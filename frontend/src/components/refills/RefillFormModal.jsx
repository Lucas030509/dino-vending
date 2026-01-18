import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { X, Camera, Package, AlertCircle, Check, ArrowRight } from 'lucide-react'
import '../../pages/Refills.css'

export default function RefillFormModal({ onClose, onSuccess, location }) {
    const [submitting, setSubmitting] = useState(false)
    const [photo, setPhoto] = useState(null)
    const [photoPreview, setPhotoPreview] = useState('')

    // State: Map { machineId: { add_amount: '', is_full: false, current: 0, capacity: 180 } }
    const [refillMap, setRefillMap] = useState({})

    const machines = location?.machines || []

    useEffect(() => {
        if (!machines.length) return

        const initialMap = {}
        machines.forEach(m => {
            const current = m.current_stock_snapshot || 0
            const cap = m.capsule_capacity || 180 // Per machine physical capacity
            initialMap[m.id] = {
                id: m.id,
                name: m.nickname || m.product_type || `Máquina ${m.id.substring(0, 4)}`,
                current: current,
                capacity: cap,
                add_amount: '', // User input
                is_full: false,
                estimated_max_add: Math.max(0, cap - current)
            }
        })
        setRefillMap(initialMap)
    }, [machines])

    const handleUpdate = (id, field, value) => {
        setRefillMap(prev => {
            const current = prev[id]
            const updated = { ...current, [field]: value }

            // Logic: If 'is_full' toggled ON, set add_amount to estimated need
            if (field === 'is_full' && value === true) {
                updated.add_amount = current.estimated_max_add
            }
            // Logic: If 'is_full' toggled OFF, clear amount? Or keep? Let's clear for clarity.
            if (field === 'is_full' && value === false) {
                updated.add_amount = ''
            }
            // Logic: If manual amount entered, uncheck is_full if it doesn't match max?
            // checking strictly might be annoying. Let's just trust user input.

            return { ...prev, [id]: updated }
        })
    }

    const handlePhotoChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setPhoto(file)
            setPhotoPreview(URL.createObjectURL(file))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Sesión caducada")

            // 1. Upload Shared Photo
            let photoUrl = null
            if (photo) {
                const timestamp = Date.now()
                const fileName = `${user.user_metadata.tenant_id}/${location.id}/${timestamp}_refill.jpg`
                const { error: uploadError } = await supabase.storage
                    .from('collection-evidence') // Check consistency with Collections.jsx
                    .upload(fileName, photo)

                if (!uploadError) {
                    const { data } = supabase.storage
                        .from('collection-evidence')
                        .getPublicUrl(fileName)
                    photoUrl = data.publicUrl
                }
            }

            // 2. Process Updates
            const updates = Object.values(refillMap).map(async (item) => {
                const added = parseInt(item.add_amount)
                if (!added || added <= 0) return // Skip if nothing added

                const newStock = Math.min(item.capacity, item.current + added)
                const machine = machines.find(m => m.id === item.id)
                const now = new Date().toISOString()

                // Insert Record
                await supabase.from('collections').insert({
                    tenant_id: machine.tenant_id,
                    location_id: location.id, // NEW
                    machine_id: machine.id,
                    collection_date: now,
                    created_by: user.id,
                    record_type: 'refill', // Crucial to distinguish
                    inventory_refilled: added,
                    stock_after_refill: newStock,
                    profit_amount: 0,
                    evidence_photo_url: photoUrl
                })

                // Update Machine Snapshot in Supabase
                await supabase.from('machines').update({
                    current_stock_snapshot: newStock,
                    last_refill_date: now
                }).eq('id', machine.id)

                // Update Local Dexie DB
                await db.machines.update(machine.id, {
                    current_stock_snapshot: newStock,
                    last_refill_date: now
                })
            })

            await Promise.all(updates)

            onSuccess()
            onClose()

        } catch (error) {
            console.error(error)
            if (onClose.showToast) { // Defensive check if passed as property function
                onClose.showToast("Error: " + error.message, 'error')
            } else if (typeof showToast === 'function') {
                showToast("Error: " + error.message, 'error')
            } else {
                // Fallback
                console.error("No toast function available")
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="modal-overlay">
            <div className="glass modal-content" style={{ maxWidth: '600px' }}>
                <div className="refills-header">
                    <div>
                        <h3 style={{ margin: 0 }}>Relleno: {location?.name}</h3>
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>{location?.address}</p>
                    </div>
                    <button onClick={onClose} className="btn-secondary icon-only"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="machines-refill-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                        {Object.values(refillMap).map(item => (
                            <div key={item.id} className="machine-refill-item glass" style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.name}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cap: {item.capacity} | Actual: {item.current}</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'end' }}>
                                    {/* Manual Input */}
                                    <div className="field-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '0.75rem' }}>Cantidad a Agregar</label>
                                        <input
                                            type="number"
                                            className="refill-input compact"
                                            value={item.add_amount}
                                            onChange={e => handleUpdate(item.id, 'add_amount', e.target.value)}
                                            placeholder="0"
                                            style={{ padding: '8px' }}
                                        />
                                    </div>

                                    {/* Toggle Full */}
                                    <button
                                        type="button"
                                        className={`btn-secondary ${item.is_full ? 'active-success' : ''}`}
                                        style={{
                                            justifyContent: 'center',
                                            height: '42px',
                                            borderColor: item.is_full ? '#10b981' : 'rgba(255,255,255,0.1)',
                                            color: item.is_full ? '#10b981' : '#94a3b8'
                                        }}
                                        onClick={() => handleUpdate(item.id, 'is_full', !item.is_full)}
                                    >
                                        {item.is_full ? <Check size={16} style={{ marginRight: 4 }} /> : null}
                                        {item.is_full ? 'Lleno Completo' : 'Marcar Lleno'}
                                    </button>
                                </div>

                                {/* Visual Indicator of Result */}
                                <div style={{ marginTop: '8px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${Math.min(100, ((item.current + (parseInt(item.add_amount) || 0)) / item.capacity) * 100)}%`,
                                            background: '#10b981',
                                            transition: 'width 0.3s ease'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="field-group" style={{ marginTop: '20px' }}>
                        <label>Evidencia Visual (Opcional)</label>
                        <div className="photo-preview-box compact" onClick={() => document.getElementById('refill-photo').click()} style={{ height: '80px', minHeight: '80px' }}>
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className="preview-img" />
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                                    <Camera size={24} />
                                    <span>Tocar para tomar foto</span>
                                </div>
                            )}
                            <input
                                id="refill-photo"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                hidden
                                onChange={handlePhotoChange}
                            />
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Confirmar Rellenos'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
