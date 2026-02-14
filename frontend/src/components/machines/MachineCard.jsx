import React from 'react'
import { CheckSquare, Square, Settings, Trash2, MapPin } from 'lucide-react'

export const MachineCard = React.memo(function MachineCard({ machine, isSelected, onSelect, onEdit, onDelete, onToggleStatus }) {

    // Helper for keyboard events on non-button elements if necessary, 
    // but better to use buttons directly.
    const handleKeyDown = (e, action, ...args) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            action(e, ...args);
        }
    };

    return (
        <div
            className={`glass machine-card card-glow ${isSelected ? 'selected-card' : ''}`}
            onClick={() => onEdit(machine)}
            onKeyDown={(e) => handleKeyDown(e, onEdit, machine)}
            tabIndex="0"
            role="button"
            aria-label={`Editar máquina en ${machine.location_name}`}
        >
            <div className="m-header">
                <button
                    className="selection-trigger"
                    onClick={(e) => { e.stopPropagation(); onSelect(e, machine.id); }}
                    aria-label={isSelected ? "Deseleccionar máquina" : "Seleccionar máquina"}
                    type="button"
                >
                    {isSelected ? <CheckSquare size={20} className="teal" /> : <Square size={20} className="dim" />}
                </button>

                <button
                    className="status-badge"
                    onClick={(e) => { e.stopPropagation(); onToggleStatus(e, machine); }}
                    aria-label={`Cambiar estado, actual: ${machine.current_status === 'Active' ? 'Activa' : 'Inactiva'}`}
                    type="button"
                >
                    <span className={`status-dot ${machine.current_status === 'Active' ? 'active' : 'inactive'}`}></span>
                    {machine.current_status === 'Active' ? 'Activa' : 'Inactiva'}
                </button>

                <div className="card-actions">
                    <button
                        className="edit-icon-btn"
                        onClick={(e) => { e.stopPropagation(); onEdit(machine); }}
                        aria-label="Configurar máquina"
                        type="button"
                    >
                        <Settings size={14} />
                    </button>
                    <button
                        className="edit-icon-btn delete"
                        onClick={(e) => { e.stopPropagation(); onDelete(e, machine); }}
                        aria-label="Eliminar máquina"
                        type="button"
                    >
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
                <a
                    href={machine.maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="address-link"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Ver dirección en mapa: ${machine.address || 'Sin dirección'}`}
                >
                    <MapPin size={12} />
                    {machine.address || 'Sin dirección'}
                </a>
            </div>
        </div>
    )
})
