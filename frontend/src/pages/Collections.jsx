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
    const locationsData = useLiveQuery(() => db.locations.toArray())
    const machinesData = useLiveQuery(() => db.machines.toArray())
    const collectionsData = useLiveQuery(() => db.collections.orderBy('collection_date').reverse().limit(50).toArray())

    const locations = locationsData || []
    const machines = machinesData || []
    const collections = collectionsData || []
    const isLoadingData = !locationsData || !machinesData || !collectionsData

    const [filteredLocations, setFilteredLocations] = useState([])
    const [filterQuery, setFilterQuery] = useState('')
    const [viewMode, setViewMode] = useState('list') // 'list' or 'history'

    const [selectedLocation, setSelectedLocation] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [collectionToDelete, setCollectionToDelete] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Collection State: Map { machineId: { ...data } }
    const [collectionMap, setCollectionMap] = useState({})

    // Group Machines by Location (Already done above)
    // ...

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

    // Incident Reporting State
    const [reportForm, setReportForm] = useState({
        enabled: false,
        active: false,
        type: 'Otro',
        description: '',
        remember: true
    })
    const [machineAlert, setMachineAlert] = useState(null)

    // --- LOGIC: OPEN MODAL ---
    const handleOpenModal = async (location) => {
        setSelectedLocation(location)
        const machines = location.machines || []

        // Initialize Map for each machine
        const initialMap = {}
        const today = getMexicoCityDate()

        machines.forEach(m => {
            const isRent = m.contract_type === 'rent'
            initialMap[m.id] = {
                machine_id: m.id,
                gross_amount: '', // Start empty
                collection_date: today,
                next_refill_days: 15,
                notes: '',
                units_sold: 0,
                cost_capsule: 1, // Default, maybe fetch from settings later
                cost_product: 2.5,
                commission_percent: isRent ? 0 : (m.commission_percent || 0),
                is_rent: isRent
            }
        })
        setCollectionMap(initialMap)

        // Reset Evidence & Forms
        setReportForm({ active: false, type: 'Otro', description: '', remember: true })
        setMachineAlert(null)
        setPhotoBlob(null)
        setPhotoPreview(null)
        setSignaturePreview(null)
        setShowPhotoModal(false)
        setShowSignatureModal(false)
        setShowModal(true)

        // Check reports (simplified: just check if ANY machine has reports)
        // ... (Optional: fetch reports for all machines in loc)
    }

    // --- LOGIC: UPDATE INDIVIDUAL COLLECTION ---
    const handleUpdateCollection = (machineId, field, value) => {
        setCollectionMap(prev => {
            const current = prev[machineId]
            const updated = { ...current, [field]: value }

            // Auto-calc units if amount changes
            if (field === 'gross_amount') {
                const machine = selectedLocation.machines.find(m => m.id === machineId)
                if (machine) {
                    const amount = parseFloat(value || 0)
                    const denom = machine.denomination || 10
                    updated.units_sold = Math.round(amount / denom)
                }
            }

            // Sync Date Global (if one changes, all change? UX decision. 
            // Better: update all dates if field is 'collection_date')
            if (field === 'collection_date') {
                const newMap = {}
                Object.keys(prev).forEach(key => {
                    newMap[key] = { ...prev[key], collection_date: value }
                })
                return newMap
            }

            return { ...prev, [machineId]: updated }
        })
    }

    // --- COMPUTED: TOTAL PROFIT ---
    const totalProfit = Object.values(collectionMap).reduce((acc, curr) => {
        const gross = parseFloat(curr.gross_amount || 0)
        const comm = gross * ((curr.commission_percent || 0) / 100)
        const expenses = (parseInt(curr.units_sold || 0) * (parseFloat(curr.cost_capsule || 0) + parseFloat(curr.cost_product || 0)))
        const profit = gross - comm - expenses
        return acc + profit
    }, 0)


    // ... (Helpers for dates, photos, signatures remain same)

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

    // Upload Helper
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
        if (!selectedLocation) return
        setIsSubmitting(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Sesión inválida")

            // 1. Upload Evidence ONCE (Shared)
            let photoUrl = null
            let signatureUrl = null
            const timestamp = Date.now()

            // Use Location ID for folder path now
            if (photoBlob) {
                const photoPath = `${user.user_metadata.tenant_id}/${selectedLocation.id}/${timestamp}_photo.jpg`
                photoUrl = await uploadEvidence(photoBlob, photoPath)
            }
            if (signaturePreview) {
                const sigBlob = await (await fetch(signaturePreview)).blob()
                const sigPath = `${user.user_metadata.tenant_id}/${selectedLocation.id}/${timestamp}_sig.png`
                signatureUrl = await uploadEvidence(sigBlob, sigPath)
            }

            // 2. Process All Machines in parallel
            const promises = Object.values(collectionMap).map(async (entry) => {
                if (!entry.gross_amount) return // Skip empty entries if allowed? Or assume required. Form has required.

                const machine = selectedLocation.machines.find(m => m.id === entry.machine_id)
                const gross = parseFloat(entry.gross_amount)
                const commission = gross * (entry.commission_percent / 100)
                const units = parseInt(entry.units_sold)
                const costCap = parseFloat(entry.cost_capsule)
                const costProd = parseFloat(entry.cost_product)
                const totalExp = units * (costCap + costProd)
                const profit = gross - commission - totalExp

                // Smart Next Date
                const nextVisitDateStr = calculateSmartNextDate(
                    entry.collection_date,
                    entry.next_refill_days,
                    machine.closed_days || []
                )

                // Insert Collection
                const { data: inserted, error } = await supabase.from('collections').insert({
                    tenant_id: machine.tenant_id,
                    location_id: selectedLocation.id, // NEW: Link to Location
                    machine_id: machine.id,
                    collection_date: entry.collection_date,
                    gross_amount: gross,
                    commission_amount: commission,
                    net_revenue: (gross - commission),
                    profit_amount: profit,
                    units_sold: units,
                    unit_cost_capsule: costCap,
                    unit_cost_product: costProd,
                    commission_percent_snapshot: entry.commission_percent,
                    next_refill_date_estimate: nextVisitDateStr,
                    next_visit_date: nextVisitDateStr,
                    notes: entry.notes,
                    created_by: user.id,
                    evidence_photo_url: photoUrl,     // SHARED URL
                    evidence_signature_url: signatureUrl // SHARED URL
                }).select().single()

                if (error) throw error

                // Update Machine Stock
                try {
                    // Since we don't have atomic decrement in this simple setup easily, assume optimistic
                    const newStock = Math.max(0, (machine.current_stock_snapshot || 0) - units)
                    await supabase.from('machines').update({
                        current_stock_snapshot: newStock
                    }).eq('id', machine.id)
                } catch (e) { console.error(e) }

                // Fire Email (One per machine? Or aggregate? Let's just fire existing per-collection logic for now)
                if (machine.contact_email) {
                    supabase.functions.invoke('send-receipt', { body: { collection_id: inserted.id } })
                }
            })

            await Promise.all(promises)

            // 3. Incident Report (Shared Logic - if report active, link to... FIRST machine? or generic?)
            // We need a machine_id for the report table typically.
            // Let's attach to the first machine of the location if generic, or User needs to select.
            // Simplified: Attach to the first machine in the list for now.
            if (reportForm.active) {
                const mainMachine = selectedLocation.machines[0]
                const reportStatus = reportForm.remember ? 'pending' : 'resolved'
                await supabase.from('reports').insert({
                    tenant_id: mainMachine.tenant_id,
                    machine_id: mainMachine.id,
                    machine_uid: mainMachine.qr_code_uid,
                    report_type: reportForm.type,
                    description: reportForm.description,
                    source: 'internal',
                    status: reportStatus,
                    priority: 'medium',
                    reported_at: new Date().toISOString()
                })
            }

            showToast('Corte registrado exitosamente!', 'success')
            setShowModal(false)

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
                    <div className="panel machine-list-panel glass" style={{ width: '100%', maxWidth: 'none' }}>
                        <div className="panel-header">
                            <h3>Puntos de Venta (Locaciones)</h3>
                            <span className="badge">{filteredLocations.length} Puntos</span>
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
                            {filteredLocations.map(location => (
                                <div
                                    key={location.id}
                                    className="machine-item glass-hover"
                                    onClick={() => handleOpenModal(location)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="m-info">
                                        <h4>{location.name}</h4>
                                        <p className="sub-text">
                                            {location.district ? `${location.district} • ` : ''}
                                            {location.total_machines === 1
                                                ? '1 Máquina'
                                                : `${location.total_machines} Máquinas`
                                            }
                                        </p>
                                    </div>
                                    <div className="action-btn-icon" title="Registrar Corte">
                                        <ArrowDownToLine size={24} />
                                    </div>
                                </div>
                            ))}
                            {filteredLocations.length === 0 && (
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
            {/* Modal: Register Collection */}
            {showModal && selectedLocation && (
                <CollectionModal
                    location={selectedLocation}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleRegisterCollection}
                    collectionMap={collectionMap}
                    onUpdateCollection={handleUpdateCollection}
                    totalProfit={totalProfit}
                    reportForm={reportForm}
                    setReportForm={setReportForm}
                    machineAlert={machineAlert}
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
