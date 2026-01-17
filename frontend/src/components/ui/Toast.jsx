import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export const Toast = ({ show, message, type = 'info', onClose, duration = 5000 }) => {
    useEffect(() => {
        if (show && duration && type !== 'error') {
            const timer = setTimeout(() => {
                onClose()
            }, duration)
            return () => clearTimeout(timer)
        }
    }, [show, duration, onClose, type])

    if (!show) return null

    return (
        <div className={`toast-notification ${type}`} onClick={onClose}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <span>{message}</span>
                <X size={16} style={{ cursor: 'pointer', opacity: 0.8 }} />
            </div>
            {type === 'error' && (
                <div style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.8 }}>
                    Clic para cerrar
                </div>
            )}
        </div>
    )
}
