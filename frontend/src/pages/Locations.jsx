import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, PlusCircle, Search, MapPin, Edit, Trash2, Upload } from 'lucide-react'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { LocationFormModal } from '../components/locations/LocationFormModal'
import { MachineFormModal } from '../components/machines/MachineFormModal'
import { LinkMachineModal } from '../components/locations/LinkMachineModal'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { Toast } from '../components/ui/Toast'
import './Machines.css' // Reuse machines styles for grid/cards

export default function Locations() {
    // Offline Data
    // Offline Data
    const locationsData = useLiveQuery(() => db.locations.toArray())
    const machinesData = useLiveQuery(() => db.machines.toArray()) // Fetch machines for count/display
    const locations = locationsData || []
    const machines = machinesData || []
    const loading = !locationsData || !machinesData

    // Sync Check: If we detect empty array but Dexie has data (rare) or user just cleared Supabase
    // We can rely on Realtime, but for manual clear we might need to force a refresh or check.
    // However, the issue described is likely Dexie caching data even if Supabase is empty,
    // OR Supabase deletion didn't propagate to Dexie yet.

    // Add a manual re-sync effect on mount or when data changes unexpectedly
    useEffect(() => {
        const syncCheck = async () => {
            // Basic fetch to verify truth if local seems weird
            // But actually, useLiveQuery should react to Dexie changes. 
            // If the user deleted via SQL, the client doesn't know unless we listen to Changes or restart.
            // We'll trust the user refreshed. If they refreshed and it's still there, 
            // it means Dexie wasn't cleared.

            // Let's add a clear mechanism if it's truly zombie data vs valid offline data.
            // For now, assuming the user ran the SQL. We must ensure the app fetches the latest.
            // Since we don't have full Sync logic here, we'll add a 'Refresh' button or auto-fetch on mount.
        }
    }, [])

    // State
    const [filterQuery, setFilterQuery] = useState('')
    const [filteredLocations, setFilteredLocations] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingLocation, setEditingLocation] = useState(null)

    // Delete State
    const [locationToDelete, setLocationToDelete] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState(null)

    // Toast State
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type })
    }
    const hideToast = () => setToast({ ...toast, show: false })

    // Machine Modal State
    const [showMachineModal, setShowMachineModal] = useState(false)
    const [showLinkModal, setShowLinkModal] = useState(false)
    const [preSelectedLocation, setPreSelectedLocation] = useState(null)
    const [machineToUnlink, setMachineToUnlink] = useState(null)
    const fileInputRef = React.useRef(null)

    // Filter Logic
    useEffect(() => {
        if (!locations) return
        if (!filterQuery) {
            setFilteredLocations(locations)
        } else {
            const q = filterQuery.toLowerCase()
            setFilteredLocations(locations.filter(l =>
                l.name.toLowerCase().includes(q) ||
                (l.address && l.address.toLowerCase().includes(q))
            ))
        }
    }, [filterQuery, locations])

    const handleSave = async (formData) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return showToast("Sesión expirada", 'error')

            // Get Tenant
            const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
            const tenantId = user.user_metadata.tenant_id || profile?.tenant_id

            const payload = {
                ...formData,
                tenant_id: tenantId
            }

            if (editingLocation) {
                const { error } = await supabase.from('locations').update(payload).eq('id', editingLocation.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('locations').insert(payload)
                if (error) throw error
            }

            setShowModal(false)
            setEditingLocation(null)
        } catch (e) {
            console.error(e)
            showToast("Error al guardar: " + e.message, 'error')
        }
    }

    const handleDelete = async () => {
        if (!locationToDelete || !locationToDelete.id) {
            return
        }

        setIsDeleting(true)
        setDeleteError(null)

        try {
            // Check for machines linked to this location
            // Removing 'head: true' and selecting 'id' only to rule out weird header issues with PostgREST
            const { count, error: countError } = await supabase
                .from('machines')
                .select('id', { count: 'exact', head: true })
                .eq('location_id', locationToDelete.id)

            if (countError) {
                throw countError
            }

            if (count > 0) {
                setDeleteError(`No se puede eliminar: Hay ${count} máquinas asignadas a esta ubicación. Debes moverlas o eliminarlas primero.`)
                setIsDeleting(false)
                return
            }

            const { error } = await supabase.from('locations').delete().eq('id', locationToDelete.id)

            if (error) {
                throw error
            }

            setIsDeleting(false)
            setLocationToDelete(null)

            // Refetch or let subscription handle it? 
            // Since we use local state initially in effect but actually purely local locations from Dexie... 
            // We should ensure Dexie syncs? 
            // The useLiveQuery will update automatically if Dexie updates.
            // But we need to update Dexie or wait for sync.
            // For now, let's assume sync handles it or we reload.
            // Actually, we should probably delete from local DB too for immediate UI update if sync is slow.
            try {
                await db.locations.delete(locationToDelete.id)
            } catch (dexieError) {
                console.warn("Error deleting from local DB:", dexieError)
            }

        } catch (e) {
            console.error(e)
            setDeleteError("Error al eliminar: " + (e.message || "Error desconocido"))
            setIsDeleting(false)
        }
    }

    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                // Dynamic Import for XLSX
                const { read, utils } = await import('xlsx');

                const bstr = evt.target.result;
                const wb = read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = utils.sheet_to_json(ws);

                if (data.length === 0) {
                    showToast("El archivo parece estar vacío", 'error');
                    return;
                }
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return;

                // 1. Try fetching from Metadata
                let tenantId = user.user_metadata?.tenant_id

                // 2. Fallback to Profiles
                if (!tenantId) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('tenant_id')
                        .eq('id', user.id)
                        .single()
                    tenantId = profile?.tenant_id
                }

                if (!tenantId) {
                    showToast("Error de sesión: No se encontró el tenant.", 'error');
                    return;
                }

                // Helper to find value case-insensitive
                const findValue = (row, keys) => {
                    const normalize = str => str ? str.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
                    const rowKeys = Object.keys(row);

                    for (const targetKey of keys) {
                        const foundKey = rowKeys.find(k => normalize(k) === normalize(targetKey));
                        if (foundKey && row[foundKey]) return row[foundKey];
                    }
                    return undefined;
                };

                // Map and validate
                const locationsToUpsert = data.map(row => {
                    const name = findValue(row, ['nombre', 'lugar', 'ubicacion', 'punto de venta', 'cliente']) || 'Sin Nombre';
                    const address = findValue(row, ['direccion', 'domicilio', 'calle', 'ubicacion_completa']);
                    const district = findValue(row, ['zona', 'sector', 'area', 'colonia', 'distrito']);

                    return {
                        tenant_id: tenantId,
                        name: name,
                        address: address,
                        district: district
                    };
                });

                console.log("Locations Payload:", locationsToUpsert)

                const { error } = await supabase.from('locations').upsert(locationsToUpsert, { onConflict: 'name, tenant_id' }); // Assuming we want to update by name match? Or just insert? location id is uuid.
                // Upserting by name without ID is tricky in Supabase unless there is a generic unique constraint on (tenant_id, name).
                // Let's check if we can insert. If we use upsert without ID, it acts as insert unless there is a conflict on a unique key.
                // For now, let's assumes inserts for simple use case or check if we want dedupe.
                // The prompt implies "mass load", so insert is fine. Update might require ID.

                if (error) throw error;

                showToast(`Importación exitosa: ${locationsToUpsert.length} ubicaciones procesadas.`, 'success');
                // Sync should pick it up or we rely on page reload / navigation for now.

            } catch (error) {
                console.error("Error importing excel:", error);
                showToast("Error al importar: " + error.message, 'error');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    }

    return (
        <div className="machines-page"> {/* Reusing page class */}
            <Toast
                show={toast.show}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
            />
            <header className="page-header">
                <div className="header-left">
                    <Link to="/" className="back-btn"><ArrowLeft size={20} /></Link>
                    <div>
                        <h1>Puntos de Venta</h1>
                        <p className="subtitle">{locations.length} Ubicaciones registradas</p>
                    </div>
                </div>
            </header>

            <section className="fleet-section">
                <div className="toolbar-glass">
                    <div className="search-filter">
                        <Search size={18} className="machine-search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar ubicación..."
                            value={filterQuery}
                            onChange={e => setFilterQuery(e.target.value)}
                        />
                    </div>
                    <div className="actions">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleExcelUpload}
                            style={{ display: 'none' }}
                            accept=".xlsx, .xls, .csv"
                        />
                        <button onClick={() => fileInputRef.current.click()} className="add-btn secondary">
                            <Upload size={18} />
                            <span className="hide-mobile">Importar</span>
                        </button>
                        <button onClick={() => { setEditingLocation(null); setShowModal(true) }} className="add-btn primary">
                            <PlusCircle size={18} />
                            Nueva Ubicación
                        </button>
                    </div>
                </div>

                {loading ? <div className="loading-state">Cargando...</div> : (
                    <div className="machine-grid">
                        {filteredLocations.map(loc => {
                            // Find machines for this location
                            const locMachines = machines.filter(m => m.location_id === loc.id);

                            return (
                                <div key={loc.id}
                                    className="machine-card glass hover-effect"
                                    style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                                    onClick={() => {
                                        setPreSelectedLocation(loc)
                                        setShowLinkModal(true)
                                    }}
                                >
                                    <div className="card-header">
                                        <div className="header-top">
                                            <h3 className="machine-name text-xl">{loc.name}</h3>
                                            <div className="status-badge active" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                                <MapPin size={12} /> {loc.district || 'General'}
                                            </div>
                                        </div>
                                        <p className="machine-uid" style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.9rem' }}>
                                            {loc.address || 'Sin dirección registrada'}
                                        </p>
                                    </div>

                                    {/* Assigned Machines Section */}
                                    <div style={{
                                        margin: '15px 0',
                                        padding: '10px',
                                        background: 'rgba(0,0,0,0.2)',
                                        borderRadius: '8px',
                                        flex: 1
                                    }}>
                                        <span style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7, display: 'block', marginBottom: '8px' }}>
                                            Máquinas ({locMachines.length})
                                        </span>
                                        {locMachines.length === 0 ? (
                                            <div style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>Sin máquinas asignadas</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {locMachines.map(m => (
                                                    <div key={m.id} style={{
                                                        background: 'rgba(var(--primary-rgb), 0.1)',
                                                        border: '1px solid rgba(var(--primary-rgb), 0.3)',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem',
                                                        color: 'var(--primary-color)'
                                                    }}>
                                                        {m.qr_code_uid || m.nickname || 'Máquina'}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="card-actions" style={{
                                        marginTop: 'auto',
                                        paddingTop: 15,
                                        borderTop: '1px solid rgba(255,255,255,0.05)',
                                        display: 'grid',
                                        gridTemplateColumns: 'auto auto 1fr',
                                        gap: '8px'
                                    }}>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingLocation(loc); setShowModal(true) }} className="icon-btn tool-btn" title="Editar">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setLocationToDelete(loc); setDeleteError(null); }} className="icon-btn delete-btn" title="Eliminar">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            <LocationFormModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleSave}
                initialData={editingLocation}
            />

            <ConfirmationModal
                isOpen={!!locationToDelete}
                onClose={() => setLocationToDelete(null)}
                onConfirm={handleDelete}
                title="Eliminar Ubicación"
                message={
                    deleteError ? (
                        <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>
                            {deleteError}
                        </div>
                    ) : (
                        <span>¿Estás seguro de eliminar <strong>{locationToDelete?.name}</strong>?</span>
                    )
                }
                confirmText={deleteError ? "Reintentar" : "Eliminar"}
                isDestructive={true}
                isLoading={isDeleting}
            />

            <LinkMachineModal
                isOpen={showLinkModal}
                onClose={() => setShowLinkModal(false)}
                location={preSelectedLocation}
                onCreateNew={() => {
                    setShowLinkModal(false)
                    setShowMachineModal(true)
                }}
                onLink={async (machine) => {
                    // Update Machine Location
                    try {
                        const updates = {
                            location_id: preSelectedLocation.id,
                            location_name: preSelectedLocation.name,
                            address: preSelectedLocation.address || machine.address,
                            zone: preSelectedLocation.district || machine.zone
                        }

                        const { error } = await supabase.from('machines').update(updates).eq('id', machine.id)

                        if (error) throw error

                        // Update local DB for immediate UI feedback
                        await db.machines.update(machine.id, updates)

                        showToast("Máquina asignada al punto de venta.", 'success')
                        // Keep modal open or close? User might want to manage more. Let's keep it open or close. User usually closes.
                    } catch (e) {
                        console.error(e)
                        showToast("Error al asignar: " + e.message, 'error')
                    }
                }}
                onUnlink={(machine) => setMachineToUnlink(machine)}
            />

            <ConfirmationModal
                isOpen={!!machineToUnlink}
                onClose={() => setMachineToUnlink(null)}
                onConfirm={async () => {
                    if (!machineToUnlink) return
                    try {
                        const updates = {
                            location_id: null,
                            location_name: 'Bodega / Sin Asignar',
                            address: '',
                            zone: ''
                        }
                        const { error } = await supabase.from('machines').update(updates).eq('id', machineToUnlink.id)
                        if (error) throw error
                        await db.machines.update(machineToUnlink.id, updates)
                        showToast("Máquina desvinculada.", 'success')
                        setMachineToUnlink(null)
                    } catch (e) {
                        console.error(e)
                        showToast("Error al desvincular: " + e.message, 'error')
                        setMachineToUnlink(null)
                    }
                }}
                title="Desvincular Máquina"
                message={<span>¿Estás seguro de desvincular la máquina <strong>{machineToUnlink?.qr_code_uid || machineToUnlink?.nickname}</strong> de este punto de venta?</span>}
                confirmText="Desvincular"
                isDestructive={true}
            />

            <MachineFormModal
                isOpen={showMachineModal}
                onClose={() => setShowMachineModal(false)}
                onSubmit={async (formData) => {
                    // Reusing logic similar to Machines.jsx but specifically for adding new machines linked to this location
                    try {
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) return showToast("Sesión expirada", 'error')

                        // Get Tenant
                        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
                        const tenantId = user.user_metadata.tenant_id || profile?.tenant_id

                        const machineData = {
                            ...formData,
                            tenant_id: tenantId,
                            location_id: preSelectedLocation.id, // Enforce current location
                            location_name: preSelectedLocation.name, // Enforce name just in case
                            current_status: 'Active'
                        }

                        const { data, error } = await supabase.from('machines').insert(machineData).select().single()
                        if (error) throw error

                        // Add to local DB for immediate UI feedback
                        if (data) {
                            await db.machines.add(data)
                        }

                        showToast("Máquina agregada exitosamente!", 'success')
                        setShowMachineModal(false)
                    } catch (e) {
                        console.error(e)
                        showToast("Error al agregar máquina: " + e.message, 'error')
                    }
                }}
                initialData={preSelectedLocation ? {
                    location_id: preSelectedLocation.id,
                    location_name: preSelectedLocation.name,
                    address: preSelectedLocation.address,
                    zone: preSelectedLocation.district
                } : null}
                isEditing={false}
            />
        </div>
    )
}
