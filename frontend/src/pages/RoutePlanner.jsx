import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, Map, Calendar, CheckSquare, Square, Search, Navigation, Layers, Save, List, Plus, Trash2, CheckCircle, Clock, Wand2 } from 'lucide-react'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import './RoutePlanner.css'

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
    const [confirmAction, setConfirmAction] = useState(null) // { type: 'delete' | 'finish', data: route }
    const [isProcessing, setIsProcessing] = useState(false)

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
            // Use current order of machines (which might be optimized)
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

        const waypoints = targets.slice(0, -1)
            .map(m => encodeURIComponent(getLocationForMaps(m)))
            .join('|')

        const lastTarget = targets[targets.length - 1];
        const destination = encodeURIComponent(getLocationForMaps(lastTarget))

        const url = `https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${destination}&waypoints=${waypoints}`
        window.open(url, '_blank')
        showToast("Ruta abierta en Google Maps (Optimizado)", "success")
    }

    const handleOptimizeRoute = () => {
        if (selectedIds.size < 2) {
            showToast("Selecciona al menos 2 máquinas para optimizar", "warning")
            return
        }

        if (!navigator.geolocation) {
            showToast("Geolocalización no soportada", "error")
            return
        }

        setIsProcessing(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords

                // 1. Get selected objects
                const selectedMachines = machines.filter(m => selectedIds.has(m.id))
                const unselectedMachines = machines.filter(m => !selectedIds.has(m.id))

                // Helper: Parse Lat/Lon from maps_url
                const getCoords = (m) => {
                    if (m.maps_url && m.maps_url.includes('q=')) {
                        try {
                            const [lat, lon] = m.maps_url.split('q=')[1].split('&')[0].split(',')
                            return { lat: parseFloat(lat), lon: parseFloat(lon) }
                        } catch (e) { return null }
                    }
                    return null
                }

                // Helper: Distance (Haversine/Euclidean approximation)
                const getDist = (p1, p2) => {
                    return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lon - p2.lon, 2))
                }

                // 2. Nearest Neighbor Algorithm
                let currentPos = { lat: latitude, lon: longitude }
                let pool = selectedMachines.map(m => ({ ...m, coords: getCoords(m) })).filter(m => m.coords) // filtering those with coords

                // Keep those without coords at the end of optimization
                const noCoordsPool = selectedMachines.filter(m => !getCoords(m))

                const sorted = []

                while (pool.length > 0) {
                    let nearest = null
                    let minFreeDist = Infinity
                    let nearestIdx = -1

                    for (let i = 0; i < pool.length; i++) {
                        const d = getDist(currentPos, pool[i].coords)
                        if (d < minFreeDist) {
                            minFreeDist = d
                            nearest = pool[i]
                            nearestIdx = i
                        }
                    }

                    if (nearest) {
                        sorted.push(nearest)
                        currentPos = nearest.coords // Move current position to this stop
                        pool.splice(nearestIdx, 1)
                    } else {
                        break // Should not happen
                    }
                }

                // 3. Reconstruct State
                // Put optimized first, then those with no coords, then unselected
                const newOrder = [...sorted, ...noCoordsPool, ...unselectedMachines]

                // Important: We need to preserve original object references or just re-sort
                // Since we created new objects in 'pool', let's match by ID
                const finalSorted = newOrder.map(n => machines.find(m => m.id === n.id))

                setMachines(finalSorted)
                setIsProcessing(false)
                showToast("Ruta optimizada con éxito 🪄", "success")
            },
            (error) => {
                console.error(error)
                setIsProcessing(false)
                showToast("Error obteniendo ubicación GPS", "error")
            }
        )
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

    const handleDeleteRoute = (e, route) => {
        e.stopPropagation()
        setConfirmAction({ type: 'delete', data: route })
    }

    const handleFinishRoute = (route) => {
        setConfirmAction({ type: 'finish', data: route })
    }

    const resolveConfirmation = async () => {
        if (!confirmAction) return
        setIsProcessing(true)

        try {
            if (confirmAction.type === 'delete') {
                const { error } = await supabase.from('routes').delete().eq('id', confirmAction.data.id)
                if (error) throw error
                showToast("Ruta eliminada", "success")
                fetchRoutes()
                if (viewingRoute?.id === confirmAction.data.id) setViewingRoute(null)
            } else if (confirmAction.type === 'finish') {
                await supabase.from('routes').update({ status: 'completed' }).eq('id', confirmAction.data.id)
                showToast("Ruta finalizada", "success")
                fetchRoutes()
                setViewingRoute(null)
            }
        } catch (e) {
            console.error(e)
            showToast("Error al procesar la acción", "error")
        } finally {
            setIsProcessing(false)
            setConfirmAction(null)
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

                            {selectedIds.size > 1 && (
                                <button
                                    className="optimize-btn"
                                    onClick={handleOptimizeRoute}
                                    disabled={isProcessing}
                                >
                                    <Wand2 size={16} />
                                    {isProcessing ? 'Calculando...' : 'Optimizar Ruta (AI)'}
                                </button>
                            )}
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
                                        <button className="icon-btn delete" onClick={(e) => handleDeleteRoute(e, route)}>
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
                                onClick={() => handleFinishRoute(viewingRoute)}
                            >
                                <CheckCircle size={18} /> Finalizar Ruta
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={resolveConfirmation}
                title={confirmAction?.type === 'delete' ? "Eliminar Ruta" : "Finalizar Ruta"}
                message={
                    confirmAction?.type === 'delete'
                        ? <span>¿Eliminar la ruta <strong>{confirmAction?.data?.name}</strong>?</span>
                        : "¿Marcar esta ruta como completada?"
                }
                confirmText={confirmAction?.type === 'delete' ? "Sí, Eliminar" : "Finalizar"}
                isDestructive={confirmAction?.type === 'delete'}
                isLoading={isProcessing}
            />


        </div>
    )
}

