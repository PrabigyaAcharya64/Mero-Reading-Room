const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions/v1");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Scheduled function to apply daily compound interest on active loans.
 * Runs every 24 hours.
 */
exports.dailyInterestTask = onSchedule("every 24 hours", async (event) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    try {
        // 1. Fetch Loan Settings from centralized config
        const settingsDoc = await db.collection('settings').doc('config').get();
        if (!settingsDoc.exists) {
            console.log("No system config found. Skipping interest calculation.");
            return;
        }

        const config = settingsDoc.data();
        const settings = config.LOAN;

        if (!settings) {
            console.log("No loan settings configured. Skipping.");
            return;
        }

        if (!settings.DAILY_INTEREST_RATE || !settings.DEADLINE_DAYS) {
            console.error("Invalid loan settings. Missing rate or deadline.");
            return;
        }

        const dailyRate = settings.DAILY_INTEREST_RATE;
        const deadlineDays = settings.DEADLINE_DAYS;

        // 2. Query users with active loans
        const usersRef = db.collection('users');
        const activeLoanUsers = await usersRef.where('loan.has_active_loan', '==', true).get();

        const batch = db.batch();
        let updateCount = 0;

        activeLoanUsers.forEach(doc => {
            const userData = doc.data();
            const loan = userData.loan;

            if (!loan || !loan.taken_at) return;

            const takenAtDate = loan.taken_at.toDate();
            const nowDate = now.toDate();

            // Calculate days elapsed
            const diffTime = Math.abs(nowDate - takenAtDate);
            const daysSinceTaken = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Only apply interest if overdue (past deadline)
            if (daysSinceTaken > deadlineDays) {
                const rateDecimal = dailyRate / 100;

                // Prevent double-charging if function retries
                const lastApplied = loan.last_interest_applied ? loan.last_interest_applied.toDate() : null;
                if (lastApplied) {
                    const hoursSinceLast = (nowDate - lastApplied) / (1000 * 60 * 60);
                    if (hoursSinceLast < 20) {
                        console.log(`Skipping user ${doc.id}, interest already applied recently.`);
                        return;
                    }
                }

                const newBalance = loan.current_balance * (1 + rateDecimal);

                batch.update(doc.ref, {
                    "loan.current_balance": newBalance,
                    "loan.last_interest_applied": now
                });
                updateCount++;
                console.log(`Applied interest for user ${doc.id}. New Balance: ${newBalance}`);
            }
        });

        if (updateCount > 0) {
            await batch.commit();
            console.log(`Successfully updated loan interest for ${updateCount} users.`);
        } else {
            console.log("No overdue loans requiring interest update.");
        }

    } catch (error) {
        console.error("Error in dailyInterestTask:", error);
    }
});

// Define the secret parameter
const brevoApiKey = defineSecret("BREVO_API_KEY");

/**
 * Generate a unique, human-readable transaction ID
 * Format: PREFIX-YYYYMMDD-RANDOM (e.g., CAN-20260202-A3X7K2)
 * @param {string} prefix - Service identifier (CAN, RDR, HST, HSR, BTU, BLD)
 * @returns {string} Unique transaction ID
 */
function generateTransactionId(prefix) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${dateStr}-${random}`;
}



/**
 * Trigger: On User Updated (2nd Gen)
 * Handles automatic role sync and Canteen Type assignment based on subscriptions.
 */
exports.onUserUpdated = onDocumentUpdated(
    {
        document: "users/{userId}",
        secrets: [brevoApiKey], // Keep secrets if needed for potential email logic, though main logic is simpler
    },
    async (event) => {
        const newData = event.data.after.data();
        const oldData = event.data.before.data();
        const userId = event.params.userId;

        if (!newData) return null;

        const db = admin.firestore();
        const batch = db.batch();
        let needsUpdate = false;
        const updates = {};

        // --- 1. Sync Role & Access Status to Custom Claims ---
        const roleChanged = newData.role !== oldData.role;
        const paymentChanged = newData.nextPaymentDue !== oldData.nextPaymentDue;

        if (roleChanged || paymentChanged) {
            try {
                const claims = {
                    role: newData.role || 'client'
                };

                if (newData.nextPaymentDue) {
                    const nextDueMillis = new Date(newData.nextPaymentDue).getTime();
                    if (!isNaN(nextDueMillis)) {
                        claims.nextPaymentDue = Math.floor(nextDueMillis / 1000);
                    }
                }

                await admin.auth().setCustomUserClaims(userId, claims);
                console.log(`Synced claims for ${userId}:`, claims);
            } catch (error) {
                console.error(`Error syncing claims for ${userId}:`, error);
            }
        }

        // --- 2. Automated Canteen Type Assignment ---
        // Logic:
        // - If Admin/Canteen/Staff role -> Preserve existing type (or default to 'staff'/'mrr' if missing)
        // - If MANUAL override (canteen_type_manual === true) -> Preserve existing type.
        // - If Client:
        //   - Has Active Hostel (currentHostelRoom) -> 'mrr_hostel' (Covers both & hostel-only)
        //   - Has Active MRR (currentSeat) -> 'mrr'
        //   - Else -> 'mrr' (Default for verified)

        const currentType = newData.canteen_type;
        const isManual = newData.canteen_type_manual === true;
        let newType = 'mrr'; // Default

        // Check explicit roles or MANUAL flag that might override logic
        const userRole = newData.role || 'client';

        if (isManual) {
            // Respect manual override
            newType = currentType;
        } else if (userRole === 'admin' || userRole === 'canteen') {
            // Admins usually see everything, but let's keep what's set or default to 'mrr'
            // If they manually set 'staff', keep it?
            // Let's rely on manual setting for special roles.
            // But if undefined, default to 'mrr'.
            if (!currentType) newType = 'mrr';
            else newType = currentType;
        } else if (currentType === 'staff') {
            // Keep existing 'staff' check as a fallback if manual flag isn't used yet for staff
            newType = 'staff';
        } else {
            // Standard Automation for Clients
            const hasHostel = !!newData.currentHostelRoom;
            const hasMRR = !!newData.currentSeat;

            if (hasHostel) {
                newType = 'mrr_hostel';
            } else if (hasMRR) {
                newType = 'mrr';
            } else {
                newType = 'mrr';
            }
        }

        // Apply Update if changed
        if (newType !== currentType) {
            console.log(`Auto-assigning canteen_type for ${userId}: ${currentType} -> ${newType} (Manual: ${isManual})`);
            // If manual, we shouldn't be here unless currentType was undefined, but logic above handles it.
            // If isManual is true, strictly newType === currentType, so this block won't run.
            updates.canteen_type = newType;
            needsUpdate = true;
        }

        // --- 3. Handle Verification Email (Legacy Logic moved here) ---
        if (newData.verified === true && oldData.verified !== true) {
            const userEmail = newData.email;
            const userName = newData.name;

            if (userEmail) {
                try {
                    const brevoKey = brevoApiKey.value();
                    if (brevoKey) {
                        await fetch("https://api.brevo.com/v3/smtp/email", {
                            method: "POST",
                            headers: {
                                "accept": "application/json",
                                "api-key": brevoKey,
                                "content-type": "application/json"
                            },
                            body: JSON.stringify({
                                templateId: 2,
                                to: [{ email: userEmail, name: userName }],
                                params: { FULLNAME: userName }
                            })
                        });
                        console.log(`Verification email sent to ${userEmail}`);
                    }
                } catch (error) {
                    console.error("Error sending email:", error);
                }
            }
        }

        if (needsUpdate) {
            // Use event.data.after.ref to update to avoid stale writes?
            // Actually, we should just return the update promise.
            // CAUTION: Writing back to the same document triggers the function again.
            // We guarded with `if (newType !== currentType)`.
            // So the next run will see them equal and stop.
            return event.data.after.ref.update(updates);
        }

        return null;
    }
);

/**
 * Trigger: On User Created (1st Gen Background)
 * Assigns roles based on email using Custom Claims.
 * Compatible with all Firebase plans.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    const email = user.email ? user.email.toLowerCase().trim() : null;
    let role = null;

    if (email === 'headmrr@gmail.com') {
        role = 'admin';
    } else if (email === 'canteenmrr@gmail.com') {
        role = 'canteen';
    }

    if (role) {
        try {
            // Set Custom Claims
            await admin.auth().setCustomUserClaims(user.uid, { role: role });
            console.log(`Assigned role ${role} to user ${user.uid}`);

            // Update Firestore document for sync/rules
            await admin.firestore().collection('users').doc(user.uid).set({
                role: role,
                verified: true,
                updatedAt: new Date().toISOString()
            }, { merge: true });

        } catch (error) {
            console.error(`Error assigning role to user ${user.uid}:`, error);
        }
    }
    return null;
});

/**
 * Callable function to assign a seat (2nd Gen).
 * Prevents race conditions by using a transaction.
 */
exports.assignSeat = onCall(async (request) => {
    // Check authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { userId, seatId, roomId } = request.data;

    if (!userId || !seatId || !roomId) {
        throw new HttpsError('invalid-argument', 'Missing required fields: userId, seatId, roomId');
    }

    const db = admin.firestore();
    const roomRef = db.collection('readingRooms').doc(roomId);
    const userRef = db.collection('users').doc(userId);

    return db.runTransaction(async (transaction) => {
        // 1. Check if the seat is already assigned in seatAssignments
        const assignmentsRef = db.collection('seatAssignments');
        const q = assignmentsRef.where('roomId', '==', roomId).where('seatId', '==', seatId);
        const snapshot = await transaction.get(q);

        if (!snapshot.empty) {
            // Check if it's the SAME user (re-assignment or idempotent retry)
            const existing = snapshot.docs[0].data();
            if (existing.userId === userId) {
                return { success: true, message: "Seat already assigned to this user." };
            }
            throw new HttpsError('aborted', 'Seat is already occupied.');
        }

        // 2. Get User and Room data
        const userDoc = await transaction.get(userRef);
        const roomDoc = await transaction.get(roomRef);

        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User not found');
        }
        if (!roomDoc.exists) {
            throw new HttpsError('not-found', 'Room not found');
        }

        const userData = userDoc.data();
        const roomData = roomDoc.data();
        const seat = (roomData.elements || []).find(e => e.id === seatId);

        if (!seat) {
            throw new HttpsError('not-found', 'Seat not found in room');
        }

        // 3. Create Seat Assignment
        const newAssignmentRef = assignmentsRef.doc(); // Auto-ID
        transaction.set(newAssignmentRef, {
            userId: userId,
            userName: userData.name || 'Unknown',
            userMrrNumber: userData.mrrNumber || 'N/A',
            roomId: roomId,
            roomName: roomData.name,
            seatId: seatId,
            seatLabel: seat.label,
            assignedAt: new Date().toISOString(),
            assignedBy: request.auth.uid
        });

        // 4. Update User Profile
        let nextPaymentDue = userData.nextPaymentDue;
        let lastPaymentDate = userData.lastPaymentDate;

        if (!nextPaymentDue) {
            // Store ISO strings in Firestore, they will be converted to Unix for claims in onUserVerified
            nextPaymentDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            lastPaymentDate = new Date().toISOString();
        }

        transaction.set(userRef, {
            registrationCompleted: true,
            enrollmentCompleted: true,
            currentSeat: {
                roomId: roomId,
                roomName: roomData.name,
                seatId: seatId,
                seatLabel: seat.label
            },
            nextPaymentDue: nextPaymentDue,
            lastPaymentDate: lastPaymentDate,
            selectedRoomType: roomData.type
        }, { merge: true });

        return { success: true, assignmentId: newAssignmentRef.id };
    }).then(async (result) => {
        // After transaction succeeds, set custom claims for nextPaymentDue
        // This is required for Firestore security rules (hasActiveAccess function)
        try {
            const nextPaymentDueTimestamp = Math.floor(new Date(nextPaymentDue).getTime() / 1000);


            const userRecord = await admin.auth().getUser(userId);
            const existingClaims = userRecord.customClaims || {};

            await admin.auth().setCustomUserClaims(userId, {
                ...existingClaims,
                nextPaymentDue: nextPaymentDueTimestamp
            });
            console.log(`Set custom claims for user ${userId}: nextPaymentDue=${nextPaymentDueTimestamp}`);
        } catch (claimError) {
            console.error(`Error setting custom claims for user ${userId}:`, claimError);
            // Don't fail the whole operation if claim setting fails
        }
        return result;
    });
});

/**
 * Callable function to upload images to ImgBB (2nd Gen).
 * Secures the ImgBB API key on the server.
 */
const imgbbApiKey = defineSecret("IMGBB_API_KEY");

exports.uploadImage = onCall(
    { secrets: [imgbbApiKey] },
    async (request) => {
        // Check authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { base64Image } = request.data;

        if (!base64Image) {
            throw new HttpsError('invalid-argument', 'Missing required field: base64Image');
        }

        try {
            const apiKey = imgbbApiKey.value();

            if (!apiKey) {
                console.error("IMGBB_API_KEY secret not found.");
                throw new HttpsError('internal', 'Image upload service not configured.');
            }

            // Create FormData for ImgBB API
            const formData = new FormData();
            formData.append('image', base64Image);

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                return { success: true, url: data.data.url };
            } else {
                console.error("ImgBB upload error:", data);
                throw new HttpsError('internal', `Upload failed: ${data.error?.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Error uploading to ImgBB:", error);
            throw new HttpsError('internal', 'Error uploading image. Please try again.');
        }
    }
);

/**
 * Callable function to send invoice email with PDF attachment (2nd Gen).
 * Secures the Brevo API key on the server.
 */
