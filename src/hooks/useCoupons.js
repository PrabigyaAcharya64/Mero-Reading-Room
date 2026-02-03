import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export const useCoupons = (userId, serviceType) => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setCoupons([]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'coupons'),
            where('expiryDate', '>=', new Date().toISOString()) // Filter expired on server-side if possible, but simpler to filter client side for complex logic
        );
        // Note: Firestore query limitations might make complex filtering hard.
        // Let's fetch all active coupons (logic-wise expensive if many, but fine for now)
        // or just fetch all and filter client side for flexibility.
        // Actually, let's just listen to the coupons collection. It shouldn't be huge.

        const couponsQuery = query(collection(db, 'coupons'));

        const unsubscribe = onSnapshot(couponsQuery, (snapshot) => {
            const now = new Date();
            const availableCoupons = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(coupon => {
                    // 1. Check Expiry
                    if (coupon.expiryDate) {
                        const expiry = new Date(coupon.expiryDate);
                        if (expiry < now) return false;
                    }

                    // 2. Check Usage Limit
                    if (coupon.usageLimit > 0 && (coupon.usedCount || 0) >= coupon.usageLimit) {
                        return false;
                    }

                    // 3. Check Target Audience
                    if (coupon.targetType === 'specific') {
                        if (!coupon.allowedUsers || !coupon.allowedUsers.includes(userId)) {
                            return false;
                        }
                    }

                    // 4. Check Service Type
                    // If applicableServices is empty or undefined, maybe assume all? No, admin interface forces selection.
                    if (coupon.applicableServices && coupon.applicableServices.length > 0) {
                        if (!coupon.applicableServices.includes(serviceType)) {
                            return false;
                        }
                    }

                    return true;
                });

            setCoupons(availableCoupons);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching coupons:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, serviceType]);

    return { coupons, loading };
};
