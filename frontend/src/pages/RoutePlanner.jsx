import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, Map, Calendar, CheckSquare, Square, Search, Navigation, Layers, Save, List, Plus, Trash2, CheckCircle, Clock } from 'lucide-react'

export default function RoutePlanner() {
    // --- Existing State ---
    const [machines, setMachines] = useState([])
    const [zones, setZones] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterQuery, setFilterQuery] = useState('')
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [scheduleDate, setScheduleDate] = useState('')

    // --- New State for Route Management ---
    const [activeTab, setActiveTab] = useState('new') // 'new' | 'list'
    const [savedRoutes, setSavedRoutes] = useState([])
    const [routesLoading, setRoutesLoading] = useState(false)
    const [viewingRoute, setViewingRoute] = useState(null) // If not null, showing details of a saved route

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

    useEffect(() => {
        if (activeTab === 'list') {
            fetchRoutes()
        }
    }, [activeTab])

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

    const fetchRoutes = async () => {
        setRoutesLoading(true)
        try {
            // Updated: Rely on RLS policies to filter by tenant. 
            // Previous explicit check failed if metadata was missing.
            const { data, error } = await supabase
                .from('routes')
                .select('*, route_stops(count)')
                .order('scheduled_date', { ascending: false })

            if (data) setSavedRoutes(data)
        } catch (e) {
            console.error(e)
        } finally {
            setRoutesLoading(false)
        }
    }

    const toggleZone = (zoneName) => {
        const machinesInZone = machines.filter(m => m.zone === zoneName).map(m => m.id)
        const newSet = new Set(selectedIds)
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

    const handleLaunchRoute = (routeMachines = null) => {
        // If routeMachines is passed (from saved route), use that. Else use selection.
        let targets = []
        if (routeMachines) {
            targets = routeMachines
        } else {
            if (selectedIds.size === 0) {
                showToast("Selecciona al menos una máquina", "error")
                return
            }
            targets = machines.filter(m => selectedIds.has(m.id))
        }

        // Helper to get efficient map target
        const getLocationForMaps = (m) => {
            // 1. Try to use explicit coords from maps_url (FASTEST)
            if (m.maps_url && m.maps_url.includes('q=')) {
                try {
                    const coords = m.maps_url.split('q=')[1].split('&')[0]
                    return coords // Returns "lat,lon" directly
                } catch (e) {
                    console.warn("Failed to parse coords", m.maps_url)
                }
            }
            // 2. Fallback to address search (SLOWER)
            const query = (m.address || m.location_name) || ''
            return query.includes('Mexico') ? query : `${query}, Mexico`
        }

        const waypoints = targets
            .map(m => encodeURIComponent(getLocationForMaps(m)))
            .join('|')

        const lastTarget = targets[targets.length - 1];
        const destination = encodeURIComponent(getLocationForMaps(lastTarget))

        const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}`
        window.open(url, '_blank')
        showToast("Ruta abierta en Google Maps (Optimizado)", "success")
    }

    const handleSaveRoute = async () => {
        if (selectedIds.size === 0) {
            showToast("Selecciona al menos una máquina", "error")
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()

            // Robust Tenant ID Fetch
            let tenantId = user.user_metadata?.tenant_id

            if (!tenantId) {
                // Fallback: fetch from profile if metadata is empty (fix for legacy/client users)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('tenant_id')
                    .eq('id', user.id)
                    .single()

                if (profile?.tenant_id) {
                    tenantId = profile.tenant_id
                } else {
                    throw new Error("No se pudo identificar tu organización (Tenant ID missing).")
                }
            }

            const { data: route, error: routeError } = await supabase.from('routes').insert({
                driver_id: user.id,
                tenant_id: tenantId,
                scheduled_date: scheduleDate.split('T')[0],
                name: `Ruta ${new Date(scheduleDate).toLocaleDateString()}`,
                status: 'scheduled'
            }).select().single()

            if (routeError) throw routeError

            const stopsData = machines
                .filter(m => selectedIds.has(m.id))
                .map((m, index) => ({
                    route_id: route.id,
                    machine_id: m.id,
                    stop_order: index + 1,
                    status: 'pending'
                }))

            const { error: stopsError } = await supabase.from('route_stops').insert(stopsData)
            if (stopsError) throw stopsError

            showToast("Ruta guardada exitosamente", "success")
            setSelectedIds(new Set()) // Clear selection
            setActiveTab('list') // Switch to list view
        } catch (e) {
            console.error(e)
            showToast("Error al guardar ruta: " + e.message, "error")
        }
    }

    const handleViewRoute = async (routeId) => {
        try {
            // Fetch route details + stops + machines
            const { data: route, error } = await supabase
                .from('routes')
                .select(`
                    *,
                    route_stops (
                        id,
                        stop_order,
                        status,
                        machines (
                            id, location_name, address, maps_url
                        )
                    )
                `)
                .eq('id', routeId)
                .single()

            if (route) {
                // Sort stops by order
                route.route_stops.sort((a, b) => a.stop_order - b.stop_order)
                setViewingRoute(route)
            }
        } catch (e) {
            console.error(e)
            showToast("Error cargando detalles", "error")
        }
    }

    const handleDeleteRoute = async (routeId) => {
        if (!window.confirm("¿Estás seguro de eliminar esta ruta?")) return

        try {
            const { error } = await supabase.from('routes').delete().eq('id', routeId)
            if (error) throw error

            showToast("Ruta eliminada", "success")
            fetchRoutes() // Refresh list
            if (viewingRoute?.id === routeId) setViewingRoute(null)
        } catch (e) {
            showToast("Error al eliminar", "error")
        }
    }

    const handleFinishRoute = async (routeId) => {
        if (!window.confirm("¿Finalizar ruta y marcar como completada?")) return

        try {
            await supabase.from('routes').update({ status: 'completed' }).eq('id', routeId)
            showToast("Ruta finalizada", "success")
            fetchRoutes()
            setViewingRoute(null)
        } catch (e) {
            console.error(e)
        }
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
                        <h1>Gestión de Rutas</h1>
                        <p className="subtitle">Planifica, guarda y ejecuta tus recorridos</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="planner-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('new'); setViewingRoute(null); }}
                    >
                        <Plus size={16} /> Nueva Ruta
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveTab('list')}
                    >
                        <List size={16} /> Mis Rutas
                    </button>
                </div>
            </header>

            {/* --- VIEW: NEW ROUTE --- */}
            {activeTab === 'new' && (
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

                        <div className="actions-stack">
                            <button
                                className="launch-btn secondary"
                                onClick={handleSaveRoute}
                                disabled={selectedIds.size === 0}
                            >
                                <Save size={18} />
                                Guardar ({selectedIds.size})
                            </button>

                            <button
                                className="launch-btn"
                                onClick={() => handleLaunchRoute()}
                                disabled={selectedIds.size === 0}
                            >
                                <Map size={18} />
                                Maps ({selectedIds.size})
                            </button>
                        </div>

                        <p className="hint-text">Guarda la ruta para seguimiento o ábrela directamente en Google Maps.</p>
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
                            {/* Selector Header */}
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

                            {/* List */}
                            <div className="selection-list">
                                {loading ? <p className="loading">Cargando...</p> : filteredMachines.map(m => {
                                    const dateObj = new Date(scheduleDate)
                                    const dayOptions = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                                    const currentDay = dayOptions[dateObj.getDay()]
                                    const isClosed = m.closed_days && m.closed_days.includes(currentDay)

                                    return (
                                        <div
                                            key={m.id}
                                            className={`select-item ${selectedIds.has(m.id) ? 'selected' : ''} ${isClosed ? 'item-closed' : ''}`}
                                            onClick={() => toggleSelection(m.id)}
                                            style={isClosed ? { opacity: 0.6 } : {}}
                                        >
                                            <div className="check-indicator">
                                                {selectedIds.has(m.id) ? <CheckSquare size={20} className="teal" /> : <Square size={20} />}
                                            </div>
                                            <div className="item-info">
                                                <h4>
                                                    {m.location_name}
                                                    {m.zone && <span className="mini-zone">@{m.zone}</span>}
                                                    {isClosed && <span className="closed-badge">⛔ CERRADO HOY</span>}
                                                </h4>
                                                <p>{m.address || 'Sin dirección'}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                                {filteredMachines.length === 0 && !loading && <p className="empty">No se encontraron máquinas.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VIEW: ROUTE LIST --- */}
            {activeTab === 'list' && !viewingRoute && (
                <div className="routes-list-container">
                    {routesLoading ? <p className="loading">Cargando rutas...</p> : savedRoutes.length === 0 ? (
                        <div className="empty-state glass">
                            <Map size={48} className="dim-icon" />
                            <h3>No tienes rutas guardadas</h3>
                            <p>Crea una nueva ruta en la pestaña "Nueva Ruta".</p>
                        </div>
                    ) : (
                        <div className="routes-grid">
                            {savedRoutes.map(route => (
                                <div key={route.id} className="route-card glass" onClick={() => handleViewRoute(route.id)}>
                                    <div className="route-header">
                                        <div className="route-date">
                                            <Calendar size={16} />
                                            {new Date(route.scheduled_date + 'T00:00:00').toLocaleDateString()}
                                        </div>
                                        <span className={`status-badge ${route.status}`}>
                                            {route.status === 'completed' ? 'Finalizada' : route.status === 'in_progress' ? 'En Curso' : 'Programada'}
                                        </span>
                                    </div>
                                    <h3>{route.name || 'Sin Nombre'}</h3>
                                    <div className="route-meta">
                                        <span><Map size={14} /> {route.route_stops[0]?.count || 0} Paradas</span>
                                    </div>
                                    <div className="route-actions">
                                        <button className="icon-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteRoute(route.id); }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* --- VIEW: ROUTE DETAIL --- */}
            {activeTab === 'list' && viewingRoute && (
                <div className="route-detail-container glass">
                    <div className="detail-header">
                        <button className="back-link" onClick={() => setViewingRoute(null)}>
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <div className="header-content">
                            <h2>{viewingRoute.name}</h2>
                            <span className={`status-badge ${viewingRoute.status}`}>
                                {viewingRoute.status === 'completed' ? 'Finalizada' : viewingRoute.status === 'in_progress' ? 'En Curso' : 'Programada'}
                            </span>
                        </div>
                    </div>

                    <div className="route-stops-list">
                        {viewingRoute.route_stops.map((stop, index) => (
                            <div key={stop.id} className={`stop-item ${stop.status === 'visited' ? 'visited' : ''}`}>
                                <div className="stop-number">{index + 1}</div>
                                <div className="stop-info">
                                    <h4>{stop.machines?.location_name}</h4>
                                    <p>{stop.machines?.address}</p>
                                </div>
                                <div className="stop-status">
                                    {stop.status === 'visited' && <CheckCircle size={20} className="success-icon" />}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="detail-actions">
                        <button
                            className="launch-btn"
                            onClick={() => handleLaunchRoute(viewingRoute.route_stops.map(s => s.machines))}
                        >
                            <Navigation size={18} /> Navegar (Maps)
                        </button>

                        {viewingRoute.status !== 'completed' && (
                            <button
                                className="launch-btn success"
                                onClick={() => handleFinishRoute(viewingRoute.id)}
                            >
                                <CheckCircle size={18} /> Finalizar Ruta
                            </button>
                        )}
                    </div>
                </div>
            )}

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
                .closed-badge { background: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px; font-weight: bold; }
                
                .toast-notification { position: fixed; top: 20px; right: 20px; padding: 15px 25px; background: #333; color: white; border-radius: 8px; z-index: 1000; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }

                /* --- NEW STYLES FOR ROUTE MANAGEMENT --- */
                .planner-tabs { display: flex; gap: 10px; margin-left: auto; }
                .tab-btn { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: var(--text-dim); padding: 8px 16px; border-radius: 20px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; transition: 0.2s; }
                .tab-btn.active { background: var(--primary-color); color: black; border-color: var(--primary-color); font-weight: 600; }
                .tab-btn:hover:not(.active) { background: rgba(255,255,255,0.05); color: white; }

                .actions-stack { display: flex; flex-direction: column; gap: 12px; margin-bottom: 15px; }
                .launch-btn.secondary { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.1); }
                .launch-btn.secondary:hover { background: rgba(255,255,255,0.15); border-color: white; }
                .launch-btn.success { background: #10b981; color: black; }
                
                .routes-list-container { width: 100%; }
                .empty-state { text-align: center; padding: 60px 20px; color: var(--text-dim); }
                .dim-icon { opacity: 0.2; margin-bottom: 15px; }

                .routes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; width: 100%; }
                .route-card { cursor: pointer; transition: 0.2s; position: relative; }
                .route-card:hover { transform: translateY(-3px); border-color: var(--primary-color); }
                
                .route-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                .route-date { font-size: 0.8rem; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }
                .status-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; text-transform: uppercase; font-weight: bold; }
                .status-badge.scheduled { background: #3b82f6; color: white; }
                .status-badge.in_progress { background: #f59e0b; color: black; }
                .status-badge.completed { background: #10b981; color: black; }

                .route-card h3 { margin: 0 0 8px 0; font-size: 1.1rem; }
                .route-meta { display: flex; gap: 15px; font-size: 0.85rem; color: var(--text-dim); }
                .route-actions { position: absolute; bottom: 15px; right: 15px; opacity: 0; transition: 0.2s; }
                .route-card:hover .route-actions { opacity: 1; }
                .icon-btn.delete { background: rgba(220, 38, 38, 0.2); color: #ef4444; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .icon-btn.delete:hover { background: #dc2626; color: white; }

                /* Route Detail */
                .route-detail-container { max-width: 800px; margin: 0 auto; }
                .detail-header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 25px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; }
                .back-link { background: none; border: none; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 5px; padding: 0; font-size: 0.9rem; }
                .back-link:hover { color: white; }
                .header-content h2 { margin: 0 0 5px 0; font-size: 1.5rem; }

                .route-stops-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px; }
                .stop-item { display: flex; align-items: center; gap: 15px; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid transparent; }
                .stop-item.visited { opacity: 0.5; background: rgba(16, 185, 129, 0.05); }
                .stop-number { width: 28px; height: 28px; background: var(--primary-color); color: black; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; flex-shrink: 0; }
                .stop-info { flex: 1; }
                .stop-info h4 { margin: 0; font-size: 1rem; }
                .stop-info p { margin: 2px 0 0 0; color: var(--text-dim); font-size: 0.85rem; }
                .success-icon { color: #10b981; }

                .detail-actions { display: flex; gap: 15px; justify-content: flex-end; }
            `}} />
        </div>
    )
}

