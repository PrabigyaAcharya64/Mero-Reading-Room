import React from 'react';
import { Inbox } from 'lucide-react';
import '../styles/ModuleDashboard.css';

/**
 * StatCard — Top-row KPI card (clickable when onClick is provided)
 */
export function StatCard({ label, value, icon, accent = 'blue', subtitle, onClick }) {
    return (
        <div
            className={`mod-db-stat-card accent-${accent}${onClick ? ' clickable' : ''}`}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
        >
            <div className="mod-db-stat-header">
                <p className="mod-db-stat-label">{label}</p>
                <div className={`mod-db-stat-icon ${accent}`}>{icon}</div>
            </div>
            <h3 className="mod-db-stat-value">{value}</h3>
            {subtitle && <p className="mod-db-stat-sub">{subtitle}{onClick && <span className="mod-db-stat-arrow"> →</span>}</p>}
        </div>
    );
}

/**
 * QuickTile — Compact info tile with Lucide icon
 */
export function QuickTile({ icon, label, value }) {
    return (
        <div className="mod-db-quick-tile">
            <div className="mod-db-tile-icon">{icon}</div>
            <div className="mod-db-tile-content">
                <span className="mod-db-tile-label">{label}</span>
                <span className="mod-db-tile-value">{value}</span>
            </div>
        </div>
    );
}

/**
 * ChartCard — White card wrapper for Recharts content
 */
export function ChartCard({ title, height = 300, children }) {
    return (
        <div className="mod-db-chart-card">
            <div className="mod-db-chart-header">
                <h4 className="mod-db-chart-title">{title}</h4>
            </div>
            <div style={{ width: '100%', height }}>
                {children}
            </div>
        </div>
    );
}

/**
 * TimeRangeBar — Segmented control for global time range
 */
const RANGE_OPTIONS = [
    { key: 'today', label: 'Today' },
    { key: '1w', label: '1W' },
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: '6m', label: '6M' },
    { key: '1y', label: '1Y' },
];

export function TimeRangeBar({ selected, onChange }) {
    return (
        <div className="mod-db-range-bar">
            {RANGE_OPTIONS.map(opt => (
                <button
                    key={opt.key}
                    className={`mod-db-range-btn ${selected === opt.key ? 'active' : ''}`}
                    onClick={() => onChange(opt.key)}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/**
 * EmptyState — Friendly zero-data display
 */
export function EmptyState({ message = 'No data available yet.' }) {
    return (
        <div className="mod-db-empty-state">
            <Inbox size={40} />
            <p>{message}</p>
        </div>
    );
}

/**
 * Shared tooltip style
 */
export function DashboardTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)',
            padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: '12px', lineHeight: 1.5
        }}>
            <p style={{ margin: 0, fontWeight: 700, marginBottom: 3, color: '#1C1C1E' }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ margin: 0, color: p.color || p.fill || '#4b5563' }}>
                    {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue')
                        ? `रु ${p.value.toLocaleString()}`
                        : p.value}
                </p>
            ))}
        </div>
    );
}

/**
 * Shared helper to compute cutoff date from range key
 */
export function getCutoffDate(range) {
    const now = new Date();
    const cutoff = new Date();
    switch (range) {
        case 'today': cutoff.setHours(0, 0, 0, 0); break;
        case '1w': cutoff.setDate(now.getDate() - 7); break;
        case '1m': cutoff.setMonth(now.getMonth() - 1); break;
        case '3m': cutoff.setMonth(now.getMonth() - 3); break;
        case '6m': cutoff.setMonth(now.getMonth() - 6); break;
        case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
        default: cutoff.setMonth(now.getMonth() - 6);
    }
    return cutoff;
}

/**
 * Human-readable label for the selected time range
 */
export function getRangeLabel(range) {
    switch (range) {
        case 'today': return 'Today';
        case '1w': return 'Past 7 Days';
        case '1m': return 'Past Month';
        case '3m': return 'Past 3 Months';
        case '6m': return 'Past 6 Months';
        case '1y': return 'Past Year';
        default: return 'Past 6 Months';
    }
}

/**
 * Build chart data buckets based on range
 */
export function buildTimeBuckets(range) {
    const now = new Date();
    const buckets = [];
    if (range === 'today') {
        for (let h = 0; h <= now.getHours(); h++) {
            buckets.push({
                label: `${h > 12 ? h - 12 : h === 0 ? 12 : h}${h >= 12 ? 'pm' : 'am'}`,
                match: (d) => d.getHours() === h && d.toDateString() === now.toDateString()
            });
        }
    } else if (range === '1w') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.toDateString();
            buckets.push({
                label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                match: (dt) => dt.toDateString() === ds
            });
        }
    } else if (range === '1m') {
        for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.toDateString();
            buckets.push({
                label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                match: (dt) => dt.toDateString() === ds
            });
        }
    } else {
        const months = range === '3m' ? 3 : range === '6m' ? 6 : 12;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const mi = d.getMonth(), yr = d.getFullYear();
            buckets.push({
                label: monthNames[mi],
                match: (dt) => dt.getMonth() === mi && dt.getFullYear() === yr
            });
        }
    }
    return buckets;
}
