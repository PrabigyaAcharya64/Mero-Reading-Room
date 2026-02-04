const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
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
        // 1. Fetch Loan Settings
        // Use the centralized config document (settings/config)
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

        // Validate settings
        if (!settings.DAILY_INTEREST_RATE || !settings.DEADLINE_DAYS) {
            console.error("Invalid loan settings. Missing rate or deadline.");
            return;
        }

        const dailyRate = settings.DAILY_INTEREST_RATE;
        const deadlineDays = settings.DEADLINE_DAYS;

        // 2. Query Overdue Users
        // Note: Firestore doesn't support complex querying on sub-fields easily with inequality on different fields efficiently without composite indexes.
        // We will fetch all users with active loans and filter in memory for simplicity, assuming user base isn't massive yet.
        // Or better, query users where loan.has_active_loan == true.

        const usersRef = db.collection('users');
        const activeLoanUsers = await usersRef.where('loan.has_active_loan', '==', true).get();

        const batch = db.batch();
        let updateCount = 0;

        activeLoanUsers.forEach(doc => {
            const userData = doc.data();
            const loan = userData.loan;

            if (!loan || !loan.taken_at) return;

            const takenAtDate = loan.taken_at.toDate(); // Convert Firestore Timestamp to Date
            const nowDate = now.toDate();

            // Calculate days elapsed
            const diffTime = Math.abs(nowDate - takenAtDate);
            const daysSinceTaken = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Check if overdue
            if (daysSinceTaken > deadlineDays) {
                // Apply Interest
                // current_balance = current_balance * (1 + rate)
                // dailyRate is stored as percentage? No, user enters % in UI (e.g. 2).
                // So rate = dailyRate / 100.
                // Settings.jsx: newValue = parseFloat(value).
                // LoanRequest.jsx just shows it as %.
                // Calculation: balance * (1 + rate/100).

                const rateDecimal = dailyRate / 100;

                // IMPORTANT: Check if we already applied interest today to prevent double charging if function retries?
                // We track `last_interest_applied`.

                const lastApplied = loan.last_interest_applied ? loan.last_interest_applied.toDate() : null;

                // Check if last applied was today (or less than 20 hours ago)
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

exports.onUserVerified = onDocumentUpdated(
    {
        document: "users/{userId}",
        secrets: [brevoApiKey],
    },
    async (event) => {
        const newData = event.data.after.data();
        const oldData = event.data.before.data();
        const userId = event.params.userId;

        // OPTIMIZATION: Sync Role & Access Status to Custom Claims
        // This allows firestore.rules to be FREE and FAST (no extra get() calls)
        const roleChanged = newData.role !== oldData.role;
        const paymentChanged = newData.nextPaymentDue !== oldData.nextPaymentDue;

        if (roleChanged || paymentChanged) {
            try {
                const claims = {
                    role: newData.role || 'client'
                };

                if (newData.nextPaymentDue) {
                    // Convert ISO string to Unix timestamp (seconds) for Firestore Rules
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

        if (newData.verified === true && oldData.verified !== true) {
            const userEmail = newData.email;
            const userName = newData.name;

            if (!userEmail) {
                console.log("No email found for user", event.params.userId);
                return null;
            }

            try {

                const brevoKey = brevoApiKey.value();

                if (!brevoKey) {
                    console.error("BREVO_API_KEY secret not found.");
                    return null;
                }

                // Using standard fetch (Node 20+)
                const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                    method: "POST",
                    headers: {
                        "accept": "application/json",
                        "api-key": brevoKey,
                        "content-type": "application/json"
                    },
                    body: JSON.stringify({
                        templateId: 2,
                        to: [{ email: userEmail, name: userName }],
                        params: {
                            FULLNAME: userName,
                        }
                    })
                });

                if (response.ok) {
                    console.log(`Verification email sent to ${userEmail}`);
                } else {
                    const errorData = await response.json();
                    console.error("Brevo API Error:", errorData);
                }

            } catch (error) {
                console.error("Error sending email:", error);
            }
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

            const packageName = invoiceData.details ||
                `${invoiceData.roomType === 'ac' ? 'AC' : 'Non-AC'} Reading Room Package`;

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

/**
 * Scheduled function to check for expired memberships daily at midnight.
 * Applies fines for standard policy, removes seat for 'daily' policy.
 */
exports.checkStatusExpiration = onSchedule("0 0 * * *", async (event) => {
    const db = admin.firestore();
    const now = new Date();
    const today = now.toISOString();

    try {
        const batch = db.batch();
        let operationsCount = 0;

        // --- 1. Process Reading Room Expirations ---
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
                    fineAmount: admin.firestore.FieldValue.increment(5),
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
                hostelFineAmount: admin.firestore.FieldValue.increment(5),
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
        return await db.runTransaction(async (transaction) => {
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

    // Validate that slot is not in the past
    // Nepal Time is UTC+05:45
    // Slot ID is the start hour (e.g., '15' -> 15:00)
    // Slot ends at startHour + 3
    // We allow booking if NOW < Slot End Time

    // Construct slot end time in UTC
    // date is "YYYY-MM-DD"
    const startHour = parseInt(slotId);
    const endHour = startHour + 3;

    // Create date string for Nepal Time: "YYYY-MM-DDTHH:00:00+05:45"
    // Note: hours must be padded
    const paddedEndHour = endHour.toString().padStart(2, '0');
    // If endHour is 24 (midnight), typical ISO handling might be tricky, but slots go up to 21 (end 24/00).
    // Let's use simple logic:
    // Slot End in Nepal Time = YYYY-MM-DD T HH:00:00 +05:45

    // Handle edge case if endHour >= 24 (e.g. 21+3=24). 
    // This implies next day 00:00.
    // Simplifying: compare start time. If NOW > Start Time + buffer?
    // User asked "if its 3 pm why show old time slots".
    // Implies we can't book slots that have *ended*.
    // Strictly: can't book slots that have *started*?
    // "Discussion room" usually booked in advance or for *upcoming* sessions.
    // If it's 3:30 PM, can I book the 3-6 PM slot?
    // If I book it, I get 2.5 hours. It's valid.
    // But if I try to book 12-3 PM, it's invalid.

    let targetDateStr = date;
    let targetHour = endHour;

    // If endHour is 24, technically it is tomorrow 00:00
    // But ISO string "24:00" is invalid.
    // We can use the start time for validation to be safe.
    // Allow booking if Current Time < End Time.

    let slotEndTimeDate;

    if (endHour === 24) {
        // Handle midnight transition if needed, or just set to 23:59:59 roughly
        // Or construct tomorrow 00:00
        // Simpler: Use timestamp calculation
        const startIso = `${date}T${slotId.toString().padStart(2, '0')}:00:00+05:45`;
        const startDate = new Date(startIso);
        slotEndTimeDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
    } else {
        const endIso = `${date}T${targetHour.toString().padStart(2, '0')}:00:00+05:45`;
        slotEndTimeDate = new Date(endIso);
    }

    if (Date.now() > slotEndTimeDate.getTime()) {
        throw new HttpsError('failed-precondition', 'Cannot book a past time slot.');
    }

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

            if (currentBalance < total) {
                throw new HttpsError('failed-precondition', isProxyOrder ? 'Client has insufficient balance.' : 'Insufficient balance.');
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

            // 3. Calculate Final Price with Coupon
            const calcResult = await calculatePriceInternal({
                userId: userIdToCharge,
                serviceType: 'canteen',
                couponCode: request.data.couponCode || null,
                months: 1,
                basePrice: total,
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
                total: finalTotal, // Final price after discount
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
                    discounts: calcResult.discounts
                }
            });

            return {
                success: true,
                orderId: orderRef.id,
                newBalance: newBalance
            };
        });

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

            const currentBalance = userDoc.data().balance || 0;
            const newBalance = currentBalance + amount;

            transaction.update(userRef, {
                balance: newBalance,
                updatedAt: new Date().toISOString()
            });

            // Create transaction record
            const topUpTxnId = generateTransactionId('BTU');
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'balance_topup',
                transactionId: topUpTxnId,
                amount: amount,
                details: 'Admin Balance Top-up',
                userId: userId,
                userName: userDoc.data().name || 'User',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                adminId: request.auth.uid
            });

            return {
                success: true,
                newBalance: newBalance,
                transactionId: transactionRef.id
            };
        });

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
            const newBalance = currentBalance + amount;

            // 3. Update User Balance
            transaction.update(userRef, {
                balance: newBalance,
                updatedAt: new Date().toISOString()
            });

            // 4. Update Request Status
            transaction.update(requestRef, {
                status: 'approved',
                approvedBy: request.auth.uid,
                approvedAt: new Date().toISOString()
            });

            // 5. Create Transaction Record
            const balanceLoadTxnId = generateTransactionId('BLD');
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'balance_load',
                transactionId: balanceLoadTxnId,
                amount: amount,
                details: 'Wallet Top-up (Mobile Banking)',
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                method: 'mobile_banking',
                requestId: requestId,
                status: 'completed'
            });

            return { success: true, newBalance };
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

            // 2. Get room configuration from hostelRooms collection
            // Note: In transaction, all reads must come before writes.
            // But calculatePriceInternal does reads (settings, coupons, user).
            // Cloud Firestore transactions require reads to be done via the transaction object if we want consistency.
            // However, settings/discounts and coupons don't change often. 
            // Limitation: calculatePriceInternal uses db.collection().get() not transaction.get().
            // Ideally we pass transaction object to calculatePriceInternal, but strictly it must be used for ALL reads.
            // For now, calculating price *outside* first? No, we need user data.
            // Let's stick to calculating inside, but accept that reads in calculatePriceInternal are non-transactional (snapshot consistency vs transaction consistency).
            // This is acceptable for simple coupons. 
            // OR we update calculatePriceInternal to accept a transaction object?

            // 2. Get room config
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

            // 3. Update User (Add Loan & Balance)
            const currentBalance = userData.balance || 0;
            const newBalance = currentBalance + loanAmount;
            const now = admin.firestore.Timestamp.now();

            transaction.update(userRef, {
                balance: newBalance,
                loan: {
                    has_active_loan: true,
                    loan_amount: loanAmount,
                    current_balance: loanAmount, // Initial debt equals principal
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
                type: 'loan_disbursement',
                amount: loanAmount,
                details: 'Loan Taken',
                status: 'completed',
                createdAt: now,
                transactionId: txnId
            });

            return { success: true, message: "Loan approved and credited." };
        });

    } catch (error) {
        console.error("Loan Request Error:", error);
        // Pass through specific HttpsErrors, wrap others
        if (error.code && error.code.startsWith('functions/')) {
            throw error;
        }
        throw new HttpsError('internal', error.message || 'Loan request failed.');
    }
});

