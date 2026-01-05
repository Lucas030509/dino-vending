import React from 'react'
import { CheckSquare, Square, Settings, Trash2, MapPin } from 'lucide-react'

export function MachineCard({ machine, isSelected, onSelect, onEdit, onDelete, onToggleStatus }) {
    return (
        <div
            className={`glass machine-card card-glow ${isSelected ? 'selected-card' : ''}`}
            onClick={() => onEdit(machine)}
        >
            <div className="m-header">
                <div className="selection-trigger" onClick={(e) => onSelect(e, machine.id)}>
                    {isSelected ? <CheckSquare size={20} className="teal" /> : <Square size={20} className="dim" />}
                </div>
                <div className="status-badge" onClick={(e) => onToggleStatus(e, machine)}>
                    <span className={`status-dot ${machine.current_status === 'Active' ? 'active' : 'inactive'}`}></span>
                    {machine.current_status === 'Active' ? 'Activa' : 'Inactiva'}
                </div>
                <div className="card-actions">
                    <button className="edit-icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(machine); }}>
                        <Settings size={14} />
                    </button>
                    <button className="edit-icon-btn delete" onClick={(e) => onDelete(e, machine)}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <div className="m-body">
                <h4>{machine.location_name}</h4>
                <p className="qr-ref">{machine.qr_code_uid} {machine.zone && <span className="zone-tag">@{machine.zone}</span>}</p>

                <div className="machine-stats-mini">
                    <div className="stat-pill">
                        <span className="label">Cant.</span>
                        <span className="val">{machine.machine_count}</span>
                    </div>
                    <div className="stat-pill">
                        <span className="label">Precio</span>
                        <span className="val">${machine.denomination}</span>
                    </div>
                    <div className="stat-pill">
                        <span className="label">Comisión</span>
                        <span className="val">{machine.commission_percent}%</span>
                    </div>
                </div>
            </div>

            <div className="m-footer">
                <a href={machine.maps_url} target="_blank" rel="noreferrer" className="address-link" onClick={(e) => e.stopPropagation()}>
                    <MapPin size={12} />
                    {machine.address || 'Sin dirección'}
                </a>
            </div>
        </div>
    )
}
