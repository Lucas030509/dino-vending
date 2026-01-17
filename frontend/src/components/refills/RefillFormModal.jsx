import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Camera, Package, AlertCircle } from 'lucide-react'
import '../../pages/Refills.css' // Reuse styles

export default function RefillFormModal({ onClose, onSuccess, preSelectedMachine }) {
    const [machines, setMachines] = useState([])
    const [selectedMachine, setSelectedMachine] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    // Form State
    const [refillType, setRefillType] = useState('full') // 'full' or 'partial'
    const [manualAmount, setManualAmount] = useState('')
    const [photo, setPhoto] = useState(null)
    const [photoPreview, setPhotoPreview] = useState('')

    // Calculated Values
    const [machineDetails, setMachineDetails] = useState(null)
    const [estimatedFill, setEstimatedFill] = useState(0)

    useEffect(() => {
        if (preSelectedMachine) {
            // If passed explicitly, use it and skip fetch if we want, 
            // but we might still want to fetch others if user changes mind? 
            // Actually UX says "Directly on machine", so we lock it.
            setSelectedMachine(preSelectedMachine.id)
            setMachineDetails(preSelectedMachine)

            const count = preSelectedMachine.machine_count || 1;
            const unitCapacity = preSelectedMachine.capsule_capacity || 180;
            const totalCapacity = unitCapacity * count;
            const current = preSelectedMachine.current_stock_snapshot || 0

            setEstimatedFill(Math.max(0, totalCapacity - current))
            setLoading(false) // No need to fetch machines list
        } else {
            fetchMachines()
        }
    }, [preSelectedMachine])

    const fetchMachines = async () => {
        try {
            // Fetch machines to populate select
            const { data, error } = await supabase
                .from('machines')
                .select('id, location_name, capsule_capacity, current_stock_snapshot, tenant_id, machine_count')
                .eq('current_status', 'Active')
                .order('location_name')

            if (error) throw error
            setMachines(data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleMachineSelect = (e) => {
        const id = e.target.value
        setSelectedMachine(id)

        if (id) {
            const m = machines.find(mac => mac.id === id)
            setMachineDetails(m)
            // Calculate heuristic: If Full, we refill (Capacity * Count - Current)
            const count = m.machine_count || 1;
            const unitCapacity = m.capsule_capacity || 180;
            const totalCapacity = unitCapacity * count;

            const current = m.current_stock_snapshot || 0
            setEstimatedFill(Math.max(0, totalCapacity - current))
        } else {
            setMachineDetails(null)
            setEstimatedFill(0)
        }
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
        if (!selectedMachine) return
        setSubmitting(true)

        try {
            let photoUrl = null

            // 1. Upload Photo
            if (photo) {
                const fileExt = photo.name.split('.').pop()
                const fileName = `refill-${selectedMachine}-${Date.now()}.${fileExt}`

                // Assuming we reuse the 'collections-photos' bucket or similar
                // If not, 'report-photos' works as a generic evidence bucket
                const { error: uploadError } = await supabase.storage
                    .from('evidence-photos') // Use a generic bucket if possible, or create one
                    .upload(fileName, photo)

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('evidence-photos')
                        .getPublicUrl(fileName)
                    photoUrl = publicUrl
                } else {
                    console.warn("Photo upload failed, proceeding without photo", uploadError)
                }
            }

            // 2. Calculate final numbers
            const count = machineDetails.machine_count || 1;
            const unitCapacity = machineDetails.capsule_capacity || 180;
            const totalCapacity = unitCapacity * count;
            const current = machineDetails.current_stock_snapshot || 0

            let quantityAdded = 0
            let newStockLevel = 0

            if (refillType === 'full') {
                quantityAdded = Math.max(0, totalCapacity - current)
                newStockLevel = totalCapacity
            } else {
                quantityAdded = parseInt(manualAmount) || 0
                // Safety: Clamp to total capacity
                newStockLevel = Math.min(totalCapacity, current + quantityAdded)
            }

            // 3. Insert into Collections (Kardex)
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) throw new Error("Sesión caducada")

            // Prepare payload
            const payload = {
                machine_id: selectedMachine,
                tenant_id: machineDetails.tenant_id,
                collection_date: new Date().toISOString(),
                created_by: user.id,
                record_type: 'refill',
                inventory_refilled: quantityAdded,
                stock_after_refill: newStockLevel,
                profit_amount: 0
            }

            // Only add evidence photo if uploaded
            if (photoUrl) {
                payload.evidence_photo_url = photoUrl
            }

            const { error: dbError } = await supabase
                .from('collections')
                .insert(payload)

            if (dbError) throw dbError

            // 4. Update Machine Snapshot
            // This is crucial for the "Smart Logic" to work next time
            await supabase
                .from('machines')
                .update({
                    current_stock_snapshot: newStockLevel,
                    last_refill_date: new Date().toISOString()
                })
                .eq('id', selectedMachine)

            onSuccess()
            onClose()

        } catch (error) {
            console.error(error)
            alert("Error al registrar relleno: " + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="modal-overlay">
            <div className="glass modal-content" style={{ maxWidth: '500px' }}>
                <div className="refills-header">
                    <h3 style={{ margin: 0 }}>Registrar Relleno (Refill)</h3>
                    <button onClick={onClose} className="btn-secondary icon-only"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="field-group">
                        <label>Máquina Seleccionada</label>
                        {preSelectedMachine ? (
                            <input
                                type="text"
                                className="refill-input"
                                value={preSelectedMachine.location_name}
                                disabled
                                style={{ background: '#f1f5f9', color: '#475569' }}
                            />
                        ) : (
                            <select
                                className="refill-input"
                                value={selectedMachine}
                                onChange={handleMachineSelect}
                                required
                            >
                                <option value="">-- Elige una máquina --</option>
                                {machines.map(m => (
                                    <option key={m.id} value={m.id}>{m.location_name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {machineDetails && (
                        <div className="stock-preview">
                            <Package size={24} color="#fbbf24" strokeWidth={1.5} />
                            <div className="stock-info">
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                                    <span style={{ color: '#94a3b8' }}>Nivel Actual</span>
                                    <span>{machineDetails.current_stock_snapshot || 0} / {(machineDetails.capsule_capacity || 180) * (machineDetails.machine_count || 1)}</span>
                                </div>
                                <div className="stock-bar-bg">
                                    <div
                                        className="stock-bar-fill"
                                        style={{
                                            width: `${Math.min(100, ((machineDetails.current_stock_snapshot || 0) / ((machineDetails.capsule_capacity || 180) * (machineDetails.machine_count || 1))) * 100)}%`,
                                            background: (machineDetails.current_stock_snapshot || 0) < 50 ? '#ef4444' : '#10b981'
                                        }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="field-group">
                        <label>Tipo de Relleno {machineDetails?.machine_count > 1 && <span className="badge-god-mini" style={{ marginLeft: 8 }}>{machineDetails.machine_count} Máquinas</span>}</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                className={`btn-secondary ${refillType === 'full' ? 'active-refill-btn' : ''}`}
                                style={{ flex: 1, borderColor: refillType === 'full' ? '#10b981' : '', color: refillType === 'full' ? '#10b981' : '' }}
                                onClick={() => setRefillType('full')}
                            >
                                Lleno Completo
                            </button>
                            <button
                                type="button"
                                className={`btn-secondary ${refillType === 'partial' ? 'active-refill-btn' : ''}`}
                                style={{ flex: 1, borderColor: refillType === 'partial' ? '#f59e0b' : '', color: refillType === 'partial' ? '#f59e0b' : '' }}
                                onClick={() => setRefillType('partial')}
                            >
                                Parcial / Manual
                            </button>
                        </div>
                    </div>

                    {refillType === 'full' && machineDetails && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <AlertCircle size={20} color="#10b981" />
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#d1fae5' }}>
                                Se agregarán aprox. <strong>{Math.max(0, ((machineDetails.capsule_capacity || 180) * (machineDetails.machine_count || 1)) - (machineDetails.current_stock_snapshot || 0))}</strong> cápsulas para llegar al 100%.
                            </p>
                        </div>
                    )}

                    {refillType === 'partial' && (
                        <div className="field-group">
                            <label>Cantidad Ingresada (Cápsulas)</label>
                            <input
                                type="number"
                                className="refill-input"
                                value={manualAmount}
                                onChange={e => setManualAmount(e.target.value)}
                                placeholder="Ej: 50"
                                required
                            />
                        </div>
                    )}

                    <div className="field-group">
                        <label>Evidencia Visual</label>
                        <div className="photo-preview-box" onClick={() => document.getElementById('refill-photo').click()}>
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className="preview-img" />
                            ) : (
                                <>
                                    <Camera size={28} />
                                    <span style={{ fontSize: '0.9rem', marginTop: '8px' }}>Tocar para tomar foto</span>
                                </>
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
                        <button type="submit" className="btn-primary" disabled={submitting || !selectedMachine}>
                            {submitting ? 'Guardando...' : 'Confirmar Relleno'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
