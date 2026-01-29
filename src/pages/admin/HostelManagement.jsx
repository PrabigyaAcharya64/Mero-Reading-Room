import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Eye, Edit, Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useLoading } from '../../context/GlobalLoadingContext';
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
    const [rooms, setRooms] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [editingGroup, setEditingGroup] = useState(null);
    const [newPrice, setNewPrice] = useState('');

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
        const loadInitialData = async () => {
            await fetchRooms();
            if (onDataLoaded) onDataLoaded();
        };
        loadInitialData();
    }, []);

    const fetchRooms = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'hostelRooms'));
            const roomsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            roomsData.sort((a, b) => {
                if (a.buildingId !== b.buildingId) {
                    return a.buildingId.localeCompare(b.buildingId);
                }
                return a.label.localeCompare(b.label);
            });
            setRooms(roomsData);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            alert('Failed to load rooms');
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



    // If a group is selected, show detail view
    if (selectedGroup) {
        return (
            <div className="std-container">
                <PageHeader
                    title={`${selectedGroup.buildingName} - ${getRoomTypeLabel(selectedGroup.type)}`}
                    onBack={() => setSelectedGroup(null)}
                />
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
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Capacity</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Price</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedGroup.rooms.map((room) => (
                                    <tr key={room.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '1rem', fontWeight: 600 }}>{room.label}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>{room.capacity}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            रु {room.price.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
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
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.1)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                    title="Delete Room"
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
                </main>
            </div>
        );
    }

    // Main grouped view
    return (
        <div className="std-container">
            <PageHeader title="Hostel Management" />

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
            </main >
        </div >
    );
};

export default HostelManagement;
