import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Filter, Package, Calendar } from 'lucide-react'
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
                                        <span className="refill-badge full">
                                            {row.stock_after_refill} Total
                                        </span>
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
