import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, PlusCircle, Search, Loader2, Settings, Upload, MapPin, Trash2, CheckCircle2, Printer, CheckSquare, Square } from 'lucide-react'
import { read, utils } from 'xlsx'
import { QRCodeSVG } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

export default function Machines() {
    const [machines, setMachines] = useState([])
    const [filteredMachines, setFilteredMachines] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    // Filter State (Autocomplete Search)
    const [filterQuery, setFilterQuery] = useState('')

    // Machine Form State
    const [newMachine, setNewMachine] = useState({
        qr_code_uid: '',
        location_name: '',
        address: '',
        maps_url: '',
        capsule_capacity: 100,
        denomination: 10,
        machine_count: 1,
        commission_percent: 20,
        zone: ''
    })
    const [isEditing, setIsEditing] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
    const qrPrintRef = useRef(null)

    // Address Search State (Nominatim)
    const [searchQuery, setSearchQuery] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const searchTimeout = useRef(null)

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

    useEffect(() => {
        fetchMachines()
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
                (m.address && m.address.toLowerCase().includes(query)) ||
                (m.zone && m.zone.toLowerCase().includes(query))
            )
            setFilteredMachines(filtered)
        }
    }, [filterQuery, machines])

    const fetchMachines = async () => {
        setLoading(true)
        const { data, error } = await supabase.from('machines').select('*').order('location_name')
        if (error) {
            console.error('Error fetching machines:', error)
            showToast("Error al cargar máquinas", 'error')
        } else {
            setMachines(data)
            setFilteredMachines(data)
        }
        setLoading(false)
    }

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
    }

    // --- Actions ---

    const handleToggleStatus = async (e, machine) => {
        e.stopPropagation()
        const newStatus = machine.current_status === 'Active' ? 'Inactive' : 'Active'
        const { error } = await supabase
            .from('machines')
            .update({ current_status: newStatus })
            .eq('id', machine.id)

        if (!error) fetchMachines()
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

        if (!window.confirm(`¿Seguro que deseas eliminar la máquina "${machine.location_name}"?`)) return

        const { error } = await supabase.from('machines').delete().eq('id', machine.id)
        if (error) {
            showToast("Error al eliminar: " + error.message, 'error')
        } else {
            showToast("Máquina eliminada correctamente", 'success')
            fetchMachines()
        }
    }

    const handleEdit = (machine) => {
        setNewMachine({
            qr_code_uid: machine.qr_code_uid,
            location_name: machine.location_name,
            address: machine.address || '',
            maps_url: machine.maps_url || '',
            capsule_capacity: machine.capsule_capacity || 100,
            denomination: machine.denomination || 10,
            machine_count: machine.machine_count || 1,
            commission_percent: machine.commission_percent || 0,
            zone: machine.zone || ''
        })
        setSearchQuery(machine.address || '')
        setEditingId(machine.id)
        setIsEditing(true)
        setShowModal(true)
    }

    const handleAddMachine = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)

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

            // Prepare data
            const machineData = {
                ...newMachine,
                tenant_id: tenantId
            }

            let error
            if (isEditing) {
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
                showToast('Máquina guardada exitosamente!', 'success')
                setShowModal(false)
                setNewMachine({
                    qr_code_uid: '', location_name: '', address: '', maps_url: '',
                    capsule_capacity: 100, denomination: 10, machine_count: 1, commission_percent: 20, zone: ''
                })
                setSearchQuery('')
                setIsEditing(false)
                setEditingId(null)
                fetchMachines()
            } else {
                showToast("Error al guardar: " + error.message, 'error')
            }
        } catch (err) {
            showToast("Error inesperado: " + err.message, 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    // --- Address Search (Nominatim) ---
    const handleAddressSearch = async (query) => {
        setSearchQuery(query)
        setNewMachine(prev => ({ ...prev, address: query }))

        if (query.length < 3) {
            setSuggestions([])
            return
        }
        if (searchTimeout.current) clearTimeout(searchTimeout.current)

        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true)
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`)
                const data = await response.json()
                setSuggestions(data)
                setShowSuggestions(true)
            } catch (err) {
                console.error('Search error:', err)
            } finally {
                setIsSearching(false)
            }
        }, 500)
    }

    const selectSuggestion = (item) => {
        const address = item.display_name
        const lat = item.lat
        const lon = item.lon
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`

        setNewMachine(prev => ({ ...prev, address, maps_url: mapsUrl }))
        setSearchQuery(address)
        setShowSuggestions(false)
    }

    // --- Excel Upload ---
    const handleExcelUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
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
                        machine_count: parseInt(findValue(row, ['cantidad', 'maquinas', 'unidades']) || 1)
                    };

                    if (uidMap.has(cleanUid)) {
                        machineObj.id = uidMap.get(cleanUid);
                    }

                    return machineObj;
                });

                const { error } = await supabase.from('machines').upsert(machinesToUpsert);

                if (error) throw error;
                const updatedCount = machinesToUpsert.filter(m => m.id).length;
                const newCount = machinesToUpsert.length - updatedCount;

                showToast(`Importación exitosa: ${newCount} nuevas, ${updatedCount} actualizadas.`, 'success');
                fetchMachines();

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
                        <Search size={18} className="search-icon" />
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
                            setIsEditing(false);
                            setNewMachine({
                                qr_code_uid: '', location_name: '', address: '', maps_url: '',
                                capsule_capacity: 100, denomination: 10, machine_count: 1, commission_percent: 20, zone: ''
                            });
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
                            <div key={machine.id} className={`glass machine-card card-glow ${selectedIds.has(machine.id) ? 'selected-card' : ''}`} onClick={() => handleEdit(machine)}>
                                <div className="m-header">
                                    <div className="selection-trigger" onClick={(e) => toggleSelection(e, machine.id)}>
                                        {selectedIds.has(machine.id) ? <CheckSquare size={20} className="teal" /> : <Square size={20} className="dim" />}
                                    </div>
                                    <div className="status-badge" onClick={(e) => handleToggleStatus(e, machine)}>
                                        <span className={`status-dot ${machine.current_status === 'Active' ? 'active' : 'inactive'}`}></span>
                                        {machine.current_status === 'Active' ? 'Activa' : 'Inactiva'}
                                    </div>
                                    <div className="card-actions">
                                        <button className="edit-icon-btn" onClick={(e) => { e.stopPropagation(); handleEdit(machine); }}>
                                            <Settings size={14} />
                                        </button>
                                        <button className="edit-icon-btn delete" onClick={(e) => handleDeleteMachine(e, machine)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="m-body">
                                    <h4>{machine.location_name}</h4>
                                    <p className="qr-ref">{machine.qr_code_uid} {machine.zone && <span className="zone-tag">@{machine.zone}</span>}</p>

                                    <div className="machine-stats-mini">
                                        <div className="stat-pill">
                                            <span className="label">Cant.</span>
                                            <span className="val">{machine.machine_count}</span>
                                        </div>
                                        <div className="stat-pill">
                                            <span className="label">Precio</span>
                                            <span className="val">${machine.denomination}</span>
                                        </div>
                                        <div className="stat-pill">
                                            <span className="label">Comisión</span>
                                            <span className="val">{machine.commission_percent}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="m-footer">
                                    <a href={machine.maps_url} target="_blank" rel="noreferrer" className="address-link" onClick={(e) => e.stopPropagation()}>
                                        <MapPin size={12} />
                                        {machine.address || 'Sin dirección'}
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Modal de Registro */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="glass modal-content">
                        <h3>{isEditing ? 'Editar Máquina' : 'Registrar Máquina'}</h3>
                        <form onSubmit={handleAddMachine}>
                            <div className="input-group">
                                <label>Código QR / UID</label>
                                <input
                                    type="text"
                                    placeholder="DINO-001"
                                    value={newMachine.qr_code_uid}
                                    onChange={e => setNewMachine({ ...newMachine, qr_code_uid: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label>Ubicación (Nombre)</label>
                                <input
                                    type="text"
                                    placeholder="Hospital Central"
                                    value={newMachine.location_name}
                                    onChange={e => setNewMachine({ ...newMachine, location_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label>Zona / Sector (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Zona Norte, Centro, etc."
                                    value={newMachine.zone}
                                    onChange={e => setNewMachine({ ...newMachine, zone: e.target.value })}
                                />
                            </div>

                            <div className="columns-2">
                                <div className="input-group">
                                    <label>Capacidad</label>
                                    <input
                                        type="number"
                                        value={newMachine.capsule_capacity}
                                        onChange={e => setNewMachine({ ...newMachine, capsule_capacity: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Precio ($)</label>
                                    <input
                                        type="number"
                                        step="0.50"
                                        value={newMachine.denomination}
                                        onChange={e => setNewMachine({ ...newMachine, denomination: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="columns-2">
                                <div className="input-group">
                                    <label>Cant. Máquinas</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newMachine.machine_count}
                                        onChange={e => setNewMachine({ ...newMachine, machine_count: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Comisión (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={newMachine.commission_percent}
                                        onChange={e => setNewMachine({ ...newMachine, commission_percent: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="input-group search-container">
                                <label>Dirección</label>
                                <div className="search-input-wrapper">
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchQuery}
                                        onChange={e => handleAddressSearch(e.target.value)}
                                        className="map-input"
                                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                    />
                                    {isSearching ? <Loader2 className="input-icon spin" size={18} /> : <Search className="input-icon" size={18} />}
                                </div>

                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="suggestions-dropdown glass">
                                        {suggestions.map((item, index) => (
                                            <div
                                                key={index}
                                                className="suggestion-item"
                                                onClick={() => selectSuggestion(item)}
                                            >
                                                <MapPin size={14} className="teal" />
                                                <span>{item.display_name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Registrar')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
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

            <style dangerouslySetInnerHTML={{
                __html: `
        .machines-page { padding: 20px; max-width: 1200px; margin: 0 auto; color: white; padding-bottom: 80px; }
        .page-header { margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .back-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); color: white; transition: all 0.2s; }
        .back-btn:hover { background: var(--primary-color); color: black; }
        .page-header h1 { margin: 0; font-size: 1.8rem; }
        .subtitle { color: var(--text-dim); margin: 4px 0 0 0; font-size: 0.9rem; }

        .selected-card { border-color: var(--primary-color) !important; background: rgba(16, 185, 129, 0.05) !important; }
        .selection-trigger { margin-right: 12px; cursor: pointer; display: flex; align-items: center; }
        .dim { color: rgba(255,255,255,0.2); }

        /* Toolbar */
        .toolbar-glass { 
            background: rgba(22, 27, 34, 0.7); border: 1px solid rgba(48, 54, 61, 0.8); backdrop-filter: blur(12px);
            padding: 16px; border-radius: 12px; margin-bottom: 24px;
            display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;
        }

        /* QR Print Styles */
        .qr-print-sheet { 
            width: 210mm; padding: 10mm; background: white; color: black;
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 10mm;
        }
        .qr-sticker {
            border: 1px solid #eee; padding: 10px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; text-align: center;
        }
        .qr-box { margin-bottom: 8px; }
        .qr-info { display: flex; flex-direction: column; gap: 2px; }
        .qr-info strong { font-size: 12px; }
        .qr-info span { font-size: 10px; color: #666; font-family: monospace; }
        .qr-info small { font-size: 8px; color: #999; margin-top: 4px; }
        
        .search-filter { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 250px; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
        .search-filter input { background: transparent; border: none; color: white; flex: 1; outline: none; font-size: 0.95rem; }
        .search-icon { color: var(--text-dim); }
        .select-all-icon-btn { background: transparent; border: none; padding: 4px; cursor: pointer; display: flex; align-items: center; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 10px; margin-left: 5px; }

        .actions { display: flex; gap: 10px; }
        .add-btn { 
            display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 8px; 
            font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; 
        }
        .add-btn.primary { background: var(--primary-color); color: black; }
        .add-btn.primary:hover { box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); }
        .add-btn.secondary { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.1); }
        .add-btn.secondary:hover { background: rgba(255,255,255,0.15); }

        /* Grid */
        .machine-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .machine-card { padding: 20px; border-radius: 16px; position: relative; transition: all 0.3s ease; }
        .machine-card:hover { transform: translateY(-4px); border-color: var(--primary-color); }

        .m-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        
        .status-badge { 
            display: flex; align-items: center; gap: 6px; font-size: 0.75rem; 
            background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 20px; cursor: pointer; user-select: none;
        }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #666; }
        .status-dot.active { background: #10b981; box-shadow: 0 0 8px #10b981; }
        .status-dot.inactive { background: #ef4444; }

        .card-actions { display: flex; gap: 6px; }
        .edit-icon-btn { 
            background: rgba(255,255,255,0.05); border: none; color: var(--text-dim); 
            padding: 6px; border-radius: 6px; cursor: pointer; transition: all 0.2s; 
        }
        .edit-icon-btn:hover { background: var(--primary-color); color: black; }
        .edit-icon-btn.delete:hover { background: #ef4444; color: white; }

        .m-body h4 { margin: 0 0 4px 0; font-size: 1.1rem; }
        .qr-ref { color: var(--text-dim); font-size: 0.85rem; margin: 0 0 16px 0; font-family: monospace; display: flex; align-items: center; gap: 8px; }
        .zone-tag { background: var(--primary-color); color: black; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }

        .machine-stats-mini { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .stat-pill { 
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); 
            padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; display: flex; gap: 6px;
        }
        .stat-pill .label { color: var(--text-dim); }
        .stat-pill .val { font-weight: 600; color: white; }

        .m-footer { padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); }
        .address-link { display: flex; align-items: center; gap: 6px; color: var(--text-dim); font-size: 0.8rem; text-decoration: none; transition: color 0.2s; }
        .address-link:hover { color: var(--primary-color); }

        /* Modal specific hacks for dark input integration */
        .modal-content { max-width: 500px; padding: 25px; background: #161b22; }
        .input-group label { margin-bottom: 6px; display: block; color: #ccc; font-size: 0.9rem; }
        input { 
            background: rgba(0,0,0,0.2) !important; border: 1px solid rgba(255,255,255,0.1) !important; 
            color: white !important; padding: 10px; border-radius: 8px; width: 100%; box-sizing: border-box; 
        }
        input:focus { border-color: var(--primary-color) !important; outline: none; }
        .columns-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        
        /* Map Suggestions */
        .suggestions-dropdown {
            position: absolute; top: 100%; left: 0; right: 0;
            background: #1c2128; border: 1px solid var(--border-color);
            border-radius: 8px; z-index: 100; max-height: 200px; overflow-y: auto;
            margin-top: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .suggestion-item {
            padding: 10px 12px; display: flex; align-items: center; gap: 8px;
            cursor: pointer; font-size: 0.9rem; color: var(--text-dim);
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .suggestion-item:hover { background: rgba(16, 185, 129, 0.1); color: white; }
        .search-container { position: relative; }
        .search-input-wrapper { display: flex; align-items: center; position: relative; }
        .input-icon { position: absolute; right: 10px; color: var(--text-dim); pointer-events: none; }
        
        .modal-actions { display: flex; gap: 12px; margin-top: 25px; }
        .btn-primary, .btn-secondary { flex: 1; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; }
        .btn-primary { background: var(--primary-color); color: rgb(0,0,0); }
        .btn-secondary { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; }

        .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
            display: flex; justify-content: center; align-items: center;
            z-index: 1000; padding: 20px;
        }
        `}} />
        </div>
    )
}
