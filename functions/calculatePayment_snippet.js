
/**
 * Calculate Payment with Discounts & Coupons
 * Validates coupons, checks automated rules, and returns final price.
 */
exports.calculatePayment = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be authenticated.');
    }

    const { userId, serviceType, couponCode, months = 1, roomType } = request.data;
    // serviceType: 'readingRoom' | 'hostel' | 'canteen'

    if (!userId || !serviceType) {
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
        // Fetch standard rates (Assuming static for now or fetch from config/settings doc)
        // Ideally fetch from 'settings/config' or rely on passed 'roomType'
        const isAc = roomType === 'ac';
        basePrice = (isAc ? 3750 : 3500) * months;
        basePriceLabel = `${isAc ? 'AC' : 'Non-AC'} Reading Room (${months} months)`;
    } else if (serviceType === 'hostel') {
        const roomRef = db.collection('hostelRooms').where('status', '==', 'available').limit(1);
        // Logic simplification: For calculation, we might need specific room price. 
        // For this demo, let's use a standard starting rate or the specific room if passed.
        basePrice = 14500 * months;
        basePriceLabel = `Hostel Room (${months} months)`;
    } else {
        throw new HttpsError('invalid-argument', 'Invalid service type for discount calculation.');
    }

    // --- 2. Automated Discounts ---
    const discounts = [];

    // Constants (Mirrored from Frontend Config)
    const DISCOUNTS = {
        REFERRAL_PERCENT: 5,
        BULK_PERCENT: 10,
        BUNDLE_FIXED: 500,
        LOYALTY_THRESHOLD: 50
    };

    // A. Bulk Discount (6+ months)
    if (months >= 6) {
        const amount = Math.round(basePrice * (DISCOUNTS.BULK_PERCENT / 100));
        discounts.push({
            id: 'auto_bulk',
            name: `Bulk Discount (${months}+ months)`,
            amount: amount,
            type: 'automated'
        });
    }

    // B. Bundle Discount (Hostel + Reading Room)
    // Check if user has the OTHER service active
    if (serviceType === 'hostel' && userData.currentSeat) {
        discounts.push({
            id: 'auto_bundle',
            name: 'Bundle Discount (Active Reading Room)',
            amount: DISCOUNTS.BUNDLE_FIXED,
            type: 'automated'
        });
    } else if (serviceType === 'readingRoom' && userData.currentHostelRoom) {
        discounts.push({
            id: 'auto_bundle',
            name: 'Bundle Discount (Active Hostel)',
            amount: DISCOUNTS.BUNDLE_FIXED,
            type: 'automated'
        });
    }

    // C. Loyalty Discount (Example: Canteen meals count)
    // Assuming userData.mealsEaten exists or is calculated
    const mealsEaten = userData.mealsEaten || 0;
    if (mealsEaten > DISCOUNTS.LOYALTY_THRESHOLD) {
        // One-time loyalty usage logic would be complex (need to track used status). 
        // For now, simple check.
        // discounts.push({ ... });
    }

    // --- 3. Coupon Validation ---
    if (couponCode) {
        const couponRef = db.collection('coupons').where('code', '==', couponCode).limit(1);
        const couponSnap = await couponRef.get();

        if (!couponSnap.empty) {
            const couponDoc = couponSnap.docs[0];
            const coupon = couponDoc.data();
            const now = new Date().toISOString();

            let isValid = true;
            let invalidReason = '';

            // Validation Checks
            if (coupon.expiryDate && coupon.expiryDate < now) {
                isValid = false;
                invalidReason = 'Coupon expired';
            }
            if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
                isValid = false;
                invalidReason = 'Coupon usage limit reached';
            }
            if (coupon.applicableServices && !coupon.applicableServices.includes(serviceType)) {
                isValid = false;
                invalidReason = 'Coupon not applicable for this service';
            }
            if (coupon.minAmount && basePrice < coupon.minAmount) {
                isValid = false;
                invalidReason = `Minimum spend of ${coupon.minAmount} required`;
            }
            if (coupon.shadowUserId && coupon.shadowUserId !== userId) {
                isValid = false;
                invalidReason = 'Invalid coupon code';
            }

            if (isValid) {
                // Calculate Coupon Amount
                let amount = 0;
                if (coupon.type === 'percentage') {
                    amount = Math.round(basePrice * (coupon.value / 100));
                } else if (coupon.type === 'flat') {
                    amount = coupon.value;
                }

                // Stacking Logic
                // If coupon is NOT stackable, it might replace automated discounts or be rejected if autos exist.
                // Requirement: "Ensure admin can toggle if coupons work on top of automated discounts."
                const hasAutomated = discounts.length > 0;

                if (!coupon.stackable && hasAutomated) {
                    // Policy: Takes the specific coupon over generic automated? Or fail?
                    // Usually user prefers whichever is higher. 
                    // Let's Add it but mark it. Or filter later. 
                    // Simplest interpretation: If NOT stackable, remove all automated discounts.
                    discounts.length = 0; // Clear automated
                }

                discounts.push({
                    id: couponDoc.id,
                    name: `Coupon (${couponCode})`,
                    amount: amount,
                    type: 'coupon',
                    code: couponCode
                });

            } else {
                // Return error or just ignore? 
                // Better to clear it so frontend knows it failed.
                // Or throw?
                // Throwing is better for "Apply" button feedback.
                throw new HttpsError('invalid-argument', invalidReason);
            }
        } else {
            throw new HttpsError('not-found', 'Invalid coupon code');
        }
    }

    // --- 4. Final Calculation ---
    const totalDiscount = discounts.reduce((sum, d) => sum + d.amount, 0);
    const finalPrice = Math.max(0, basePrice - totalDiscount);

    return {
        success: true,
        basePrice,
        basePriceLabel,
        discounts,
        totalDiscount,
        finalPrice,
        currency: 'NPR'
    };
});