exports.sendInvoiceEmail = onCall(
    { secrets: [brevoApiKey] },
    async (request) => {
        // Check authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { userData, invoiceData, pdfBase64, transactionId } = request.data;

        if (!userData || !invoiceData || !pdfBase64 || !transactionId) {
            throw new HttpsError('invalid-argument', 'Missing required fields: userData, invoiceData, pdfBase64, transactionId');
        }

        const db = admin.firestore();

        try {
            // 1. Create Invoice Record First (Atomic-ish)
            const invoiceRef = db.collection('invoices').doc();
            const now = new Date().toISOString();

            await invoiceRef.set({
                userId: request.auth.uid,
                transactionId: transactionId,
                invoiceNumber: invoiceData.invoiceNumber,
                createdAt: now,
                sentAt: now,
                status: 'sent'
            });

            // 2. Update Transaction with Invoice ID
            await db.collection('transactions').doc(transactionId).update({
                invoiceSent: true,
                invoiceId: invoiceRef.id,
                invoiceSentAt: now
            });

            const apiKey = brevoApiKey.value();

            if (!apiKey) {
                console.error("BREVO_API_KEY secret not found.");
                throw new HttpsError('internal', 'Email service not configured.');
            }

            const isHostel = invoiceData.invoiceNumber?.includes('-HST-') || invoiceData.invoiceNumber?.includes('-HSR-');
            const packageName = invoiceData.details ||
                (isHostel ? 'Hostel Accommodation Plan' : `${invoiceData.roomType === 'ac' ? 'AC' : 'Non-AC'} Reading Room Package`);

            const emailBody = `
      <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #f9f9f9; padding: 50px 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 40px; border: 1px solid #eeeeee; border-radius: 8px;">
          <div style="margin-bottom: 40px; text-align: center;">
            <h1 style="font-size: 24px; font-weight: 700; margin: 0;">Mero Reading Room</h1>
          </div>
          <h2 style="font-size: 24px; font-weight: 700; color: #000000; margin-bottom: 10px;">Purchase Successful</h2>
          <p style="font-size: 16px; color: #444444; line-height: 1.6;">
            Hi <strong>${userData.name}</strong>, thank you for your purchase! We've received your payment for the <strong>${packageName}</strong>.
          </p>
          
          <div style="background-color: #fcfcfc; border: 1px solid #eeeeee; padding: 20px; border-radius: 4px; margin: 30px 0;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #666666; padding-bottom: 8px;">Invoice Number</td>
                <td style="text-align: right; font-weight: 600;">${invoiceData.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="color: #666666;">Amount Paid</td>
                <td style="text-align: right; font-weight: 600;">Rs. ${invoiceData.amount.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 16px; color: #444444;">
            Your official invoice is attached to this email as a PDF for your records.
          </p>
          <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #eeeeee;">
            <p style="font-size: 14px; color: #888888; margin-bottom: 4px;">Questions?</p>
            <p style="font-size: 14px; color: #000000; font-weight: 500;">
              Contact us at <a href="mailto:headmrr@gmail.com" style="color: #000; text-decoration: underline;">headmrr@gmail.com</a> or call <strong>9867666655</strong>.
            </p>
          </div>
        </div>
        <p style="text-align: center; font-size: 12px; color: #999999; margin-top: 20px;">
          © ${new Date().getFullYear()} Mero Reading Room. Mid Baneshwor, Kathmandu.
        </p>
      </div>
    `;

            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                body: JSON.stringify({
                    sender: {
                        name: 'Mero Reading Room',
                        email: 'headmrr@gmail.com'
                    },
                    to: [
                        {
                            email: userData.email,
                            name: userData.name
                        }
                    ],
                    subject: `Invoice ${invoiceData.invoiceNumber} - Mero Reading Room`,
                    htmlContent: emailBody,
                    attachment: [
                        {
                            name: `Invoice-${invoiceData.invoiceNumber}.pdf`,
                            content: pdfBase64
                        }
                    ]
                })
            });

            if (response.ok) {
                return {
                    success: true,
                    message: `Invoice sent to ${userData.email}`,
                    invoiceId: invoiceRef.id
                };
            } else {
                const errorData = await response.json();
                console.error("Brevo API Error:", errorData);
                throw new HttpsError('internal', `Email failed: ${errorData.message || 'Unknown error'}`);
            }

        } catch (error) {
            console.error("Error sending invoice email:", error);
            throw new HttpsError('internal', 'Error sending invoice email. Please try again.');
        }
    }
);


