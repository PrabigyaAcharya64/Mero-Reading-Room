import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import PageHeader from '../../components/PageHeader';
import { formatDate } from '../../utils/dateFormat';
import { Check, X, Eye } from 'lucide-react';
import StudentDetailModal from './UserDetailView'; // Reusing UserDetailView for details if needed, or create a specific one. 
// Actually, better to just show the enrollment details in a modal or reuse UserDetailView passing the user ID.
// For now, let's list them and maybe show a simple modal with the form.

function EnrollmentRequests({ onBack }) {
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEnrollment, setSelectedEnrollment] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    useEffect(() => {
        const q = query(
            collection(db, 'readingRoomEnrollments'),
            orderBy('submittedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setEnrollments(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching enrollments:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleUpdateStatus = async (enrollmentId, newStatus) => {
        if (!confirm(`Are you sure you want to mark this as ${newStatus}?`)) return;

        try {
            await updateDoc(doc(db, 'readingRoomEnrollments', enrollmentId), {
                status: newStatus,
                reviewedAt: new Date().toISOString()
            });

            // If approved, optionally update the user record too?
            // The logic in UserDetailView checks for 'approved' status, so this should be enough.
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status");
        }
    };

    return (
        <div className="std-container">
            <PageHeader
                title="Enrollment Requests"
                onBack={onBack}
            />

            <main className="std-body">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">Reading Room Applications</h2>

                    {loading ? (
                        <div className="text-center py-10">Loading...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                                        <th className="p-3 font-semibold text-gray-700">Applicant</th>
                                        <th className="p-3 font-semibold text-gray-700">Submitted Date</th>
                                        <th className="p-3 font-semibold text-gray-700">College</th>
                                        <th className="p-3 font-semibold text-gray-700">Mobile</th>
                                        <th className="p-3 font-semibold text-gray-700">Status</th>
                                        <th className="p-3 font-semibold text-gray-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enrollments.map(item => (
                                        <tr key={item.id} className="border-b hover:bg-gray-50">
                                            <td className="p-3">
                                                <div className="font-medium text-gray-900">{item.name}</div>
                                                <div className="text-sm text-gray-500">{item.email}</div>
                                            </td>
                                            <td className="p-3 text-gray-600">
                                                {formatDate(item.submittedAt || item.declarationDate)}
                                            </td>
                                            <td className="p-3 text-gray-600">{item.college}</td>
                                            <td className="p-3 text-gray-600">{item.mobileNo}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                    ${item.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                        item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                            'bg-yellow-100 text-yellow-800'}`}>
                                                    {(item.status || 'pending').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex gap-2">
                                                    {(!item.status || item.status === 'pending') && (
                                                        <>
                                                            <button
                                                                onClick={() => handleUpdateStatus(item.id, 'approved')}
                                                                className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100"
                                                                title="Approve"
                                                            >
                                                                <Check size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateStatus(item.id, 'rejected')}
                                                                className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                                                                title="Reject"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {enrollments.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-gray-500">
                                                No enrollment requests found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default EnrollmentRequests;
