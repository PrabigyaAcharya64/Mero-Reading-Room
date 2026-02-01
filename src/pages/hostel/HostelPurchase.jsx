import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useLoading } from '../../context/GlobalLoadingContext';
import PageHeader from '../../components/PageHeader';
import { HOSTEL_CONFIG, getRoomTypes, calculateHostelCost } from '../../config/hostelConfig';
import '../../styles/Hostel.css';
import '../../styles/StandardLayout.css';

const PACKAGE_OPTIONS = [
    { label: '1 Month', value: 1 },
    { label: '3 Months', value: 3 },
    { label: '6 Months', value: 6 },
    { label: '12 Months', value: 12 }
];

const HostelPurchase = ({ onBack, onNavigate }) => {
    const { user } = useAuth();
    const { setIsLoading } = useLoading();

    const [step, setStep] = useState(1); // 1: select room, 2: select package, 3: confirm
    const [selectedBuildingRoomType, setSelectedBuildingRoomType] = useState(null);
    const [selectedMonths, setSelectedMonths] = useState(1);
    const [userBalance, setUserBalance] = useState(0);
    const [isFirstTime, setIsFirstTime] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [roomTypes, setRoomTypes] = useState([]);
    const [availability, setAvailability] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            setIsLoading(true);
            try {
                // Fetch user data
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUserBalance(userData.balance || 0);
                    setIsFirstTime(!userData.hostelRegistrationPaid);
                }

                // Fetch hostel rooms from Firestore
                const roomsSnapshot = await getDocs(collection(db, 'hostelRooms'));
                const assignmentsSnapshot = await getDocs(collection(db, 'hostelAssignments'));

                // Count occupancy
                const occupancyMap = {};
                assignmentsSnapshot.forEach(doc => {
                    const assignment = doc.data();
                    if (assignment.status === 'active') {
                        const key = `${assignment.roomId}_${assignment.bedNumber}`;
                        occupancyMap[key] = true;
                    }
                });

                // Calculate availability per room type
                const availabilityMap = {};
                const typesSet = new Map();

                roomsSnapshot.forEach(doc => {
                    const room = { id: doc.id, ...doc.data() };
                    const typeKey = `${room.buildingId}_${room.type}`;

                    if (!typesSet.has(typeKey)) {
                        typesSet.set(typeKey, {
                            buildingId: room.buildingId,
                            buildingName: room.buildingName,
                            type: room.type,
                            price: room.price,
                            capacity: room.capacity
                        });
                    }

                    // Count available beds
                    const availableBedsInRoom = [];
                    for (let bed = 1; bed <= room.capacity; bed++) {
                        const key = `${room.id}_${bed}`;
                        if (!occupancyMap[key]) {
                            availableBedsInRoom.push(bed);
                        }
                    }

                    if (availableBedsInRoom.length > 0) {
                        if (!availabilityMap[typeKey]) {
                            availabilityMap[typeKey] = 0;
                        }
                        availabilityMap[typeKey] += availableBedsInRoom.length;
                    }
                });

                setRoomTypes(Array.from(typesSet.values()));
                setAvailability(availabilityMap);

            } catch (error) {
                console.error('Error fetching data:', error);
                setError('Failed to load room information.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user, setIsLoading]);

    const getRoomTypeName = (type) => {
        const names = {
            single: 'Single Room',
            single_attached: 'Single Attached',
            double: 'Twin Sharing',
            twin: 'Twin Sharing',
            twin_attached: 'Twin Sharing Attached',
            triple: 'Triple Sharing'
        };
        return names[type] || type;
    };

    const handleRoomSelect = (roomType) => {
        setSelectedBuildingRoomType(roomType);
        setError('');
        setStep(2);
    };

    const handlePackageSelect = (months) => {
        setSelectedMonths(months);
        setError('');
        setStep(3);
    };

    const handlePurchase = async () => {
        if (!selectedBuildingRoomType || !selectedMonths) return;

        setIsSubmitting(true);
        setError('');

        try {
            const processHostelPurchase = httpsCallable(functions, 'processHostelPurchase');
            const result = await processHostelPurchase({
                buildingId: selectedBuildingRoomType.buildingId,
                roomType: selectedBuildingRoomType.type,
                months: selectedMonths
            });

            if (result.data.success) {
                alert(
                    `Hostel room booked successfully!\n\n` +
                    `Building: ${result.data.roomInfo.buildingName}\n` +
                    `Room: ${result.data.roomInfo.roomLabel}\n` +
                    `Bed: ${result.data.roomInfo.bedNumber}\n\n` +
                    `Next payment due: ${new Date(result.data.nextPaymentDue).toLocaleDateString()}`
                );
                onNavigate('status');
            }
        } catch (err) {
            console.error('Purchase failed:', err);
            setError(err.message || 'Failed to process purchase. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const costBreakdown = selectedBuildingRoomType
        ? calculateHostelCost(selectedBuildingRoomType.price, selectedMonths, isFirstTime)
        : null;

    const canAfford = costBreakdown ? userBalance >= costBreakdown.total : false;

    // Step 1: Room Type Selection
    if (step === 1) {
        return (
            <div className="std-container">
                <PageHeader title="Select Room Type" onBack={onBack} forceShowBack={true} />

                <main className="std-body">
                    <div className="hostel-purchase-card">
                        <h2 className="page-title">Choose Your Room</h2>
                        <p className="page-subtitle">
                            Select a room type from any of our 3 buildings
                        </p>

                        {error && <div className="error-msg">{error}</div>}

                        <div className="room-types-grid">
                            {roomTypes.map((roomType) => {
                                const typeKey = `${roomType.buildingId}_${roomType.type}`;
                                const availableBeds = availability[typeKey] || 0;
                                const isAvailable = availableBeds > 0;

                                return (
                                    <div
                                        key={typeKey}
                                        className={`room-type-card ${!isAvailable ? 'unavailable' : ''}`}
                                        onClick={() => isAvailable && handleRoomSelect(roomType)}
                                    >
                                        <div className="room-type-header">
                                            <h3 className="room-type-name">{getRoomTypeName(roomType.type)}</h3>
                                            <span className="room-type-building">{roomType.buildingName}</span>
                                        </div>
                                        <div className="room-type-info">
                                            <div className="room-capacity">
                                                <span className="capacity-icon">
                                                    {roomType.capacity === 1 ? '👤' : roomType.capacity === 2 ? '👥' : '👥👥'}
                                                </span>
                                                <span className="capacity-text">
                                                    {roomType.capacity} {roomType.capacity === 1 ? 'Person' : 'People'}
                                                </span>
                                            </div>
                                            <div className="room-price">
                                                <span className="price-amount">रु {roomType.price.toLocaleString()}</span>
                                                <span className="price-period">/month</span>
                                            </div>
                                        </div>
                                        <div className="room-availability">
                                            {isAvailable ? (
                                                <span className="available-badge">{availableBeds} bed{availableBeds > 1 ? 's' : ''} available</span>
                                            ) : (
                                                <span className="unavailable-badge">No beds available</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Step 2: Package Selection
    if (step === 2) {
        return (
            <div className="std-container">
                <PageHeader title="Select Package" onBack={() => setStep(1)} forceShowBack={true} />

                <main className="std-body">
                    <div className="hostel-purchase-card">
                        <div className="selected-room-banner">
                            <h3>{getRoomTypeName(selectedBuildingRoomType.type)}</h3>
                            <p>{selectedBuildingRoomType.buildingName} - रु {selectedBuildingRoomType.price.toLocaleString()}/month</p>
                        </div>

                        <h2 className="page-title">Choose Duration</h2>
                        <p className="page-subtitle">How many months would you like to stay?</p>

                        {error && <div className="error-msg">{error}</div>}

                        <div className="package-grid">
                            {PACKAGE_OPTIONS.map(pkg => {
                                const cost = calculateHostelCost(selectedBuildingRoomType.price, pkg.value, isFirstTime);

                                return (
                                    <div
                                        key={pkg.value}
                                        className="package-card"
                                        onClick={() => handlePackageSelect(pkg.value)}
                                    >
                                        <div className="package-duration">
                                            <span className="duration-value">{pkg.value}</span>
                                            <span className="duration-label">Month{pkg.value > 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="package-price">
                                            <span className="package-total">रु {cost.total.toLocaleString()}</span>
                                            {pkg.value > 1 && (
                                                <span className="package-monthly">
                                                    रु {Math.round(cost.total / pkg.value).toLocaleString()}/month avg
                                                </span>
                                            )}
                                        </div>
                                        {pkg.value === 12 && (
                                            <span className="package-badge">Best Value</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Step 3: Confirmation
    return (
        <div className="std-container">
            <PageHeader title="Confirm Purchase" onBack={() => setStep(2)} forceShowBack={true} />

            <main className="std-body">
                <div className="hostel-purchase-card">
                    <h2 className="page-title">Review Your Purchase</h2>

                    <div className="purchase-summary">
                        <div className="summary-section">
                            <h3>Room Details</h3>
                            <div className="summary-item">
                                <span>Type:</span>
                                <span>{getRoomTypeName(selectedBuildingRoomType.type)}</span>
                            </div>
                            <div className="summary-item">
                                <span>Building:</span>
                                <span>{selectedBuildingRoomType.buildingName}</span>
                            </div>
                            <div className="summary-item">
                                <span>Duration:</span>
                                <span>{selectedMonths} Month{selectedMonths > 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        <div className="summary-section">
                            <h3>Cost Breakdown</h3>
                            <div className="summary-item">
                                <span>Monthly Rate × {selectedMonths}:</span>
                                <span>रु {costBreakdown.monthlyTotal.toLocaleString()}</span>
                            </div>
                            {costBreakdown.registrationFee > 0 && (
                                <div className="summary-item">
                                    <span>Registration Fee:</span>
                                    <span>रु {costBreakdown.registrationFee.toLocaleString()}</span>
                                </div>
                            )}
                            {costBreakdown.deposit > 0 && (
                                <div className="summary-item refundable">
                                    <span>Deposit (Refundable):</span>
                                    <span>रु {costBreakdown.deposit.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="summary-item total">
                                <span>Total:</span>
                                <span>रु {costBreakdown.total.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="balance-info">
                            <div className="balance-row">
                                <span>Your Balance:</span>
                                <span className={canAfford ? 'sufficient' : 'insufficient'}>
                                    रु {userBalance.toLocaleString()}
                                </span>
                            </div>
                            {!canAfford && (
                                <div className="insufficient-notice">
                                    You need रु {(costBreakdown.total - userBalance).toLocaleString()} more
                                </div>
                            )}
                        </div>
                    </div>

                    {error && <div className="error-msg">{error}</div>}

                    <button
                        className="btn btn-black btn-block"
                        onClick={handlePurchase}
                        disabled={isSubmitting || !canAfford}
                    >
                        {isSubmitting ? 'Processing...' : canAfford ? 'Confirm Purchase' : 'Insufficient Balance'}
                    </button>
                </div>
            </main>
        </div>
    );
};

export default HostelPurchase;
