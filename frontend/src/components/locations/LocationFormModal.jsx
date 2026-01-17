import React, { useState, useEffect } from 'react'
import { X, MapPin } from 'lucide-react'

export function LocationFormModal({ isOpen, onClose, onSubmit, initialData }) {
    if (!isOpen) return null

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        district: ''
    })

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                address: initialData.address || '',
                district: initialData.district || ''
            })
        } else {
            setFormData({ name: '', address: '', district: '' })
        }
    }, [initialData])

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit(formData)
    }

    return (
        <div className="modal-overlay">
            <div className="glass modal-content">
                <div className="modal-header">
                    <h3>{initialData ? 'Editar Ubicación' : 'Nueva Ubicación'}</h3>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Nombre del Lugar</label>
                        <input
                            type="text"
                            placeholder="Ej. Plaza Central, Abarrotes Mary..."
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label>Dirección</label>
                        <textarea
                            placeholder="Calle, Número, Colonia..."
                            rows="2"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>

                    <div className="input-group">
                        <label>Zona / Colonia / Distrito</label>
                        <input
                            type="text"
                            placeholder="Ej. Centro, Norte, Roma..."
                            value={formData.district}
                            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" className="btn-primary">
                            {initialData ? 'Actualizar' : 'Crear'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
