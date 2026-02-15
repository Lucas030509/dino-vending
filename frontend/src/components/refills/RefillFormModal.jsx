import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { X, Camera, Package, AlertCircle, Check, ArrowRight, CheckCircle2 } from 'lucide-react'
import '../../pages/Refills.css'

export default function RefillFormModal({ onClose, onSuccess, location, showToast }) {
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
            <div className="glass modal-content" style={{ maxWidth: '600px', padding: '0' }}>
                <div className="modal-header-refined" style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>Registro de Rellenos</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-dim)' }}>{location?.name} • {location?.address}</p>
                    </div>
                    <button onClick={onClose} className="btn-secondary" style={{ padding: '8px', minWidth: 'auto', border: 'none', background: 'transparent' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    <div className="machines-refill-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {Object.values(refillMap).map(item => (
                            <div key={item.id} className="machine-refill-card" style={{
                                padding: '16px',
                                background: 'var(--bg-color)',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>{item.name}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>
                                        Cap: {item.capacity} | Stock: {item.current}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
                                    <div className="input-group-clean">
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Cargar</label>
                                        <input
                                            type="number"
                                            className="refill-input"
                                            value={item.add_amount}
                                            onChange={e => handleUpdate(item.id, 'add_amount', e.target.value)}
                                            placeholder="0"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-color)',
                                                color: 'var(--text-main)',
                                                fontSize: '1rem'
                                            }}
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        className={`btn-selector ${item.is_full ? 'active' : ''}`}
                                        style={{
                                            height: '42px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            border: item.is_full ? '2px solid var(--success-color)' : '1px solid var(--border-color)',
                                            background: item.is_full ? 'rgba(0, 204, 102, 0.05)' : 'var(--bg-color)',
                                            color: item.is_full ? 'var(--success-color)' : 'var(--text-dim)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            transition: '0.2s'
                                        }}
                                        onClick={() => handleUpdate(item.id, 'is_full', !item.is_full)}
                                    >
                                        {item.is_full ? <CheckCircle2 size={18} /> : <div style={{ width: 18, height: 18, border: '2px solid #ddd', borderRadius: '50%' }} />}
                                        {item.is_full ? 'Está Lleno' : 'Marcar Full'}
                                    </button>
                                </div>

                                {/* Visual Progress of simulated stock */}
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                        <span>Proyección post-relleno</span>
                                        <span style={{ fontWeight: 700 }}>{Math.min(100, (((item.current + (parseInt(item.add_amount) || 0)) / item.capacity) * 100)).toFixed(0)}%</span>
                                    </div>
                                    <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${Math.min(100, ((item.current + (parseInt(item.add_amount) || 0)) / item.capacity) * 100)}%`,
                                                background: 'var(--success-color)',
                                                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="evidence-section" style={{ marginTop: '24px' }}>
                        <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: '12px' }}>Evidencia (Opcional)</h4>
                        <div
                            className="photo-uploader"
                            onClick={() => document.getElementById('refill-photo').click()}
                            style={{
                                border: '2px dashed var(--border-color)',
                                borderRadius: '12px',
                                height: photoPreview ? '180px' : '100px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                background: '#f9fafb',
                                overflow: 'hidden',
                                transition: '0.2s'
                            }}
                        >
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-dim)' }}>
                                    <Camera size={24} />
                                    <span style={{ fontWeight: 600 }}>Cargar foto del punto</span>
                                </div>
                            )}
                            <input id="refill-photo" type="file" accept="image/*" capture="environment" hidden onChange={handlePhotoChange} />
                        </div>
                    </div>

                    <div className="modal-actions" style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                        <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 600 }}>Cerrar</button>
                        <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 12px var(--primary-glow)' }}>
                            {submitting ? 'Procesando...' : 'Guardar Rellenos'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