/**
 * Scheduled function to send SMS notifications for expiry warnings and grace period endings.
 * Runs hourly but sends only at the configured hour.
 */
const diceApiKey = defineSecret("DICE_API_KEY");

exports.sendExpirySms = onSchedule(
    {
        schedule: "every 60 minutes",
        secrets: [diceApiKey]
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

            const apiKey = diceApiKey.value();
            if (!apiKey) {
                console.error("DICE_API_KEY secret not found.");
                return;
            }

            console.log("Starting SMS Notification Job...");

            // 3. Calculate Date Ranges
            // Strategy: Convert target days to ISO range for that full day.

            const getDayRange = (offsetDays) => {
                const d = new Date();
                d.setDate(d.getDate() + offsetDays); // Add/Sub days

                // Set time to 00:00:00.000 local (assuming users entered locally?)
                // Actually, nextPaymentDue is usually UTC ISO. 
                // Note: The prompt asks for "Today + 3 Days" logic.
                // If today is Feb 3, +3 is Feb 6.
                // We want any timestamp falling on Feb 6.
                // But specifically Feb 6 in WHICH timezone? 
                // Implicitly Kathmandu as it's a Nepali app.

                // Create a date object for the target day in Kathmandu
                // We'll use string manipulation on the Kathmandu date string to get YYYY-MM-DD
                const targetIsoString = d.toLocaleDateString("en-CA", { timeZone: KATHMANDU_TZ }); // YYYY-MM-DD

                // Construct ISO range for that YYYY-MM-DD
                // But we must compare against user.nextPaymentDue (ISO UTC).
                // So we need: Start of Feb 6 KATHMANDU converted to UTC.
                // End of Feb 6 KATHMANDU converted to UTC.

                // Start: YYYY-MM-DD 00:00:00 Kathmandu -> UTC
                // End:   YYYY-MM-DD 23:59:59 Kathmandu -> UTC

                // Helper to create date from string in specific TZ?
                // It's tricky without a library in pure Node.
                // Simpler fallback: Treat 'nextPaymentDue' as UTC and ignore TZ offset for simplicity 
                // UNLESS user strictly needs Kathmandu alignment. 
                // Given "Today + 3", usually implies "3 x 24h from now" OR "Calendar Day".
                // Let's stick to UTC Calendar Day to match standard ISO strings.
                // YYYY-MM-DD (UTC).

                const utcYear = d.getUTCFullYear();
                const utcMonth = d.getUTCMonth();
                const utcDay = d.getUTCDate();

                const start = new Date(Date.UTC(utcYear, utcMonth, utcDay, 0, 0, 0, 0));
                const end = new Date(Date.UTC(utcYear, utcMonth, utcDay, 23, 59, 59, 999));

                return { start: start.toISOString(), end: end.toISOString() };
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

                    // Optional: If we want to differentiate in future, we could append type, 
                    // but sticking to user template for now.

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
                        "Authorization": `Token ${apiKey}`,
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
    { secrets: [diceApiKey] },
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

        const apiKey = diceApiKey.value();
        if (!apiKey) {
            throw new HttpsError('internal', 'DICE_API_KEY not configured.');
        }

        // Debug: Check key format (masking mostly)
        console.log(`[sendCustomSms] Using API Key. Length: ${apiKey.length}, Starts with: ${apiKey.substring(0, 4)}***`);

        console.log(`Sending custom SMS to ${numbers.length} users.`);

        // Send via DiCE SMS (POST)
        // Attempting 'Bearer' instead of 'Token' as 401 occurred.
        const results = await Promise.allSettled(numbers.map(async (num) => {
            const response = await fetch("https://dicesms.asia/api/sms/", {
                method: "POST",
                headers: {
                    "Authorization": `Token ${apiKey}`, // Reverting to Token as Bearer gave 'not provided'
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    phone_number: num,
                    message: message
                })
            });

            if (!response.ok) {
                const txt = await response.text();
                console.error(`[sendCustomSms] API Error for ${num}: ${response.status} - ${txt}`);
                throw new Error(`API Error ${response.status}: ${txt}`);
            }
            return num;
        }));

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').map(r => ({ error: r.reason.message }));

        return {
            success: true,
            successCount,
            failureCount: failures.length,
            failures: failures.slice(0, 10) // Return first 10 errors
        };
    }
);