async function sendPushNotification(userId, title, body, data = {}) {
    const logPrefix = `[Push-${userId}]`;
    console.log(`${logPrefix} START`);

    if (!userId || !title || !body) {
        console.error(`${logPrefix} FAILED: Missing fields`);
        return { success: false, error: 'missing_fields' };
    }

    try {
        const userDoc = await admin.firestore().collection('users').doc(userId).get();

        if (!userDoc.exists) {
            console.error(`${logPrefix} FAILED: User not found`);
            return { success: false, error: 'user_not_found' };
        }

        const userData = userDoc.data();
        const tokens = userData.pushTokens || [];

        if (tokens.length === 0) {
            console.log(`${logPrefix} ABORT: No tokens`);
            return { success: false, error: 'no_tokens' };
        }

        // Sanitize data payload
        const safeData = {};
        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                if (value === null || value === undefined) return;
                safeData[key] = String(value);
            });
        }

        const message = {
            tokens: tokens,
            notification: {
                title: title,
                body: body
            },
            data: safeData,
            android: {
                priority: 'high',
                notification: {
                    channelId: 'mrr_high_importance',
                    priority: 'max',
                    defaultSound: true,
                    visibility: 'public'
                }
            }
        };

        console.log(`${logPrefix} Payload:`, JSON.stringify(message, null, 2));

        const response = await admin.messaging().sendEachForMulticast(message);

        console.log(`${logPrefix} Result: ${response.successCount} OK, ${response.failureCount} Fail`);

        // Handle invalid tokens
        if (response.failureCount > 0) {
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        invalidTokens.push(tokens[idx]);
                    }
                }
            });

            if (invalidTokens.length > 0) {
                await admin.firestore().collection('users').doc(userId).update({
                    pushTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
                });
            }
        }

        return {
            success: response.successCount > 0,
            successCount: response.successCount,
            failureCount: response.failureCount,
            response: response
        };

    } catch (error) {
        console.error(`${logPrefix} CRITICAL ERROR:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Trigger: On Notification Created
 * Automatically sends a push notification to the user when an in-app notification is created.
 */
// HTTP Function for debugging Push Notifications
const cors = require('cors')({ origin: true });

exports.testPush = onRequest(async (request, response) => {
    return cors(request, response, async () => {
        const userId = request.query.uid;
        if (!userId) {
            response.status(400).send("Missing 'uid' query parameter.");
            return;
        }

        try {
            const userDoc = await admin.firestore().collection('users').doc(userId).get();
            if (!userDoc.exists) {
                response.status(404).json({ success: false, error: `User ${userId} not found.` });
                return;
            }

            const userData = userDoc.data();
            const tokens = userData.pushTokens || [];

            if (tokens.length === 0) {
                response.json({ success: false, error: `User ${userId} has 0 tokens. Cannot send.` });
                return;
            }

            const message = {
                tokens: tokens,
                notification: {
                    title: "Test Debug",
                    body: "Direct HTTP Test"
                },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'mrr_high_importance',
                        priority: 'max',
                        defaultSound: true,
                        visibility: 'public'
                    }
                }
            };

            const fcmResponse = await admin.messaging().sendEachForMulticast(message);

            response.json({
                success: true,
                user: userId,
                tokenCount: tokens.length,
                fcmResponse: fcmResponse
            });
        } catch (error) {
            console.error("Test Push Error:", error);
            response.status(500).json({ error: error.message, stack: error.stack });
        }
    });
});

/**
 * Trigger: On Notification Created
 * Automatically sends a push notification to the user when an in-app notification is created.
 */
exports.onNotificationCreated = onDocumentCreated("notifications/{notifId}", async (event) => {
    const data = event.data.data();
    const userId = data.userId;
    const title = data.title || "New Notification";
    const body = data.message || "You have a new update.";

    // Only include essential, serializable fields in data payload
    // DO NOT spread entire document - it contains Firestore Timestamps that break Android notifications
    const dataPayload = {
        type: data.type || 'general',
        notifId: event.params.notifId,
        // Only include simple string/number fields, NO Timestamps or complex objects
        ...(data.relatedId && { relatedId: String(data.relatedId) }),
        ...(data.orderId && { orderId: String(data.orderId) }),
        ...(data.refundId && { refundId: String(data.refundId) })
    };

    console.log(`New notification document detected (${event.params.notifId}). Routing to push service...`);

    const result = await sendPushNotification(userId, title, body, dataPayload);

    // DEBUG: Update the notification document with the push result
    // This allows us to verify if the trigger ran and if it succeeded
    try {
        await event.data.ref.update({
            pushStatus: result.success ? 'sent' : 'failed',
            pushDebug: {
                attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
                successCount: result.successCount || 0,
                failureCount: result.failureCount || 0,
                error: result.error || null
            }
        });
        console.log(`Updated notification ${event.params.notifId} with push status.`);
    } catch (dbError) {
        console.error("Failed to update notification with debug status:", dbError);
    }

    return null;
});

/**
 * Trigger: On Order Updated
 * Sends notification when order status changes to 'completed'.
 */
exports.onOrderUpdated = onDocumentUpdated("orders/{orderId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const orderId = event.params.orderId;

    if (newData.status === 'completed' && oldData.status !== 'completed') {
        const userId = newData.userId;
        const userName = newData.userName || 'Reader';

        console.log(`Order ${orderId} completed. Creating notification for ${userId}`);

        const configDoc = await admin.firestore().collection('settings').doc('config').get();
        const sysConfig = configDoc.exists ? configDoc.data() : {};
        const notificationsConfig = sysConfig.NOTIFICATIONS || {};

        const title = notificationsConfig.ORDER_READY_TITLE || "Order Ready!";
        const message = (notificationsConfig.ORDER_READY_BODY || "Hello {{name}}, your canteen order is ready for pickup.").replace(/\{\{name\}\}/g, userName);

        // Create notification in Firestore
        // This will trigger 'onNotificationCreated' which sends the push
        await admin.firestore().collection('notifications').add({
            userId: userId,
            title: title,
            message: message,
            type: 'order',
            orderId: orderId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });
    }

    // Add logic for 'preparing' if needed, or other status changes
    if (newData.status === 'preparing' && oldData.status !== 'preparing') {
        const userId = newData.userId;
        const userName = newData.userName || 'Reader';
        console.log(`Order ${orderId} preparing. Creating notification for ${userId}`);

        const configDoc = await admin.firestore().collection('settings').doc('config').get();
        const sysConfig = configDoc.exists ? configDoc.data() : {};
        const notificationsConfig = sysConfig.NOTIFICATIONS || {};

        const title = notificationsConfig.ORDER_PREPARING_TITLE || "Order Preparing 🍳";
        const message = (notificationsConfig.ORDER_PREPARING_BODY || "Your order is now being prepared.").replace(/\{\{name\}\}/g, userName);

        await admin.firestore().collection('notifications').add({
            userId: userId,
            title: title,
            message: message,
            type: 'order',
            orderId: orderId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });
    }

    return null;
});

/**
 * Trigger: On Announcement Created
 * Broadcasts the announcement to ALL users.
 */
exports.onAnnouncementCreated = onDocumentCreated("announcements/{id}", async (event) => {
    const data = event.data.data();
    if (!data) return;

    const text = data.text;
    const title = data.title || "New Announcement";

    if (!text) return;

    console.log(`[Announcement] New announcement: ${text}. Preparing broadcast...`);

    try {
        // Fetch all users who have push tokens
        const snapshot = await admin.firestore().collection('users').get();

        let allTokens = [];
        snapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
                allTokens.push(...userData.pushTokens);
            }
        });

        if (allTokens.length === 0) {
            console.log("[Announcement] No tokens found in database.");
            return;
        }

        // Deduplicate tokens
        allTokens = [...new Set(allTokens)];
        console.log(`[Announcement] Broadcasting to ${allTokens.length} tokens.`);

        // Send in batches of 500 (FCM limit)
        const batchSize = 500;
        const promises = [];

        for (let i = 0; i < allTokens.length; i += batchSize) {
            const batchTokens = allTokens.slice(i, i + batchSize);

            const message = {
                tokens: batchTokens,
                notification: {
                    title: title,
                    body: text
                },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'mrr_high_importance',
                        priority: 'max',
                        defaultSound: true,
                        visibility: 'public'
                    }
                }
            };

            // DEBUG: Log the exact FCM message being sent for announcements
            console.log(`[Announcement] Sending FCM message to ${batchTokens.length} tokens:`, JSON.stringify(message, null, 2));

            promises.push(admin.messaging().sendEachForMulticast(message));
        }

        const results = await Promise.all(promises);
        results.forEach((res, idx) => {
            console.log(`[Announcement] Batch ${idx + 1}: ${res.successCount} sent, ${res.failureCount} failed.`);
        });

    } catch (error) {
        console.error("[Announcement] Error broadcasting:", error);
    }
});

/**
 * Trigger: On Refund Updated
 * Notifies user when their refund request is approved or rejected.
 */
exports.onRefundUpdated = onDocumentUpdated("refunds/{refundId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const refundId = event.params.refundId;

    // Check if status changed
    if (newData.status !== oldData.status) {
        const userId = newData.userId;
        const status = newData.status; // 'approved', 'rejected', 'completed'

        const configDoc = await admin.firestore().collection('settings').doc('config').get();
        const sysConfig = configDoc.exists ? configDoc.data() : {};
        const notificationsConfig = sysConfig.NOTIFICATIONS || {};

        let title = "Refund Update";
        let body = `Your refund request has been updated to: ${status}`;

        if (status === 'completed' || status === 'approved') {
            title = notificationsConfig.REFUND_APPROVED_TITLE || "Refund Approved";
            const amount = newData.finalRefundAmount || newData.amount;
            body = (notificationsConfig.REFUND_APPROVED_BODY || "Your refund of Rs. {{amount}} has been approved/completed.").replace(/\{\{amount\}\}/g, amount);
        } else if (status === 'rejected') {
            title = notificationsConfig.REFUND_REJECTED_TITLE || "Refund Rejected";
            const reason = newData.rejectionReason || 'Contact admin';
            body = (notificationsConfig.REFUND_REJECTED_BODY || "Your refund request was rejected. Reason: {{reason}}").replace(/\{\{reason\}\}/g, reason);
        }

        console.log(`Refund ${refundId} status ${status}. creating notification for user ${userId}`);

        // Create notification in Firestore
        // This will trigger 'onNotificationCreated' which sends the push
        await admin.firestore().collection('notifications').add({
            userId: userId,
            title: title,
            message: body,
            type: 'refund',
            refundId: refundId,
            status: status,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });
    }
    return null;
});

/**
 * Scheduled function to check for expired memberships daily at midnight.
 * Applies fines for standard policy, removes seat for 'daily' policy.
 */
exports.checkStatusExpiration = onSchedule("0 0 * * *", async (event) => {
    const db = admin.firestore();
    const now = new Date();
    const today = now.toISOString();

    try {
        // Fetch fine rates from config
        const configDoc = await db.collection('settings').doc('config').get();
        const sysConfig = configDoc.exists ? configDoc.data() : {};
        const rrDailyFine = sysConfig.READING_ROOM?.DAILY_FINE || 5;
        const hostelDailyFine = sysConfig.HOSTEL?.DAILY_FINE || 5;

        const batch = db.batch();
        let operationsCount = 0;

        // --- 0. Send 3-Day Expiration Warnings ---
        // Calculate target date: Today + 3 days
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 3);
        const targetDateISO = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

        // Construct query range for that specific day
        // We look for nextPaymentDue strings that start with targetDateISO
        // Or strictly >= startOfDay AND <= endOfDay
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const notificationsConfig = sysConfig.NOTIFICATIONS || {};

        // Warning for Reading Room
        const warningQuery = db.collection('users')
            .where('nextPaymentDue', '>=', startOfDay.toISOString())
            .where('nextPaymentDue', '<=', endOfDay.toISOString())
            .where('enrollmentCompleted', '==', true);

        const warningSnapshot = await warningQuery.get();

        for (const userDoc of warningSnapshot.docs) {
            const userData = userDoc.data();
            const title = notificationsConfig.EXPIRY_WARNING_TITLE || "Membership Expiring Soon";
            const message = (notificationsConfig.EXPIRY_WARNING_BODY || "Hi {{name}}, your Reading Room package expires in 3 days. Please renew to avoid interruption.").replace(/\{\{name\}\}/g, userData.name || 'Reader');

            await db.collection('notifications').add({
                userId: userDoc.id,
                title: title,
                message: message,
                type: 'enrollment',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        }

        // Warning for Hostel
        const hostelWarningQuery = db.collection('users')
            .where('hostelNextPaymentDue', '>=', startOfDay.toISOString())
            .where('hostelNextPaymentDue', '<=', endOfDay.toISOString())
            .where('hostelRegistrationPaid', '==', true);

        const hostelWarningSnapshot = await hostelWarningQuery.get();

        for (const userDoc of hostelWarningSnapshot.docs) {
            const userData = userDoc.data();
            const title = notificationsConfig.HOSTEL_EXPIRY_WARNING_TITLE || "Hostel Rent Due Soon";
            const message = (notificationsConfig.HOSTEL_EXPIRY_WARNING_BODY || "Hi {{name}}, your Hostel rent is due in 3 days. Please pay on time to avoid fines.").replace(/\{\{name\}\}/g, userData.name || 'Resident');

            await db.collection('notifications').add({
                userId: userDoc.id,
                title: title,
                message: message,
                type: 'hostel',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        }



        const usersRef = db.collection('users');
        // Get users who are enrolled and have a payment due date in the past
        const expiredUsersQuery = usersRef
            .where('nextPaymentDue', '<', today)
            .where('enrollmentCompleted', '==', true);

        const snapshot = await expiredUsersQuery.get();

        const seatDeletions = [];

        snapshot.forEach((doc) => {
            const userData = doc.data();
            const userId = doc.id;
            const nextPaymentDue = new Date(userData.nextPaymentDue);

            // Calculate days overdue
            const diffTime = Math.abs(now - nextPaymentDue);
            const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            console.log(`Processing expiration for user: ${userId}, Overdue: ${daysOverdue} days, Policy: ${userData.expiryPolicy}`);

            // logic: If 'daily' policy -> Remove Immediately
            // logic: If 'standard' (default) -> Keep seat, Apply Fine (Rs 5/day)

            const isDailyPolicy = userData.expiryPolicy === 'daily';

            if (isDailyPolicy) {
                // Immediate Removal
                console.log(`Removing daily user ${userId}`);
                batch.update(doc.ref, {
                    enrollmentCompleted: false,
                    currentSeat: admin.firestore.FieldValue.delete(),
                    expiryPolicy: admin.firestore.FieldValue.delete(),
                    updatedAt: today
                });

                // Find and delete their seat assignments
                const assignmentsRef = db.collection('seatAssignments');
                const q = assignmentsRef.where('userId', '==', userId);
                seatDeletions.push(q.get());

            } else {
                // Standard Policy: Indefinite Grace Period with Fines
                console.log(`Applying fine to user ${userId}`);

                // Calculate fine increment (Rs 5 per day overdue)
                // If the function runs daily, we just add 5 to the existing fine.
                // However, to be robust, we can just increment by 5 each time this runs (daily).

                batch.update(doc.ref, {
                    inGracePeriod: true,
                    fineAmount: admin.firestore.FieldValue.increment(rrDailyFine),
                    updatedAt: today
                });
            }
            operationsCount++;
        });

        // --- 2. Process Hostel Expirations ---
        // Hostel users also have indefinite retention with fines
        const hostelUsersQuery = usersRef
            .where('hostelNextPaymentDue', '<', today)
            .where('hostelRegistrationPaid', '==', true); // Assuming this indicates active hostel user

        const hostelSnapshot = await hostelUsersQuery.get();

        hostelSnapshot.forEach((doc) => {
            const userData = doc.data();
            const userId = doc.id;

            // Check if actually has a room (double check)
            if (!userData.currentHostelRoom) return;

            console.log(`Processing hostel expiration for user: ${userId}`);

            // Apply Fine (Rs 5)
            batch.update(doc.ref, {
                hostelInGracePeriod: true,
                hostelFineAmount: admin.firestore.FieldValue.increment(hostelDailyFine),
                updatedAt: today
            });
            operationsCount++;
        });


        // Execute Seat Deletions (for daily users)
        const assignmentSnapshots = await Promise.all(seatDeletions);
        assignmentSnapshots.forEach(snap => {
            snap.forEach(doc => {
                batch.delete(doc.ref);
                operationsCount++;
            });
        });

        if (operationsCount > 0) {
            await batch.commit();
            console.log(`Successfully processed expirations. Operations: ${operationsCount}`);
        } else {
            console.log("No expiration actions needed today.");
        }

    } catch (error) {
        console.error("Error in checkStatusExpiration:", error);
    }
    return null;
});

/**
 * Callable function to renew reading room subscription.
 * Handles custom durations, fines, and policy updates.
 */
exports.renewReadingRoomSubscription = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated to renew.');
    }

    const { duration, durationType, roomType, userId: targetUserId } = request.data;
    // durationType: 'month' | 'day'
    // duration: number (e.g., 1, 3, 45)
    // roomType: optional, to verify rate if needed, though we usually use user's current room

    if (!duration || !durationType) {
        throw new HttpsError('invalid-argument', 'Missing duration details.');
    }

    let userId = request.auth.uid;
    const db = admin.firestore();

    // Admin override
    if (targetUserId && targetUserId !== userId) {
        const callerDoc = await db.collection('users').doc(userId).get();
        if (callerDoc.exists && callerDoc.data().role === 'admin') {
            userId = targetUserId;
        } else {
            throw new HttpsError('permission-denied', 'Only admins can renew for others.');
        }
    }

    try {
        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User not found.');
            }

            const userData = userDoc.data();

            if (!userData.currentSeat) {
                throw new HttpsError('failed-precondition', 'No active seat to renew.');
            }

            // Determine Rate
            // We need to fetch the room to get the current rate, or use a stored rate.
            // For now, let's look up the room.
            const roomRef = db.collection('readingRooms').doc(userData.currentSeat.roomId);
            const roomDoc = await transaction.get(roomRef);

            if (!roomDoc.exists) {
                throw new HttpsError('not-found', 'Assigned room not found.');
            }

            const roomData = roomDoc.data();
            const monthlyRate = roomData.price || (roomData.type === 'ac' ? 3000 : 2500); // Fallback
            const dailyRate = Math.ceil(monthlyRate / 30); // Approx daily rate or standard daily rate

            let cost = 0;
            let expiryPolicy = 'standard';
            let addedTimeMs = 0;

            if (durationType === 'month') {
                cost = monthlyRate * duration;
                addedTimeMs = duration * 30 * 24 * 60 * 60 * 1000;
                expiryPolicy = 'standard';
            } else if (durationType === 'day') {
                // If user specifically buys "days", we might treat them as 'daily' policy OR just standard extension.
                // The requirement says "ensure a custom month also like 2 months 3 months".
                // And "in the bottom add a per day also option it should have the logic like today's reading rom system after expiery remove from the seat."

                // So if they choose "Per Day" option, they become 'daily' policy user.
                cost = dailyRate * duration; // Or specific daily rate if different
                addedTimeMs = duration * 24 * 60 * 60 * 1000;
                expiryPolicy = 'daily';
            }

            // Add Fines
            const fine = userData.fineAmount || 0;
            const totalCost = cost + fine;

            // Check Balance
            if ((userData.balance || 0) < totalCost) {
                throw new HttpsError('failed-precondition', `Insufficient balance. Total needed: रु ${totalCost} (Includes fine: रु ${fine})`);
            }

            // Calculate New Expiry
            const currentDue = userData.nextPaymentDue ? new Date(userData.nextPaymentDue) : new Date();
            const now = new Date();

            // If expired, start from NOW? Or backdate? 
            // Usually, if you pay fine, you extend from NOW. 
            // If you are in grace period, valid discussion. 
            // Let's assume extending from NOW if already expired, to avoid paying for dead time + fine doubles.
            // BUT, if we just charged fines for the dead days, we should probably start from NOW.

            // Simple logic: New Due = Now + Duration. 
            // (Since fines covered the gap).

            const newDueDate = new Date(now.getTime() + addedTimeMs);

            // Update User
            transaction.update(userRef, {
                balance: (userData.balance || 0) - totalCost,
                nextPaymentDue: newDueDate.toISOString(),
                fineAmount: 0, // Clear fine
                inGracePeriod: false,
                expiryPolicy: expiryPolicy,
                updatedAt: now.toISOString()
            });

            // Create Transaction Record
            const renewalTxnId = generateTransactionId('RRE'); // Reading Room renewal
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'reading_room_renewal',
                transactionId: renewalTxnId,
                amount: totalCost,
                details: `Renewal - ${durationType === 'month' ? duration + ' Month(s)' : duration + ' Day(s)'}${fine > 0 ? ` (Fine: ${fine})` : ''}`,
                userId: userId,
                userName: userData.name || 'User',
                date: now.toISOString(),
                createdAt: now.toISOString(),
                breakdown: {
                    cost: cost,
                    fine: fine
                }
            });

            return {
                success: true,
                newBalance: (userData.balance || 0) - totalCost,
                nextPaymentDue: newDueDate.toISOString(),
                message: "Renewal successful"
            };
        });

        // Send Notification asynchronously
        try {
            await db.collection('notifications').add({
                userId: userId,
                title: 'Reading Room Subscription Renewed',
                message: `You have successfully renewed your subscription for ${duration} ${durationType === 'month' ? 'Month(s)' : 'Day(s)'}.`,
                type: 'enrollment',
                relatedId: result.transactionId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        } catch (notifError) {
            console.error('Error creating notification for reading room renewal:', notifError);
        }

        return result;
    } catch (error) {
        console.error('Error renewing subscription:', error);
        throw new HttpsError('internal', error.message || 'Renewal failed');
    }
});

/**
 * Callable function to withdraw from a service (Reading Room or Hostel).
 * Immediately removes user from the seat/room.
 */
exports.withdrawService = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated to withdraw.');
    }

    const { serviceType, userId: targetUserId } = request.data; // 'readingRoom' or 'hostel'
    let userId = request.auth.uid;
    const db = admin.firestore();

    // Admin override
    if (targetUserId && targetUserId !== userId) {
        const callerDoc = await db.collection('users').doc(userId).get();
        if (callerDoc.exists && callerDoc.data().role === 'admin') {
            userId = targetUserId;
        } else {
            throw new HttpsError('permission-denied', 'Only admins can withdraw others.');
        }
    }

    try {
        const batch = db.batch();
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get(); // No need for transaction unless we refund, which we don't usually for withdraw?
        // Let's assume no refund for voluntary withdraw unless specified.

        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User not found.');
        }
        const userData = userDoc.data();

        if (serviceType === 'readingRoom') {
            if (!userData.currentSeat) {
                throw new HttpsError('failed-precondition', 'No active reading room seat to withdraw from.');
            }

            // Remove seat assignment
            const assignmentsRef = db.collection('seatAssignments');
            const q = assignmentsRef.where('userId', '==', userId).where('roomId', '==', userData.currentSeat.roomId);
            const snapshot = await q.get();

            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Update user
            batch.update(userRef, {
                enrollmentCompleted: false,
                currentSeat: admin.firestore.FieldValue.delete(),
                inGracePeriod: false,
                fineAmount: 0, // Clear fine on exit? Or keep it? Usually clear if they leave.
                updatedAt: new Date().toISOString()
            });

        } else if (serviceType === 'hostel') {
            if (!userData.currentHostelRoom) {
                throw new HttpsError('failed-precondition', 'No active hostel room to withdraw from.');
            }

            // Logic for hostel withdraw
            // Find active assignment
            const assignmentsRef = db.collection('hostelAssignments');
            const q = assignmentsRef.where('userId', '==', userId).where('status', '==', 'active');
            const snapshot = await q.get();

            snapshot.forEach(doc => {
                batch.update(doc.ref, { status: 'withdrawn', endedAt: new Date().toISOString() });
            });

            // Update user
            batch.update(userRef, {
                currentHostelRoom: admin.firestore.FieldValue.delete(),
                hostelRegistrationPaid: true, // They paid once, so maybe keep this true
                hostelInGracePeriod: false,
                hostelFineAmount: 0,
                updatedAt: new Date().toISOString()
            });
        } else {
            throw new HttpsError('invalid-argument', 'Invalid service type.');
        }

        // --- Handle Refund Creation if Requested ---
        // --- Handle Refund Creation if Requested ---
        const { refundDetails, refundMode } = request.data; // refundMode: 'wallet' | 'cash'
        let refundToken = null;

        if (refundDetails) {
            // Generate Token Server-Side
            const uniqueSuffix = Date.now().toString().slice(-4) + Math.random().toString(36).substring(2, 4).toUpperCase();
            refundToken = `REF-${uniqueSuffix}`;

            const calculatedAmount = refundDetails.calculatedAmount || 0;

            if (refundMode === 'wallet' && calculatedAmount > 0) {
                // 1. Credit Balance Immediately
                batch.update(userRef, {
                    balance: (userData.balance || 0) + calculatedAmount,
                    updatedAt: new Date().toISOString()
                });

                // 2. Create COMPLETED Refund Record
                const refundDoc = db.collection('refunds').doc();
                batch.set(refundDoc, {
                    userId: userId,
                    userName: userData.name || 'Unknown',
                    userMrr: userData.mrrNumber || 'N/A',
                    serviceType: serviceType === 'readingRoom' ? 'reading_room' : 'hostel',
                    packagePrice: refundDetails.packagePrice || 0,
                    packageDays: refundDetails.packageDays || 30,
                    daysUsed: refundDetails.daysUsed || 0,
                    calculatedAmount: calculatedAmount,
                    finalRefundAmount: calculatedAmount,
                    status: 'completed', // Completed immediately
                    refundMode: 'wallet',
                    refundToken: refundToken,
                    createdAt: new Date().toISOString(),
                    processedAt: new Date().toISOString(),
                    processedBy: 'System (Wallet Credit)'
                });

                // 3. Create Transaction Record
                const txnRef = db.collection('transactions').doc();
                batch.set(txnRef, {
                    type: 'refund_credit',
                    transactionId: `TXN-REF-${uniqueSuffix}`,
                    amount: calculatedAmount,
                    details: `Refund Credited to Wallet - ${refundToken}`,
                    userId: userId,
                    userName: userData.name || 'Unknown',
                    date: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    status: 'completed'
                });

            } else {
                // Cash Mode (Standard Pending Request)
                const refundDoc = db.collection('refunds').doc();
                batch.set(refundDoc, {
                    userId: userId,
                    userName: userData.name || 'Unknown',
                    userMrr: userData.mrrNumber || 'N/A',
                    serviceType: serviceType === 'readingRoom' ? 'reading_room' : 'hostel',
                    packagePrice: refundDetails.packagePrice || 0,
                    packageDays: refundDetails.packageDays || 30,
                    daysUsed: refundDetails.daysUsed || 0,
                    calculatedAmount: calculatedAmount,
                    finalRefundAmount: calculatedAmount, // Admin can edit
                    status: 'pending',
                    refundMode: 'cash',
                    refundToken: refundToken, // Server-generated token
                    createdAt: new Date().toISOString()
                });
            }
        }

        await batch.commit();

        return {
            success: true,
            message: "Service withdrawn successfully.",
            refundToken: refundToken
        };

    } catch (error) {
        console.error('Error withdrawing service:', error);
        throw new HttpsError('internal', error.message || 'Withdraw failed');
    }
});

/**
 * Callable function to request a balance refund.
 * Generates token, DEDUCTS BALANCE IMMEDIATELY, and stores request securely.
 */
exports.requestBalanceRefund = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated.');
    }

    const { amount, reason } = request.data;
    const userId = request.auth.uid;
    const refundAmount = parseFloat(amount);

    if (!refundAmount || refundAmount <= 0) {
        throw new HttpsError('invalid-argument', 'Invalid amount.');
    }

    const db = admin.firestore();

    try {
        return await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User not found.');
            }

            const userData = userDoc.data();
            const currentBalance = userData.balance || 0;

            if (currentBalance < refundAmount) {
                throw new HttpsError('failed-precondition', 'Insufficient balance.');
            }

            // Generate Token
            const uniqueSuffix = Date.now().toString().slice(-4) + Math.random().toString(36).substring(2, 4).toUpperCase();
            const refundToken = `REF-${uniqueSuffix}`;
            const now = new Date().toISOString();

            // 1. Deduct Balance
            transaction.update(userRef, {
                balance: currentBalance - refundAmount,
                updatedAt: now
            });

            // 2. Create Refund Request
            const refundRef = db.collection('refunds').doc();
            transaction.set(refundRef, {
                userId: userId,
                userName: userData.name || 'Unknown',
                serviceType: 'balance_refund',
                details: reason || 'Balance Withdraw Request',
                amount: refundAmount,
                packagePrice: refundAmount, // For consistency
                calculatedAmount: refundAmount,
                finalRefundAmount: refundAmount,
                status: 'pending',
                refundToken: refundToken,
                createdAt: now
            });

            // 3. Create Transaction Record (Debit)
            const txnRef = db.collection('transactions').doc();
            transaction.set(txnRef, {
                userId: userId,
                userName: userData.name || 'Unknown',
                type: 'balance_refund_request', // Special type to indicate this deduction
                amount: refundAmount, // Should be positive or negative? Usually expenses are shown with amount, logic handles sign.
                // In this system, outflows are usually expenses.
                details: `Refund Request - ${refundToken}`,
                date: now,
                createdAt: now,
                transactionId: `TXN-REF-${uniqueSuffix}`,
                status: 'pending' // Maybe useful track that this txn corresponds to a pending refund
            });

            return {
                success: true,
                refundToken: refundToken,
                newBalance: currentBalance - refundAmount
            };
        });

    } catch (error) {
        console.error('Error requesting balance refund:', error);
        throw new HttpsError('internal', error.message || 'Refund request failed');
    }
});

exports.verifyDiscussionEligibility = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { userId } = request.data;
    if (!userId) {
        throw new HttpsError('invalid-argument', 'Missing required field: userId');
    }

    const db = admin.firestore();
    try {
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return { eligible: false, reason: "User profile not found." };
        }

        const userData = userDoc.data();
        const now = new Date();

        // 1. Check for expired membership (Adjusted for Grace Period logic)
        // If in grace period, can they book? Probably NO.
        const isExpired = userData.nextPaymentDue && new Date(userData.nextPaymentDue) < now;

        if (isExpired) {
            // Even if in grace period, they shouldn't book discussion rooms until renewed.
            return { eligible: false, reason: "Your membership has expired. Please renew to book discussion rooms." };
        }

        // 2. Check if registration is completed
        if (!userData.registrationCompleted) {
            return { eligible: false, reason: "Please complete your registration first." };
        }

        // 3. Check for an active seat
        if (!userData.currentSeat) {
            return { eligible: false, reason: "Discussion rooms are available for active reading room members only." };
        }

        return { eligible: true };

    } catch (error) {
        console.error("Error verifying eligibility:", error);
        throw new HttpsError('internal', 'Unable to verify eligibility at this time.');
    }
});

/**
 * Callable function to book a discussion room
 * Supports 7 rooms (D1-D7) with automatic assignment
 * Maximum 2 bookings per day per user
 */
exports.bookDiscussionRoom = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated to book a discussion room.');
    }

    const { date, slotId, slotLabel, teamName, members } = request.data;
    const userId = request.auth.uid;

    if (!date || !slotId || !slotLabel || !teamName || !Array.isArray(members)) {
        throw new HttpsError('invalid-argument', 'Missing required booking details.');
    }

    const ROOMS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
    const db = admin.firestore();

    try {
        const result = await db.runTransaction(async (transaction) => {
            // 1. Get all bookings for this date
            const bookingsQuery = db.collection('discussion_rooms').where('date', '==', date);
            const allBookingsSnapshot = await transaction.get(bookingsQuery);

            // 2. Count user's bookings for the day (leader or member)
            let userBookingCount = 0;
            const memberUids = members.map(m => m.uid);
            const allParticipantUids = [userId, ...memberUids];

            // Track which members already have 2+ bookings
            const memberBookingCounts = {};
            allParticipantUids.forEach(uid => {
                memberBookingCounts[uid] = 0;
            });

            // Track occupied rooms for this slot
            const occupiedRoomsForSlot = new Set();

            allBookingsSnapshot.forEach(doc => {
                const booking = doc.data();

                // Track occupied rooms for this specific slot
                if (booking.slotId === slotId) {
                    occupiedRoomsForSlot.add(booking.roomId);
                }

                // Count bookings for each participant
                if (booking.bookedBy && memberBookingCounts.hasOwnProperty(booking.bookedBy)) {
                    memberBookingCounts[booking.bookedBy]++;
                }
                if (booking.members && Array.isArray(booking.members)) {
                    booking.members.forEach(member => {
                        if (member.uid && memberBookingCounts.hasOwnProperty(member.uid)) {
                            memberBookingCounts[member.uid]++;
                        }
                    });
                }
            });

            // 3. Check if user or any member has reached max bookings (2 per day)
            for (const [uid, count] of Object.entries(memberBookingCounts)) {
                if (count >= 2) {
                    // Find the member's name for better error message
                    const member = members.find(m => m.uid === uid);
                    const userName = uid === userId ? 'You' : (member ? member.name : 'A member');
                    throw new HttpsError('failed-precondition',
                        `${userName} ${uid === userId ? 'have' : 'has'} already reached the maximum of 2 bookings per day.`);
                }
            }

            // 4. Find first available room for this slot
            let assignedRoom = null;
            for (const room of ROOMS) {
                if (!occupiedRoomsForSlot.has(room)) {
                    assignedRoom = room;
                    break;
                }
            }

            if (!assignedRoom) {
                throw new HttpsError('resource-exhausted',
                    'All discussion rooms (D1-D7) are fully booked for this time slot. Please try another slot.');
            }

            // 5. Create the booking
            const bookingDocId = `${date}_${slotId}_${assignedRoom}`;
            const bookingRef = db.collection('discussion_rooms').doc(bookingDocId);

            transaction.set(bookingRef, {
                date: date,
                slotId: slotId,
                slotLabel: slotLabel,
                roomId: assignedRoom,
                bookedBy: userId,
                bookerName: request.auth.token.name || request.auth.token.email?.split('@')[0] || 'User',
                teamName: teamName,
                members: members,
                createdAt: new Date().toISOString()
            });

            return {
                success: true,
                roomId: assignedRoom,
                bookingId: bookingDocId
            };
        });

        return result;

    } catch (error) {
        console.error('Error booking discussion room:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Failed to book discussion room.');
    }
});

/**
 * Callable function to process reading room purchase
 * Handles balance deduction, seat assignment, and payment tracking atomically
 */
exports.processReadingRoomPurchase = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated to purchase.');
    }

    const { roomType, registrationFee, monthlyFee } = request.data;

    if (!roomType || typeof registrationFee !== 'number' || typeof monthlyFee !== 'number') {
        throw new HttpsError('invalid-argument', 'Missing or invalid purchase details.');
    }

    const userId = request.auth.uid;
    const totalAmount = registrationFee + monthlyFee;
    const db = admin.firestore();

    try {
        // Run atomic transaction
        const result = await db.runTransaction(async (transaction) => {
            // 1. Get user data and validate balance
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User profile not found.');
            }

            const userData = userDoc.data();
            const currentBalance = userData.balance || 0;

            // Recalculate price with coupons
            const rawBasePrice = (roomType === 'ac' ? 3750 : 3500); // Assuming 1 month for now as param suggests
            const calcResult = await calculatePriceInternal({
                userId,
                serviceType: 'readingRoom',
                couponCode: request.data.couponCode || null,
                months: 1, // Default to 1 month for this specific function signature
                basePrice: request.data.monthlyFee || rawBasePrice, // Use passed fee or default
                db
            });

            const finalAmount = calcResult.finalPrice + (request.data.registrationFee || 0);

            if (currentBalance < finalAmount) {
                throw new HttpsError('failed-precondition', `Insufficient balance. You need रु ${finalAmount - currentBalance} more.`);
            }

            // 2. Find available seat
            const roomsSnapshot = await transaction.get(db.collection('readingRooms'));
            const rooms = roomsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(room => room.type === roomType);

            if (rooms.length === 0) {
                throw new HttpsError('not-found', `No ${roomType === 'ac' ? 'AC' : 'Non-AC'} rooms available.`);
            }

            // Get all current assignments
            const assignmentsSnapshot = await transaction.get(db.collection('seatAssignments'));
            const occupiedSeatIds = new Set(assignmentsSnapshot.docs.map(doc => doc.data().seatId));

            let assignedSeat = null;
            let assignedRoom = null;

            // Find first available seat
            for (const room of rooms) {
                const elements = room.elements || room.seats || [];
                const seats = elements.filter(e => !e.type || e.type === 'seat');
                const availableSeat = seats.find(seat => !occupiedSeatIds.has(seat.id));

                if (availableSeat) {
                    assignedSeat = availableSeat;
                    assignedRoom = room;
                    break;
                }
            }

            if (!assignedSeat) {
                throw new HttpsError('resource-exhausted', `No seats available in ${roomType === 'ac' ? 'AC' : 'Non-AC'} rooms.`);
            }

            // 3. Deduct balance
            const newBalance = currentBalance - finalAmount;

            // Update user balance and subscription
            transaction.update(userRef, {
                balance: newBalance,
                selectedRoomType: roomType,
                lastPaymentDate: new Date().toISOString(),
                nextPaymentDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date().toISOString(),
                currentSeat: {
                    roomId: assignedRoom.id,
                    roomName: assignedRoom.name,
                    seatId: assignedSeat.id,
                    seatLabel: assignedSeat.label
                },
                expiryPolicy: 'standard'
            });

            // Increment usage if coupon used
            if (calcResult.discounts && calcResult.discounts.length > 0) {
                const usedCoupon = calcResult.discounts.find(d => d.type === 'coupon');
                if (usedCoupon && usedCoupon.docId) {
                    transaction.update(db.collection('coupons').doc(usedCoupon.docId), {
                        usedCount: admin.firestore.FieldValue.increment(1)
                    });
                }
            }

            // 4. Create seat assignment
            const assignmentRef = db.collection('seatAssignments').doc();
            transaction.set(assignmentRef, {
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                userMrrNumber: userData.mrrNumber || 'N/A',
                roomId: assignedRoom.id,
                roomName: assignedRoom.name,
                seatId: assignedSeat.id,
                seatLabel: assignedSeat.label,
                assignedAt: new Date().toISOString(),
                assignedBy: 'system',
                status: 'active'
            });

            // 5. Create transaction record
            const readingRoomTxnId = generateTransactionId('RDR');
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'reading_room',
                transactionId: readingRoomTxnId,
                amount: finalAmount,
                originalAmount: (request.data.monthlyFee || rawBasePrice) + (request.data.registrationFee || 0),
                couponCode: request.data.couponCode || null,
                breakdown: {
                    basePrice: request.data.monthlyFee || rawBasePrice,
                    registrationFee: request.data.registrationFee || 0,
                    discounts: calcResult.discounts
                },
                details: `${roomType === 'ac' ? 'AC' : 'Non-AC'} Room Fee`,
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                roomType: roomType,
                month: new Date().toLocaleString('default', { month: 'short' })
            });

            return {
                success: true,
                newBalance: newBalance,
                transactionId: transactionRef.id,
                seatInfo: {
                    roomId: assignedRoom.id,
                    roomName: assignedRoom.name,
                    seatId: assignedSeat.id,
                    seatLabel: assignedSeat.label
                },
                needsEnrollment: !userData.registrationCompleted
            };
        });

        // After transaction succeeds, set custom claims for nextPaymentDue
        // This is required for Firestore security rules (hasActiveAccess function)
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            if (userData && userData.nextPaymentDue) {
                const nextPaymentDueTimestamp = Math.floor(new Date(userData.nextPaymentDue).getTime() / 1000);

                // Get existing custom claims to merge with them (preserve role, etc.)
                const userRecord = await admin.auth().getUser(userId);
                const existingClaims = userRecord.customClaims || {};

                await admin.auth().setCustomUserClaims(userId, {
                    ...existingClaims,
                    nextPaymentDue: nextPaymentDueTimestamp
                });
                console.log(`Set custom claims for user ${userId}: nextPaymentDue=${nextPaymentDueTimestamp}`);
            }
        } catch (claimError) {
            console.error(`Error setting custom claims for user ${userId}:`, claimError);
            // Don't fail the whole operation if claim setting fails
        }

        // Send Notification asynchronously
        try {
            await db.collection('notifications').add({
                userId,
                title: 'Reading Room Subscription Active',
                message: `You have successfully subscribed to ${roomType === 'ac' ? 'AC' : 'Non-AC'} Reading Room.`,
                type: 'enrollment',
                relatedId: result.transactionId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        } catch (notifError) {
            console.error('Error creating notification for reading room purchase:', notifError);
        }

        return result;

    } catch (error) {
        console.error('Error processing reading room purchase:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Failed to process purchase.');
    }
});


/**
 * Callable function to process canteen order
 * Handles balance deduction, stock updates, and order creation atomically
 * Supports proxy orders if targetUserId is provided and caller is authorized
 */
exports.processCanteenOrder = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated to place order.');
    }

    const { cart, note, targetUserId } = request.data;
    const callerId = request.auth.uid;
    let userIdToCharge = callerId;
    let isProxyOrder = false;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
        throw new HttpsError('invalid-argument', 'Cart is empty or invalid.');
    }

    const db = admin.firestore();

    try {
        // Handle Proxy Order logic
        if (targetUserId && targetUserId !== callerId) {
            // Verify caller has permission to place proxy orders
            // Check both token (claims) and document for consistency with security rules
            const tokenRole = request.auth.token.role;
            let callerRole = tokenRole;

            if (!callerRole) {
                const callerDoc = await db.collection('users').doc(callerId).get();
                callerRole = callerDoc.exists ? callerDoc.data().role : null;
            }

            if (callerRole !== 'admin' && callerRole !== 'canteen') {
                console.error(`User ${callerId} attempted proxy order for ${targetUserId} but is not authorized. Role: ${callerRole}`);
                throw new HttpsError('permission-denied', 'Unauthorized to place proxy orders.');
            }
            userIdToCharge = targetUserId;
            isProxyOrder = true;
        }

        const result = await db.runTransaction(async (transaction) => {
            // 1. Get user and validate balance
            const userRef = db.collection('users').doc(userIdToCharge);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User profile not found.');
            }

            const userData = userDoc.data();
            const currentBalance = userData.balance || 0;

            // Calculate total
            const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

            const itemIds = [...new Set(cart.map(i => i.id))];
            const menuRefs = itemIds.map(id => db.collection('menuItems').doc(id));
            const menuSnaps = await transaction.getAll(...menuRefs);
            const menuMap = new Map();
            menuSnaps.forEach(snap => {
                if (snap.exists) menuMap.set(snap.id, snap.data());
            });

            // Validate Access
            for (const item of cart) {
                const menuData = menuMap.get(item.id);
                if (menuData) {
                    const targetTypes = menuData.targetTypes || [];
                    const userCanteenType = userData.canteen_type || 'mrr';

                    if (targetTypes.length > 0 && !targetTypes.includes(userCanteenType)) {
                        throw new HttpsError('permission-denied', `You are not authorized to order "${item.name}".`);
                    }
                }
            }

            // Apply Staff Discount
            let adjustedTotal = total;
            const staffDiscounts = [];

            if ((userData.canteen_type || 'mrr') === 'staff') {
                const configRef = db.collection('settings').doc('config');
                const configDoc = await transaction.get(configRef);

                if (configDoc.exists) {
                    const configData = configDoc.data();
                    const discountPercent = configData.CANTEEN_DISCOUNTS?.staff || 0;

                    if (discountPercent > 0) {
                        const discountAmount = Math.round(total * (discountPercent / 100));
                        adjustedTotal = Math.max(0, total - discountAmount);
                        staffDiscounts.push({
                            id: 'staff_discount',
                            name: `Staff Discount (${discountPercent}%)`,
                            amount: discountAmount,
                            type: 'automated'
                        });
                    }
                }
            }


            // 2. Validate and reserve stock
            const stockUpdates = [];

            for (const item of cart) {
                if (item.stockRefId) {
                    const stockRef = db.collection('canteen_items').doc(item.stockRefId);
                    const stockDoc = await transaction.get(stockRef);

                    if (!stockDoc.exists) {
                        throw new HttpsError('not-found', `Item "${item.name}" not found in inventory.`);
                    }

                    const stockData = stockDoc.data();
                    const currentStock = stockData.stockCount || 0;

                    if (currentStock < item.quantity) {
                        throw new HttpsError('resource-exhausted', `"${item.name}" is currently out of stock.`);
                    }

                    stockUpdates.push({
                        ref: stockRef,
                        newStock: currentStock - item.quantity
                    });
                }
            }

            // 3. Calculate Final Price with Coupon (on top of staff discount)
            const calcResult = await calculatePriceInternal({
                userId: userIdToCharge,
                serviceType: 'canteen',
                couponCode: request.data.couponCode || null,
                months: 1,
                basePrice: adjustedTotal, // Use discounted total as base
                db
            });
            const finalTotal = calcResult.finalPrice;

            if (currentBalance < finalTotal) {
                throw new HttpsError('failed-precondition', isProxyOrder ? 'Client has insufficient balance.' : 'Insufficient balance.');
            }

            // 4. Execute all updates atomically
            const newBalance = currentBalance - finalTotal;

            // Increment coupon usage
            if (calcResult.discounts && calcResult.discounts.length > 0) {
                const usedCoupon = calcResult.discounts.find(d => d.type === 'coupon');
                if (usedCoupon && usedCoupon.docId) {
                    transaction.update(db.collection('coupons').doc(usedCoupon.docId), {
                        usedCount: admin.firestore.FieldValue.increment(1)
                    });
                }
            }

            // Combine discounts for record
            const allDiscounts = [...staffDiscounts, ...(calcResult.discounts || [])];

            // Update balance
            transaction.update(userRef, {
                balance: newBalance,
                updatedAt: new Date().toISOString()
            });

            // Update stock
            stockUpdates.forEach(update => {
                transaction.update(update.ref, { stockCount: update.newStock });
            });

            // Create order
            const canteenTxnId = generateTransactionId('CAN');
            const orderRef = db.collection('orders').doc();
            transaction.set(orderRef, {
                userId: userIdToCharge,
                userEmail: userData.email || null,
                userName: userData.name || userData.displayName || 'Reader',
                items: cart,
                total: finalTotal, // Final price after all discounts
                originalTotal: total, // Original price
                status: 'pending',
                note: note || null,
                location: null,
                createdAt: new Date().toISOString(),
                transactionId: canteenTxnId,
                isProxyOrder: isProxyOrder,
                processedBy: isProxyOrder ? callerId : null,
                couponCode: request.data.couponCode || null,
                breakdown: {
                    discounts: allDiscounts
                }
            });

            return {
                success: true,
                orderId: orderRef.id,
                newBalance: newBalance
            };
        });

        // Send Notification asynchronously
        try {
            await db.collection('notifications').add({
                userId: userIdToCharge, // Use the user who paid/ordered
                title: 'Order Placed Successfully',
                message: `Your canteen order has been received and is pending approval.`,
                type: 'order',
                orderId: result.orderId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        } catch (notifError) {
            console.error('Error creating notification for canteen order:', notifError);
        }

        return result;

    } catch (error) {
        console.error('Error processing canteen order:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Failed to process order.');
    }
});

/**
 * Callable function to top up user balance (Admin only)
 */
exports.topUpBalance = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated.');
    }

    // Check if caller is admin
    const callerToken = await admin.auth().getUser(request.auth.uid);
    const callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const callerRole = callerDoc.exists ? callerDoc.data().role : null;

    if (callerRole !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can top up balance.');
    }

    const { userId, amount } = request.data;

    if (!userId || typeof amount !== 'number' || amount <= 0) {
        throw new HttpsError('invalid-argument', 'Invalid user ID or amount.');
    }

    const db = admin.firestore();

    try {
        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User not found.');
            }

            const userData = userDoc.data();
            const currentBalance = userData.balance || 0;
            let finalAmountToAdd = amount;
            let loanDeduction = 0;
            const now = new Date().toISOString();
            const topUpTxnId = generateTransactionId('BTU');

            // --- Loan Auto-Deduction ---
            if (userData.loan && userData.loan.has_active_loan) {
                const loanBalance = userData.loan.current_balance || 0;
                if (loanBalance > 0) {
                    loanDeduction = Math.min(amount, loanBalance);
                    finalAmountToAdd = amount - loanDeduction;

                    const newLoanBalance = loanBalance - loanDeduction;
                    const loanStatus = newLoanBalance <= 0 ? 'repaid' : 'active';

                    transaction.update(userRef, {
                        'loan.current_balance': newLoanBalance,
                        'loan.status': loanStatus,
                        'loan.has_active_loan': loanStatus === 'active'
                    });

                    // Create Loan Repayment Transaction
                    if (loanDeduction > 0) {
                        const repaymentTxnId = generateTransactionId('LRP');
                        const repaymentRef = db.collection('transactions').doc();
                        transaction.set(repaymentRef, {
                            type: 'loan_repayment',
                            transactionId: repaymentTxnId,
                            amount: loanDeduction,
                            details: 'Auto-deduction from Top-up',
                            userId: userId,
                            userName: userData.name || 'User',
                            date: now,
                            createdAt: now,
                            relatedTransactionId: topUpTxnId
                        });
                    }
                }
            }

            const newBalance = currentBalance + finalAmountToAdd;

            transaction.update(userRef, {
                balance: newBalance,
                updatedAt: now
            });

            // Create Top-up transaction record
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'balance_topup',
                transactionId: topUpTxnId,
                amount: amount,
                details: 'Admin Balance Top-up',
                userId: userId,
                userName: userData.name || 'User',
                date: now,
                createdAt: now,
                adminId: request.auth.uid,
                loanDeducted: loanDeduction
            });

            return {
                success: true,
                newBalance: newBalance,
                transactionId: transactionRef.id,
                loanDeducted: loanDeduction
            };
        });

        // Send Notification asynchronously
        try {
            await db.collection('notifications').add({
                userId: userId,
                title: 'Balance Top-up Successful',
                message: `Your balance has been topped up by रु ${amount}.${result.loanDeducted > 0 ? ' (Loan deducted: रु ' + result.loanDeducted + ')' : ''}`,
                type: 'balance',
                transactionId: result.transactionId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        } catch (notifError) {
            console.error('Error creating notification for balance top-up:', notifError);
        }

        return result;

    } catch (error) {
        console.error('Error topping up balance:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to top up balance.');
    }
});

/**
 * Trigger: On Balance Request Updated
 * Sends notification when request status changes to 'approved'.
 */
exports.onBalanceRequestUpdated = onDocumentUpdated("balanceRequests/{requestId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const requestId = event.params.requestId;

    // Check if status changed to 'approved'
    if (newData.status === 'approved' && oldData.status !== 'approved') {
        const userId = newData.userId;
        const amount = newData.amount;
        const loanDeducted = newData.loanDeducted || 0; // Retrieve stored deduction or default to 0

        console.log(`Balance request ${requestId} approved. Creating notification for ${userId}`);

        const configDoc = await admin.firestore().collection('settings').doc('config').get();
        const sysConfig = configDoc.exists ? configDoc.data() : {};
        const notificationsConfig = sysConfig.NOTIFICATIONS || {};

        const title = notificationsConfig.BALANCE_LOADED_TITLE || 'Balance Loaded Successfully';
        const loanInfo = loanDeducted > 0 ? `(रु ${loanDeducted} deducted for loan)` : '';
        const message = (notificationsConfig.BALANCE_LOADED_BODY || "रु {{amount}} has been added to your wallet. {{loanInfo}}")
            .replace(/\{\{amount\}\}/g, amount)
            .replace(/\{\{loanInfo\}\}/g, loanInfo)
            .trim(); // Trim in case {{loanInfo}} is empty and leaves a trailing space

        // Create notification in Firestore
        // This will trigger 'onNotificationCreated' which sends the push
        await admin.firestore().collection('notifications').add({
            userId: userId,
            title: title,
            message: message,
            type: 'balance',
            relatedId: requestId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false
        });
    }
    return null;
});

/**
 * Callable function to approve balance load requests
 * Verifies admin, updates transaction, and increments user balance
 */
exports.approveBalanceLoad = onCall(async (request) => {
    // Check authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { requestId } = request.data;
    if (!requestId) {
        throw new HttpsError('invalid-argument', 'Missing required field: requestId');
    }

    const db = admin.firestore();

    // Check if caller is admin
    const callerRef = db.collection('users').doc(request.auth.uid);
    const callerDoc = await callerRef.get();

    // Check custom claims or firestore role
    const isAdmin = request.auth.token.role === 'admin' || (callerDoc.exists && callerDoc.data().role === 'admin');

    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'Only admins can approve balance loads.');
    }

    try {
        return await db.runTransaction(async (transaction) => {
            // 1. Get the request document
            const requestRef = db.collection('balanceRequests').doc(requestId);
            const requestDoc = await transaction.get(requestRef);

            if (!requestDoc.exists) {
                throw new HttpsError('not-found', 'Balance request not found.');
            }

            const requestData = requestDoc.data();

            if (requestData.status !== 'pending') {
                throw new HttpsError('failed-precondition', 'Request is already processed.');
            }

            const amount = requestData.amount;
            const userId = requestData.userId;

            // 2. Get the user document
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User not found.');
            }

            const userData = userDoc.data();
            const currentBalance = userData.balance || 0;
            let finalAmountToAdd = amount;
            let loanDeduction = 0;
            const now = new Date().toISOString();
            const balanceLoadTxnId = generateTransactionId('BLD');

            // --- Loan Auto-Deduction ---
            if (userData.loan && userData.loan.has_active_loan) {
                const loanBalance = userData.loan.current_balance || 0;
                if (loanBalance > 0) {
                    loanDeduction = Math.min(amount, loanBalance);
                    finalAmountToAdd = amount - loanDeduction;

                    const newLoanBalance = loanBalance - loanDeduction;
                    const loanStatus = newLoanBalance <= 0 ? 'repaid' : 'active';

                    transaction.update(userRef, {
                        'loan.current_balance': newLoanBalance,
                        'loan.status': loanStatus,
                        'loan.has_active_loan': loanStatus === 'active'
                    });

                    // Create Loan Repayment Transaction
                    if (loanDeduction > 0) {
                        const repaymentTxnId = generateTransactionId('LRP');
                        const repaymentRef = db.collection('transactions').doc();
                        transaction.set(repaymentRef, {
                            type: 'loan_repayment',
                            transactionId: repaymentTxnId,
                            amount: loanDeduction,
                            details: 'Auto-deduction from Mobile Banking Load',
                            userId: userId,
                            userName: userData.name || userData.displayName || 'User',
                            date: now,
                            createdAt: now,
                            relatedRequestId: requestId
                        });
                    }
                }
            }

            const newBalance = currentBalance + finalAmountToAdd;

            // 3. Update User Balance
            transaction.update(userRef, {
                balance: newBalance,
                updatedAt: now
            });

            // 4. Update Request Status - AND STORE LOAN DEDUCTION FOR TRIGGER
            transaction.update(requestRef, {
                status: 'approved',
                approvedBy: request.auth.uid,
                approvedAt: now,
                loanDeducted: loanDeduction // Important: The trigger needs this for the message
            });

            // 5. Create Transaction Record
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'balance_load',
                transactionId: balanceLoadTxnId,
                amount: amount,
                details: 'Wallet Top-up (Mobile Banking)',
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                date: now,
                createdAt: now,
                method: 'mobile_banking',
                requestId: requestId,
                status: 'completed',
                loanDeducted: loanDeduction
            });

            // 6. Notification is now handled by 'onBalanceRequestUpdated' trigger
            // This ensures manual approvals (if any) also trigger notifications.


            return { success: true, newBalance, loanDeducted: loanDeduction };
        });
    } catch (error) {
        console.error("Error approving balance load:", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Details: ' + error.message);
    }
});
/**
 * Callable function to process hostel room purchase
 * Handles balance deduction, room assignment, and payment tracking
 */
exports.processHostelPurchase = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated to purchase hostel room.');
    }

    const { buildingId, roomType, months, couponCode } = request.data;
    const userId = request.auth.uid;

    if (!buildingId || !roomType || !months || months < 1) {
        throw new HttpsError('invalid-argument', 'Missing or invalid purchase details.');
    }

    const db = admin.firestore();

    try {
        const result = await db.runTransaction(async (transaction) => {
            // 1. Get user data
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User profile not found.');
            }

            const userData = userDoc.data();
            const currentBalance = userData.balance || 0;
            const isFirstTime = !userData.hostelRegistrationPaid;


            const roomsSnapshot = await transaction.get(
                db.collection('hostelRooms')
                    .where('buildingId', '==', buildingId)
                    .where('type', '==', roomType)
            );

            if (roomsSnapshot.empty) {
                throw new HttpsError('not-found', `No rooms found for the selected type in ${buildingId}.`);
            }

            const availableRooms = roomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const monthlyRate = availableRooms[0].price;

            // 3. Calculate costs (Base)
            // Note: We need to use the helper to get the ACTUAL discounted price.
            // We'll call the helper here. Since it does async reads, it's fine.
            const basePrice = monthlyRate * months;

            // Call Helper
            // WARNING: calculatePriceInternal assumes db.collection... which is non-transactional read.
            // This is okay for "settings" and "coupons" usually.
            const calcResult = await calculatePriceInternal({
                userId,
                serviceType: 'hostel',
                couponCode,
                months,
                basePrice,
                db
            });

            const monthlyTotal = calcResult.finalPrice; // This is the discounted monthly total
            const registrationFee = isFirstTime ? 4000 : 0;
            const deposit = isFirstTime ? 5000 : 0;
            const totalCost = monthlyTotal + registrationFee + deposit;

            if (currentBalance < totalCost) {
                throw new HttpsError('failed-precondition',
                    `Insufficient balance. You need रु ${totalCost - currentBalance} more.`);
            }

            // 4. Find available bed
            const assignmentsSnapshot = await transaction.get(db.collection('hostelAssignments'));
            const occupiedBeds = new Map();

            assignmentsSnapshot.docs.forEach(doc => {
                const assignment = doc.data();
                if (assignment.status === 'active') {
                    const key = `${assignment.roomId}_${assignment.bedNumber}`;
                    occupiedBeds.set(key, true);
                }
            });

            let assignedRoom = null;
            let assignedBed = null;

            // Find first available bed
            for (const room of availableRooms) {
                for (let bedNum = 1; bedNum <= room.capacity; bedNum++) {
                    const key = `${room.id}_${bedNum}`;
                    if (!occupiedBeds.has(key)) {
                        assignedRoom = room;
                        assignedBed = bedNum;
                        break;
                    }
                }
                if (assignedRoom) break;
            }

            if (!assignedRoom) {
                throw new HttpsError('resource-exhausted',
                    `No beds available in ${roomType} rooms. Please try a different room type.`);
            }

            // 5. Deduct balance
            const newBalance = currentBalance - totalCost;
            const nextPaymentDue = new Date();
            nextPaymentDue.setDate(nextPaymentDue.getDate() + (months * 30));

            transaction.update(userRef, {
                balance: newBalance,
                currentHostelRoom: {
                    buildingId: assignedRoom.buildingId,
                    buildingName: assignedRoom.buildingName,
                    roomId: assignedRoom.id,
                    roomLabel: assignedRoom.label,
                    roomType: assignedRoom.type,
                    bedNumber: assignedBed
                },
                hostelNextPaymentDue: nextPaymentDue.toISOString(),
                hostelRegistrationPaid: true,
                hostelDepositPaid: isFirstTime ? 5000 : userData.hostelDepositPaid,
                hostelMonthlyRate: monthlyRate,
                updatedAt: new Date().toISOString()
            });

            // 6. Create hostel assignment
            const assignmentRef = db.collection('hostelAssignments').doc();
            transaction.set(assignmentRef, {
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                userMrrNumber: userData.mrrNumber || 'N/A',
                buildingId: assignedRoom.buildingId,
                buildingName: assignedRoom.buildingName,
                roomId: assignedRoom.id,
                roomLabel: assignedRoom.label,
                roomType: assignedRoom.type,
                bedNumber: assignedBed,
                monthlyRate: monthlyRate,
                assignedAt: new Date().toISOString(),
                nextPaymentDue: nextPaymentDue.toISOString(),
                status: 'active'
            });

            // 7. Create transaction record
            const transactionRef = db.collection('transactions').doc();
            const transactionDetails = isFirstTime
                ? `Hostel ${assignedRoom.buildingName} - ${assignedRoom.label} (${months} month${months > 1 ? 's' : ''}) + Registration + Deposit`
                : `Hostel ${assignedRoom.buildingName} - ${assignedRoom.label} (${months} month${months > 1 ? 's' : ''})`;

            const hostelTxnId = generateTransactionId('HST');
            transaction.set(transactionRef, {
                type: 'hostel',
                transactionId: hostelTxnId,
                amount: totalCost,
                details: transactionDetails,
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                buildingId: assignedRoom.buildingId,
                roomType: assignedRoom.type,
                months: months,
                couponCode: couponCode || null, // Track used coupon
                breakdown: {
                    monthlyRate: monthlyRate,
                    basePrice: basePrice,
                    discountedPrice: monthlyTotal,
                    registrationFee: registrationFee,
                    deposit: deposit,
                    discounts: calcResult.discounts
                }
            });

            // 8. Increment Coupon Usage Counter (if coupon used)
            // Note: calcResult.discounts contains applied discounts.
            // Find if a coupon was actually applied (it might have been invalid or replaced).
            const appliedCoupon = calcResult.discounts.find(d => d.type === 'coupon');
            if (appliedCoupon && appliedCoupon.docId) {
                const couponRef = db.collection('coupons').doc(appliedCoupon.docId);
                transaction.update(couponRef, {
                    usedCount: admin.firestore.FieldValue.increment(1)
                });
            }

            return {
                success: true,
                newBalance: newBalance,
                transactionId: transactionRef.id,
                assignmentId: assignmentRef.id,
                roomInfo: {
                    buildingId: assignedRoom.buildingId,
                    buildingName: assignedRoom.buildingName,
                    roomId: assignedRoom.id,
                    roomLabel: assignedRoom.label,
                    roomType: assignedRoom.type,
                    bedNumber: assignedBed,
                    monthlyRate: monthlyRate
                },
                nextPaymentDue: nextPaymentDue.toISOString()
            };
        });

        // Send Notification asynchronously
        try {
            await db.collection('notifications').add({
                userId: userId,
                title: 'Hostel Room Booked',
                message: `You have successfully booked ${result.roomInfo.roomLabel} (${result.roomInfo.roomType}).`,
                type: 'hostel',
                transactionId: result.transactionId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        } catch (notifError) {
            console.error('Error creating notification for hostel purchase:', notifError);
        }

        return result;

    } catch (error) {
        console.error('Error processing hostel purchase:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Failed to process hostel purchase.');
    }
});

/**
 * Callable function to get roommates for a given room
 */
exports.getHostelRoommates = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated.');
    }

    const { roomId } = request.data;

    if (!roomId) {
        throw new HttpsError('invalid-argument', 'Missing room ID.');
    }

    const db = admin.firestore();

    try {
        const assignmentsSnapshot = await db.collection('hostelAssignments')
            .where('roomId', '==', roomId)
            .where('status', '==', 'active')
            .get();

        const roommates = [];
        assignmentsSnapshot.forEach(doc => {
            const assignment = doc.data();
            roommates.push({
                userId: assignment.userId,
                userName: assignment.userName,
                userMrrNumber: assignment.userMrrNumber,
                bedNumber: assignment.bedNumber
            });
        });

        // Sort by bed number
        roommates.sort((a, b) => a.bedNumber - b.bedNumber);

        return { success: true, roommates };

    } catch (error) {
        console.error('Error fetching roommates:', error);
        throw new HttpsError('internal', 'Failed to fetch roommates.');
    }
});

/**
 * Callable function to renew hostel subscription
 */
exports.renewHostelSubscription = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated.');
    }

    const { months, userId: targetUserId } = request.data;
    let userId = request.auth.uid;

    if (!months || months < 1) {
        throw new HttpsError('invalid-argument', 'Invalid number of months.');
    }

    const db = admin.firestore();

    // Admin override
    if (targetUserId && targetUserId !== userId) {
        const callerDoc = await db.collection('users').doc(userId).get();
        if (callerDoc.exists && callerDoc.data().role === 'admin') {
            userId = targetUserId;
        } else {
            throw new HttpsError('permission-denied', 'Only admins can renew for others.');
        }
    }

    try {
        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User not found.');
            }

            const userData = userDoc.data();

            if (!userData.currentHostelRoom) {
                throw new HttpsError('failed-precondition', 'No active hostel booking found.');
            }

            const currentBalance = userData.balance || 0;
            const monthlyRate = userData.hostelMonthlyRate || 0;
            const renewalCost = monthlyRate * months;

            if (currentBalance < renewalCost) {
                throw new HttpsError('failed-precondition',
                    `Insufficient balance. You need रु ${renewalCost - currentBalance} more.`);
            }

            // Calculate new payment due date
            const currentDue = new Date(userData.hostelNextPaymentDue);
            const now = new Date();
            const baseDate = currentDue > now ? currentDue : now;
            const newDueDate = new Date(baseDate);
            newDueDate.setDate(newDueDate.getDate() + (months * 30));

            // Update user
            const newBalance = currentBalance - renewalCost;
            transaction.update(userRef, {
                balance: newBalance,
                hostelNextPaymentDue: newDueDate.toISOString(),
                updatedAt: new Date().toISOString()
            });

            // Update assignment
            const assignmentQuery = db.collection('hostelAssignments')
                .where('userId', '==', userId)
                .where('status', '==', 'active');
            const assignmentSnapshot = await transaction.get(assignmentQuery);

            if (!assignmentSnapshot.empty) {
                const assignmentRef = assignmentSnapshot.docs[0].ref;
                transaction.update(assignmentRef, {
                    nextPaymentDue: newDueDate.toISOString()
                });
            }

            // Create transaction
            const renewalTxnId = generateTransactionId('HSR');
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'hostel_renewal',
                transactionId: renewalTxnId,
                amount: renewalCost,
                details: `Hostel Renewal - ${userData.currentHostelRoom.roomLabel} (${months} month${months > 1 ? 's' : ''})`,
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                months: months
            });

            return {
                success: true,
                newBalance: newBalance,
                nextPaymentDue: newDueDate.toISOString(),
                transactionId: transactionRef.id
            };
        });

        // Send Notification asynchronously
        try {
            await db.collection('notifications').add({
                userId: userId,
                title: 'Hostel Subscription Renewed',
                message: `You have successfully renewed your hostel subscription for ${months} Month(s).`,
                type: 'hostel',
                transactionId: result.transactionId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        } catch (notifError) {
            console.error('Error creating notification for hostel renewal:', notifError);
        }

        return result;

    } catch (error) {
        console.error('Error renewing hostel subscription:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Failed to renew subscription.');
    }
});

/**
 * Calculate Payment with Discounts & Coupons
 * Validates coupons, checks automated rules, and returns final price.
 */
exports.calculatePayment = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated.');
    }

    const { userId, serviceType, couponCode, months = 1, roomType, amount } = request.data;
    // serviceType: 'readingRoom' | 'hostel' | 'canteen'

    if (!userId || !serviceType) {
        console.error("calculatePayment Missing Fields:", { userId, serviceType, data: request.data });
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User not found.');
    }
    const userData = userDoc.data();

    // --- 1. Base Price Fetching ---
    let basePrice = 0;
    let basePriceLabel = '';

    if (serviceType === 'readingRoom') {
        const isAc = roomType === 'ac';
        basePrice = (isAc ? 3750 : 3500) * months;
        basePriceLabel = `${isAc ? 'AC' : 'Non-AC'} Reading Room (${months} months)`;
    } else if (serviceType === 'hostel') {
        // Fetch accurate price if details provided
        if (request.data.buildingId && request.data.roomType) {
            const roomsSnapshot = await db.collection('hostelRooms')
                .where('buildingId', '==', request.data.buildingId)
                .where('type', '==', request.data.roomType)
                .limit(1)
                .get();

            if (!roomsSnapshot.empty) {
                const roomData = roomsSnapshot.docs[0].data();
                basePrice = roomData.price * months;
                basePriceLabel = `Hostel Room (${months} months)`;
            } else {
                // Fallback if not found (should not happen if frontend is correct)
                basePrice = 14500 * months;
                basePriceLabel = `Hostel Room (Est.)`;
            }
        } else {
            // Fallback for generic estimate
            basePrice = 14500 * months;
            basePriceLabel = `Hostel Room (Base)`;
        }
    } else if (serviceType === 'canteen') {
        // For canteen, base price is the cart total passed from client (validated later in processOrder)
        // Here we just use it for estimation
        if (typeof amount !== 'number' || amount < 0) {
            throw new HttpsError('invalid-argument', 'Invalid amount for canteen order.');
        }
        basePrice = amount;
        basePriceLabel = 'Canteen Order Total';
    } else {
        console.error("Invalid service type received:", serviceType);
        throw new HttpsError('invalid-argument', `Invalid service type for discount calculation: ${serviceType}`);
    }

    try {
        const result = await calculatePriceInternal({
            userId,
            serviceType,
            couponCode,
            months,
            basePrice,
            db
        });

        return {
            success: true,
            basePrice: basePrice, // Renamed from originalPrice for consistency
            finalPrice: result.finalPrice,
            discounts: result.discounts,
            basePriceLabel: basePriceLabel, // Renamed from label for consistency
            totalDiscount: result.totalDiscount, // Added totalDiscount
            currency: 'NPR' // Kept currency
        };
    } catch (e) {
        throw new HttpsError('invalid-argument', e.message);
    }
});

/**
 * Shared Helper: Calculate Final Price with Discounts
 * Used by calculatePayment (UI) and processHostelPurchase (Transaction)
 */
async function calculatePriceInternal({ userId, serviceType, couponCode, months, basePrice, db }) {
    const discounts = [];

    // 1. Fetch Dynamic Settings
    let discountSettings = {
        REFERRAL_PERCENT: 5,
        BULK_PERCENT: 10,
        BUNDLE_FIXED: 500,
        LOYALTY_THRESHOLD: 50
    };

    try {
        const settingsDoc = await db.collection('settings').doc('discounts').get();
        if (settingsDoc.exists) {
            discountSettings = { ...discountSettings, ...settingsDoc.data() };
        }
    } catch (e) {
        console.error("Error fetching discount settings:", e);
    }

    // 2. Automated Discounts

    // A. Bulk Discount (6+ months)
    if (months >= 6) {
        const amount = Math.round(basePrice * (discountSettings.BULK_PERCENT / 100));
        discounts.push({
            id: 'auto_bulk',
            name: `Bulk Discount (${months}+ months)`,
            amount: amount,
            type: 'automated'
        });
    }

    // B. Bundle Discount (Check active services)
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
        const userData = userDoc.data();
        if (serviceType === 'hostel' && userData.currentSeat) {
            discounts.push({
                id: 'auto_bundle',
                name: 'Bundle Discount (Active Reading Room)',
                amount: discountSettings.BUNDLE_FIXED,
                type: 'automated'
            });
        } else if (serviceType === 'readingRoom' && userData.currentHostelRoom) {
            discounts.push({
                id: 'auto_bundle',
                name: 'Bundle Discount (Active Hostel)',
                amount: discountSettings.BUNDLE_FIXED,
                type: 'automated'
            });
        }
    }

    // 3. Coupon Validation
    if (couponCode) {
        const couponRef = db.collection('coupons').where('code', '==', couponCode).limit(1);
        const couponSnap = await couponRef.get();

        if (!couponSnap.empty) {
            const couponDoc = couponSnap.docs[0];
            const coupon = couponDoc.data();
            const now = new Date().toISOString();

            let isValid = true;
            let invalidReason = '';

            if (coupon.expiryDate && coupon.expiryDate < now) { isValid = false; invalidReason = 'Coupon expired'; }
            if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) { isValid = false; invalidReason = 'Coupon limit reached'; }
            if (coupon.applicableServices && !coupon.applicableServices.includes(serviceType)) { isValid = false; invalidReason = 'Not applicable for this service'; }
            if (coupon.minAmount && basePrice < coupon.minAmount) { isValid = false; invalidReason = `Min spend ${coupon.minAmount} required`; }

            if (isValid) {
                // Check stackable
                const hasAutomated = discounts.length > 0;
                if (!coupon.stackable && hasAutomated) {
                    discounts.length = 0; // Clear automated if not stackable
                }

                let amount = 0;
                if (coupon.type === 'percentage') {
                    amount = Math.round(basePrice * (coupon.value / 100));
                } else {
                    amount = coupon.value;
                }

                discounts.push({
                    id: couponDoc.id,
                    name: `Coupon (${couponCode})`,
                    amount: amount,
                    type: 'coupon',
                    code: couponCode,
                    docId: couponDoc.id // Needed for incrementing usage
                });
            } else {
                throw new Error(invalidReason);
            }
        } else {
            throw new Error('Invalid coupon code');
        }
    }

    const totalDiscount = discounts.reduce((sum, d) => sum + d.amount, 0);
    const finalPrice = Math.max(0, basePrice - totalDiscount);

    return { discounts, totalDiscount, finalPrice };
}

/**
 * Callable function to request a loan.
 * Validates eligibility and performs atomic update.
 */
exports.requestLoan = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated to request loan.');
    }

    const { amount } = request.data;
    const loanAmount = parseFloat(amount);
    const userId = request.auth.uid;

    if (!loanAmount || isNaN(loanAmount) || loanAmount <= 0) {
        throw new HttpsError('invalid-argument', 'Invalid loan amount.');
    }

    const db = admin.firestore();

    try {
        return await db.runTransaction(async (transaction) => {
            // 1. Fetch System Config & User Data
            const configRef = db.collection('settings').doc('config');
            const userRef = db.collection('users').doc(userId);

            const [configDoc, userDoc] = await Promise.all([
                transaction.get(configRef),
                transaction.get(userRef)
            ]);

            if (!configDoc.exists) {
                throw new HttpsError('failed-precondition', 'System configuration missing.');
            }
            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User not found.');
            }

            const config = configDoc.data();
            const userData = userDoc.data();
            const loanSettings = config.LOAN || {};
            const maxAmount = loanSettings.MAX_AMOUNT || 0;

            // 2. Validate Eligibility
            if (userData.loan && userData.loan.has_active_loan) {
                throw new HttpsError('failed-precondition', 'You already have an active loan.');
            }

            if (loanAmount > maxAmount) {
                throw new HttpsError('invalid-argument', `Loan amount cannot exceed रु ${maxAmount}`);
            }

            // Check if balance is low enough (< 50)
            const currentBalance = userData.balance || 0;
            if (currentBalance >= 50) {
                throw new HttpsError('failed-precondition', 'Loan is only available if balance is less than रु 50.');
            }

            // 3. Disburse Loan
            const newBalance = currentBalance + loanAmount;
            const now = admin.firestore.Timestamp.now();

            transaction.update(userRef, {
                balance: newBalance,
                loan: {
                    has_active_loan: true,
                    loan_amount: loanAmount,
                    current_balance: loanAmount,
                    taken_at: now,
                    last_interest_applied: now,
                    status: 'active'
                }
            });

            // 4. Create Transaction Record
            const txnId = generateTransactionId('LOAN');
            const txnRef = db.collection('transactions').doc(txnId);

            transaction.set(txnRef, {
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                type: 'loan_disbursement',
                amount: loanAmount,
                details: 'Loan Taken',
                status: 'completed',
                date: now,
                createdAt: now,
                transactionId: txnId
            });

            return { success: true, message: "Loan approved and credited." };
        });

    } catch (error) {
        console.error("Loan Request Error:", error);
        if (error.code && error.code.startsWith('functions/')) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Loan request failed.');
    }
});
/**
 * Callable function to request a balance refund/withdrawal.
 * Deducts balance immediately and creates a pending refund request.
 */
exports.requestBalanceRefund = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated to request refund.');
    }

    const { amount, reason, refundMode } = request.data;
    const refundAmount = parseFloat(amount);
    const userId = request.auth.uid;

    if (!refundAmount || isNaN(refundAmount) || refundAmount <= 0) {
        throw new HttpsError('invalid-argument', 'Invalid refund amount.');
    }

    const db = admin.firestore();

    try {
        return await db.runTransaction(async (transaction) => {
            // 1. Get User Data
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new HttpsError('not-found', 'User not found.');
            }

            const userData = userDoc.data();
            const currentBalance = userData.balance || 0;

            // 2. Check Sufficient Balance
            if (currentBalance < refundAmount) {
                throw new HttpsError('failed-precondition', 'Insufficient balance for refund.');
            }

            // 3. Deduct Balance
            const newBalance = currentBalance - refundAmount;
            const now = new Date().toISOString();

            transaction.update(userRef, {
                balance: newBalance,
                updatedAt: now
            });

            // 4. Create Refund Request
            const refundRef = db.collection('refunds').doc();
            const refundToken = Math.random().toString(36).substring(2, 8).toUpperCase();

            transaction.set(refundRef, {
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                userMrrNumber: userData.mrrNumber || 'N/A',
                amount: refundAmount,
                reason: reason || 'Balance Withdrawal',
                refundMode: refundMode || 'cash',
                status: 'pending',
                refundToken: refundToken,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                serviceType: 'balance_refund'
            });

            // 5. Create Transaction Record (Debit)
            const webTxnId = generateTransactionId('REF');
            const txnRef = db.collection('transactions').doc();

            transaction.set(txnRef, {
                type: 'refund_request',
                transactionId: webTxnId,
                amount: refundAmount,
                details: 'Balance Refund Request',
                status: 'pending', // Pending until admin approves/pays out? Or completed deduction?
                // Usually for accounting, money is "gone" from wallet, so might show as separate or just deduction.
                // Let's mark as 'pending' status but it effectively reduced balance.
                userId: userId,
                userName: userData.name || 'User',
                date: now,
                createdAt: now,
                relatedRefundId: refundRef.id
            });

            return {
                success: true,
                message: "Refund request submitted.",
                refundToken: refundToken,
                newBalance: newBalance
            };
        });

    } catch (error) {
        console.error("Refund Request Error:", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Refund request failed.');
    }
});

/**
 * Scheduled function to send SMS notifications for expiry warnings and grace period endings.
 * Runs hourly but sends only at the configured hour.
 */
const diceUsername = defineSecret("DICE_USERNAME");
const dicePassword = defineSecret("DICE_PASSWORD");
// Keeping API key for backward compatibility if needed, though plan is to replace usage
const diceApiKey = defineSecret("DICE_API_KEY");

/**
 * Helper to get authentication token from DiCE SMS
 */
async function getDiceToken(username, password) {
    try {
        const response = await fetch("https://dicesms.asia/api/api-token-auth/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[getDiceToken] Failed to get token: ${response.status} - ${errorText}`);
            return null;
        }

        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error("[getDiceToken] Error getting token:", error);
        return null;
    }
}

