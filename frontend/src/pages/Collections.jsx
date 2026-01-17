import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, Calendar, TrendingUp, AlertCircle, CheckCircle2, MoreVertical, Plus, Trash2, Search, ArrowDownToLine, Camera, Eraser, Eye } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import { getMexicoCityDate, formatDateDDMMYYYY } from '../utils/formatters'
import { CollectionModal } from '../components/collections/CollectionModal'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import './Collections.css'

export default function Collections() {
    // Offline Data
    // Offline Data
    const machinesData = useLiveQuery(() => db.machines.orderBy('location_name').toArray())
    const collectionsData = useLiveQuery(() => db.collections.orderBy('collection_date').reverse().limit(50).toArray())

    const machines = machinesData || []
    const collections = collectionsData || []
    const isLoadingData = !machinesData || !collectionsData

    const [filteredMachines, setFilteredMachines] = useState([])
    const [filterQuery, setFilterQuery] = useState('')
    // const [loading, setLoading] = useState(false) // Removed, using isLoadingData
    const [viewMode, setViewMode] = useState('list') // 'list' or 'history'
    const [selectedMachine, setSelectedMachine] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [collectionToDelete, setCollectionToDelete] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)
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
    // Form State for New Collection
    const [newCollection, setNewCollection] = useState({
        gross_amount: '',
        // Force Mexico City Timezone (YYYY-MM-DD)
        collection_date: getMexicoCityDate(),
        next_refill_days: 15, // Default estimate
        notes: '',
        units_sold: 0,
        cost_capsule: 1,
        cost_product: 2.5,
        commission_percent: 0
    })

    // Incident Reporting State
    const [reportForm, setReportForm] = useState({
        enabled: false,
        type: 'Otro',
        description: '',
        remember: true
    })
    const [machineAlert, setMachineAlert] = useState(null)

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

    // Removed manual fetchData useEffect

    // Removed manual fetchData function


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

    const handleOpenModal = async (machine) => {
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

        // Reset Incident Form
        setReportForm({ enabled: false, type: 'Otro', description: '', remember: true })
        setMachineAlert(null)

        // Check for pending reports
        try {
            const { count } = await supabase
                .from('reports')
                .select('*', { count: 'exact', head: true })
                .eq('machine_id', machine.id)
                .in('status', ['pending', 'in_progress'])

            if (count && count > 0) {
                setMachineAlert(`⚠️ Atención: Esta máquina tiene ${count} incidencia(s) pendiente(s).`)
            }
        } catch (e) {
            console.error("Error checking reports", e)
        }

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

            // 5. Update Machine Stock (Inventory Management)
            try {
                // Fetch fresh data to avoid race conditions
                const { data: freshMachine } = await supabase
                    .from('machines')
                    .select('current_stock_snapshot')
                    .eq('id', selectedMachine.id)
                    .single()

                if (freshMachine) {
                    const currentStock = freshMachine.current_stock_snapshot || 0
                    const newStock = Math.max(0, currentStock - units)

                    await supabase
                        .from('machines')
                        .update({ current_stock_snapshot: newStock })
                        .eq('id', selectedMachine.id)
                }
            } catch (invError) {
                console.error("Error updating inventory:", invError)
                // Don't block flow, just log
            }

            // 4. Save Incident Report (if enabled)
            if (reportForm.enabled) {
                const reportStatus = reportForm.remember ? 'pending' : 'resolved'
                const { error: reportError } = await supabase.from('reports').insert({
                    tenant_id: selectedMachine.tenant_id,
                    machine_id: selectedMachine.id,
                    machine_uid: selectedMachine.qr_code_uid, // Required for Reports Display
                    report_type: reportForm.type,
                    description: reportForm.description,
                    contact_phone: 'N/A', // Internal report
                    source: 'internal', // New column
                    status: reportStatus,
                    priority: 'medium',
                    reported_at: new Date().toISOString()
                })
                if (reportError) console.error("Error saving incident:", reportError)
            }

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
            setShowModal(false)
            // fetchData() // Refresh handled by liveQuery automatically


        } catch (err) {
            console.error('Error recording collection:', err)
            showToast(err.message, 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteCollection = (e, col) => {
        e.stopPropagation()
        setCollectionToDelete(col)
    }

    const resolveDeleteCollection = async () => {
        if (!collectionToDelete) return
        setIsDeleting(true)

        try {
            const { error } = await supabase
                .from('collections')
                .delete()
                .eq('id', collectionToDelete.id)

            if (error) {
                console.error('Error deleting collection:', error)
                showToast('Error al eliminar', 'error')
            } else {
                showToast('Corte eliminado correctamente', 'success')
            }
        } catch (err) {
            console.error(err)
            showToast('Error inesperado', 'error')
        } finally {
            setIsDeleting(false)
            setCollectionToDelete(null)
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
                <div className="header-actions">
                    <button
                        className="btn-secondary"
                        onClick={() => setViewMode(viewMode === 'list' ? 'history' : 'list')}
                    >
                        {viewMode === 'list' ? (
                            <>
                                <Calendar size={18} style={{ marginRight: 8 }} />
                                Ver Historial Global
                            </>
                        ) : (
                            <>
                                <Plus size={18} style={{ marginRight: 8 }} />
                                Nuevo Corte
                            </>
                        )}
                    </button>
                </div>
            </header>

            <div className="main-content-area" style={{ display: 'block' }}>
                {viewMode === 'list' ? (
                    /* Left Panel: Active Machines to Service */
                    <div className="panel machine-list-panel glass" style={{ width: '100%', maxWidth: 'none' }}>
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

                        <div className="scrollable-list" style={{ maxHeight: 'none' }}>
                            {filteredMachines.map(machine => (
                                <div
                                    key={machine.id}
                                    className="machine-item glass-hover"
                                    onClick={() => handleOpenModal(machine)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="m-info">
                                        <h4>{machine.location_name}</h4>
                                        <p className="sub-text">
                                            {machine.qr_code_uid} •
                                            {machine.contract_type === 'rent' ? ' Renta Fija' : ` ${machine.commission_percent}% Com.`}
                                        </p>
                                    </div>
                                    <div className="action-btn-icon" title="Registrar Corte">
                                        <ArrowDownToLine size={24} />
                                    </div>
                                </div>
                            ))}
                            {filteredMachines.length === 0 && (
                                <div className="empty-search-state">
                                    <p>No se encontraron resultados.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Right Panel: Recent History */
                    <div className="panel history-panel glass" style={{ width: '100%', maxWidth: 'none' }}>
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
                                            <td>{formatDateDDMMYYYY(col.collection_date)}</td>
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
                                                <button onClick={(e) => handleDeleteCollection(e, col)} className="delete-btn-mini" title="Eliminar Corte">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {isLoadingData && (
                                        <tr>
                                            <td colSpan="6" className="empty-cell">Cargando historial...</td>
                                        </tr>
                                    )}
                                    {!isLoadingData && collections.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="empty-cell">No hay cortes registrados aún.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Register Collection */}
            {showModal && selectedMachine && (
                <CollectionModal
                    machine={selectedMachine}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleRegisterCollection}
                    newCollection={newCollection}
                    setNewCollection={setNewCollection}
                    reportForm={reportForm}
                    setReportForm={setReportForm}
                    machineAlert={machineAlert}
                    commissionAmount={commissionAmount}
                    netProfit={profitAmount}
                    signatureRef={signatureRef}
                    clearSignature={clearSignature}
                    signaturePreview={signaturePreview}
                    setSignaturePreview={setSignaturePreview}
                    photoPreview={photoPreview}
                    setPhotoPreview={setPhotoPreview}
                    showPhotoModal={showPhotoModal}
                    setShowPhotoModal={setShowPhotoModal}
                    showSignatureModal={showSignatureModal}
                    setShowSignatureModal={setShowSignatureModal}
                    photoFile={photoBlob}
                    setPhotoFile={setPhotoBlob}
                    isSubmitting={isSubmitting}
                />
            )}
            {/* --- MODAL FOTO --- */}
            {
                showPhotoModal && (
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
                )
            }

            {/* --- MODAL FIRMA --- */}
            {
                showSignatureModal && (
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
                )
            }

            {/* --- MODAL DETALLE HISTORIAL --- */}
            {
                viewingCollection && (
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
                                        <span className="val">{formatDateDDMMYYYY(viewingCollection.collection_date)}</span>
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
                )
            }



            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!collectionToDelete}
                onClose={() => setCollectionToDelete(null)}
                onConfirm={resolveDeleteCollection}
                title="Eliminar Corte"
                message={
                    <span>
                        ¿Estás seguro de eliminar el corte del <strong>{formatDateDDMMYYYY(collectionToDelete?.collection_date)}</strong>?
                        <br /><br />
                        <small style={{ color: '#ef4444' }}>⚠ Esto afectará los contadores y reportes financieros.</small>
                    </span>
                }
                confirmText="Sí, Eliminar"
                isDestructive={true}
                isLoading={isDeleting}
            />
        </div >
    )
}
