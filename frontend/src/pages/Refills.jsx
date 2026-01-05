import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Filter, Package, Calendar, Camera } from 'lucide-react'
import RefillFormModal from '../components/refills/RefillFormModal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import './Refills.css'

export default function Refills() {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [filterMachine, setFilterMachine] = useState('')

    useEffect(() => {
        fetchHistory()
    }, [])

    const fetchHistory = async () => {
        try {
            // We query 'collections' but filter for 'refill' type
            // Join with machines to get name
            const { data, error } = await supabase
                .from('collections')
                .select(`
                    *,
                    machines (location_name, address)
                `)
                .eq('record_type', 'refill')
                .order('collection_date', { ascending: false })
                .limit(50) // Paginate ideally, but limit for now

            if (error) throw error
            setHistory(data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const filteredHistory = history.filter(item =>
        filterMachine ? item.machines?.location_name.toLowerCase().includes(filterMachine.toLowerCase()) : true
    )

    return (
        <div className="refills-page">
            <header className="refills-header">
                <h2>
                    <Package size={28} color="#10b981" />
                    Historial de Rellenos
                </h2>
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} style={{ marginRight: '6px' }} />
                    Nuevo Relleno
                </button>
            </header>

            <div className="refills-filters">
                <div style={{ position: 'relative' }}>
                    <Filter size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Buscar máquina..."
                        className="filter-input"
                        style={{ paddingLeft: '36px' }}
                        value={filterMachine}
                        onChange={e => setFilterMachine(e.target.value)}
                    />
                </div>
            </div>

            {loading ? <LoadingSpinner /> : (
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
            )}

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

            {showModal && (
                <RefillFormModal
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        fetchHistory() // Refresh list
                    }}
                />
            )}
        </div>
    )
}
