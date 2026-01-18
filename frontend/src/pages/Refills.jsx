import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Plus, Filter, Package, Calendar, Camera, ArrowLeft, Search, FileText } from 'lucide-react'
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

    // Filter Logic for History
    const filteredHistory = history.filter(item =>
        filterHistoryMachine ? item.machines?.location_name.toLowerCase().includes(filterHistoryMachine.toLowerCase()) : true
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
                <div className="header-actions">
                    <button
                        className="btn-secondary"
                        onClick={() => setViewMode(viewMode === 'list' ? 'history' : 'list')}
                    >
                        {viewMode === 'list' ? (
                            <>
                                <Calendar size={18} style={{ marginRight: 8 }} />
                                Ver Historial
                            </>
                        ) : (
                            <>
                                <Plus size={18} style={{ marginRight: 8 }} />
                                Nuevo Relleno
                            </>
                        )}
                    </button>
                </div>
            </header>

            <div className="main-content-area" style={{ display: 'block' }}>
                {viewMode === 'list' ? (
                    /* Left Panel: Active Locations to Service */
                    <div className="panel machine-list-panel glass" style={{ width: '100%', maxWidth: 'none' }}>
                        <div className="panel-header">
                            <h3>Puntos de Venta (Locaciones)</h3>
                            <span className="badge">{filteredLocations.length} Puntos</span>
                        </div>

                        <div className="search-box-container">
                            <Search size={16} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Buscar punto..."
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>

                        <div className="scrollable-list" style={{ maxHeight: 'none' }}>
                            {filteredLocations.map(location => (
                                <div
                                    key={location.id}
                                    className="machine-item glass-hover"
                                    onClick={() => handleOpenRefillModal(location)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="m-info">
                                        <h4>{location.name}</h4>
                                        <p className="sub-text">
                                            Stock Total: {location.current_total_stock || 0} / {location.total_capacity || 0} capsules
                                            <span style={{ marginLeft: 6, color: location.fill_percentage < 30 ? '#ef4444' : '#94a3b8' }}>
                                                ({location.fill_percentage.toFixed(0)}%)
                                            </span>
                                        </p>
                                    </div>
                                    <div className="stock-indicator-mini" style={{ width: 60, height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                                        <div style={{ width: `${location.fill_percentage}%`, height: '100%', background: location.fill_percentage < 30 ? '#ef4444' : '#10b981' }}></div>
                                    </div>
                                    <div className="action-btn-icon" title="Registrar Relleno" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', marginLeft: 'auto' }}>
                                        <Package size={24} />
                                    </div>
                                </div>
                            ))}
                            {filteredLocations.length === 0 && (
                                <div className="empty-search-state">
                                    <p>No se encontraron resultados.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Right Panel: History View */
                    <div className="panel history-panel glass" style={{ width: '100%', maxWidth: 'none' }}>
                        <div className="panel-header">
                            <h3>Historial de Rellenos</h3>
                        </div>

                        <div className="refills-filters" style={{ marginBottom: 20 }}>
                            <div style={{ position: 'relative' }}>
                                <Filter size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder="Filtrar historial por máquina..."
                                    className="filter-input"
                                    style={{ paddingLeft: '36px', width: '100%', boxSizing: 'border-box' }}
                                    value={filterHistoryMachine}
                                    onChange={e => setFilterHistoryMachine(e.target.value)}
                                />
                            </div>
                        </div>

                        {isLoadingData ? <LoadingSpinner /> : (
                            <>
                                <div className="glass refills-table-container">
                                    <table className="refills-table">
                                        <thead>
                                            <tr>
                                                <th>Máquina</th>
                                                <th>Fecha</th>
                                                <th>Carga (+Qty)</th>
                                                <th>Nivel Final</th>
                                                <th>Evidencia</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredHistory.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                                        No hay registros de rellenos aún.
                                                    </td>
                                                </tr>
                                            ) : filteredHistory.map(row => (
                                                <tr key={row.id}>
                                                    <td>
                                                        <div className="machine-info-cell">
                                                            <span className="machine-name">{row.machines?.location_name || 'Máquina Eliminada'}</span>
                                                            <span className="machine-addr">{row.machines?.address?.substring(0, 30)}...</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                                                            <Calendar size={14} />
                                                            {new Date(row.collection_date).toLocaleDateString()}
                                                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                                                {new Date(row.collection_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: '#10b981' }}>
                                                            +{row.inventory_refilled} caps
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span className="refill-badge full" style={{ width: 'fit-content' }}>
                                                                {row.stock_after_refill} Total
                                                            </span>
                                                            {/* Visual Bar for Desktop */}
                                                            <div className="desktop-stock-bar">
                                                                <div
                                                                    className="desktop-stock-fill"
                                                                    style={{
                                                                        width: `${Math.min(100, (row.stock_after_refill / 180) * 100)}%`,
                                                                        background: row.stock_after_refill < 50 ? '#ef4444' : '#10b981'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {row.evidence_photo_url ? (
                                                            <a href={row.evidence_photo_url} target="_blank" rel="noopener noreferrer" className="photo-link">
                                                                Ver Foto ↗
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>--</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View (Hidden on Desktop) */}
                                <div className="refills-mobile-list">
                                    {filteredHistory.map(row => (
                                        <div key={row.id} className="refill-card">
                                            <div className="card-top">
                                                <div className="card-info">
                                                    <h4>{row.machines?.location_name || 'Máquina Eliminada'}</h4>
                                                    <p><Calendar size={12} /> {new Date(row.collection_date).toLocaleDateString()} • {new Date(row.collection_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                                {row.inventory_refilled > 50 ?
                                                    <span className="card-status-badge" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>Full</span> :
                                                    <span className="card-status-badge">Parcial</span>}
                                            </div>

                                            <div className="card-stats">
                                                <div className="stat-block">
                                                    <label>Agregado</label>
                                                    <div className="value" style={{ color: '#10b981' }}>+{row.inventory_refilled}</div>
                                                </div>
                                                <div className="stat-block">
                                                    <label>Stock Final</label>
                                                    <div className="value">
                                                        {row.stock_after_refill}
                                                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>/ 180</span>
                                                    </div>
                                                    <div className="stock-indicator-mobile">
                                                        <div
                                                            className="indicator-fill"
                                                            style={{
                                                                width: `${Math.min(100, (row.stock_after_refill / 180) * 100)}%`,
                                                                background: row.stock_after_refill < 50 ? '#ef4444' : '#10b981'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="card-actions">
                                                {row.evidence_photo_url ? (
                                                    <a href={row.evidence_photo_url} target="_blank" rel="noopener noreferrer" className="photo-link">
                                                        <Camera size={14} /> Ver Evidencia
                                                    </a>
                                                ) : <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Sin foto</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {showModal && (
                <RefillFormModal
                    location={selectedLocation}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        showToast("Rellenos registrados correctamente", 'success')
                    }}
                    showToast={showToast}
                />
            )}
        </div>
    )
}
