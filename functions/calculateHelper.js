
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

            // targeted users check
            if (coupon.allowedUsers && Array.isArray(coupon.allowedUsers) && coupon.allowedUsers.length > 0) {
                if (!coupon.allowedUsers.includes(userId)) {
                    isValid = false;
                    invalidReason = 'This coupon is not valid for your account';
                }
            }

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
