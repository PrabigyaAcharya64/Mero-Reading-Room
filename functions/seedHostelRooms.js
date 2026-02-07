// Firebase Seed Script for Hostel Rooms
// Run this script once to populate the hostelRooms collection in Firestore

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Make sure to set your credentials
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

const HOSTEL_ROOMS = [
    { id: 'a_single_1', buildingId: 'building_a', buildingName: 'Building A', type: 'single', capacity: 1, label: 'A-S1', price: 16000 },
    { id: 'a_single_2', buildingId: 'building_a', buildingName: 'Building A', type: 'single', capacity: 1, label: 'A-S2', price: 16000 },
    { id: 'a_single_3', buildingId: 'building_a', buildingName: 'Building A', type: 'single', capacity: 1, label: 'A-S3', price: 16000 },
    { id: 'a_single_4', buildingId: 'building_a', buildingName: 'Building A', type: 'single', capacity: 1, label: 'A-S4', price: 16000 },
    // Building A - Double Rooms
    { id: 'a_double_1', buildingId: 'building_a', buildingName: 'Building A', type: 'double', capacity: 2, label: 'A-D1', price: 14500 },
    { id: 'a_double_2', buildingId: 'building_a', buildingName: 'Building A', type: 'double', capacity: 2, label: 'A-D2', price: 14500 },
    { id: 'a_double_3', buildingId: 'building_a', buildingName: 'Building A', type: 'double', capacity: 2, label: 'A-D3', price: 14500 },
    { id: 'a_double_4', buildingId: 'building_a', buildingName: 'Building A', type: 'double', capacity: 2, label: 'A-D4', price: 14500 },

    // Building B - Single Rooms
    { id: 'b_single_1', buildingId: 'building_b', buildingName: 'Building B', type: 'single', capacity: 1, label: 'B-S1', price: 17000 },
    { id: 'b_single_2', buildingId: 'building_b', buildingName: 'Building B', type: 'single', capacity: 1, label: 'B-S2', price: 17000 },
    { id: 'b_single_3', buildingId: 'building_b', buildingName: 'Building B', type: 'single', capacity: 1, label: 'B-S3', price: 17000 },
    { id: 'b_single_4', buildingId: 'building_b', buildingName: 'Building B', type: 'single', capacity: 1, label: 'B-S4', price: 17000 },
    { id: 'b_single_5', buildingId: 'building_b', buildingName: 'Building B', type: 'single', capacity: 1, label: 'B-S5', price: 17000 },
    { id: 'b_single_6', buildingId: 'building_b', buildingName: 'Building B', type: 'single', capacity: 1, label: 'B-S6', price: 17000 },
    { id: 'b_single_7', buildingId: 'building_b', buildingName: 'Building B', type: 'single', capacity: 1, label: 'B-S7', price: 17000 },
    { id: 'b_single_8', buildingId: 'building_b', buildingName: 'Building B', type: 'single', capacity: 1, label: 'B-S8', price: 17000 },
    // Building B - Single Attached
    { id: 'b_single_attached_1', buildingId: 'building_b', buildingName: 'Building B', type: 'single_attached', capacity: 1, label: 'B-SA1', price: 18000 },
    { id: 'b_single_attached_2', buildingId: 'building_b', buildingName: 'Building B', type: 'single_attached', capacity: 1, label: 'B-SA2', price: 18000 },
    // Building B - Twin Sharing
    { id: 'b_twin_1', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T1', price: 15500 },
    { id: 'b_twin_2', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T2', price: 15500 },
    { id: 'b_twin_3', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T3', price: 15500 },
    { id: 'b_twin_4', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T4', price: 15500 },
    { id: 'b_twin_5', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T5', price: 15500 },
    { id: 'b_twin_6', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T6', price: 15500 },
    { id: 'b_twin_7', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T7', price: 15500 },
    { id: 'b_twin_8', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T8', price: 15500 },
    { id: 'b_twin_9', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T9', price: 15500 },
    { id: 'b_twin_10', buildingId: 'building_b', buildingName: 'Building B', type: 'twin', capacity: 2, label: 'B-T10', price: 15500 },
    // Building B - Twin Attached
    { id: 'b_twin_attached_1', buildingId: 'building_b', buildingName: 'Building B', type: 'twin_attached', capacity: 2, label: 'B-TA1', price: 15750 },
    // Building B - Triple Sharing
    { id: 'b_triple_1', buildingId: 'building_b', buildingName: 'Building B', type: 'triple', capacity: 3, label: 'B-TR1', price: 14500 },

    // Building C
    { id: 'c_single_1', buildingId: 'building_c', buildingName: 'Building C', type: 'single', capacity: 1, label: 'C-S1', price: 18000 },
    { id: 'c_twin_1', buildingId: 'building_c', buildingName: 'Building C', type: 'twin', capacity: 2, label: 'C-T1', price: 16500 },
    { id: 'c_twin_attached_1', buildingId: 'building_c', buildingName: 'Building C', type: 'twin_attached', capacity: 2, label: 'C-TA1', price: 16750 },
];

async function seedHostelRooms() {
    console.log('Starting hostel rooms seed...');

    const batch = db.batch();

    for (const room of HOSTEL_ROOMS) {
        const roomRef = db.collection('hostelRooms').doc(room.id);
        batch.set(roomRef, {
            buildingId: room.buildingId,
            buildingName: room.buildingName,
            type: room.type,
            capacity: room.capacity,
            label: room.label,
            price: room.price,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    await batch.commit();
    console.log(`✅ Successfully seeded ${HOSTEL_ROOMS.length} hostel rooms!`);
}

seedHostelRooms()
    .then(() => {
        console.log('Seed completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error seeding data:', error);
        process.exit(1);
    });
