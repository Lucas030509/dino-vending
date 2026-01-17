import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, PlusCircle, Search, Upload, CheckCircle2, Printer, CheckSquare, Square } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { db } from '../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { MachineFormModal } from '../components/machines/MachineFormModal'
import { MachineCard } from '../components/machines/MachineCard'
import './Machines.css'

export default function Machines() {
    // Offline: Read from Dexie
    const machines = useLiveQuery(() => db.machines.orderBy('location_name').toArray())
    const loading = !machines

    // Derived state for filtering
    const [filteredMachines, setFilteredMachines] = useState([])


    const [showModal, setShowModal] = useState(false)

    // Filter State (Autocomplete Search)
    const [filterQuery, setFilterQuery] = useState('')

    // Machine Form State
    const [editingMachine, setEditingMachine] = useState(null)
    const [editingId, setEditingId] = useState(null)
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

    const qrPrintRef = useRef(null)

    // Delete Modal State
    const [machineToDelete, setMachineToDelete] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Toast State
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type })
        if (type !== 'error') {
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000)
        }
    }
    const hideToast = () => setToast({ ...toast, show: false })

    const fileInputRef = useRef(null)

    // Filter effect
    useEffect(() => {
        if (!machines) return; // Wait for load

        if (!filterQuery) {
            setFilteredMachines(machines)
        } else {
            const query = filterQuery.toLowerCase()
            const filtered = machines.filter(m =>
                (m.location_name && m.location_name.toLowerCase().includes(query)) ||
                (m.qr_code_uid && m.qr_code_uid.toLowerCase().includes(query)) ||
                (m.address && m.address.toLowerCase().includes(query)) ||
                (m.zone && m.zone.toLowerCase().includes(query))
            )
            setFilteredMachines(filtered)
        }
    }, [filterQuery, machines])

    // Fetch call removed in favor of useLiveQuery


    const toggleSelection = (e, id) => {
        e.stopPropagation()
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const selectAll = () => {
        if (selectedIds.size === filteredMachines.length && filteredMachines.length > 0) {
            setSelectedIds(new Set())
        } else {
            const newSet = new Set(filteredMachines.map(m => m.id))
            setSelectedIds(newSet)
        }
    }

    const handlePrintQRs = async () => {
        const toPrint = machines.filter(m => selectedIds.has(m.id))
        if (toPrint.length === 0) {
            showToast("Selecciona al menos una máquina para imprimir", 'info')
            return
        }

        setIsGeneratingPDF(true)
        showToast("Generando hoja de QRs...", 'info')

        try {
            // Dynamic Import for Performance
            const { jsPDF } = await import('jspdf')
            const html2canvas = (await import('html2canvas')).default

            // Small delay to ensure the hidden component renders
            setTimeout(async () => {
                try {
                    const doc = new jsPDF('p', 'mm', 'a4')
                    const element = qrPrintRef.current

                    const canvas = await html2canvas(element, { scale: 2 })
                    const imgData = canvas.toDataURL('image/png')

                    const imgProps = doc.getImageProperties(imgData)
                    const pdfWidth = doc.internal.pageSize.getWidth()
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

                    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
                    doc.save(`QRs_DinoVending_${new Date().toLocaleDateString()}.pdf`)
                    showToast("PDF generado con éxito", 'success')
                } catch (err) {
                    console.error(err)
                    showToast("Error al generar PDF", 'error')
                } finally {
                    setIsGeneratingPDF(false)
                }
            }, 500)
        } catch (e) {
            console.error("Error loading PDF libs", e)
            setIsGeneratingPDF(false)
        }
    }

    // --- Actions ---

    const handleToggleStatus = async (e, machine) => {
        e.stopPropagation()
        const newStatus = machine.current_status === 'Active' ? 'Inactive' : 'Active'
        const { error } = await supabase
            .from('machines')
            .update({ current_status: newStatus })
            .eq('id', machine.id)

        if (!error) {
            // Success - sync will update UI eventually
        }
    }

    const handleDeleteMachine = async (e, machine) => {
        e.stopPropagation()
        const { count, error: countError } = await supabase
            .from('collections')
            .select('*', { count: 'exact', head: true })
            .eq('machine_id', machine.id)

        if (countError) {
            showToast("Error verificando cortes: " + countError.message, 'error')
            return
        }

        if (count > 0) {
            showToast(`No se puede eliminar: tiene ${count} cortes registrados.`, 'error')
            return
        }

        setMachineToDelete(machine)
    }

    const handleConfirmDelete = async () => {
        if (!machineToDelete) return
        setIsDeleting(true)

        try {
            const { error } = await supabase.from('machines').delete().eq('id', machineToDelete.id)
            if (error) {
                showToast("Error al eliminar: " + error.message, 'error')
            } else {
                showToast("Máquina eliminada correctamente", 'success')
            }
        } catch (err) {
            console.error(err)
            showToast("Error inesperado al eliminar", 'error')
        } finally {
            setIsDeleting(false)
            setMachineToDelete(null)
        }
    }

    const handleEdit = (machine) => {
        setEditingMachine(machine)
        setEditingId(machine.id)
        setShowModal(true)
    }

    const handleSaveMachine = async (formData) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                showToast("Sesión expirada", 'error')
                return
            }

            // 1. Try fetching from Metadata (Fastest & Safest)
            let tenantId = user.user_metadata?.tenant_id

            // 2. Fallback to Profiles if not in metadata
            if (!tenantId) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('tenant_id')
                    .eq('id', user.id)
                    .single()
                tenantId = profile?.tenant_id
            }

            if (!tenantId) {
                showToast("No se encontró Tenant (Empresa) asociada.", 'error')
                return
            }

            // Prepare data with sanitation
            const machineData = {
                ...formData,
                tenant_id: tenantId,
                // Ensure empty strings don't break numeric/time columns
                rent_amount: formData.rent_amount === '' ? 0 : parseFloat(formData.rent_amount),
                opening_time: formData.opening_time === '' ? null : formData.opening_time,
                closing_time: formData.closing_time === '' ? null : formData.closing_time,
                closed_days: formData.closed_days || []
            }

            console.log("Saving Machine Data:", machineData)

            let error
            if (editingId) {
                const { error: updateError } = await supabase
                    .from('machines')
                    .update(machineData)
                    .eq('id', editingId)
                error = updateError
            } else {
                machineData.current_status = 'Active' // Set default only on insert
                const { error: insertError } = await supabase
                    .from('machines')
                    .insert(machineData)
                error = insertError
            }

            if (!error) {
                // fetchMachines() // Handled by liveQuery via sync/websocket in future, but for now we rely on sync or manual refresh.
                // Ideally, we should also update local Dexie here if we want instant feedback offline-first.
                // But since we are online for these actions (they use supabase.* directly), we can trigger a sync or just update Dexie.
                // For simplicity now:
                // We let the sync logic handle it or just rely on the fact that if we are online, we probably should sync.
                // Actually, if we use Dexie as source of truth, we MUST update Dexie or trigger sync.

                // Trigger background sync to update local DB
                // In a perfect world we write to Dexie -> Queue -> Sync

                showToast(editingId ? 'Máquina actualizada correctamente!' : 'Máquina registrada exitosamente!', 'success')
                setShowModal(false)
                setEditingMachine(null)
                setEditingId(null)
            } else {
                console.error("Supabase Error:", error)
                // Handle specific errors
                if (error.code === '23503') {
                    showToast("Error crítico: La empresa asociada no existe.", 'error')
                } else if (error.code === '42501') {
                    showToast("Permisos insuficientes. Verifica tu sesión.", 'error')
                } else if (error.code === '22P02') {
                    showToast("Error de tipo de dato (Verifica montos y horas).", 'error')
                } else {
                    showToast("Error al guardar: " + error.message, 'error')
                }
            }
        } catch (err) {
            console.error("TryCatch Error:", err)
            showToast("Error inesperado: " + err.message, 'error')
        }
    }

    // --- Excel Upload ---
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

                // 1. Try fetching from Metadata (Fastest & Safest)
                let tenantId = user.user_metadata?.tenant_id

                // 2. Fallback to Profiles if not in metadata
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

                // 1. Fetch existing machines to check for UIDs (for Updates)
                const { data: existingMachines } = await supabase
                    .from('machines')
                    .select('id, qr_code_uid')
                    .eq('tenant_id', tenantId);

                const uidMap = new Map();
                if (existingMachines) {
                    existingMachines.forEach(m => {
                        if (m.qr_code_uid) uidMap.set(m.qr_code_uid.trim().toUpperCase(), m.id);
                    });
                }

                // Helper to find value case-insensitive and accent-insensitive
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
                const machinesToUpsert = data.map(row => {
                    const addressText = findValue(row, ['domicilio', 'direccion', 'calle', 'ubicacion_completa']) || '';
                    const uid = findValue(row, ['uid', 'codigo', 'qr', 'id']) || `AUTO-${Math.random().toString(36).substr(2, 6)}`;
                    const cleanUid = String(uid).trim().toUpperCase();

                    const generatedMapUrl = addressText
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
                        : '';

                    // Parse Closed Days - KEYS UPDATED
                    const closedRaw = findValue(row, ['dias de cierre', 'dias_cerrados', 'cerrado', 'descanso', 'dias_no_laborales']) || '';
                    let daysArray = [];
                    if (closedRaw && closedRaw != '0') {
                        daysArray = String(closedRaw).split(',').map(d => {
                            const clean = d.trim().toLowerCase();
                            // Spanish & English Mapping
                            if (clean.includes('lu') || clean.includes('mo')) return 'Monday';
                            if (clean.includes('ma') || clean.includes('tu')) return 'Tuesday';
                            if (clean.includes('mi') || clean.includes('we')) return 'Wednesday';
                            if (clean.includes('ju') || clean.includes('th')) return 'Thursday';
                            if (clean.includes('vi') || clean.includes('fr')) return 'Friday';
                            if (clean.includes('sa') || clean.includes('sat')) return 'Saturday';
                            if (clean.includes('do') || clean.includes('su')) return 'Sunday';
                            return null;
                        }).filter(Boolean);
                    }

                    // Parse Contract Type - KEYS UPDATED
                    let contractType = 'commission';
                    const cTypeRaw = String(findValue(row, ['tipo de pago', 'tipo_contrato', 'contrato', 'modelo']) || '').toLowerCase();
                    if (cTypeRaw.includes('rent') || cTypeRaw.includes('fijo') || cTypeRaw.includes('alquiler')) {
                        contractType = 'rent';
                    }

                    // Parse Times
                    // Basic safeguard: if excel sends serial number for time, we might skip it for now or assume HH:MM text
                    const openTime = findValue(row, ['apertura', 'hora_abierto', 'opening']) || null;
                    const closeTime = findValue(row, ['cierre', 'hora_cierre', 'closing']) || null;


                    const machineObj = {
                        tenant_id: tenantId,
                        qr_code_uid: uid,
                        location_name: findValue(row, ['nombre', 'ubicacion', 'lugar', 'cliente']) || 'Sin Nombre',
                        address: addressText,
                        denomination: parseFloat(findValue(row, ['precio', 'costo', 'denominacion']) || 10),
                        capsule_capacity: parseInt(findValue(row, ['capacidad', 'capsulas']) || 100),
                        commission_percent: parseFloat(findValue(row, ['comision', 'porcentaje']) || 0),
                        maps_url: findValue(row, ['maps', 'url', 'mapa']) || generatedMapUrl,
                        current_status: 'Active',
                        zone: findValue(row, ['zona', 'sector', 'area']) || '',
                        machine_count: parseInt(findValue(row, ['cantidad', 'maquinas', 'unidades']) || 1),
                        contact_name: findValue(row, ['contacto', 'encargado', 'dueño', 'contacto_nombre']) || '',
                        contact_email: findValue(row, ['email', 'correo', 'contacto_email']) || '',
                        contact_phone: findValue(row, ['telefono', 'celular', 'tel', 'contacto_tel']) || '',
                        // V3 Fields
                        closed_days: daysArray,
                        opening_time: openTime,
                        closing_time: closeTime,
                        contract_type: contractType,
                        rent_amount: parseFloat(findValue(row, ['importe renta', 'renta', 'monto_renta', 'pago_fijo']) || 0),
                        rent_periodicity: findValue(row, ['periodicidad', 'periodo_renta']) || 'Mensual'
                    };

                    if (uidMap.has(cleanUid)) {
                        machineObj.id = uidMap.get(cleanUid);
                    }

                    return machineObj;
                });

                console.log("Machines Payload for Upsert:", machinesToUpsert)

                const { error } = await supabase.from('machines').upsert(machinesToUpsert);

                if (error) throw error;
                const updatedCount = machinesToUpsert.filter(m => m.id).length;
                const newCount = machinesToUpsert.length - updatedCount;

                showToast(`Importación exitosa: ${newCount} nuevas, ${updatedCount} actualizadas.`, 'success');
                showToast(`Importación exitosa: ${newCount} nuevas, ${updatedCount} actualizadas.`, 'success');
                // fetchMachines(); // Removed as handled by liveQuery/Sync

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
        <div className="machines-page">
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
                        <h1>Gestión de Máquinas</h1>
                        <p className="subtitle">{machines.length} Unidades registradas</p>
                    </div>
                </div>
            </header>

            <section className="fleet-section">
                <div className="toolbar-glass">
                    <div className="search-filter">
                        <Search size={18} className="machine-search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar máquina (Nombre, UID, Dirección)..."
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                        />
                        <button className="select-all-icon-btn" onClick={selectAll} title={selectedIds.size === filteredMachines.length ? "Deseleccionar todas" : "Seleccionar todas"}>
                            {selectedIds.size > 0 && selectedIds.size === filteredMachines.length ? <CheckSquare size={18} className="teal" /> : <Square size={18} className="dim" />}
                        </button>
                    </div>
                    <div className="actions">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleExcelUpload}
                            style={{ display: 'none' }}
                            accept=".xlsx, .xls"
                        />
                        {selectedIds.size > 0 && (
                            <button className="add-btn secondary" onClick={handlePrintQRs}>
                                <Printer size={18} />
                                <span className="hide-mobile">Imprimir QRs ({selectedIds.size})</span>
                            </button>
                        )}
                        <button onClick={() => fileInputRef.current.click()} className="add-btn secondary">
                            <Upload size={18} />
                            <span className="hide-mobile">Importar</span>
                        </button>
                        <button onClick={() => {
                            setEditingId(null)
                            setEditingMachine(null)
                            setShowModal(true);
                        }} className="add-btn primary">
                            <PlusCircle size={18} />
                            Nueva
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state"><p>Cargando máquinas...</p></div>
                ) : filteredMachines.length === 0 ? (
                    <div className="empty-state glass">
                        <p>{filterQuery ? 'No se encontraron máquinas con ese criterio.' : 'No tienes máquinas registradas.'}</p>
                    </div>
                ) : (
                    <div className="machine-grid">
                        {filteredMachines.map(machine => (
                            <MachineCard
                                key={machine.id}
                                machine={machine}
                                isSelected={selectedIds.has(machine.id)}
                                onSelect={(e) => toggleSelection(e, machine.id)}
                                onEdit={handleEdit}
                                onDelete={handleDeleteMachine}
                                onToggleStatus={handleToggleStatus}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Modal de Registro / Edición (Refactorizado) */}
            {showModal && (
                <MachineFormModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleSaveMachine}
                    initialData={editingMachine}
                    isEditing={!!editingId}
                />
            )}

            {/* Hidden QR Generator for Print */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                <div ref={qrPrintRef} className="qr-print-sheet">
                    {machines.filter(m => selectedIds.has(m.id)).map(m => (
                        <div key={m.id} className="qr-sticker">
                            <div className="qr-box">
                                <QRCodeSVG value={`${window.location.origin}/report/${m.id}`} size={120} />
                            </div>
                            <div className="qr-info">
                                <strong>{m.location_name}</strong>
                                <span>{m.qr_code_uid}</span>
                                <small>Reporta aquí si está vacía</small>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!machineToDelete}
                onClose={() => setMachineToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Eliminar Máquina"
                message={<span>¿Estás seguro de que deseas eliminar <strong>{machineToDelete?.location_name}</strong>? Esta acción no se puede deshacer.</span>}
                confirmText="Sí, Eliminar"
                cancelText="No, Cancelar"
                isDestructive={true}
                isLoading={isDeleting}
            />


        </div >
    )
}
