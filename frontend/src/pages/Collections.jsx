import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, Calendar, TrendingUp, AlertCircle, CheckCircle2, MoreVertical, Plus, Trash2, Search, ArrowDownToLine, Camera, Eraser, Eye } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import { getMexicoCityDate, formatDateDDMMYYYY, calculateSmartNextDate } from '../utils/formatters'
import { CollectionModal } from '../components/collections/CollectionModal'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { Toast } from '../components/ui/Toast'
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

    // --- PROCESS DATA: GROUP MACHINES BY LOCATION ---
    useEffect(() => {
        if (isLoadingData) return

        // 1. Group machines by location ID
        const machinesByLoc = {}
        machines.forEach(m => {
            if (m.location_id) {
                if (!machinesByLoc[m.location_id]) machinesByLoc[m.location_id] = []
                machinesByLoc[m.location_id].push(m)
            }
        })

        // 2. Enrich Locations
        const enrichedLocations = locations.map(loc => ({
            ...loc,
            machines: machinesByLoc[loc.id] || [],
            total_machines: (machinesByLoc[loc.id] || []).length
        }))

        // 3. Filter
        if (!filterQuery) {
            setFilteredLocations(enrichedLocations)
        } else {
            const q = filterQuery.toLowerCase()
            const filtered = enrichedLocations.filter(l =>
                l.name.toLowerCase().includes(q) ||
                (l.address && l.address.toLowerCase().includes(q))
            )
            setFilteredLocations(filtered)
        }
    }, [locations, machines, filterQuery, isLoadingData])

    // Sort Filter State
    const [sortOption, setSortOption] = useState('zone_asc') // 'zone_asc', 'name_asc'

    // Apply Sorting
    useEffect(() => {
        setFilteredLocations(prev => {
            const sorted = [...prev]
            if (sortOption === 'zone_asc') {
                sorted.sort((a, b) => {
                    const zoneA = (a.district || '').toLowerCase()
                    const zoneB = (b.district || '').toLowerCase()
                    if (zoneA < zoneB) return -1
                    if (zoneA > zoneB) return 1
                    // If zones equal, sort by name
                    return a.name.localeCompare(b.name)
                })
            } else if (sortOption === 'name_asc') {
                sorted.sort((a, b) => a.name.localeCompare(b.name))
            }
            return sorted
        })
    }, [sortOption, locations, filterQuery]) // Re-sort when data/filter changes (handled by effect chain, actually we need to run this ONCE after filtering)

    // Better: Integrate into main filter effect or separate effect that depends on filteredLocations? 
    // If we depend on filteredLocations, we get loop.
    // Let's integrate into the main effect above.


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

        // Check reports
        try {
            const machineIds = machines.map(m => m.id)
            const openReports = await db.reports
                .where('machine_id')
                .anyOf(machineIds)
                .filter(r => r.status === 'pending')
                .toArray()

            if (openReports.length > 0) {
                setMachineAlert({
                    type: 'warning',
                    message: `⚠ Hay ${openReports.length} reporte(s) pendiente(s) en este punto.`
                })
            } else {
                setMachineAlert(null)
            }
        } catch (err) {
            console.error("Error checking reports:", err)
            // Non-critical, just ignore
        }
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

            // 2. Prepare Batches
            const collectionsBatch = []
            const refillsBatch = []
            const machineUpdates = [] // Array of { id, changes }
            const machineStockUpdates = [] // For local Dexie

            // Prepare Data Loop
            Object.values(collectionMap).forEach(entry => {
                if (!entry.gross_amount) return

                const machine = selectedLocation.machines.find(m => m.id === entry.machine_id)
                if (!machine) return; // Safety check

                const gross = parseFloat(entry.gross_amount)
                const commission = gross * (entry.commission_percent / 100)
                const units = parseInt(entry.units_sold)
                const costCap = parseFloat(entry.cost_capsule)
                const costProd = parseFloat(entry.cost_product)
                const totalExp = units * (costCap + costProd)
                const profit = gross - commission - totalExp

                const nextVisitDateStr = calculateSmartNextDate(
                    entry.collection_date,
                    entry.next_refill_days,
                    machine.closed_days || []
                )

                // Add to Collections Batch
                collectionsBatch.push({
                    tenant_id: machine.tenant_id,
                    location_id: selectedLocation.id,
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
                    evidence_photo_url: photoUrl,
                    evidence_signature_url: signatureUrl,
                    machine_contact_email: machine.contact_email // Pass email here to use later? No, not in schema.
                })

                // Handle Stock Logic
                let newStock = machine.current_stock_snapshot || 0
                newStock = Math.max(0, newStock - units)

                if (entry.add_stock || entry.is_full) {
                    const added = parseInt(entry.add_stock || 0)
                    const capacity = machine.capsule_capacity || 180

                    if (entry.is_full) {
                        newStock = capacity
                    } else {
                        newStock = newStock + added
                    }
                    if (newStock > capacity) newStock = capacity

                    // Add to Refills Batch
                    refillsBatch.push({
                        tenant_id: machine.tenant_id,
                        machine_id: machine.id,
                        previous_percentage: 0,
                        current_percentage: Math.round((newStock / capacity) * 100),
                        quantity_added: added,
                        is_full: entry.is_full || false,
                        refill_date: new Date().toISOString(),
                        created_by: user.id
                    })
                }

                // Prepare Machine Update
                const updatePayload = {
                    current_stock_snapshot: newStock,
                    last_refill_date: (entry.add_stock || entry.is_full) ? new Date().toISOString() : machine.last_refill_date
                }

                machineUpdates.push({ id: machine.id, ...updatePayload })
                machineStockUpdates.push({ id: machine.id, ...updatePayload })
            })

            // 3. EXECUTE BATCHES

            // A. Bulk Insert Collections
            let insertedCollections = []
            if (collectionsBatch.length > 0) {
                const { data, error } = await supabase.from('collections').insert(collectionsBatch).select()
                if (error) throw error
                insertedCollections = data
            }

            // B. Bulk Insert Refills
            if (refillsBatch.length > 0) {
                const { error } = await supabase.from('refills').insert(refillsBatch)
                if (error) console.error("Error bulk inserting refills:", error)
            }

            // C. Parallel Machine Updates (Still N requests, but non-blocking critical path sort of)
            // Ideally we'd use an RPC for bulk update, but for 5-10 items Promise.all is acceptable vs complexity.
            // We use mapLimit if list is huge, but here typically < 20 machines per loc.
            await Promise.all(machineUpdates.map(u =>
                supabase.from('machines').update({
                    current_stock_snapshot: u.current_stock_snapshot,
                    last_refill_date: u.last_refill_date
                }).eq('id', u.id)
            ))

            // D. Local Dexie Updates
            await db.machines.bulkUpdate(machineStockUpdates.map(u => ({
                key: u.id,
                changes: { current_stock_snapshot: u.current_stock_snapshot, last_refill_date: u.last_refill_date }
            })))


            // E. Send Emails (After success)
            // Match inserted collections back to machines to get emails
            insertedCollections.forEach(col => {
                // We don't have the machine email in 'col', but we have 'col.machine_id'
                // Find original machine
                const m = selectedLocation.machines.find(x => x.id === col.machine_id)
                if (m && m.contact_email) {
                    // Fire and forget (don't await)
                    supabase.functions.invoke('send-receipt', { body: { collection_id: col.id } }).catch(console.error)
                }
            })

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
            <Toast
                show={toast.show}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
            />
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

                        <div className="filter-actions" style={{ padding: '0 16px', marginBottom: 12, display: 'flex', gap: 8 }}>
                            <select
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value)}
                                className="filter-select"
                                style={{ padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', flex: 1 }}
                            >
                                <option value="zone_asc">📍 Zona (A-Z)</option>
                                <option value="name_asc">🔤 Nombre (A-Z)</option>
                            </select>
                        </div>

                        <div className="scrollable-list" style={{ maxHeight: 'none' }}>
                            {filteredLocations.map(location => (
                                <div
                                    key={location.id}
                                    className="machine-item glass-hover"
                                    onClick={() => handleOpenModal(location)}
                                    // A11y Attributes
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            handleOpenModal(location)
                                        }
                                    }}
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
                                            <td className="amount">${parseFloat(col.gross_amount || 0).toFixed(2)}</td>
                                            <td className="amount commission">-${parseFloat(col.commission_amount || 0).toFixed(2)}</td>
                                            <td className={`amount ${col.profit_amount >= 0 ? 'profit' : 'commission'}`}>
                                                ${parseFloat(col.profit_amount ?? col.net_revenue ?? 0).toFixed(2)}
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
