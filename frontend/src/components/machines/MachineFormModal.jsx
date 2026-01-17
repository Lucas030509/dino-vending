import React, { useState, useEffect, useRef } from 'react'
import { Search, Loader2, MapPin, User, Mail, Phone, Clock, DollarSign, Navigation } from 'lucide-react'
import { db } from '../../lib/db'
import { useLiveQuery } from 'dexie-react-hooks'

const DEFAULT_MACHINE = {
    qr_code_uid: '',
    location_name: '',
    address: '',
    maps_url: '',
    capsule_capacity: 100,
    denomination: 10,
    machine_count: 1,
    commission_percent: 20,
    zone: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    closed_days: [],
    opening_time: '',
    closing_time: '',
    contract_type: 'commission',
    rent_periodicity: 'Mensual',
    rent_amount: ''
}

export function MachineFormModal({ isOpen, onClose, onSubmit, initialData, isEditing }) {
    const locations = useLiveQuery(() => db.locations.toArray())
    const [formData, setFormData] = useState(DEFAULT_MACHINE)
    const [searchQuery, setSearchQuery] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const searchTimeout = useRef(null)

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Merge initial data with default (handle both Edit and Pre-fill cases)
                setFormData(prev => ({ ...DEFAULT_MACHINE, ...initialData }))
                setSearchQuery(initialData.address || '')
            } else {
                setFormData(DEFAULT_MACHINE)
                setSearchQuery('')
            }
        }
    }, [isOpen, initialData, isEditing])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            await onSubmit(formData)
            onClose()
        } catch (error) {
            console.error("Error submitting form", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    // --- Address Search (Nominatim) ---
    const handleAddressSearch = async (query) => {
        setSearchQuery(query)
        setFormData(prev => ({ ...prev, address: query }))

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

        setFormData(prev => ({ ...prev, address, maps_url: mapsUrl }))
        setSearchQuery(address)
        setShowSuggestions(false)
    }

    const handleUseGPS = () => {
        if (!("geolocation" in navigator)) {
            alert("Tu navegador no soporta geolocalización")
            return
        }

        setIsSearching(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude
                const lon = position.coords.longitude
                const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`
                const gpsText = `Ubicación GPS (${lat.toFixed(5)}, ${lon.toFixed(5)})`

                setFormData(prev => ({
                    ...prev,
                    maps_url: mapsUrl,
                    address: (!prev.address || prev.address === '') ? gpsText : prev.address
                }))

                if (!searchQuery) setSearchQuery(gpsText)
                setIsSearching(false)
            },
            (error) => {
                console.error("GPS Error:", error)
                setIsSearching(false)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay">
            <div className="glass modal-content">
                <h3>{isEditing ? 'Editar Máquina' : 'Registrar Máquina'}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Código QR / UID</label>
                        <input
                            type="text"
                            placeholder="DINO-001"
                            value={formData.qr_code_uid}
                            onChange={e => setFormData({ ...formData, qr_code_uid: e.target.value })}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Asignar a Punto de Venta</label>
                        <select
                            className="select-input"
                            value={formData.location_id || ''}
                            onChange={e => {
                                const locId = e.target.value
                                if (locId) {
                                    const loc = locations?.find(l => l.id === locId)
                                    if (loc) {
                                        setFormData(prev => ({
                                            ...prev,
                                            location_id: locId,
                                            location_name: loc.name,
                                            address: loc.address || prev.address,
                                            zone: loc.district || prev.zone
                                        }))
                                        // Also update search query for address if needed
                                        if (loc.address) setSearchQuery(loc.address)
                                    }
                                } else {
                                    setFormData(prev => ({ ...prev, location_id: null }))
                                }
                            }}
                        >
                            <option value="">-- Sin asignar (Individual) --</option>
                            {locations?.map(loc => (
                                <option key={loc.id} value={loc.id}>
                                    {loc.name} {loc.district ? `(${loc.district})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group">
                        <label>Ubicación (Nombre)</label>
                        <input
                            type="text"
                            placeholder="Hospital Central"
                            value={formData.location_name}
                            onChange={e => setFormData({ ...formData, location_name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Zona / Sector (Opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej: Zona Norte, Centro, etc."
                            value={formData.zone}
                            onChange={e => setFormData({ ...formData, zone: e.target.value })}
                        />
                    </div>

                    <div className="columns-2">
                        <div className="input-group">
                            <label>Capacidad</label>
                            <input
                                type="number"
                                value={formData.capsule_capacity}
                                onChange={e => setFormData({ ...formData, capsule_capacity: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="input-group">
                            <label>Precio ($)</label>
                            <input
                                type="number"
                                step="0.50"
                                value={formData.denomination}
                                onChange={e => setFormData({ ...formData, denomination: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Cant. Máquinas</label>
                        <input
                            type="number"
                            min="1"
                            value={formData.machine_count}
                            onChange={e => setFormData({ ...formData, machine_count: parseInt(e.target.value) })}
                        />
                    </div>

                    <div className="form-section-divider">
                        <h4 style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '20px 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={16} /> Horarios y Disponibilidad
                        </h4>
                        <div className="input-group">
                            <label>Días Cerrados (No se programarán visitas)</label>
                            <div className="days-selector week-days">
                                {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((day, idx) => {
                                    const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                                    const dayVal = fullDays[idx]
                                    const isClosed = formData.closed_days?.includes(dayVal)
                                    return (
                                        <button
                                            type="button"
                                            key={day}
                                            className={isClosed ? 'active closed-day' : ''}
                                            onClick={() => {
                                                const current = formData.closed_days || []
                                                const updated = current.includes(dayVal)
                                                    ? current.filter(d => d !== dayVal)
                                                    : [...current, dayVal]
                                                setFormData({ ...formData, closed_days: updated })
                                            }}
                                            title={isClosed ? 'Cerrado' : 'Abierto'}
                                        >
                                            {day}
                                        </button>
                                    )
                                })}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                * Selecciona los días que el local NO abre.
                            </div>
                        </div>
                        <div className="columns-2">
                            <div className="input-group">
                                <label>Apertura</label>
                                <input
                                    type="time"
                                    value={formData.opening_time || ''}
                                    onChange={e => setFormData({ ...formData, opening_time: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <label>Cierre</label>
                                <input
                                    type="time"
                                    value={formData.closing_time || ''}
                                    onChange={e => setFormData({ ...formData, closing_time: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section-divider">
                        <h4 style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '20px 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DollarSign size={16} /> Acuerdo Financiero
                        </h4>

                        <div className="contract-switch">
                            <button
                                type="button"
                                className={formData.contract_type === 'commission' ? 'active' : ''}
                                onClick={() => setFormData({ ...formData, contract_type: 'commission' })}
                            >
                                Por Comisión (%)
                            </button>
                            <button
                                type="button"
                                className={formData.contract_type === 'rent' ? 'active' : ''}
                                onClick={() => setFormData({ ...formData, contract_type: 'rent' })}
                            >
                                Renta Fija ($)
                            </button>
                        </div>

                        {formData.contract_type === 'rent' ? (
                            <div className="rent-config glass-panel-inner">
                                <div className="columns-2">
                                    <div className="input-group">
                                        <label>Monto de Renta (A Pagar)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={formData.rent_amount}
                                            onChange={e => setFormData({ ...formData, rent_amount: e.target.value })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Periodicidad</label>
                                        <select
                                            value={formData.rent_periodicity}
                                            onChange={e => setFormData({ ...formData, rent_periodicity: e.target.value })}
                                            className="select-input"
                                        >
                                            {['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'].map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="input-group">
                                <label>Comisión sobre Venta (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.commission_percent}
                                    onChange={e => setFormData({ ...formData, commission_percent: parseFloat(e.target.value) })}
                                />
                            </div>
                        )}
                    </div>

                    <div className="form-section-divider">
                        <h4 style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '20px 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <User size={16} /> Datos de Contacto (Para Recibos)
                        </h4>
                        <div className="input-group">
                            <label>Nombre del Encargado / Dueño</label>
                            <input
                                type="text"
                                placeholder="Ej: Juan Pérez"
                                value={formData.contact_name}
                                onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                                className="contact-input"
                            />
                        </div>
                        <div className="columns-2">
                            <div className="input-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14} /> Correo (Recibos)</label>
                                <input
                                    type="email"
                                    placeholder="cliente@email.com"
                                    value={formData.contact_email}
                                    onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} /> Teléfono</label>
                                <input
                                    type="tel"
                                    placeholder="55 1234 5678"
                                    value={formData.contact_phone}
                                    onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="input-group search-container">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label>Dirección</label>
                            <button
                                type="button"
                                onClick={handleUseGPS}
                                className="gps-btn"
                                style={{
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    border: '1px solid var(--primary-color)',
                                    color: 'var(--primary-color)',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: '600'
                                }}
                                title="Capturar ubicación actual del dispositivo"
                            >
                                <Navigation size={14} /> Usar mi Ubicación
                            </button>
                        </div>
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
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={isSubmitting}
                            style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'wait' : 'pointer' }}
                        >
                            {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Registrar')}
                        </button>
                    </div>
                </form>
            </div>
        </div >
    )
}
