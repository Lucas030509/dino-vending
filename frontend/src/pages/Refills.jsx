import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Plus, Filter, Package, Calendar, Camera, ArrowLeft, Search, FileText, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react'
import RefillFormModal from '../components/refills/RefillFormModal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Toast } from '../components/ui/Toast' // Add import
import './Refills.css'

export default function Refills() {
    // Offset standard imports
    // Offline Data
    const locationsData = useLiveQuery(() => db.locations.toArray())
    const machinesData = useLiveQuery(() => db.machines.orderBy('location_name').toArray())
    const historyData = useLiveQuery(() =>
        db.collections
            .where('record_type').equals('refill')
            .reverse()
            .sortBy('collection_date')
            .then(items => items.reverse())
    )

    const locations = locationsData || []
    const machines = machinesData || []
    const history = historyData || []
    const isLoadingData = !locationsData || !machinesData || !historyData

    const [viewMode, setViewMode] = useState('list') // 'list' or 'history'
    const [filterQuery, setFilterQuery] = useState('')

    // Toast State
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type })
    }
    const hideToast = () => setToast({ ...toast, show: false })

    // Group Machines by Location
    const [groupedLocations, setGroupedLocations] = useState([])
    const [filteredLocations, setFilteredLocations] = useState([])

    useEffect(() => {
        if (!locations.length && !machines.length) return

        const joined = locations.map(loc => {
            const myMachines = machines.filter(m => m.location_id === loc.id)
            const totalCap = myMachines.reduce((acc, m) => acc + (m.capsule_capacity || 180), 0)
            const currentStock = myMachines.reduce((acc, m) => acc + (m.current_stock_snapshot || 0), 0)

            return {
                ...loc,
                machines: myMachines,
                total_machines: myMachines.length,
                total_capacity: totalCap,
                current_total_stock: currentStock,
                fill_percentage: totalCap > 0 ? (currentStock / totalCap) * 100 : 0
            }
        })

        // Handle Orphans (Legacy Data Support)
        const orphans = machines.filter(m => !m.location_id)
        if (orphans.length > 0) {
            const totalCap = orphans.reduce((acc, m) => acc + (m.capsule_capacity || 180), 0)
            const currentStock = orphans.reduce((acc, m) => acc + (m.current_stock_snapshot || 0), 0)
            joined.push({
                id: 'orphan',
                name: '⚠️ Sin Ubicación',
                address: 'Requiere actualizar datos en sección Máquinas',
                machines: orphans,
                total_machines: orphans.length,
                total_capacity: totalCap,
                current_total_stock: currentStock,
                fill_percentage: totalCap > 0 ? (currentStock / totalCap) * 100 : 0,
                is_orphan: true
            })
        }

        setGroupedLocations(joined)
    }, [locations, machines])

    // Modal State
    const [showModal, setShowModal] = useState(false)
    const [selectedLocation, setSelectedLocation] = useState(null)
    const [filterHistoryMachine, setFilterHistoryMachine] = useState('')

    // Filter Logic for Locations List
    useEffect(() => {
        if (!filterQuery) {
            setFilteredLocations(groupedLocations)
        } else {
            const query = filterQuery.toLowerCase()
            const filtered = groupedLocations.filter(loc =>
                (loc.name && loc.name.toLowerCase().includes(query)) ||
                (loc.address && loc.address.toLowerCase().includes(query))
            )
            setFilteredLocations(filtered)
        }
    }, [filterQuery, groupedLocations])

    // Mini-Dashboard Statistics
    const inventoryStats = React.useMemo(() => {
        const stats = {
            criticalNodes: 0,
            criticalMachines: 0,
            lowNodes: 0,
            lowMachines: 0,
            goodNodes: 0,
            goodMachines: 0
        };

        groupedLocations.forEach(loc => {
            const fill = loc.fill_percentage || 0;
            if (fill < 25) {
                stats.criticalNodes++;
                stats.criticalMachines += loc.total_machines;
            } else if (fill < 50) {
                stats.lowNodes++;
                stats.lowMachines += loc.total_machines;
            } else {
                stats.goodNodes++;
                stats.goodMachines += loc.total_machines;
            }
        });
        return stats;
    }, [groupedLocations]);

    // Filter Logic for History
    const filteredHistory = history.filter(item =>
        filterHistoryMachine ? (item.machines?.location_name || '').toLowerCase().includes(filterHistoryMachine.toLowerCase()) : true
    )

    const handleOpenRefillModal = (location) => {
        if (location.is_orphan) {
            showToast("Estas máquinas no tienen una ubicación asignada. Por favor ve a la pestaña Máquinas y edítalas para asignarles una ubicación.", 'error')
            return
        }
        setSelectedLocation(location)
        setShowModal(true)
    }

    return (
        <div className="refills-page">
            <Toast
                show={toast.show}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
            />
            <header className="page-header">
                <div className="header-left">
                    <Link to="/" className="back-btn">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1>Inventario y Rellenos</h1>
                        <p className="subtitle">Gestión de stock de cápsulas</p>
                    </div>
                </div>
            </header>

            <div className="refills-summary-bar">
                <div className="summary-card critical card-glow">
                    <div className="card-icon"><AlertCircle size={22} /></div>
                    <div className="card-info">
                        <span className="count">{inventoryStats.criticalMachines}</span>
                        <span className="label">Crítico</span>
                        <span className="sub">{inventoryStats.criticalNodes} Puntos</span>
                    </div>
                </div>
                <div className="summary-card warning card-glow">
                    <div className="card-icon"><Package size={22} /></div>
                    <div className="card-info">
                        <span className="count">{inventoryStats.lowMachines}</span>
                        <span className="label">Bajo</span>
                        <span className="sub">{inventoryStats.lowNodes} Puntos</span>
                    </div>
                </div>
                <div className="summary-card good card-glow">
                    <div className="card-icon"><CheckCircle2 size={22} /></div>
                    <div className="card-info">
                        <span className="count">{inventoryStats.goodMachines}</span>
                        <span className="label">Óptimo</span>
                        <span className="sub">{inventoryStats.goodNodes} Puntos</span>
                    </div>
                </div>
            </div>

            <div className="toolbar-glass">
                <div className="search-filter">
                    <Search size={18} className="search-icon-dim" />
                    <input
                        type="text"
                        placeholder={viewMode === 'list' ? "Buscar punto..." : "Buscar historial..."}
                        value={viewMode === 'list' ? filterQuery : filterHistoryMachine}
                        onChange={(e) => viewMode === 'list' ? setFilterQuery(e.target.value) : setFilterHistoryMachine(e.target.value)}
                    />
                </div>

                <div className="view-switcher-container">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`view-switcher-btn ${viewMode === 'list' ? 'active' : ''}`}
                    >
                        <Package size={18} />
                        <span className="hide-mobile">Inventario</span>
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`view-switcher-btn ${viewMode === 'history' ? 'active' : ''}`}
                    >
                        <Calendar size={18} />
                        <span className="hide-mobile">Historial</span>
                    </button>
                </div>

                <div className="actions">
                    <button
                        className="add-btn primary"
                        onClick={() => setViewMode('list')}
                    >
                        <Plus size={18} />
                        Nueva Carga
                    </button>
                </div>
            </div>

            <main className="main-content-area">
                {isLoadingData ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                        <LoadingSpinner />
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="inventory-grid">
                        {filteredLocations.map(location => {
                            const fillPercent = location.fill_percentage || 0;
                            const statusClass = fillPercent < 25 ? 'critical' : fillPercent < 50 ? 'warning' : 'good';
                            const statusText = fillPercent < 25 ? 'Crítico' : fillPercent < 50 ? 'Bajo' : 'Bueno';

                            return (
                                <div
                                    key={location.id}
                                    className="inventory-card card-glow"
                                    onClick={() => handleOpenRefillModal(location)}
                                >
                                    <div className="c-header">
                                        <div className="status-badge">
                                            <span className={`status-dot ${statusClass}`}></span>
                                            {statusText}
                                        </div>
                                        <div className="action-icon-pill">
                                            <Package size={18} />
                                        </div>
                                    </div>

                                    <div className="c-body">
                                        <h4>{location.name}</h4>
                                        <div className="inventory-stats-mini">
                                            <div className="stat-pill">
                                                <span className="label">Maq.</span>
                                                <span className="val">{location.total_machines}</span>
                                            </div>
                                            <div className="stat-pill">
                                                <span className="label">Stock</span>
                                                <span className="val">{location.current_total_stock || 0}</span>
                                            </div>
                                            <div className="stat-pill">
                                                <span className="label">Cap.</span>
                                                <span className="val">{location.total_capacity || 0}</span>
                                            </div>
                                        </div>

                                        <div className="progress-bar-container">
                                            <div
                                                className={`progress-bar-fill ${statusClass}`}
                                                style={{
                                                    width: `${Math.min(100, fillPercent)}%`,
                                                    background: fillPercent < 25 ? '#ef4444' : fillPercent < 50 ? '#f59e0b' : '#10b981'
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Llenado Total</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 700 }}>{fillPercent.toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    <div className="c-footer">
                                        <div className="address-link">
                                            <MapPin size={12} />
                                            <span>
                                                {location.address || 'Sin dirección'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredLocations.length === 0 && (
                            <div className="empty-state" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-dim)' }}>
                                <Package size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                                <p>No se encontraron puntos de venta.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="history-container glass">
                        <table className="refills-table">
                            <thead>
                                <tr>
                                    <th>Locación</th>
                                    <th>Fecha y Carga</th>
                                    <th>Cantidad</th>
                                    <th>Stock Final</th>
                                    <th>Evidencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-dim)' }}>
                                            No hay registros de rellenos.
                                        </td>
                                    </tr>
                                ) : filteredHistory.map(row => (
                                    <tr key={row.id}>
                                        <td>
                                            <div className="machine-cell">
                                                <span className="name">{row.machines?.location_name || 'Desconocida'}</span>
                                                <span className="addr">{row.machines?.address?.substring(0, 30)}...</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)' }}>
                                                <Calendar size={14} />
                                                {new Date(row.collection_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                                <span style={{ opacity: 0.7 }}>{new Date(row.collection_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge-qty">+{row.inventory_refilled} caps</span>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>
                                            {row.stock_after_refill} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>/ 180</span>
                                        </td>
                                        <td>
                                            {row.evidence_photo_url ? (
                                                <a href={row.evidence_photo_url} target="_blank" rel="noopener noreferrer" className="photo-link">
                                                    <Camera size={14} /> Foto
                                                </a>
                                            ) : '--'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {showModal && (
                <RefillFormModal
                    location={selectedLocation}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        showToast("Relleno registrado correctamente", 'success')
                    }}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
