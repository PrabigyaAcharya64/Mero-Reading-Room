import React from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useCoupons } from '../hooks/useCoupons';
import { Tag, Clock } from 'lucide-react';

export default function CouponSelector({ serviceType, onSelect }) {
    const { user } = useAuth();
    const { coupons, loading } = useCoupons(user?.uid, serviceType);

    if (loading || coupons.length === 0) return null;

    return (
        <div className="coupon-selector-container" style={{ marginTop: '15px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag size={14} /> Available Coupons
            </h4>
            <div className="coupon-list" style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {coupons.map((coupon) => (
                    <div
                        key={coupon.id}
                        onClick={() => onSelect(coupon.code)}
                        style={{
                            border: '1px dashed #000',
                            borderRadius: '8px',
                            padding: '10px',
                            cursor: 'pointer',
                            backgroundColor: '#fafafa',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        className="coupon-card"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '14px', fontFamily: 'monospace', backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>
                                {coupon.code}
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#16a34a' }}>
                                {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `Rs ${coupon.value} OFF`}
                            </span>
                        </div>

                        {coupon.minAmount > 0 && (
                            <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                                Min spend: Rs {coupon.minAmount}
                            </div>
                        )}

                        {coupon.expiryDate && (
                            <div style={{ fontSize: '10px', color: '#999', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '5px' }}>
                                <Clock size={10} /> Expires: {new Date(coupon.expiryDate).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
