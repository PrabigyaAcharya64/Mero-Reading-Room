const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions/v1");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

// Define the secret parameter
const brevoApiKey = defineSecret("BREVO_API_KEY");


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

        // Check if the user was just verified
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
 * Proactively clears seats and updates user status.
 */
exports.checkStatusExpiration = onSchedule("0 0 * * *", async (event) => {
    const db = admin.firestore();
    const now = new Date().toISOString();

    try {
        // 1. Find users with expired nextPaymentDue
        const usersRef = db.collection('users');
        const expiredUsersQuery = usersRef
            .where('nextPaymentDue', '<', now)
            .where('enrollmentCompleted', '==', true);

        const snapshot = await expiredUsersQuery.get();

        if (snapshot.empty) {
            console.log("No expired memberships found today.");
            return null;
        }

        const batch = db.batch();
        const seatDeletions = [];

        snapshot.forEach((doc) => {
            const userId = doc.id;

            console.log(`Processing expiration for user: ${userId}`);

            // Update user document
            batch.update(doc.ref, {
                enrollmentCompleted: false,
                currentSeat: admin.firestore.FieldValue.delete(),
                updatedAt: now
            });

            // Find and delete their seat assignments
            const assignmentsRef = db.collection('seatAssignments');
            const q = assignmentsRef.where('userId', '==', userId);
            seatDeletions.push(q.get());
        });

        // Resolve all assignment queries
        const assignmentSnapshots = await Promise.all(seatDeletions);
        assignmentSnapshots.forEach(snap => {
            snap.forEach(doc => {
                batch.delete(doc.ref);
            });
        });

        await batch.commit();
        console.log(`Successfully processed ${snapshot.size} expired memberships.`);

    } catch (error) {
        console.error("Error in checkStatusExpiration:", error);
    }
    return null;
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

        // 1. Check for expired membership
        if (userData.nextPaymentDue && new Date(userData.nextPaymentDue) < now) {
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

            if (currentBalance < totalAmount) {
                throw new HttpsError('failed-precondition', `Insufficient balance. You need रु ${totalAmount - currentBalance} more.`);
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
            const newBalance = currentBalance - totalAmount;
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
                }
            });

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
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'reading_room',
                amount: totalAmount,
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

            // 3. Execute all updates atomically
            const newBalance = currentBalance - total;

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
            const orderRef = db.collection('orders').doc();
            transaction.set(orderRef, {
                userId: userIdToCharge,
                userEmail: userData.email || null,
                userName: userData.name || userData.displayName || 'Reader',
                items: cart,
                total: total,
                status: 'pending',
                note: note || null,
                location: null,
                createdAt: new Date().toISOString(),
                isProxyOrder: isProxyOrder,
                processedBy: isProxyOrder ? callerId : null
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
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'balance_topup',
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
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'balance_load',
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

    const { buildingId, roomType, months } = request.data;
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

            // 3. Calculate costs
            const monthlyTotal = monthlyRate * months;
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

            transaction.set(transactionRef, {
                type: 'hostel',
                amount: totalCost,
                details: transactionDetails,
                userId: userId,
                userName: userData.name || userData.displayName || 'User',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                buildingId: assignedRoom.buildingId,
                roomType: assignedRoom.type,
                months: months,
                breakdown: {
                    monthlyRate: monthlyRate,
                    monthlyTotal: monthlyTotal,
                    registrationFee: registrationFee,
                    deposit: deposit
                }
            });

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

    const { months } = request.data;
    const userId = request.auth.uid;

    if (!months || months < 1) {
        throw new HttpsError('invalid-argument', 'Invalid number of months.');
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
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                type: 'hostel_renewal',
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
