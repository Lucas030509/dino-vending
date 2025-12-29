import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, Map, Calendar, CheckSquare, Square, Search, Navigation, Layers } from 'lucide-react'

export default function RoutePlanner() {
    const [machines, setMachines] = useState([])
    const [zones, setZones] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterQuery, setFilterQuery] = useState('')

    // Selection State
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [scheduleDate, setScheduleDate] = useState('')

    // Toast
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type })
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000)
    }

    useEffect(() => {
        fetchMachines()
        // Set default date to now
        const now = new Date()
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
        setScheduleDate(now.toISOString().slice(0, 16))
    }, [])

    const fetchMachines = async () => {
        try {
            const { data, error } = await supabase
                .from('machines')
                .select('*')
                .eq('current_status', 'Active')
                .order('location_name')

            if (data) {
                setMachines(data)
                // Extract unique zones
                const uniqueZones = [...new Set(data.map(m => m.zone).filter(Boolean))]
                setZones(uniqueZones)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const toggleZone = (zoneName) => {
        const machinesInZone = machines.filter(m => m.zone === zoneName).map(m => m.id)
        const newSet = new Set(selectedIds)

        // If all machines in zone are already selected, deselect them
        const allSelected = machinesInZone.every(id => newSet.has(id))

        if (allSelected) {
            machinesInZone.forEach(id => newSet.delete(id))
        } else {
            machinesInZone.forEach(id => newSet.add(id))
        }
        setSelectedIds(newSet)
    }

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const selectAll = () => {
        if (selectedIds.size === filteredMachines.length) {
            setSelectedIds(new Set())
        } else {
            const newSet = new Set(filteredMachines.map(m => m.id))
            setSelectedIds(newSet)
        }
    }

    const handleLaunchRoute = () => {
        if (selectedIds.size === 0) {
            showToast("Selecciona al menos una máquina", "error")
            return
        }

        const selectedMachines = machines.filter(m => selectedIds.has(m.id))

        // Construct standard Google Maps multi-stop URL
        // Origin: Current Selection (or user's location)
        // Waypoints: All selected machines

        const waypoints = selectedMachines
            .map(m => encodeURIComponent(m.address || m.location_name))
            .join('|')

        // Use the last selected machine as the final destination
        const destination = encodeURIComponent(selectedMachines[selectedMachines.length - 1].address || selectedMachines[selectedMachines.length - 1].location_name)

        const url = `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${destination}&waypoints=${waypoints}`

        // In a real app with Google Auth, we could insert this into Google Calendar here

        window.open(url, '_blank')
        showToast("Ruta abierta en Google Maps", "success")
    }

    const filteredMachines = machines.filter(m =>
        m.location_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        m.address?.toLowerCase().includes(filterQuery.toLowerCase())
    )

    return (
        <div className="route-page">
            {toast.show && (
                <div className={`toast-notification ${toast.type}`}>
                    {toast.message}
                </div>
            )}

            <header className="page-header">
                <div className="header-left">
                    <Link to="/" className="back-btn">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1>Programar Ruta</h1>
                        <p className="subtitle">Selecciona los puntos a visitar hoy</p>
                    </div>
                </div>
            </header>

            <div className="planner-container">
                {/* Left: Configuration */}
                <div className="planner-config glass">
                    <h3><Calendar size={18} className="teal" /> Detalles de la Ruta</h3>

                    <div className="input-group">
                        <label>Fecha y Hora</label>
                        <input
                            type="datetime-local"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                        />
                    </div>

                    <div className="route-summary">
                        <div className="summary-item">
                            <span>Puntos seleccionados:</span>
                            <strong>{selectedIds.size}</strong>
                        </div>
                        <div className="summary-item">
                            <span>Estimación de tiempo:</span>
                            <strong>~ {selectedIds.size * 20} min</strong>
                            <small>(20min por punto)</small>
                        </div>
                    </div>

                    <button
                        className="launch-btn"
                        onClick={handleLaunchRoute}
                        disabled={selectedIds.size === 0}
                    >
                        <Map size={18} />
                        Generar Ruta en Maps
                    </button>

                    <p className="hint-text">Se abrirá la aplicación de Google Maps con la ruta optimizada desde tu ubicación actual.</p>
                </div>

                {/* Right: Selection List */}
                <div className="planner-main">
                    {zones.length > 0 && (
                        <div className="zones-selector glass">
                            <h3><Layers size={18} className="teal" /> Seleccionar por Zona</h3>
                            <div className="zones-grid">
                                {zones.map(z => {
                                    const machinesInZone = machines.filter(m => m.zone === z)
                                    const selectedInZone = machinesInZone.filter(m => selectedIds.has(m.id))
                                    const allInZoneSelected = selectedInZone.length === machinesInZone.length

                                    return (
                                        <button
                                            key={z}
                                            className={`zone-pill ${allInZoneSelected ? 'active' : selectedInZone.length > 0 ? 'partial' : ''}`}
                                            onClick={() => toggleZone(z)}
                                        >
                                            {z} ({selectedInZone.length}/{machinesInZone.length})
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="machine-selector glass">
                        <div className="selector-header">
                            <div className="search-box">
                                <Search size={16} className="icon" />
                                <input
                                    type="text"
                                    placeholder="Buscar punto..."
                                    value={filterQuery}
                                    onChange={e => setFilterQuery(e.target.value)}
                                />
                            </div>
                            <button className="select-all-btn" onClick={selectAll}>
                                {selectedIds.size > 0 && selectedIds.size === filteredMachines.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                {selectedIds.size === filteredMachines.length ? 'Deseleccionar' : 'Todos'}
                            </button>
                        </div>

                        <div className="selection-list">
                            {loading ? <p className="loading">Cargando...</p> : filteredMachines.map(m => (
                                <div
                                    key={m.id}
                                    className={`select-item ${selectedIds.has(m.id) ? 'selected' : ''}`}
                                    onClick={() => toggleSelection(m.id)}
                                >
                                    <div className="check-indicator">
                                        {selectedIds.has(m.id) ? <CheckSquare size={20} className="teal" /> : <Square size={20} />}
                                    </div>
                                    <div className="item-info">
                                        <h4>{m.location_name} {m.zone && <span className="mini-zone">@{m.zone}</span>}</h4>
                                        <p>{m.address || 'Sin dirección'}</p>
                                    </div>
                                </div>
                            ))}
                            {filteredMachines.length === 0 && !loading && <p className="empty">No se encontraron máquinas.</p>}
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .route-page { max-width: 1000px; margin: 0 auto; padding: 20px; color: white; padding-bottom: 80px; }
                .page-header { display: flex; align-items: center; margin-bottom: 30px; }
                .header-left { display: flex; align-items: center; gap: 16px; }
                .back-btn { display: flex; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); align-items: center; justify-content: center; color: white; transition: 0.2s; }
                .back-btn:hover { background: var(--primary-color); color: black; }
                .page-header h1 { margin: 0; font-size: 1.8rem; }
                .subtitle { color: var(--text-dim); margin: 0; }

                .planner-container { display: grid; grid-template-columns: 300px 1fr; gap: 24px; }
                @media (max-width: 768px) { .planner-container { grid-template-columns: 1fr; } }

                .glass { background: #161b22; border: 1px solid rgba(48,54,61,0.5); border-radius: 12px; padding: 20px; }
                
                .planner-config h3 { display: flex; align-items: center; gap: 10px; margin-top: 0; font-size: 1.1rem; }
                .input-group { margin: 20px 0; display: flex; flex-direction: column; gap: 8px; }
                .input-group label { color: var(--text-dim); font-size: 0.9rem; }
                .input-group input { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; color: white; }
                
                .route-summary { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; margin-bottom: 24px; }
                .summary-item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem; }
                .summary-item:last-child { margin-bottom: 0; }
                .summary-item strong { color: var(--primary-color); }

                .launch-btn { 
                    width: 100%; background: var(--primary-color); color: black; border: none; padding: 12px; 
                    border-radius: 8px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; 
                    cursor: pointer; transition: 0.2s; 
                }
                .launch-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px var(--primary-glow); }
                .launch-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .hint-text { font-size: 0.8rem; color: var(--text-dim); margin-top: 15px; text-align: center; line-height: 1.4; }

                /* Selector Layout */
                .planner-main { display: flex; flex-direction: column; gap: 20px; }

                .zones-selector { padding: 16px; border-radius: 12px; }
                .zones-selector h3 { font-size: 0.95rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
                .zones-grid { display: flex; flex-wrap: wrap; gap: 8px; }
                .zone-pill { 
                    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); 
                    color: var(--text-dim); padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; 
                    cursor: pointer; transition: 0.2s; font-weight: 500;
                }
                .zone-pill:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
                .zone-pill.active { background: var(--primary-color); color: black; border-color: var(--primary-color); }
                .zone-pill.partial { border-color: var(--primary-color); color: var(--primary-color); background: rgba(16, 185, 129, 0.05); }

                /* Selector */
                .selector-header { display: flex; gap: 12px; margin-bottom: 16px; }
                .search-box { flex: 1; position: relative; }
                .search-box input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding: 10px 10px 10px 32px; border-radius: 8px; color: white; }
                .search-box .icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-dim); }
                
                .select-all-btn { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: var(--text-dim); padding: 0 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
                .select-all-btn:hover { background: rgba(255,255,255,0.05); color: white; }

                .selection-list { max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
                .select-item { 
                    display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; 
                    background: rgba(255,255,255,0.02); border: 1px solid transparent; cursor: pointer; transition: 0.2s;
                }
                .select-item:hover { background: rgba(255,255,255,0.05); }
                .select-item.selected { background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); }
                
                .item-info h4 { margin: 0 0 2px 0; font-size: 0.95rem; display: flex; align-items: center; gap: 8px; }
                .mini-zone { color: var(--primary-color); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; background: rgba(16, 185, 129, 0.1); padding: 2px 4px; border-radius: 3px; }
                .item-info p { margin: 0; color: var(--text-dim); font-size: 0.8rem; }
                .teal { color: var(--primary-color); }
                
                .toast-notification { position: fixed; top: 20px; right: 20px; padding: 15px 25px; background: #333; color: white; border-radius: 8px; z-index: 1000; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
            `}} />
        </div>
    )
}