exports.sendExpirySms = onSchedule(
    {
        schedule: "0 * * * *",
        secrets: [diceApiKey, diceUsername, dicePassword]
    },
    async (event) => {
        const db = admin.firestore();
        const KATHMANDU_TZ = "Asia/Kathmandu";

        try {
            // 1. Fetch SMS Settings
            const configDoc = await db.collection('settings').doc('config').get();
            if (!configDoc.exists) {
                console.log("Settings config not found.");
                return;
            }

            const config = configDoc.data();
            const smsSettings = config.SMS;

            if (!smsSettings || !smsSettings.SEND_HOUR) {
                console.log("SMS settings or SEND_HOUR not configured.");
                return;
            }

            // 2. Check Execution Time
            const now = new Date();
            // Parse hour reliably in Kathmandu Time
            const currentHour = parseInt(new Intl.DateTimeFormat('en-US', {
                timeZone: KATHMANDU_TZ,
                hour: 'numeric',
                hour12: false
            }).format(now));

            // config.SMS.SEND_HOUR should be stored as integer e.g., 9 or 15
            if (currentHour !== parseInt(smsSettings.SEND_HOUR)) {
                console.log(`Current hour (${currentHour}) does not match send hour (${smsSettings.SEND_HOUR}). Skipping.`);
                return;
            }

            const username = diceUsername.value();
            const password = dicePassword.value();

            let token = null;

            if (username && password) {
                token = await getDiceToken(username, password);
                if (token) {
                    console.log(`[sendExpirySms] Retrieved dynamic token. Starts with: ${token.substring(0, 4)}***`);
                } else {
                    console.warn("[sendExpirySms] Failed to retrieve dynamic token. Checking for API Key fallback...");
                }
            } else {
                console.warn("[sendExpirySms] DICE_USERNAME or DICE_PASSWORD not configured.");
            }

            // Fallback to API Key if token retrieval failed
            if (!token) {
                const apiKey = diceApiKey.value();
                if (apiKey) {
                    token = apiKey;
                    console.log(`[sendExpirySms] Falling back to DICE_API_KEY.`);
                } else {
                    console.error("SMS Configuration Error: No credentials or API Key found.");
                    return;
                }
            }

            console.log("Starting SMS Notification Job...");

            // 3. Calculate Date Ranges
            const getDayRange = (offsetDays) => {
                const kathmanduDateStr = new Intl.DateTimeFormat('en-US', {
                    timeZone: KATHMANDU_TZ,
                    year: 'numeric', month: 'numeric', day: 'numeric'
                }).format(new Date());

                const [month, day, year] = kathmanduDateStr.split('/');
                const ktmDate = new Date(year, month - 1, day);
                ktmDate.setDate(ktmDate.getDate() + offsetDays);

                const tYear = ktmDate.getFullYear();
                const tMonth = String(ktmDate.getMonth() + 1).padStart(2, '0');
                const tDay = String(ktmDate.getDate()).padStart(2, '0');
                const targetDateStr = `${tYear}-${tMonth}-${tDay}`;

                return { start: targetDateStr, end: `${targetDateStr}T23:59:59.999Z` };
            };

            const warningRange = getDayRange(3);  // +3 Days
            const graceRange = getDayRange(-3);   // -3 Days (Grace End)

            console.log(`Checking Warning Range: ${warningRange.start} - ${warningRange.end}`);
            console.log(`Checking Grace Range: ${graceRange.start} - ${graceRange.end}`);

            // 4. Run Queries
            const usersRef = db.collection('users');

            const [
                rrWarningSnapshot, rrGraceSnapshot,
                hostelWarningSnapshot, hostelGraceSnapshot
            ] = await Promise.all([
                // Reading Room Queries
                usersRef.where('nextPaymentDue', '>=', warningRange.start)
                    .where('nextPaymentDue', '<=', warningRange.end)
                    .get(),
                usersRef.where('nextPaymentDue', '>=', graceRange.start)
                    .where('nextPaymentDue', '<=', graceRange.end)
                    .get(),
                // Hostel Queries
                usersRef.where('hostelNextPaymentDue', '>=', warningRange.start)
                    .where('hostelNextPaymentDue', '<=', warningRange.end)
                    .get(),
                usersRef.where('hostelNextPaymentDue', '>=', graceRange.start)
                    .where('hostelNextPaymentDue', '<=', graceRange.end)
                    .get()
            ]);

            console.log(`Found: RR Warn(${rrWarningSnapshot.size}), RR Grace(${rrGraceSnapshot.size}), Hostel Warn(${hostelWarningSnapshot.size}), Hostel Grace(${hostelGraceSnapshot.size})`);

            // 5. Build Notifications
            const notifications = [];

            // Helper to add to list
            const processSnapshot = (snapshot, template, dateField = 'nextPaymentDue', type = 'Plan') => {
                snapshot.forEach(doc => {
                    const userData = doc.data();
                    if (!userData.phone_number) return;

                    const dateVal = userData[dateField];
                    if (!dateVal) return;

                    const dateObj = new Date(dateVal);
                    const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

                    let message = template
                        .replace('{{name}}', userData.displayName || userData.name || 'Member')
                        .replace('{{date}}', dateStr);

                    notifications.push({
                        phone_number: userData.phone_number,
                        message: message,
                        userId: doc.id
                    });
                });
            };

            // Reading Room Notifications
            if (smsSettings.RR_WARNING_TEMPLATE) {
                processSnapshot(rrWarningSnapshot, smsSettings.RR_WARNING_TEMPLATE, 'nextPaymentDue');
            } else if (smsSettings.WARNING_TEMPLATE) {
                // Fallback to old generic template if specific one not set
                processSnapshot(rrWarningSnapshot, smsSettings.WARNING_TEMPLATE, 'nextPaymentDue');
            }

            if (smsSettings.RR_GRACE_END_TEMPLATE) {
                processSnapshot(rrGraceSnapshot, smsSettings.RR_GRACE_END_TEMPLATE, 'nextPaymentDue');
            } else if (smsSettings.GRACE_END_TEMPLATE) {
                processSnapshot(rrGraceSnapshot, smsSettings.GRACE_END_TEMPLATE, 'nextPaymentDue');
            }

            // Hostel Notifications
            if (smsSettings.HOSTEL_WARNING_TEMPLATE) {
                processSnapshot(hostelWarningSnapshot, smsSettings.HOSTEL_WARNING_TEMPLATE, 'hostelNextPaymentDue');
            } else if (smsSettings.WARNING_TEMPLATE) {
                processSnapshot(hostelWarningSnapshot, smsSettings.WARNING_TEMPLATE, 'hostelNextPaymentDue');
            }

            if (smsSettings.HOSTEL_GRACE_END_TEMPLATE) {
                processSnapshot(hostelGraceSnapshot, smsSettings.HOSTEL_GRACE_END_TEMPLATE, 'hostelNextPaymentDue');
            } else if (smsSettings.GRACE_END_TEMPLATE) {
                processSnapshot(hostelGraceSnapshot, smsSettings.GRACE_END_TEMPLATE, 'hostelNextPaymentDue');
            }

            // 6. Send SMS Loop
            const results = await Promise.allSettled(notifications.map(async (notif) => {
                const response = await fetch("https://dicesms.asia/api/sms/", {
                    method: "POST",
                    headers: {
                        "Authorization": `Token ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        phone_number: notif.phone_number,
                        message: notif.message
                    })
                });

                if (!response.ok) {
                    const txt = await response.text();
                    throw new Error(`API Error ${response.status}: ${txt}`);
                }
                return notif.userId;
            }));

            // 7. Log Results
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failCount = results.filter(r => r.status === 'rejected').length;

            console.log(`SMS Job Complete. Success: ${successCount}, Failed: ${failCount}`);
            if (failCount > 0) {
                const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
                console.error("SMS Failures:", errors.slice(0, 5));
            }

        } catch (error) {
            console.error("Error in sendExpirySms:", error);
        }
    }
);

/**
 * Callable function to send custom SMS to selected users via DiCE SMS.
 * Uses the same API pattern as sendExpirySms.
 */
exports.sendCustomSms = onCall(
    { secrets: [diceApiKey, diceUsername, dicePassword] },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated.');
        }

        const { userIds, message } = request.data;
        if (!userIds || !Array.isArray(userIds) || !message) {
            throw new HttpsError('invalid-argument', 'Invalid arguments.');
        }

        if (userIds.length === 0) return { success: true, successCount: 0 };

        console.log(`[sendCustomSms] Request received. UserIDs count: ${userIds.length}`);

        const db = admin.firestore();
        const usersRef = db.collection('users');

        // Fetch Phone Numbers
        const numbers = [];
        const fetchPromises = userIds.map(uid => usersRef.doc(uid).get());
        const snapshots = await Promise.all(fetchPromises);

        snapshots.forEach((snap, index) => {
            if (snap.exists) {
                const data = snap.data();
                const phone = data.phoneNumber || data.phone || data.mobile || data.phone_number;

                // Debug log for first user to check structure
                if (index === 0) {
                    console.log(`[sendCustomSms] First user fields:`, Object.keys(data));
                    console.log(`[sendCustomSms] First user phone resolved to:`, phone);
                }

                if (phone) {
                    numbers.push(phone);
                } else {
                    console.log(`[sendCustomSms] No phone found for user ${snap.id}`);
                }
            } else {
                console.log(`[sendCustomSms] User doc does not exist: ${snap.id}`);
            }
        });

        if (numbers.length === 0) {
            console.warn("[sendCustomSms] No valid phone numbers found among selected users.");
            return {
                success: true,
                successCount: 0,
                message: "No valid phone numbers found from selected users. Check logs for field names."
            };
        }

        const username = diceUsername.value();
        const password = dicePassword.value();

        let token = null;

        if (username && password) {
            token = await getDiceToken(username, password);
            if (token) {
                console.log(`[sendCustomSms] Retrieved dynamic token. Starts with: ${token.substring(0, 4)}***`);
            } else {
                console.warn("[sendCustomSms] Failed to retrieve dynamic token. Checking for API Key fallback...");
            }
        } else {
            console.warn("[sendCustomSms] DICE_USERNAME or DICE_PASSWORD not configured.");
        }

        // Fallback to API Key if token retrieval failed
        if (!token) {
            const apiKey = diceApiKey.value();
            if (apiKey) {
                token = apiKey;
                console.log(`[sendCustomSms] Falling back to DICE_API_KEY.`);
            } else {
                throw new HttpsError('internal', 'SMS Configuration Error: No credentials or API Key found.');
            }
        }

        // Debug: Check token format (masking mostly)
        console.log(`[sendCustomSms] Using Token. Length: ${token.length}, Starts with: ${token.substring(0, 4)}***`);

        console.log(`Sending custom SMS to ${numbers.length} users.`);

        // Send via DiCE SMS (Batch Request)
        try {
            const response = await fetch("https://dicesms.asia/api/sms/", {
                method: "POST",
                headers: {
                    "Authorization": `Token ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    phone_number: numbers,
                    message: message
                })
            });

            const responseText = await response.text();

            if (!response.ok) {
                console.error(`[sendCustomSms] API Error: ${response.status} - ${responseText}`);
                throw new HttpsError('internal', `SMS Provider Error: ${responseText}`);
            }

            console.log(`[sendCustomSms] Success: ${responseText}`);

            return {
                success: true,
                successCount: numbers.length,
                message: "SMS sent successfully."
            };
        } catch (error) {
            console.error("[sendCustomSms] Execution Error:", error);
            throw new HttpsError('internal', `Failed to send SMS: ${error.message}`);
        }
    }
);
