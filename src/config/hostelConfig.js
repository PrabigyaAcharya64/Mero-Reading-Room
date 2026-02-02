import CONFIG from '../config';

// Hostel Buildings and Room Configuration
export const HOSTEL_CONFIG = {
    registrationFee: CONFIG.HOSTEL.REGISTRATION_FEE,
    refundableDeposit: CONFIG.HOSTEL.REFUNDABLE_DEPOSIT,

    buildings: {
        building_a: {
            id: 'building_a',
            name: 'Building A',
            rooms: [
                // Single Rooms (4 total)
                { id: 'a_single_1', type: 'single', capacity: 1, label: 'A-S1', price: 16000 },
                { id: 'a_single_2', type: 'single', capacity: 1, label: 'A-S2', price: 16000 },
                { id: 'a_single_3', type: 'single', capacity: 1, label: 'A-S3', price: 16000 },
                { id: 'a_single_4', type: 'single', capacity: 1, label: 'A-S4', price: 16000 },
                // Double Rooms (4 total)
                { id: 'a_double_1', type: 'double', capacity: 2, label: 'A-D1', price: 14500 },
                { id: 'a_double_2', type: 'double', capacity: 2, label: 'A-D2', price: 14500 },
                { id: 'a_double_3', type: 'double', capacity: 2, label: 'A-D3', price: 14500 },
                { id: 'a_double_4', type: 'double', capacity: 2, label: 'A-D4', price: 14500 },
            ]
        },

        building_b: {
            id: 'building_b',
            name: 'Building B',
            rooms: [
                // Single Rooms (8 total)
                { id: 'b_single_1', type: 'single', capacity: 1, label: 'B-S1', price: 17000 },
                { id: 'b_single_2', type: 'single', capacity: 1, label: 'B-S2', price: 17000 },
                { id: 'b_single_3', type: 'single', capacity: 1, label: 'B-S3', price: 17000 },
                { id: 'b_single_4', type: 'single', capacity: 1, label: 'B-S4', price: 17000 },
                { id: 'b_single_5', type: 'single', capacity: 1, label: 'B-S5', price: 17000 },
                { id: 'b_single_6', type: 'single', capacity: 1, label: 'B-S6', price: 17000 },
                { id: 'b_single_7', type: 'single', capacity: 1, label: 'B-S7', price: 17000 },
                { id: 'b_single_8', type: 'single', capacity: 1, label: 'B-S8', price: 17000 },
                // Single Attached (2 total)
                { id: 'b_single_attached_1', type: 'single_attached', capacity: 1, label: 'B-SA1', price: 18000 },
                { id: 'b_single_attached_2', type: 'single_attached', capacity: 1, label: 'B-SA2', price: 18000 },
                // Twin Sharing (10 total)
                { id: 'b_twin_1', type: 'twin', capacity: 2, label: 'B-T1', price: 15500 },
                { id: 'b_twin_2', type: 'twin', capacity: 2, label: 'B-T2', price: 15500 },
                { id: 'b_twin_3', type: 'twin', capacity: 2, label: 'B-T3', price: 15500 },
                { id: 'b_twin_4', type: 'twin', capacity: 2, label: 'B-T4', price: 15500 },
                { id: 'b_twin_5', type: 'twin', capacity: 2, label: 'B-T5', price: 15500 },
                { id: 'b_twin_6', type: 'twin', capacity: 2, label: 'B-T6', price: 15500 },
                { id: 'b_twin_7', type: 'twin', capacity: 2, label: 'B-T7', price: 15500 },
                { id: 'b_twin_8', type: 'twin', capacity: 2, label: 'B-T8', price: 15500 },
                { id: 'b_twin_9', type: 'twin', capacity: 2, label: 'B-T9', price: 15500 },
                { id: 'b_twin_10', type: 'twin', capacity: 2, label: 'B-T10', price: 15500 },
                // Twin Attached (1 total)
                { id: 'b_twin_attached_1', type: 'twin_attached', capacity: 2, label: 'B-TA1', price: 15750 },
                // Triple Sharing (1 total)
                { id: 'b_triple_1', type: 'triple', capacity: 3, label: 'B-TR1', price: 14500 },
            ]
        },

        building_c: {
            id: 'building_c',
            name: 'Building C',
            rooms: [
                // Single Room (1 total)
                { id: 'c_single_1', type: 'single', capacity: 1, label: 'C-S1', price: 18000 },
                // Twin Sharing (1 total)
                { id: 'c_twin_1', type: 'twin', capacity: 2, label: 'C-T1', price: 16500 },
                // Twin Attached (1 total)
                { id: 'c_twin_attached_1', type: 'twin_attached', capacity: 2, label: 'C-TA1', price: 16750 },
            ]
        }
    }
};

// Room type display names
export const ROOM_TYPE_NAMES = {
    single: 'Single Room',
    single_attached: 'Single Attached',
    double: 'Twin Sharing',
    twin: 'Twin Sharing',
    twin_attached: 'Twin Sharing Attached',
    triple: 'Triple Sharing'
};

// Get all unique room types with their details
export const getRoomTypes = () => {
    const roomTypes = new Map();

    Object.values(HOSTEL_CONFIG.buildings).forEach(building => {
        building.rooms.forEach(room => {
            const key = `${building.id}_${room.type}`;
            if (!roomTypes.has(key)) {
                roomTypes.set(key, {
                    buildingId: building.id,
                    buildingName: building.name,
                    type: room.type,
                    typeName: ROOM_TYPE_NAMES[room.type] || room.type,
                    capacity: room.capacity,
                    price: room.price
                });
            }
        });
    });

    return Array.from(roomTypes.values());
};

// Get all rooms of a specific type
export const getRoomsByType = (buildingId, roomType) => {
    const building = HOSTEL_CONFIG.buildings[buildingId];
    if (!building) return [];

    return building.rooms.filter(room => room.type === roomType);
};

// Calculate total cost
export const calculateHostelCost = (monthlyRate, months, isFirstTime = true, dynamicConfig = null) => {
    const monthlyTotal = monthlyRate * months;

    // Use dynamic config if provided, otherwise fallback to imported HOSTEL_CONFIG
    // which falls back to static CONFIG in the file
    const registrationFee = isFirstTime
        ? (dynamicConfig?.REGISTRATION_FEE ?? HOSTEL_CONFIG.registrationFee)
        : 0;

    const deposit = isFirstTime
        ? (dynamicConfig?.REFUNDABLE_DEPOSIT ?? HOSTEL_CONFIG.refundableDeposit)
        : 0;

    return {
        monthlyTotal,
        registrationFee,
        deposit,
        total: monthlyTotal + registrationFee + deposit
    };
};

export default HOSTEL_CONFIG;
