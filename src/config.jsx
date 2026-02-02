
export const CONFIG = {
    READING_ROOM: {
        REGISTRATION_FEE: 1000,
        MONTHLY_FEE: {
            AC: 3750,
            NON_AC: 3500
        }
    },
    WALLET: {
        MIN_LOAD_AMOUNT: 100
    },
    HOSTEL: {
        REGISTRATION_FEE: 4000,
        REFUNDABLE_DEPOSIT: 5000
    },
    DISCOUNTS: {
        REFERRAL_DISCOUNT_PERCENT: 5,
        BULK_BOOKING_DISCOUNT: 10, // Percent off for 6+ months
        BUNDLE_DISCOUNT: 500, // Fixed amount off if Hostel + Reading Room
        LOYALTY_THRESHOLD: 50 // Number of meals for reward
    }
};

export default CONFIG;
