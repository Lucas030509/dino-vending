import React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

/**
 * Universal Confirmation Modal for Critical Actions
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: function (cancel)
 * - onConfirm: function (proceed)
 * - title: string
 * - message: string | ReactNode
 * - confirmText: string (default: "Eliminar")
 * - cancelText: string (default: "Cancelar")
 * - isDestructive: boolean (default: true -> Red Button)
 * - isLoading: boolean (default: false)
 */
export const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirmar acción",
    message = "¿Estás seguro?",
    confirmText = "Eliminar",
    cancelText = "Cancelar",
    isDestructive = true,
    isLoading = false
}) => {
    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div
                className="glass modal-content compact-modal"
                onClick={(e) => e.stopPropagation()} // CRITICAL: Propagate Stop prevents ghost clicks closing modal
                style={{
                    maxWidth: '400px',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '16px'
                }}>
                    <div style={{
                        background: isDestructive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        padding: '16px',
                        borderRadius: '50%',
                        color: isDestructive ? '#ef4444' : '#10b981'
                    }}>
                        {isDestructive ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
                    </div>
                </div>

                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{title}</h3>

                <div style={{ color: 'var(--text-dim)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>
                    {message}
                </div>

                <div className="modal-actions" style={{ gap: '12px' }}>
                    <button
                        className="btn-secondary"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        className="btn-primary"
                        onClick={onConfirm}
                        disabled={isLoading}
                        style={{
                            background: isDestructive ? '#ef4444' : 'var(--primary-color)',
                            color: 'white',
                            borderColor: isDestructive ? '#ef4444' : 'var(--primary-color)'
                        }}
                    >
                        {isLoading ? 'Procesando...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
