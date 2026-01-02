import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, Calendar, TrendingUp, AlertCircle, CheckCircle2, MoreVertical, Plus, Trash2, Search, ArrowDownToLine, Camera, Eraser, Eye } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'

export default function Collections() {
    const [machines, setMachines] = useState([])
    const [filteredMachines, setFilteredMachines] = useState([])
    const [filterQuery, setFilterQuery] = useState('')
    const [collections, setCollections] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedMachine, setSelectedMachine] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Toast State
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type })
        if (type !== 'error') {
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000)
        }
    }
    const hideToast = () => setToast({ ...toast, show: false })

    // Evidence State
    const [photoBlob, setPhotoBlob] = useState(null)
    const [photoPreview, setPhotoPreview] = useState(null)
    const [signaturePreview, setSignaturePreview] = useState(null) // To store the png data url
    const signatureRef = useRef(null)

    // Modals State
    const [showPhotoModal, setShowPhotoModal] = useState(false)
    const [showSignatureModal, setShowSignatureModal] = useState(false)
    const [viewingCollection, setViewingCollection] = useState(null)
    const [resendingId, setResendingId] = useState(null)

    // Form State for New Collection
    const [newCollection, setNewCollection] = useState({
        gross_amount: '',
        collection_date: new Date().toISOString().split('T')[0],
        next_refill_days: 15, // Default estimate
        notes: '',
        units_sold: 0,
        cost_capsule: 1,
        cost_product: 2.5,
        commission_percent: 0
    })

    // Auto-calculate units when amount changes
    useEffect(() => {
        if (selectedMachine && newCollection.gross_amount) {
            const amount = parseFloat(newCollection.gross_amount)
            const denom = selectedMachine.denomination || 10
            // Default logic: Units = Amount / Denomination
            // But user can override
            const estimatedUnits = Math.round(amount / denom)
            setNewCollection(prev => ({ ...prev, units_sold: estimatedUnits }))
        }
    }, [newCollection.gross_amount, selectedMachine])

    // Computed values for preview
    const commissionAmount = parseFloat(newCollection.gross_amount || 0) * ((newCollection.commission_percent || 0) / 100)

    const totalExpenses = (parseInt(newCollection.units_sold || 0) * (parseFloat(newCollection.cost_capsule || 0) + parseFloat(newCollection.cost_product || 0)))

    const profitAmount = (parseFloat(newCollection.gross_amount || 0) - commissionAmount - totalExpenses)

    useEffect(() => {
        fetchData()
    }, [])

    // Filter effect
    useEffect(() => {
        if (!filterQuery) {
            setFilteredMachines(machines)
        } else {
            const query = filterQuery.toLowerCase()
            const filtered = machines.filter(m =>
                (m.location_name && m.location_name.toLowerCase().includes(query)) ||
                (m.qr_code_uid && m.qr_code_uid.toLowerCase().includes(query)) ||
                (m.address && m.address.toLowerCase().includes(query))
            )
            setFilteredMachines(filtered)
        }
    }, [filterQuery, machines])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch Machines
            const { data: machinesData } = await supabase
                .from('machines')
                .select('*')
                .eq('current_status', 'Active')
                .order('location_name')

            // Fetch Recent Collections
            const { data: collectionsData } = await supabase
                .from('collections')
                .select(`
          *,
          machines (location_name)
        `)
                .order('collection_date', { ascending: false })
                .limit(20)

            setMachines(machinesData || [])
            setFilteredMachines(machinesData || [])
            setCollections(collectionsData || [])
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Helper: Smart Date Calculation (Skip Closed Days)
    const calculateSmartNextDate = (startDateStr, daysToAdd, closedDays = []) => {
        let date = new Date(startDateStr)
        date.setDate(date.getDate() + parseInt(daysToAdd))

        // Safety Break (max 14 iterations to prevent infinite loop if all days closed)
        let loops = 0
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

        while (closedDays.includes(dayNames[date.getDay()]) && loops < 14) {
            date.setDate(date.getDate() + 1) // Add 1 more day
            loops++
        }
        return date.toISOString().split('T')[0]
    }

    const handleOpenModal = (machine) => {
        setSelectedMachine(machine)
        const isRent = machine.contract_type === 'rent'

        setNewCollection({
            ...newCollection,
            gross_amount: '',
            notes: '',
            units_sold: 0,
            cost_capsule: 1,
            cost_product: 2.5,
            commission_percent: isRent ? 0 : (machine.commission_percent || 0),
            rent_amount_snapshot: isRent ? (machine.rent_amount || 0) : 0
        })
        setPhotoBlob(null)
        setPhotoPreview(null)
        setSignaturePreview(null)
        setShowPhotoModal(false)
        setShowSignatureModal(false)
        // Signature ref reset happens automatically on re-render, but we might need to clear canvas later
        setShowModal(true)
    }

    const handlePhotoSelect = (e) => {
        const file = e.target.files[0]
        if (file) {
            setPhotoBlob(file)
            setPhotoPreview(URL.createObjectURL(file))
        }
    }

    const handleConfirmSignature = () => {
        if (signatureRef.current && !signatureRef.current.isEmpty()) {
            const dataUrl = signatureRef.current.toDataURL('image/png')
            setSignaturePreview(dataUrl)
            setShowSignatureModal(false)
        } else {
            showToast("Por favor firma antes de guardar", "error")
        }
    }

    const clearSignature = () => {
        signatureRef.current?.clear()
        setSignaturePreview(null)
    }

    const uploadEvidence = async (file, path) => {
        const { data, error } = await supabase.storage
            .from('collection-evidence')
            .upload(path, file)

        if (error) throw error

        const { data: publicData } = supabase.storage
            .from('collection-evidence')
            .getPublicUrl(path)

        return publicData.publicUrl
    }

    const handleRegisterCollection = async (e) => {
        e.preventDefault()
        if (!selectedMachine) return
        setIsSubmitting(true)

        try {
            const gross = parseFloat(newCollection.gross_amount)
            const commission = gross * (newCollection.commission_percent / 100)

            // Expenses
            const units = parseInt(newCollection.units_sold)
            const costCap = parseFloat(newCollection.cost_capsule)
            const costProd = parseFloat(newCollection.cost_product)
            const totalExp = units * (costCap + costProd)

            const profit = gross - commission - totalExp

            // Smart Next Date Calculation
            const nextVisitDateStr = calculateSmartNextDate(
                newCollection.collection_date,
                newCollection.next_refill_days,
                selectedMachine.closed_days || []
            )

            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                throw new Error("No se pudo identificar al usuario. Por favor inicia sesión nuevamente.")
            }

            // --- EVIDENCE UPLOAD ---
            let photoUrl = null
            let signatureUrl = null
            const timestamp = Date.now()

            // 1. Upload Photo
            if (photoBlob) {
                const photoPath = `${selectedMachine.tenant_id}/${selectedMachine.id}/${timestamp}_photo.jpg`
                photoUrl = await uploadEvidence(photoBlob, photoPath)
            }

            // 2. Upload Signature
            if (signaturePreview) {
                const sigBlob = await (await fetch(signaturePreview)).blob()
                const sigPath = `${selectedMachine.tenant_id}/${selectedMachine.id}/${timestamp}_sig.png`
                signatureUrl = await uploadEvidence(sigBlob, sigPath)
            }

            // 3. Insert Collection Record
            const { data: insertedData, error } = await supabase.from('collections').insert({
                tenant_id: selectedMachine.tenant_id,
                machine_id: selectedMachine.id,
                collection_date: newCollection.collection_date,
                gross_amount: gross,
                commission_amount: commission,
                net_revenue: (gross - commission), // Cash flow to tenant (before expenses)
                profit_amount: profit, // Real profit
                units_sold: units,
                unit_cost_capsule: costCap,
                unit_cost_product: costProd,
                commission_percent_snapshot: newCollection.commission_percent, // Save the used percent
                next_refill_date_estimate: nextVisitDateStr,
                next_visit_date: nextVisitDateStr, // New column
                notes: newCollection.notes,
                created_by: user.id,
                evidence_photo_url: photoUrl,
                evidence_signature_url: signatureUrl
            }).select().single()

            if (error) throw error

            showToast('Corte registrado exitosamente!', 'success')

            // --- TRIGGER AUTOMATIC EMAIL (Fire and Forget) ---
            if (selectedMachine.contact_email) {
                supabase.functions.invoke('send-receipt', {
                    body: { collection_id: insertedData.id }
                }).then(({ error }) => {
                    if (error) console.error("Error enviando recibo:", error)
                    else console.log("Recibo enviado correctamente")
                })
            }

            setShowModal(false)
            fetchData() // Refresh list

        } catch (err) {
            console.error('Error recording collection:', err)
            showToast(err.message, 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteCollection = async (id) => {
        if (confirm('¿Estás seguro de que deseas eliminar este corte? Se recalcularán los contadores.')) {
            const { error } = await supabase
                .from('collections')
                .delete()
                .eq('id', id)

            if (error) {
                console.error('Error deleting collection:', error)
                showToast('Error al eliminar', 'error')
            } else {
                fetchData() // Assuming fetchData also refreshes collections
                showToast('Corte eliminado correctamente', 'success')
            }
        }
    }

    const handleResendReceipt = async (collectionId) => {
        try {
            setResendingId(collectionId)
            const { data, error } = await supabase.functions.invoke('send-receipt', {
                body: { collection_id: collectionId }
            })

            if (error) throw error

            showToast('Correo reenviado con éxito', 'success')
        } catch (error) {
            console.error('Error resending receipt:', error)
            showToast('Error al reenviar correo: ' + error.message, 'error')
        } finally {
            setResendingId(null)
        }
    }

    return (
        <div className="collections-page">
            {toast.show && (
                <div className={`toast-notification ${toast.type}`} onClick={hideToast}>
                    {toast.message}
                    {toast.type === 'error' && <div style={{ fontSize: '0.8em', marginTop: 4, opacity: 0.8 }}>(Clic para cerrar)</div>}
                </div>
            )}
            <header className="page-header">
                <div className="header-left">
                    <Link to="/" className="back-btn">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1>Programación de Cortes</h1>
                        <p className="subtitle">Gestión financiera y rutas de servicio</p>
                    </div>
                </div>
            </header>

            <div className="main-grid">
                {/* Left Panel: Active Machines to Service */}
                <div className="panel machine-list-panel glass">
                    <div className="panel-header">
                        <h3>Máquinas Activas</h3>
                        <span className="badge">{filteredMachines.length} Puntos</span>
                    </div>

                    <div className="search-box-container">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar punto..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="scrollable-list">
                        {filteredMachines.map(machine => (
                            <div key={machine.id} className="machine-item glass-hover">
                                <div className="m-info">
                                    <h4>{machine.location_name}</h4>
                                    <p className="sub-text">
                                        {machine.qr_code_uid} •
                                        {machine.contract_type === 'rent' ? ' Renta Fija' : ` ${machine.commission_percent}% Com.`}
                                    </p>
                                </div>
                                <button
                                    className="action-btn-icon"
                                    onClick={() => handleOpenModal(machine)}
                                    title="Registrar Corte"
                                >
                                    <ArrowDownToLine size={20} />
                                </button>
                            </div>
                        ))}
                        {filteredMachines.length === 0 && (
                            <div className="empty-search-state">
                                <p>No se encontraron resultados.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Recent History */}
                <div className="panel history-panel glass">
                    <div className="panel-header">
                        <h3>Historial Reciente</h3>
                    </div>
                    <div className="table-responsive">
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Ubicación</th>
                                    <th>Monto Bruto</th>
                                    <th>Comisión</th>
                                    <th>Ganancia Final</th>
                                    <th style={{ width: 50 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {collections.map(col => (
                                    <tr key={col.id}>
                                        <td>{new Date(col.collection_date).toLocaleDateString()}</td>
                                        <td>{col.machines?.location_name || 'Desconocida'}</td>
                                        <td className="amount">${col.gross_amount}</td>
                                        <td className="amount commission">-${col.commission_amount}</td>
                                        <td className={`amount ${col.profit_amount >= 0 ? 'profit' : 'commission'}`}>
                                            ${col.profit_amount ?? col.net_revenue}
                                        </td>
                                        <td>
                                            <button onClick={() => setViewingCollection(col)} className="view-btn-mini" title="Ver Detalle / Reenviar Correo">
                                                <Eye size={14} />
                                            </button>
                                            <button onClick={() => handleDeleteCollection(col.id)} className="delete-btn-mini" title="Eliminar Corte">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {collections.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="empty-cell">No hay cortes registrados aún.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal: Register Collection */}
            {showModal && selectedMachine && (
                <div className="modal-overlay">
                    <div className="glass modal-content collection-modal">
                        <div className="modal-header">
                            <h3>Registrar Corte: {selectedMachine.location_name}</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <form onSubmit={handleRegisterCollection}>
                            <div className="modal-body-grid">
                                {/* Columna Izquierda: Datos Financieros */}
                                <div className="modal-column">
                                    <div className="form-section-title">Datos del Corte</div>

                                    <div className="input-group">
                                        <label>Fecha del Corte</label>
                                        <input
                                            type="date"
                                            value={newCollection.collection_date}
                                            onChange={e => setNewCollection({ ...newCollection, collection_date: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label>Monto Recolectado ($)</label>
                                        <input
                                            type="number"
                                            step="0.50"
                                            placeholder="0.00"
                                            value={newCollection.gross_amount}
                                            onChange={e => setNewCollection({ ...newCollection, gross_amount: e.target.value })}
                                            required
                                            className="money-input"
                                        />
                                    </div>

                                    {selectedMachine.contract_type === 'rent' ? (
                                        <div className="input-group">
                                            <label>Esquema de Pago</label>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                <DollarSign size={14} style={{ display: 'inline', marginRight: 5 }} />
                                                Modelo de Renta Fija
                                                <div style={{ color: 'white', marginTop: 4, fontWeight: 'bold' }}>
                                                    ${selectedMachine.rent_amount} / {selectedMachine.rent_periodicity}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="input-group">
                                            <label>Comisión del Lugar (%)</label>
                                            <div className="commission-control">
                                                <input
                                                    type="number"
                                                    min="0" max="100" step="0.5"
                                                    value={newCollection.commission_percent}
                                                    onChange={e => setNewCollection({ ...newCollection, commission_percent: parseFloat(e.target.value) })}
                                                    required
                                                />
                                                <div className="commission-value">
                                                    = ${commissionAmount.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-section-title mt-4">Próxima Visita</div>
                                    <div className="input-group">
                                        <div className="days-selector compact">
                                            {[7, 15, 30].map(days => (
                                                <button
                                                    type="button"
                                                    key={days}
                                                    className={newCollection.next_refill_days == days ? 'active' : ''}
                                                    onClick={() => setNewCollection({ ...newCollection, next_refill_days: days })}
                                                >
                                                    {days}d
                                                </button>
                                            ))}
                                            <div className="custom-days-wrapper">
                                                <input
                                                    type="number"
                                                    className="custom-days"
                                                    placeholder="#"
                                                    value={newCollection.next_refill_days}
                                                    onChange={e => setNewCollection({ ...newCollection, next_refill_days: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Costos Operativos (Colapsables o discretos) */}
                                    <div className="details-disclosure">
                                        <details>
                                            <summary>Detalles Operativos (Costos)</summary>
                                            <div className="form-grid compact-grid mt-2">
                                                <div className="input-group">
                                                    <label>Unidades Vendidas</label>
                                                    <input
                                                        type="number"
                                                        value={newCollection.units_sold}
                                                        onChange={e => setNewCollection({ ...newCollection, units_sold: e.target.value })}
                                                    />
                                                </div>
                                                <div className="input-group">
                                                    <label>Costo Unitario ($)</label>
                                                    <input
                                                        type="number" step="0.10"
                                                        value={newCollection.cost_capsule}
                                                        onChange={e => setNewCollection({ ...newCollection, cost_capsule: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </details>
                                    </div>
                                </div>

                                {/* Columna Derecha: Evidencias (Action Buttons) */}
                                <div className="modal-column right-col">
                                    <div className="form-section-title">Evidencias</div>

                                    <div className="actions-grid">
                                        {/* Photo Action */}
                                        <div className="action-card" onClick={() => !photoPreview && setShowPhotoModal(true)}>
                                            <div className="action-header">
                                                <label>Foto Contador</label>
                                                {photoPreview && (
                                                    <div className="file-controls">
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setShowPhotoModal(true); }} className="control-btn">Cambiar</button>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); setPhotoBlob(null); }} className="control-btn danger">Borrar</button>
                                                    </div>
                                                )}
                                            </div>

                                            {photoPreview ? (
                                                <div className="preview-container">
                                                    <img src={photoPreview} alt="Evidencia" className="photo-preview-compact" />
                                                </div>
                                            ) : (
                                                <div className="action-placeholder">
                                                    <Camera size={32} className="action-icon" />
                                                    <span>Tomar Foto</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Signature Action */}
                                        <div className="action-card" onClick={() => !signaturePreview && setShowSignatureModal(true)}>
                                            <div className="action-header">
                                                <label>Firma Conformidad</label>
                                                {signaturePreview && (
                                                    <div className="file-controls">
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setShowSignatureModal(true); }} className="control-btn">Re-Firmar</button>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setSignaturePreview(null); signatureRef.current?.clear(); }} className="control-btn danger">Borrar</button>
                                                    </div>
                                                )}
                                            </div>

                                            {signaturePreview ? (
                                                <div className="preview-container">
                                                    <img src={signaturePreview} alt="Firma" className="sig-preview-compact" />
                                                </div>
                                            ) : (
                                                <div className="action-placeholder">
                                                    <Eraser size={32} className="action-icon" />
                                                    <span>Firmar Recibo</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <div className="profit-summary">
                                    <span className="label">A Pagar al Cliente:</span>
                                    <span className="val highlight">${commissionAmount.toFixed(2)}</span>
                                </div>
                                <div className="modal-actions">
                                    <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                                    <button type="submit" className="btn-primary full-width" disabled={isSubmitting}>
                                        {isSubmitting ? 'Procesando...' : 'Guardar Corte'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div >
                </div >
            )
            }

            {/* --- MODAL FOTO --- */}
            {showPhotoModal && (
                <div className="modal-overlay sub-modal">
                    <div className="glass modal-content compact-modal">
                        <h3>Subir Evidencia (Contador)</h3>
                        <div className="photo-drop-zone" onClick={() => document.getElementById('modal-upload').click()}>
                            {photoPreview ? (
                                <img src={photoPreview} alt="Preview" className="modal-preview-img" />
                            ) : (
                                <div className="drop-placeholder">
                                    <Camera size={48} />
                                    <p>Toca para seleccionar o tomar foto</p>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            id="modal-upload"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={handlePhotoSelect}
                        />
                        <div className="modal-actions">
                            <button onClick={() => setShowPhotoModal(false)} className="btn-secondary">Cancelar</button>
                            <button onClick={() => setShowPhotoModal(false)} disabled={!photoBlob} className="btn-primary">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL FIRMA --- */}
            {showSignatureModal && (
                <div className="modal-overlay sub-modal">
                    <div className="glass modal-content compact-modal">
                        <h3>Firma de Conformidad</h3>
                        <div className="sig-canvas-large-wrapper">
                            <SignatureCanvas
                                ref={signatureRef}
                                penColor="black"
                                canvasProps={{ className: 'sig-canvas-large' }}
                                backgroundColor="white"
                            />
                        </div>
                        <div className="modal-actions center">
                            <button onClick={clearSignature} className="btn-secondary">Limpiar</button>
                            <button onClick={() => setShowSignatureModal(false)} className="btn-secondary">Cancelar</button>
                            <button onClick={handleConfirmSignature} className="btn-primary">Aceptar Firma</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DETALLE HISTORIAL --- */}
            {viewingCollection && (
                <div className="modal-overlay">
                    <div className="glass modal-content collection-modal detail-mode">
                        <div className="modal-header">
                            <h3>Detalle de Corte</h3>
                            <button className="close-btn" onClick={() => setViewingCollection(null)}>✕</button>
                        </div>

                        <div className="modal-body-scrolled">
                            <div className="detail-section">
                                <div className="detail-row">
                                    <span className="label">Ubicación:</span>
                                    <span className="val">{viewingCollection.machines?.location_name}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Fecha:</span>
                                    <span className="val">{new Date(viewingCollection.collection_date).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="detail-section highlight-box">
                                <div className="detail-row">
                                    <span className="label">Monto Recolectado:</span>
                                    <span className="val money">${parseFloat(viewingCollection.gross_amount).toFixed(2)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Comisión ({viewingCollection.commission_percent_snapshot}%):</span>
                                    <span className="val commission">-${parseFloat(viewingCollection.commission_amount).toFixed(2)}</span>
                                </div>
                                <div className="divider-dash"></div>
                                <div className="detail-row total">
                                    <span className="label">Ganancia Neta:</span>
                                    <span className="val profit">${(parseFloat(viewingCollection.profit_amount) || parseFloat(viewingCollection.net_revenue)).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="detail-section">
                                <h4 className="section-header">Evidencias</h4>
                                <div className="evidence-grid-view">
                                    {viewingCollection.evidence_photo_url ? (
                                        <div className="evidence-item">
                                            <span>Foto Contador</span>
                                            <img src={viewingCollection.evidence_photo_url} alt="Foto" />
                                        </div>
                                    ) : (
                                        <div className="evidence-empty">Sin foto</div>
                                    )}

                                    {viewingCollection.evidence_signature_url ? (
                                        <div className="evidence-item">
                                            <span>Firma</span>
                                            <img src={viewingCollection.evidence_signature_url} alt="Firma" className="sig-img" />
                                        </div>
                                    ) : (
                                        <div className="evidence-empty">Sin firma</div>
                                    )}
                                </div>
                            </div>

                            <div className="detail-section">
                                <h4 className="section-header">Operaciones</h4>
                                <button
                                    onClick={() => handleResendReceipt(viewingCollection.id)}
                                    className="action-btn-full secondary"
                                    disabled={resendingId === viewingCollection.id}
                                >
                                    {resendingId === viewingCollection.id ? 'Enviando...' : '📧 Reenviar Recibo por Correo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        .collections-page { padding: 20px; max-width: 1400px; margin: 0 auto; color: white; padding-bottom: 80px; }
        
        /* --- NEW MODAL & ACTION STYLES --- */
        .actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
        .action-card { 
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); 
            border-radius: 12px; padding: 15px; cursor: pointer; transition: 0.2s; 
            min-height: 160px; display: flex; flex-direction: column;
        }
        .action-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.3); }
        
        .action-header { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.85rem; color: var(--text-dim); }
        .file-controls { display: flex; gap: 8px; }
        .control-btn { background: rgba(0,0,0,0.3); border: none; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; }
        .control-btn.danger { color: #f87171; }

        .action-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-dim); }
        .preview-container { flex: 1; display: flex; justify-content: center; align-items: center; overflow: hidden; border-radius: 8px; background: rgba(0,0,0,0.2); }
        .photo-preview-compact { width: 100%; height: 100px; object-fit: contain; }
        .sig-preview-compact { width: 100%; height: 80px; object-fit: contain; filter: invert(1); }

        /* Sub Modals */
        .sub-modal { z-index: 2000; background: rgba(0,0,0,0.85); }
        .compact-modal { width: 90%; max-width: 500px; padding: 25px; }
        .photo-drop-zone { 
            border: 2px dashed rgba(255,255,255,0.2); border-radius: 12px; 
            height: 250px; display: flex; align-items: center; justify-content: center; 
            margin: 20px 0; cursor: pointer; background: rgba(0,0,0,0.2);
        }
        .drop-placeholder { text-align: center; color: var(--text-dim); }
        .modal-preview-img { max-width: 100%; max-height: 100%; border-radius: 8px; }

        .sig-canvas-large-wrapper { background: white; border-radius: 12px; overflow: hidden; height: 300px; margin: 20px 0; }
        .sig-canvas-large { width: 100%; height: 100%; display: block; }
        .center { justify-content: center; }

        /* Detail Modal Styles */
        .modal-body-scrolled { max-height: 70vh; overflow-y: auto; padding-right: 5px; }
        .detail-section { margin-bottom: 20px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.95rem; }
        .label { color: var(--text-dim); }
        .val { font-weight: 500; }
        .val.money { color: var(--text-light); }
        .val.commission { color: #f87171; }
        .val.profit { color: var(--primary-color); font-weight: bold; }
        .highlight-box { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .divider-dash { border-top: 1px dashed rgba(255,255,255,0.1); margin: 10px 0; }
        .section-header { margin: 0 0 10px 0; color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .evidence-grid-view { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .evidence-item { background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; text-align: center; }
        .evidence-item span { display: block; margin-bottom: 8px; font-size: 0.8rem; color: var(--text-dim); }
        .evidence-item img { max-width: 100%; max-height: 150px; border-radius: 4px; }
        .evidence-item .sig-img { background: white; padding: 5px; }
        .action-btn-full { width: 100%; padding: 12px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .action-btn-full.secondary { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.1); }
        .action-btn-full.secondary:hover { background: rgba(255,255,255,0.15); border-color: white; }

        /* --- EXISTING LAYOUT --- */
        .page-header { margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .back-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); color: white; transition: all 0.2s; }
        .back-btn:hover { background: var(--primary-color); color: black; }
        .page-header h1 { margin: 0; font-size: 1.8rem; }
        .subtitle { color: var(--text-dim); margin: 4px 0 0 0; font-size: 0.9rem; }
        
        .main-grid { display: grid; grid-template-columns: 350px 1fr; gap: 24px; }
        @media (max-width: 1024px) { .main-grid { grid-template-columns: 1fr; } }

        .glass { background: #161b22; border: 1px solid rgba(48,54,61,0.5); border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .glass-hover { background: rgba(255,255,255,0.02); border: 1px solid transparent; border-radius: 8px; transition: all 0.2s; }
        .glass-hover:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); transform: translateY(-2px); }

        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .panel-header h3 { margin: 0; font-size: 1.1rem; }
        .badge { background: rgba(16, 185, 129, 0.1); color: var(--primary-color); padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }

        .search-box-container { margin-bottom: 15px; position: relative; }
        .search-input { width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding: 10px 10px 10px 35px; border-radius: 8px; color: white; box-sizing: border-box; }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-dim); }

        .scrollable-list { max-height: 600px; overflow-y: auto; padding-right: 5px; display: flex; flex-direction: column; gap: 8px; }
        .machine-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; cursor: default; }
        .m-info h4 { margin: 0 0 4px 0; font-size: 0.95rem; }
        .sub-text { margin: 0; font-size: 0.8rem; color: var(--text-dim); }
        .action-btn-icon { background: rgba(16, 185, 129, 0.1); color: var(--primary-color); border: none; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .action-btn-icon:hover { background: var(--primary-color); color: black; }
        .empty-search-state { text-align: center; padding: 20px; color: var(--text-dim); font-size: 0.9rem; }

        .table-responsive { overflow-x: auto; }
        .history-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .history-table th { text-align: left; padding: 12px; color: var(--text-dim); font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .history-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .amount { font-family: 'SF Mono', monospace; font-weight: 600; }
        .commission { color: #f87171; }
        .profit { color: var(--primary-color); }
        .delete-btn-mini { background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 6px; border-radius: 4px; opacity: 0.6; transition: 0.2s; }
        .delete-btn-mini:hover { background: rgba(220, 38, 38, 0.2); color: #ef4444; opacity: 1; }
        .view-btn-mini { background: transparent; border: none; color: var(--primary-color); cursor: pointer; padding: 6px; border-radius: 4px; margin-right: 5px; opacity: 0.8; transition: 0.2s; }
        .view-btn-mini:hover { background: rgba(16, 185, 129, 0.1); opacity: 1; }
        .empty-cell { text-align: center; color: var(--text-dim); padding: 30px; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { width: 95%; max-width: 900px; max-height: 90vh; overflow-y: auto; position: relative; display: flex; flex-direction: column; }
        .collection-modal { padding: 0; }
        .modal-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; }
        .close-btn { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }
        
        .modal-body-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; padding: 25px; }
        @media (max-width: 768px) { .modal-body-grid { grid-template-columns: 1fr; } }
        
        .form-section-title { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary-color); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 15px; font-weight: 700; }
        .mt-4 { margin-top: 25px; }
        
        .input-group { margin-bottom: 15px; display: flex; flex-direction: column; gap: 8px; }
        .input-group label { font-size: 0.9rem; color: var(--text-dim); }
        .input-group input, .input-group select { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; color: white; font-size: 1rem; }
        .input-group input:focus { border-color: var(--primary-color); outline: none; }
        .money-input { font-size: 1.2rem; font-weight: bold; color: var(--primary-color); }

        .commission-control { display: flex; align-items: center; gap: 10px; }
        .commission-control input { width: 80px; }
        .commission-value { color: #f87171; font-weight: bold; }

        .days-selector { display: flex; gap: 8px; }
        .days-selector button { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid transparent; color: var(--text-dim); padding: 8px; border-radius: 6px; cursor: pointer; transition: 0.2s; }
        .days-selector button.active { background: var(--primary-color); color: black; font-weight: bold; }
        .custom-days { width: 60px !important; text-align: center; }

        .modal-footer { padding: 20px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); display: flex; justify-content: space-between; align-items: center; }
        .profit-summary { display: flex; flex-direction: column; align-items: flex-start; }
        .profit-summary .label { font-size: 0.8rem; color: var(--text-dim); }
        .profit-summary .highlight { font-size: 1.4rem; font-weight: bold; color: var(--primary-color); }
        
        .modal-actions { display: flex; gap: 12px; }
        .btn-primary { background: var(--primary-color); color: black; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-primary:hover:not(:disabled) { box-shadow: 0 4px 12px var(--primary-glow); transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 12px 24px; border-radius: 8px; cursor: pointer; }
        .btn-secondary:hover { background: rgba(255,255,255,0.05); }
        
        .full-width { width: 100%; }

        /* Toasts */
        .toast-notification { position: fixed; top: 20px; right: 20px; padding: 15px 25px; background: #333; color: white; border-radius: 8px; z-index: 1000; box-shadow: 0 5px 15px rgba(0,0,0,0.5); cursor: pointer; transition: 0.3s; }
        .toast-notification:hover { transform: scale(1.02); }
        .toast-notification.success { background: #10b981; border-left: 4px solid #059669; }
        .toast-notification.error { background: #ef4444; border-left: 4px solid #b91c1c; }
        .toast-notification.info { background: #3b82f6; border-left: 4px solid #2563eb; }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
            ` }} />
        </div>
    )
}
