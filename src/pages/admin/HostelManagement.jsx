import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { Eye, Edit, Trash2, Users, UserPlus } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useLoading } from '../../context/GlobalLoadingContext';
import { useAdminHeader } from '../../context/AdminHeaderContext';
import '../../styles/StandardLayout.css';

const BUILDING_OPTIONS = [
    { id: 'building_a', name: 'Building A' },
    { id: 'building_b', name: 'Building B' },
    { id: 'building_c', name: 'Building C' }
];

const ROOM_TYPES = [
    { value: 'single', label: 'Single Room' },
    { value: 'single_attached', label: 'Single Attached' },
    { value: 'double', label: 'Twin Sharing' },
    { value: 'twin', label: 'Twin Sharing' },
    { value: 'twin_attached', label: 'Twin Sharing Attached' },
    { value: 'triple', label: 'Triple Sharing' }
];

const HostelManagement = ({ onBack, onDataLoaded }) => {
    const { setIsLoading } = useLoading();
    const { setHeader } = useAdminHeader();
    const [rooms, setRooms] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null); // For viewing occupants
    const [editingGroup, setEditingGroup] = useState(null);
    const [newPrice, setNewPrice] = useState('');
    const [newTotalRooms, setNewTotalRooms] = useState('');
    const [msg, setMsg] = useState('');

    // Assignment State
    const [verifiedUsers, setVerifiedUsers] = useState([]);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [targetRoomForAssignment, setTargetRoomForAssignment] = useState(null);
    const [searchUserQuery, setSearchUserQuery] = useState('');
    const [assignForm, setAssignForm] = useState({
        userId: '',
        months: 3, // Default to 3 months
        paymentMethod: 'wallet',
        includeAdmission: true, // Default checked
        includeDeposit: true    // Default checked
    });

    // ... (keep existing Renewal State)

    // ... (keep existing helper functions)

    const handleUpdateGroup = async (group) => {
        if (!newPrice || isNaN(newPrice)) {
            alert('Please enter a valid price');
            return;
        }

        const targetTotal = parseInt(newTotalRooms);
        if (!targetTotal || isNaN(targetTotal) || targetTotal < 1) {
            alert('Please enter a valid number of rooms');
            return;
        }

        const currentRooms = group.rooms;
        const currentCount = currentRooms.length;

        // Validation for scaling down
        if (targetTotal < currentCount) {
            // Check occupants in potential rooms to delete
            // We delete highest numbers first ideally, or just empty ones. 
            // Strategy: Identifty empty rooms.
            const emptyRooms = currentRooms.filter(r => getOccupants(r.id).length === 0);
            const occupiedCount = currentCount - emptyRooms.length;

            if (targetTotal < occupiedCount) {
                alert(`Cannot reduce to ${targetTotal} rooms. You have ${occupiedCount} occupied rooms. Please withdraw occupants first.`);
                return;
            }

            const roomsToDeleteCount = currentCount - targetTotal;
            if (roomsToDeleteCount > emptyRooms.length) {
                // This shouldn't happen if logic above is correct, but safe check
                alert(`Cannot find enough empty rooms to delete.`);
                return;
            }
        }

        setIsLoading(true);
        try {
            // 1. Update Price for ALL existing rooms
            const updatePromises = currentRooms.map(room =>
                updateDoc(doc(db, 'hostelRooms', room.id), { price: parseInt(newPrice) })
            );
            await Promise.all(updatePromises);

            // 2. Handle Room Count Changes
            if (targetTotal > currentCount) {
                // Scaling Up: Add rooms
                const roomsToAdd = targetTotal - currentCount;

                // Find max number in current labels to continue sequence
                // Format: Building-TypeNumber e.g. A-S101
                // We need to parse strict format or just simple increment if possible.
                // Regex to extract trailing number: (\d+)$
                let maxNum = 0;
                const regex = /(\d+)$/;

                currentRooms.forEach(r => {
                    const match = r.label.match(regex);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (num > maxNum) maxNum = num;
                    }
                });

                // If no number found, fallback to simple count? 
                // Let's assume standard format derived from add logic.
                // buildingPrefix-typePrefix-Number

                // We need prefixes. 
                // Recalculate prefixes based on group data
                const buildingPrefix = group.buildingId === 'building_a' ? 'A' :
                    group.buildingId === 'building_b' ? 'B' : 'C';

                // Deduce type prefix from existing label or reconstruction
                // Easiest is to take the first room's label and remove the number
                const sampleLabel = currentRooms[0].label;
                const labelMatch = sampleLabel.match(/^(.*?)(\d+)$/);
                const labelPrefix = labelMatch ? labelMatch[1] : `${buildingPrefix}-Room`; // Fallback

                // If maxNum is 0 (parsing failed), we might have issues. 
                // But let's assume valid data from creation.

                const addPromises = [];
                for (let i = 1; i <= roomsToAdd; i++) {
                    const nextNum = maxNum + i;
                    const newLabel = `${labelPrefix}${nextNum}`;

                    addPromises.push(addDoc(collection(db, 'hostelRooms'), {
                        buildingId: group.buildingId,
                        buildingName: group.buildingName,
                        type: group.type,
                        capacity: group.capacity,
                        label: newLabel,
                        price: parseInt(newPrice), // Use new price
                        createdAt: new Date().toISOString()
                    }));
                }
                await Promise.all(addPromises);
                alert(`Updated price and created ${roomsToAdd} new rooms.`);

            } else if (targetTotal < currentCount) {
                // Scaling Down: Delete valid empty rooms
                const roomsToDeleteCount = currentCount - targetTotal;

                // Sort empty rooms by label number descending (to remove from end)
                const emptyRooms = currentRooms.filter(r => getOccupants(r.id).length === 0);

                // Helper to get number
                const getNum = (label) => {
                    const m = label.match(/(\d+)$/);
                    return m ? parseInt(m[1]) : 0;
                };

                emptyRooms.sort((a, b) => getNum(b.label) - getNum(a.label));

                const toDelete = emptyRooms.slice(0, roomsToDeleteCount);

                const deletePromises = toDelete.map(r => deleteDoc(doc(db, 'hostelRooms', r.id)));
                await Promise.all(deletePromises);
                alert(`Updated price and deleted ${toDelete.length} empty rooms.`);
            } else {
                alert('Price updated successfully.');
            }

            setEditingGroup(null);
            setNewPrice('');
            setNewTotalRooms('');
            await fetchRooms();
        } catch (error) {
            console.error('Error updating group:', error);
            alert('Failed to update group');
        } finally {
            setIsLoading(false);
        }
    };

    // Renewal State
    const [renewModalOpen, setRenewModalOpen] = useState(false);
    const [targetOccupant, setTargetOccupant] = useState(null);
    const [renewMonths, setRenewMonths] = useState(1);

    // Form state
    const [formData, setFormData] = useState({
        buildingId: 'building_a',
        buildingName: 'Building A',
        type: 'single',
        capacity: 1,
        label: '',
        price: '',
        numberOfRooms: 1,
        startingNumber: 1
    });

    useEffect(() => {
        // Set loading true on mount (handles page refresh case)
        setIsLoading(true);
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            await fetchRooms();
            await fetchRooms();
            await loadVerifiedUsers();
            if (onDataLoaded) onDataLoaded();
        };
        loadInitialData();
    }, []);

    const fetchRooms = async () => {
        try {
            const [roomsSnapshot, assignmentsSnapshot] = await Promise.all([
                getDocs(collection(db, 'hostelRooms')),
                getDocs(collection(db, 'hostelAssignments'))
            ]);

            const roomsData = roomsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter only active assignments
            const assignmentsData = assignmentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(a => a.status === 'active');

            setAssignments(assignmentsData);

            roomsData.sort((a, b) => {
                if (a.buildingId !== b.buildingId) {
                    return a.buildingId.localeCompare(b.buildingId);
                }
                return a.label.localeCompare(b.label);
            });
            setRooms(roomsData);
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Failed to load data');
        }
    };

    const loadVerifiedUsers = async () => {
        try {
            // Fetch users with verification check (assuming 'verified' field or similar exists, matching ReadingRoom logic)
            // If ReadingRoom fetches all and filters, we do same.
            // optimization: query for verification status if index exists.
            // For now, fetching all users might be heavy, but let's stick to simple pattern used else where or fetch only needed fields
            // Inspecting ReadingRoomManagement would confirm, but let's assume standard users collection fetch
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Filter: verified and NOT already in a hostel
            // We can check hostelAssignments in memory or rely on user.currentHostelRoom
            const availableUsers = users.filter(u =>
                (u.mrrNumber || u.isVerified) && // Basic verification check
                !u.currentHostelRoom // Not currently in hostel
            );
            setVerifiedUsers(availableUsers);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    const handleAssignHostel = async () => {
        if (!assignForm.userId || !targetRoomForAssignment) {
            alert('Please select a user and room.');
            return;
        }

        // Find next available bed
        const occupants = getOccupants(targetRoomForAssignment.id);
        const occupiedBeds = occupants.map(o => o.bedNumber);
        let firstAvailableBed = null;
        for (let i = 1; i <= targetRoomForAssignment.capacity; i++) {
            if (!occupiedBeds.includes(i)) {
                firstAvailableBed = i;
                break;
            }
        }

        if (!firstAvailableBed) {
            alert('No beds available in this room.');
            return;
        }

        if (!confirm(`Confirm assignment of Bed ${firstAvailableBed} to user?`)) return;

        setIsLoading(true);
        try {
            const assignHostelBed = httpsCallable(functions, 'assignHostelBed');
            const result = await assignHostelBed({
                userId: assignForm.userId,
                roomId: targetRoomForAssignment.id,
                bedNumber: firstAvailableBed,
                months: parseInt(assignForm.months),
                paymentMethod: assignForm.paymentMethod,
                includeAdmission: assignForm.includeAdmission,
                includeDeposit: assignForm.includeDeposit
            });

            if (result.data.success) {
                alert('User assigned successfully!');
                setAssignModalOpen(false);
                setTargetRoomForAssignment(null);
                setAssignForm({
                    userId: '',
                    months: 3,
                    paymentMethod: 'wallet',
                    includeAdmission: true,
                    includeDeposit: true
                });
                await fetchRooms(); // Refresh data
                loadVerifiedUsers(); // Refresh user list
            }
        } catch (error) {
            console.error('Assignment error:', error);
            alert(`Assignment failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBuildingChange = (buildingId) => {
        const building = BUILDING_OPTIONS.find(b => b.id === buildingId);
        setFormData({
            ...formData,
            buildingId: buildingId,
            buildingName: building.name
        });
    };

    const handleTypeChange = (type) => {
        let capacity = 1;
        if (type === 'double' || type === 'twin' || type === 'twin_attached') {
            capacity = 2;
        } else if (type === 'triple') {
            capacity = 3;
        }
        setFormData({ ...formData, type, capacity });
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();

        if (!formData.price) {
            alert('Please fill in price');
            return;
        }

        const numberOfRooms = parseInt(formData.numberOfRooms) || 1;
        const startingNumber = parseInt(formData.startingNumber) || 1;

        if (numberOfRooms < 1 || numberOfRooms > 100) {
            alert('Number of rooms must be between 1 and 100');
            return;
        }

        setIsLoading(true);
        try {
            const buildingPrefix = formData.buildingId === 'building_a' ? 'A' :
                formData.buildingId === 'building_b' ? 'B' : 'C';
            const typePrefix = formData.type === 'single' ? 'S' :
                formData.type === 'single_attached' ? 'SA' :
                    formData.type === 'double' || formData.type === 'twin' ? 'T' :
                        formData.type === 'twin_attached' ? 'TA' : 'TR';

            for (let i = 0; i < numberOfRooms; i++) {
                const roomNumber = startingNumber + i;
                const roomLabel = `${buildingPrefix}-${typePrefix}${roomNumber}`;

                await addDoc(collection(db, 'hostelRooms'), {
                    buildingId: formData.buildingId,
                    buildingName: formData.buildingName,
                    type: formData.type,
                    capacity: parseInt(formData.capacity),
                    label: roomLabel,
                    price: parseInt(formData.price),
                    createdAt: new Date().toISOString()
                });
            }

            alert(`${numberOfRooms} room(s) added successfully!`);
            setShowAddForm(false);
            setFormData({
                buildingId: 'building_a',
                buildingName: 'Building A',
                type: 'single',
                capacity: 1,
                label: '',
                price: '',
                numberOfRooms: 1,
                startingNumber: 1
            });
            await fetchRooms();
        } catch (error) {
            console.error('Error adding rooms:', error);
            alert('Failed to add rooms');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteRoom = async (roomId, roomLabel) => {
        if (!window.confirm(`Delete room ${roomLabel}?`)) {
            return;
        }

        setIsLoading(true);
        try {
            await deleteDoc(doc(db, 'hostelRooms', roomId));
            alert('Room deleted!');
            await fetchRooms();
        } catch (error) {
            console.error('Error deleting room:', error);
            alert('Failed to delete room');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAllInGroup = async (group) => {
        if (!window.confirm(`Are you sure you want to delete ALL ${group.rooms.length} rooms in this group?`)) {
            return;
        }

        setIsLoading(true);
        try {
            for (const room of group.rooms) {
                await deleteDoc(doc(db, 'hostelRooms', room.id));
            }
            alert(`Deleted ${group.rooms.length} rooms successfully`);
            await fetchRooms();
            // If we were viewing the group, go back
            if (selectedGroup && selectedGroup.buildingId === group.buildingId && selectedGroup.type === group.type) {
                setSelectedGroup(null);
            }
        } catch (error) {
            console.error('Error deleting rooms:', error);
            alert('Failed to delete rooms');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateGroupPrice = async (group) => {
        if (!newPrice || isNaN(newPrice)) {
            alert('Please enter a valid price');
            return;
        }

        setIsLoading(true);
        try {
            for (const room of group.rooms) {
                await updateDoc(doc(db, 'hostelRooms', room.id), {
                    price: parseInt(newPrice)
                });
            }
            alert(`Updated price for ${group.rooms.length} rooms`);
            setEditingGroup(null);
            setNewPrice('');
            await fetchRooms();
        } catch (error) {
            console.error('Error updating price:', error);
            alert('Failed to update price');
        } finally {
            setIsLoading(false);
        }
    };

    const handleWithdrawOccupant = async (occupant) => {
        if (!confirm(`Are you sure you want to withdraw ${occupant.userName} from ${occupant.roomLabel}?`)) {
            return;
        }

        setIsLoading(true);
        try {
            const withdrawService = httpsCallable(functions, 'withdrawService');
            await withdrawService({
                serviceType: 'hostel',
                userId: occupant.userId
            });

            alert('Occupant withdrawn successfully');
            await fetchRooms();
            // Close modal if empty? or refresh it.
            // Refresh occupants list for selectedRoom
            if (selectedRoom) {
                // We need to update local state or re-fetch. 
                // fetchRooms updates 'assignments' state, so the UI should update automatically if we derive occupants from assignments.
            }
        } catch (error) {
            console.error('Error withdrawing:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRenewOccupant = async () => {
        if (!targetOccupant) return;

        setIsLoading(true);
        try {
            const renewHostelSubscription = httpsCallable(functions, 'renewHostelSubscription');
            await renewHostelSubscription({
                months: parseInt(renewMonths),
                userId: targetOccupant.userId
            });

            alert('Subscription renewed successfully!');
            setRenewModalOpen(false);
            setTargetOccupant(null);
            await fetchRooms();
        } catch (error) {
            console.error('Error renewing:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getOccupants = (roomId) => {
        return assignments.filter(a => a.roomId === roomId);
    };

    const getRoomTypeLabel = (type) => {
        const roomType = ROOM_TYPES.find(t => t.value === type);
        return roomType ? roomType.label : type;
    };

    // Group rooms by building and type
    const groupedRooms = rooms.reduce((acc, room) => {
        const key = `${room.buildingId}_${room.type}`;
        if (!acc[key]) {
            acc[key] = {
                buildingId: room.buildingId,
                buildingName: room.buildingName,
                type: room.type,
                price: room.price,
                capacity: room.capacity,
                rooms: []
            };
        }
        acc[key].rooms.push(room);
        return acc;
    }, {});

    const groupedRoomsArray = Object.values(groupedRooms);



    // Set header when a group is selected
    useEffect(() => {
        if (selectedGroup) {
            setHeader({
                title: `${selectedGroup.buildingName} - ${getRoomTypeLabel(selectedGroup.type)}`,
                onBack: () => setSelectedGroup(null)
            });
        } else {
            // Reset to default
            setHeader({
                title: 'Hostel Management',
                onBack: null // No back button on dashboard
            });
        }

        // Cleanup: Reset header when leaving this page
        return () => {
            setHeader({ title: '', actionBar: null, rightElement: null, onBack: null });
        };
    }, [selectedGroup, setHeader, onBack]);

    // If a group is selected, show detail view
    if (selectedGroup) {
        return (
            <div className="std-container">
                <main className="std-body">
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <p style={{ margin: '0.5rem 0', color: '#666' }}>
                                <strong>Total Rooms:</strong> {selectedGroup.rooms.length}
                            </p>
                            <p style={{ margin: '0.5rem 0', color: '#666' }}>
                                <strong>Capacity:</strong> {selectedGroup.capacity} {selectedGroup.capacity > 1 ? 'people' : 'person'} per room
                            </p>
                            <p style={{ margin: '0.5rem 0', color: '#666' }}>
                                <strong>Price:</strong> रु {selectedGroup.price.toLocaleString()}/month
                            </p>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Room Label</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Occupancy</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Price</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedGroup.rooms.map((room) => {
                                    const occupants = getOccupants(room.id);
                                    const isFull = occupants.length >= room.capacity;

                                    return (
                                        <tr key={room.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '1rem', fontWeight: 600 }}>{room.label}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    backgroundColor: isFull ? '#ffebee' : occupants.length > 0 ? '#e8f5e9' : '#f5f5f5',
                                                    color: isFull ? '#c62828' : occupants.length > 0 ? '#2e7d32' : '#666',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {occupants.length} / {room.capacity}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                रु {room.price.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                    <button
                                                        onClick={() => setSelectedRoom(room)}
                                                        style={{
                                                            background: 'transparent',
                                                            color: '#007AFF',
                                                            border: 'none',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title="View Occupants"
                                                    >
                                                        <Users size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (isFull) {
                                                                alert('Room is full');
                                                                return;
                                                            }
                                                            setTargetRoomForAssignment(room);
                                                            setAssignModalOpen(true);
                                                        }}
                                                        style={{
                                                            background: 'transparent',
                                                            color: isFull ? '#ccc' : '#2e7d32',
                                                            border: 'none',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: isFull ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title="Add Occupant"
                                                        disabled={isFull}
                                                    >
                                                        <UserPlus size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (isFull) {
                                                                alert('Room is full');
                                                                return;
                                                            }
                                                            setTargetRoomForAssignment(room);
                                                            setAssignModalOpen(true);
                                                        }}
                                                        style={{
                                                            background: 'transparent',
                                                            color: isFull ? '#ccc' : '#2e7d32',
                                                            border: 'none',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: isFull ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title="Add Occupant"
                                                        disabled={isFull}
                                                    >
                                                        <UserPlus size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRoom(room.id, room.label)}
                                                        style={{
                                                            background: 'transparent',
                                                            color: '#FF3B30',
                                                            border: 'none',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        title="Delete Room"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </main>

                {/* Occupants Modal */}
                {selectedRoom && (
                    <div className="modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{ background: 'white', borderRadius: '12px', width: '500px', maxWidth: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>Room {selectedRoom.label} Occupants</h3>
                                <button onClick={() => setSelectedRoom(null)} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                            </div>
                            <div style={{ padding: '20px' }}>
                                {getOccupants(selectedRoom.id).length === 0 ? (
                                    <p style={{ textAlign: 'center', color: '#666' }}>No occupants in this room.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {getOccupants(selectedRoom.id).map(occ => (
                                            <div key={occ.id} style={{ padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                    <div>
                                                        <strong>{occ.userName}</strong> ({occ.userMrrNumber || 'N/A'})
                                                        <div style={{ fontSize: '12px', color: '#666' }}>Bed {occ.bedNumber}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', fontSize: '12px' }}>
                                                        <div style={{ color: '#666' }}>Joined: {new Date(occ.assignedAt).toLocaleDateString()}</div>
                                                        <div style={{ fontWeight: 'bold', color: new Date(occ.nextPaymentDue) < new Date() ? 'red' : 'green' }}>
                                                            Due: {new Date(occ.nextPaymentDue).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button
                                                        onClick={() => {
                                                            setTargetOccupant(occ);
                                                            setRenewModalOpen(true);
                                                            // We keep selectedRoom open
                                                        }}
                                                        style={{ flex: 1, padding: '8px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                    >
                                                        Renew
                                                    </button>
                                                    <button
                                                        onClick={() => handleWithdrawOccupant(occ)}
                                                        style={{ flex: 1, padding: '8px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                    >
                                                        Withdraw
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Renewal Modal */}
                {renewModalOpen && targetOccupant && (
                    <div className="modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{ background: 'white', borderRadius: '12px', width: '350px', padding: '24px' }}>
                            <h3 style={{ marginTop: 0 }}>Renew Subscription</h3>
                            <p>Renew for <strong>{targetOccupant.userName}</strong></p>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Duration (Months)</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {[1, 3, 6, 12].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setRenewMonths(m)}
                                            style={{
                                                flex: 1, padding: '10px',
                                                border: renewMonths === m ? '2px solid #1976d2' : '1px solid #ccc',
                                                background: renewMonths === m ? ('#e3f2fd') : 'white',
                                                borderRadius: '6px', cursor: 'pointer'
                                            }}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleRenewOccupant}
                                style={{ width: '100%', padding: '12px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}
                            >
                                Confirm Renewal
                            </button>
                            <button
                                onClick={() => {
                                    setRenewModalOpen(false);
                                    setTargetOccupant(null);
                                }}
                                style={{ width: '100%', padding: '12px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Assignment Modal */}
                {assignModalOpen && targetRoomForAssignment && (
                    <div className="modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{ background: 'white', borderRadius: '12px', width: '450px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyItems: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <h3 style={{ marginTop: 0, flex: 1 }}>Assign Room {targetRoomForAssignment.label}</h3>
                                <button onClick={() => setAssignModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                            </div>

                            {/* User Selection */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select User</label>
                                <input
                                    type="text"
                                    placeholder="Search by name or number..."
                                    value={searchUserQuery}
                                    onChange={(e) => setSearchUserQuery(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: '10px' }}
                                />
                                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px' }}>
                                    {verifiedUsers
                                        .filter(u =>
                                            !searchUserQuery ||
                                            (u.name && u.name.toLowerCase().includes(searchUserQuery.toLowerCase())) ||
                                            (u.phoneNumber && u.phoneNumber.includes(searchUserQuery)) ||
                                            (u.mrrNumber && u.mrrNumber.includes(searchUserQuery))
                                        )
                                        .map(u => (
                                            <div
                                                key={u.id}
                                                onClick={() => setAssignForm({ ...assignForm, userId: u.id })}
                                                style={{
                                                    padding: '8px',
                                                    cursor: 'pointer',
                                                    backgroundColor: assignForm.userId === u.id ? '#e3f2fd' : 'white',
                                                    borderBottom: '1px solid #eee'
                                                }}
                                            >
                                                <div style={{ fontWeight: 'bold' }}>{u.name || 'Unknown'}</div>
                                                <div style={{ fontSize: '12px', color: '#666' }}>{u.phoneNumber} {u.mrrNumber ? `| ${u.mrrNumber}` : ''}</div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            {/* Duration */}
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Duration</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {[1, 3, 6, 12].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setAssignForm({ ...assignForm, months: m })}
                                            style={{
                                                flex: 1, padding: '8px',
                                                border: assignForm.months === m ? '2px solid #2e7d32' : '1px solid #ccc',
                                                background: assignForm.months === m ? '#e8f5e9' : 'white',
                                                borderRadius: '6px', cursor: 'pointer'
                                            }}
                                        >
                                            {m} Mon
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fees */}
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Additional Fees</label>
                                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={assignForm.includeAdmission}
                                        onChange={(e) => setAssignForm({ ...assignForm, includeAdmission: e.target.checked })}
                                        style={{ marginRight: '10px' }}
                                    />
                                    Admission Fee (Rs. 4000)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={assignForm.includeDeposit}
                                        onChange={(e) => setAssignForm({ ...assignForm, includeDeposit: e.target.checked })}
                                        style={{ marginRight: '10px' }}
                                    />
                                    Security Deposit (Rs. 5000)
                                </label>
                            </div>

                            {/* Payment Method */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Payment Method</label>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <label style={{ cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="wallet"
                                            checked={assignForm.paymentMethod === 'wallet'}
                                            onChange={(e) => setAssignForm({ ...assignForm, paymentMethod: e.target.value })}
                                            style={{ marginRight: '5px' }}
                                        />
                                        Deduct from Wallet
                                    </label>
                                    <label style={{ cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="cash"
                                            checked={assignForm.paymentMethod === 'cash'}
                                            onChange={(e) => setAssignForm({ ...assignForm, paymentMethod: e.target.value })}
                                            style={{ marginRight: '5px' }}
                                        />
                                        Cash / Manual
                                    </label>
                                </div>
                            </div>

                            {/* Total Summary */}
                            <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span>Rent ({assignForm.months} mon):</span>
                                    <span>Rs. {(targetRoomForAssignment.price * assignForm.months).toLocaleString()}</span>
                                </div>
                                {assignForm.includeAdmission && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <span>Admission:</span>
                                        <span>Rs. 4,000</span>
                                    </div>
                                )}
                                {assignForm.includeDeposit && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <span>Deposit:</span>
                                        <span>Rs. 5,000</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #ddd', paddingTop: '5px', marginTop: '5px' }}>
                                    <span>Total:</span>
                                    <span>Rs. {(
                                        (targetRoomForAssignment.price * assignForm.months) +
                                        (assignForm.includeAdmission ? 4000 : 0) +
                                        (assignForm.includeDeposit ? 5000 : 0)
                                    ).toLocaleString()}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleAssignHostel}
                                disabled={!assignForm.userId}
                                style={{
                                    width: '100%', padding: '12px',
                                    background: !assignForm.userId ? '#ccc' : '#2e7d32',
                                    color: 'white', border: 'none', borderRadius: '6px',
                                    fontSize: '16px', fontWeight: 'bold', cursor: !assignForm.userId ? 'not-allowed' : 'pointer',
                                    marginBottom: '10px'
                                }}
                            >
                                Confirm Assignment
                            </button>
                            <button
                                onClick={() => {
                                    setAssignModalOpen(false);
                                    setTargetRoomForAssignment(null);
                                }}
                                style={{ width: '100%', padding: '12px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Main grouped view
    return (
        <div className="std-container">
            <main className="std-body">
                <div style={{ background: 'white', padding: '1.5rem', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ margin: 0 }}>Room Categories ({groupedRoomsArray.length})</h2>
                        <button
                            className="btn btn-black"
                            onClick={() => setShowAddForm(!showAddForm)}
                        >
                            {showAddForm ? 'Cancel' : '+ Add Rooms'}
                        </button>
                    </div>

                    {/* Add Form */}
                    {showAddForm && (
                        <form
                            onSubmit={handleAddRoom}
                            style={{
                                background: '#f9f9f9',
                                padding: '1.5rem',
                                borderRadius: '8px',
                                marginBottom: '1.5rem'
                            }}
                        >
                            <h3 style={{ marginTop: 0 }}>Add New Rooms</h3>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                        Building
                                    </label>
                                    <select
                                        value={formData.buildingId}
                                        onChange={(e) => handleBuildingChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #ddd',
                                            borderRadius: '6px'
                                        }}
                                    >
                                        {BUILDING_OPTIONS.map(building => (
                                            <option key={building.id} value={building.id}>
                                                {building.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                        Room Type
                                    </label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => handleTypeChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #ddd',
                                            borderRadius: '6px'
                                        }}
                                    >
                                        {ROOM_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                        Monthly Price (Rs.)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="e.g., 15500"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #ddd',
                                            borderRadius: '6px'
                                        }}
                                        required
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                        Number of Rooms
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={formData.numberOfRooms}
                                        onChange={(e) => setFormData({ ...formData, numberOfRooms: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #ddd',
                                            borderRadius: '6px'
                                        }}
                                    />
                                    <small style={{ color: '#666' }}>How many rooms to create</small>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                                        Starting Number
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.startingNumber}
                                        onChange={(e) => setFormData({ ...formData, startingNumber: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #ddd',
                                            borderRadius: '6px'
                                        }}
                                    />
                                    <small style={{ color: '#666' }}>First room number</small>
                                </div>
                            </div>

                            <button type="submit" className="btn btn-black">
                                Add {formData.numberOfRooms || 1} Room(s)
                            </button>
                        </form>
                    )}

                    {/* Grouped Rooms Table */}
                    {groupedRoomsArray.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                            <p>No rooms added yet. Click "Add Rooms" to get started.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Building</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Room Type</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Total Rooms</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Capacity</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Price</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedRoomsArray.map((group, index) => (
                                        <tr
                                            key={index}
                                            style={{
                                                borderBottom: '1px solid #eee',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                        >
                                            <td style={{ padding: '1rem' }}>{group.buildingName}</td>
                                            <td style={{ padding: '1rem' }}>{getRoomTypeLabel(group.type)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>
                                                {group.rooms.length} rooms
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>{group.capacity}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                रु {group.price.toLocaleString()}/month
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => setSelectedGroup(group)}
                                                        style={{
                                                            background: 'transparent',
                                                            color: '#007AFF',
                                                            border: 'none',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 122, 255, 0.1)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        title="View Details"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingGroup(group);
                                                            setNewPrice(group.price.toString());
                                                            setNewTotalRooms(group.rooms.length.toString());
                                                        }}
                                                        style={{
                                                            background: 'transparent',
                                                            color: '#34C759',
                                                            border: 'none',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(52, 199, 89, 0.1)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        title="Edit Price"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAllInGroup(group)}
                                                        style={{
                                                            background: 'transparent',
                                                            color: '#FF3B30',
                                                            border: 'none',
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.1)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        title="Delete All Rooms"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {/* Edit Group Modal */}
                {editingGroup && (
                    <div className="modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{ background: 'white', borderRadius: '12px', width: '350px', padding: '24px' }}>
                            <h3 style={{ marginTop: 0 }}>Edit Category</h3>
                            <p><strong>{editingGroup.buildingName} - {getRoomTypeLabel(editingGroup.type)}</strong></p>

                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Monthly Price (Rs.)</label>
                                <input
                                    type="number"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Total Rooms</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={newTotalRooms}
                                    onChange={(e) => setNewTotalRooms(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                                />
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                                    Current: {editingGroup.rooms.length} | Occupied: {editingGroup.rooms.length - editingGroup.rooms.filter(r => getOccupants(r.id).length === 0).length}
                                </div>
                                <div style={{ fontSize: '11px', color: '#f57c00', marginTop: '3px', lineHeight: '1.2' }}>
                                    Warning: reducing rooms will permanently delete empty rooms with highest numbers first.
                                </div>
                            </div>

                            <button
                                onClick={() => handleUpdateGroup(editingGroup)}
                                style={{ width: '100%', padding: '12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={() => {
                                    setEditingGroup(null);
                                    setNewPrice('');
                                    setNewTotalRooms('');
                                }}
                                style={{ width: '100%', padding: '12px', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </main >
        </div >
    );
};

export default HostelManagement;
