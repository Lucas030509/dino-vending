import React, { useState } from 'react'
import { Search, Plus, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

export function LinkMachineModal({ isOpen, onClose, location, onLink, onCreateNew, onUnlink }) {
    if (!isOpen) return null

    const machines = useLiveQuery(() => db.machines.toArray()) || []
    const [searchQuery, setSearchQuery] = useState('')

    // Filter machines
    // STRICT HIDE: If assigned anywhere, do not show.
    const filteredMachines = machines.filter(m => {
        if (m.location_id) return false
        const q = searchQuery.toLowerCase()
        return (
            (m.qr_code_uid && m.qr_code_uid.toLowerCase().includes(q)) ||
            (m.location_name && m.location_name.toLowerCase().includes(q)) ||
            (m.address && m.address.toLowerCase().includes(q))
        )
    }).sort((a, b) => {
        // Sort by ID or name
        return (a.qr_code_uid || '').localeCompare(b.qr_code_uid || '')
    })

    return (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
            <div className="glass modal-content" style={{ maxWidth: '600px' }}>
                <h3 style={{ marginBottom: '20px' }}>Agregar Máquina a {location?.name}</h3>

                <div className="current-machines" style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Máquinas Asignadas ({machines.filter(m => m.location_id === location.id).length})
                    </h4>
                    {machines.filter(m => m.location_id === location.id).length === 0 ? (
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.85rem', color: '#64748b' }}>
                            No hay máquinas asignadas.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {machines.filter(m => m.location_id === location.id).map(m => (
                                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CheckCircle2 size={16} className="teal" />
                                        <span style={{ fontWeight: 500 }}>{m.qr_code_uid || m.nickname || 'Sin ID'}</span>
                                    </div>
                                    <button
                                        onClick={() => onUnlink && onUnlink(m)} // Use existing remove logic passed as prop
                                        className="btn-secondary"
                                        style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto', minHeight: 'unset', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                    >
                                        Desvincular
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="divider-dash" style={{ margin: '15px 0' }}></div>

                <div className="input-group search-container">
                    <div className="search-input-wrapper">
                        <input
                            type="text"
                            placeholder="Buscar máquina disponible..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        <Search className="input-icon" size={18} />
                    </div>
                </div>

                <div className="machine-list" style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', margin: '15px 0' }}>
                    {filteredMachines.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            {searchQuery ? 'No se encontraron máquinas disponibles.' : 'Escribe para buscar...'}
                        </div>
                    ) : (
                        filteredMachines.map(m => (
                            <div key={m.id} className="suggestion-item" style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', justifyContent: 'space-between', padding: '12px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1rem', color: 'white' }}>
                                        {m.qr_code_uid || 'Sin ID'}
                                        {m.current_status === 'Active' ? <CheckCircle2 size={14} className="teal" /> : <AlertCircle size={14} className="red" />}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                        <MapPin size={12} />
                                        {m.location_name || 'Sin Ubicación'}
                                    </div>
                                </div>
                                <button
                                    className="btn-primary"
                                    style={{ padding: '6px 12px', fontSize: '0.85rem', flex: '0 0 auto' }}
                                    onClick={() => onLink(m)}
                                >
                                    Asignar
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                    <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: '0 0 auto', width: 'auto' }}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={onCreateNew}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', width: 'auto' }}
                    >
                        <Plus size={16} /> Crear Nueva Máquina
                    </button>
                </div>
            </div>
        </div>
    )
}
