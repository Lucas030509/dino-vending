import React, { useState } from 'react'
import { Search, Plus, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

export function LinkMachineModal({ isOpen, onClose, location, onLink, onCreateNew }) {
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
        <div className="modal-overlay">
            <div className="glass modal-content" style={{ maxWidth: '600px' }}>
                <h3 style={{ marginBottom: '20px' }}>Agregar Máquina a {location?.name}</h3>

                <div className="input-group search-container">
                    <div className="search-input-wrapper">
                        <input
                            type="text"
                            placeholder="Buscar máquina existente por ID o nombre..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        <Search className="input-icon" size={18} />
                    </div>
                </div>

                <div className="machine-list" style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', margin: '15px 0' }}>
                    {filteredMachines.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            {searchQuery ? 'No se encontraron máquinas.' : 'Cargando máquinas...'}
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
                                    {m.location_id ? 'Mover Aquí' : 'Asignar'}
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
