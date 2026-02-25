import React, { useEffect, useState } from 'react'
import { GiVendingMachine } from 'react-icons/gi'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { LogOut, DollarSign, Settings, LayoutGrid, CheckCircle2, AlertCircle, Calendar, TrendingUp, Package, Map, MapPin, FileText, ShieldCheck, Store, Clock } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInDays, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import './Dashboard.css'


export default function Dashboard({ isSuperAdmin }) {
  const navigate = useNavigate()
  const [machines, setMachines] = useState([])
  const [activeMachines, setActiveMachines] = useState(0)
  const [inactiveMachines, setInactiveMachines] = useState(0)
  const [loading, setLoading] = useState(true)

  // KPI Stats
  const [currentMonthProfit, setCurrentMonthProfit] = useState(0)
  const [performanceData, setPerformanceData] = useState([])
  const [stockStatus, setStockStatus] = useState([])
  const [agenda, setAgenda] = useState([])
  const [temporalAlerts, setTemporalAlerts] = useState([])
  const [pendingReports, setPendingReports] = useState(0)
  const [todayRoutesCount, setTodayRoutesCount] = useState(0)


  // Branding State
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [brandColor, setBrandColor] = useState('#10b981')
  const [productCost, setProductCost] = useState(2.5) // Default Cost
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)

  // Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' }) // type: 'success', 'error', 'info'

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type })
    if (type !== 'error') {
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000)
    }
  }

  const hideToast = () => setToast({ ...toast, show: false })

  // Internal Admin Check
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdminStatus()
    fetchMachines()
    fetchMonthlyStats()
    fetchHistoricalData()
    fetchStockAndAgenda()
    fetchPendingReports()
    fetchTodayRoutes()
  }, [])

  const checkAdminStatus = async () => {
    // Direct query to profiles table check
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profile && profile.role === 'super_admin') {
        setIsAdmin(true)
      }
    }
  }

  const fetchPendingReports = async () => {
    const { count, error } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Resolved')

    if (!error) setPendingReports(count || 0)
  }

  const fetchTodayRoutes = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { count, error } = await supabase
        .from('routes')
        .select('*', { count: 'exact', head: true })
        .eq('scheduled_date', today)
        .neq('status', 'canceled') // Exclude canceled routes

      if (!error) setTodayRoutesCount(count || 0)
    } catch (e) { console.error('Error fetching routes:', e) }
  }

  const fetchMachines = async () => {
    try {
      const { data, error } = await supabase.from('machines').select('*')
      if (!error && data) {
        setMachines(data)

        // Sum machine_count instead of just counting rows
        const total = data.reduce((acc, m) => acc + (parseInt(m.machine_count) || 1), 0)
        const active = data
          .filter(m => m.current_status === 'Active')
          .reduce((acc, m) => acc + (parseInt(m.machine_count) || 1), 0)

        setActiveMachines(active)
        setInactiveMachines(total - active)
      }
    } catch (e) { console.error(e) }
  }

  const fetchMonthlyStats = async () => {
    try {
      const date = new Date();
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from('collections')
        .select('profit_amount')
        .gte('collection_date', firstDay);

      if (!error && data) {
        const total = data.reduce((acc, curr) => acc + (curr.profit_amount || 0), 0);
        setCurrentMonthProfit(total);
      }
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  }

  const fetchHistoricalData = async () => {
    try {
      // Get last 6 months
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5)).toISOString()
      const { data, error } = await supabase
        .from('collections')
        .select('profit_amount, collection_date')
        .gte('collection_date', sixMonthsAgo)
        .order('collection_date', { ascending: true })

      if (!error && data) {
        // Group by month
        const months = {}
        // Initialize last 6 months with 0
        for (let i = 5; i >= 0; i--) {
          const m = format(subMonths(new Date(), i), 'MMM', { locale: es })
          months[m] = 0
        }

        data.forEach(col => {
          const m = format(parseISO(col.collection_date), 'MMM', { locale: es })
          if (months[m] !== undefined) {
            months[m] += (col.profit_amount || 0)
          }
        })

        const chartData = Object.keys(months).map(name => ({
          name,
          ganancia: Math.round(months[name])
        }))
        setPerformanceData(chartData)
      }
    } catch (e) { console.error(e) }
  }

  const fetchStockAndAgenda = async () => {
    try {
      const { data: machinesData } = await supabase.from('machines').select('*').eq('current_status', 'Active')

      // Get only the latest collection for each machine
      const { data: latestCollections } = await supabase
        .from('collections')
        .select('machine_id, collection_date, next_refill_date_estimate')
        .order('collection_date', { ascending: false })

      if (machinesData) {
        const now = new Date()
        const stockMap = []
        const agendaMap = []

        const temporalMap = []

        const FREQUENCY_DAYS = {
          'Semanal': 7,
          'Quincenal': 15,
          'Mensual': 30,
          '40 dias': 40,
          '2 meses': 60
        }

        machinesData.forEach(m => {
          // Temporal Alerts Logic
          if (m.last_refill_date) {
            const lastRefill = parseISO(m.last_refill_date)
            const daysFreq = FREQUENCY_DAYS[m.refill_frequency || 'Quincenal'] || 15
            const nextDue = addDays(lastRefill, daysFreq)
            const daysUntilDue = differenceInDays(nextDue, now)

            if (daysUntilDue <= 3) {
              temporalMap.push({
                id: m.id,
                name: m.location_name,
                daysUntil: daysUntilDue,
                frequency: m.refill_frequency || 'Quincenal'
              })
            }
          }

          const latest = latestCollections?.find(c => c.machine_id === m.id)

          if (latest) {
            const lastVisit = parseISO(latest.collection_date)
            const estimateEmpty = parseISO(latest.next_refill_date_estimate)

            const totalCycle = differenceInDays(estimateEmpty, lastVisit) || 15
            const daysElapsed = differenceInDays(now, lastVisit)

            let fillLevel = Math.max(0, Math.min(100, Math.round(((totalCycle - daysElapsed) / totalCycle) * 100)))

            stockMap.push({
              id: m.id,
              name: m.location_name,
              level: fillLevel,
              daysLeft: differenceInDays(estimateEmpty, now)
            })

            // Agenda: If refill is in less than 4 days or overdue
            const daysUntilRefill = differenceInDays(estimateEmpty, now)
            if (daysUntilRefill <= 3) {
              agendaMap.push({
                id: m.id,
                name: m.location_name,
                address: m.address,
                maps_url: m.maps_url,
                daysUntil: daysUntilRefill,
                date: latest.next_refill_date_estimate
              })
            }
          } else {
            // New machines with no collections
            stockMap.push({ id: m.id, name: m.location_name, level: 100, daysLeft: '?' })
          }
        })

        setStockStatus(stockMap.sort((a, b) => a.level - b.level).slice(0, 5)) // Top 5 critical
        setAgenda(agendaMap.sort((a, b) => a.daysUntil - b.daysUntil))
        setTemporalAlerts(temporalMap.sort((a, b) => a.daysUntil - b.daysUntil))
      }
    } catch (e) { console.error(e) } finally {
      setLoading(false)
    }
  }

  const handleGenerateRoute = () => {
    if (agenda.length === 0) return

    // Helper to get robust location (Coords > Address)
    // Optimized for speed and accuracy
    const getLocation = (item) => {
      if (item.maps_url && item.maps_url.includes('q=')) {
        try { return item.maps_url.split('q=')[1].split('&')[0] } catch (e) { }
      }
      const q = item.address || item.name
      return q.includes('Mexico') ? q : `${q}, Mexico`
    }

    const waypoints = agenda
      .map(item => encodeURIComponent(getLocation(item)))
      .join('|')

    const destItem = agenda[agenda.length - 1]
    const destination = encodeURIComponent(getLocation(destItem))

    // Fix: Using 'My+Location' explicitly tells mobile apps to use GPS start point.
    // 'Current+Location' caused issues, 'My+Location' is safer for intents.
    const url = `https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=${destination}&waypoints=${waypoints}`

    window.open(url, '_blank')
  }

  useEffect(() => {
    fetchTenantSettings()
  }, [])

  const fetchTenantSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (profile?.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('brand_color, logo_url, product_unit_cost')
        .eq('id', profile.tenant_id)
        .single()

      if (tenant) {
        if (tenant.brand_color) {
          setBrandColor(tenant.brand_color)
          const root = document.documentElement
          root.style.setProperty('--primary-color', tenant.brand_color)
          root.style.setProperty('--primary-glow', tenant.brand_color + '66')
        }
        if (tenant.logo_url) setLogoUrl(tenant.logo_url)
        if (tenant.product_unit_cost !== undefined) setProductCost(tenant.product_unit_cost)
      }
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSavingSettings(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()

      if (!profile?.tenant_id) throw new Error("No tenant found")

      let finalLogoUrl = logoUrl

      // Upload Logo if selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${profile.tenant_id}-${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile, { upsert: true })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath)
        finalLogoUrl = publicUrl
      }

      // Update Tenant
      const { error } = await supabase
        .from('tenants')
        .update({
          brand_color: brandColor,
          logo_url: finalLogoUrl,
          product_unit_cost: productCost
        })
        .eq('id', profile.tenant_id)

      if (error) throw error

      // Apply theme globally instantly
      const root = document.documentElement
      root.style.setProperty('--primary-color', brandColor)
      root.style.setProperty('--primary-glow', brandColor + '66')

      setLogoUrl(finalLogoUrl)
      setShowSettingsModal(false)
      setLogoFile(null)
      showToast("Configuración guardada correctamente", 'success')

    } catch (err) {
      console.error("Error saving settings:", err)
      showToast("Error al guardar configuración: " + err.message, 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        {toast.show && (
          <div className={`toast-notification ${toast.type}`} onClick={hideToast}>
            {toast.message}
            {toast.type === 'error' && <div style={{ fontSize: '0.8em', marginTop: 4, opacity: 0.8 }}>(Clic para cerrar)</div>}
          </div>
        )}
        <div className="brand">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="brand-logo" />
          ) : (
            <h1>Dino<span>Platform</span></h1>
          )}
          {isAdmin && <span className="badge-god-mini">GOD</span>}
        </div>
        <div className="header-actions">
          {isAdmin && (
            <button className="nav-btn admin-link" onClick={() => navigate('/admin')} title="Ir al Panel Super Admin">
              <ShieldCheck size={20} />
              <span className="hide-mobile">Admin</span>
            </button>
          )}
          <button onClick={() => setShowSettingsModal(true)} className="nav-btn icon-only">
            <Settings size={20} />
          </button>
          <button onClick={() => navigate('/machines')} className="nav-btn">
            <GiVendingMachine size={22} />
            <span className="hide-mobile">Maquinas</span>
          </button>
          <button onClick={() => navigate('/locations')} className="nav-btn">
            <Store size={20} />
            <span className="hide-mobile">Puntos</span>
          </button>
          <button onClick={() => navigate('/routes')} className="nav-btn">
            <MapPin size={20} />
            <span className="hide-mobile">Rutas</span>
          </button>
          <button onClick={() => navigate('/collections')} className="nav-btn">
            <DollarSign size={20} />
            <span className="hide-mobile">Cortes y Finanzas</span>
          </button>
          <button onClick={() => navigate('/reports')} className="nav-btn" style={{ position: 'relative' }}>
            <FileText size={20} />
            <span className="hide-mobile">Reportes</span>
            {pendingReports > 0 && <span className="notification-badge">{pendingReports}</span>}
          </button>
          <button onClick={() => navigate('/refills')} className="nav-btn">
            <Package size={20} />
            <span className="hide-mobile">Inventario</span>
          </button>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={20} />
            <span className="hide-mobile">Salir</span>
          </button>
        </div>
      </header >

      <div className="stats-grid four-cols">
        <div
          className="glass stat-card"
          onClick={() => todayRoutesCount > 0 && navigate('/routes')}
          style={{ cursor: todayRoutesCount > 0 ? 'pointer' : 'default', borderColor: todayRoutesCount > 0 ? 'var(--primary-color)' : 'var(--border-color)' }}
        >
          <Map className="icon teal" style={{ background: todayRoutesCount > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.05)' }} />
          <div className="stat-content">
            <span className="label">Rutas de Hoy</span>
            <span className="value" style={{ color: todayRoutesCount > 0 ? 'var(--primary-color)' : 'var(--text-main)' }}>{todayRoutesCount}</span>
          </div>
        </div>
        <div className="glass stat-card">
          <LayoutGrid className="icon teal" />
          <div className="stat-content">
            <span className="label">Total Locaciones</span>
            <span className="value">{machines.length}</span>
          </div>
        </div>
        <div className="glass stat-card">
          <CheckCircle2 className="icon teal" />
          <div className="stat-content">
            <span className="label">Activas</span>
            <span className="value">{activeMachines}</span>
          </div>
        </div>
        <div className="glass stat-card">
          <AlertCircle className="icon red" />
          <div className="stat-content">
            <span className="label">Inactivas</span>
            <span className="value">{inactiveMachines}</span>
          </div>
        </div>
        <div className="glass stat-card">
          <DollarSign className="icon teal" />
          <div className="stat-content">
            <span className="label">Ganancia Mes ({new Date().toLocaleString('es-ES', { month: 'long' })})</span>
            <span className="value">${currentMonthProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="features-grid">
        {/* Chart Section */}
        <section className="chart-section glass">
          <div className="section-header-mini">
            <TrendingUp size={18} className="teal" />
            <h3>Rendimiento Semestral</h3>
          </div>
          <div className="chart-container-inner" style={{ height: 280, marginTop: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--panel-color)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: 'var(--primary-color)' }}
                  labelStyle={{ color: 'var(--text-main)' }}
                />
                <Area type="monotone" dataKey="ganancia" stroke="var(--primary-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Inventory & Agenda Grid */}
        <div className="side-panels">
          <section className="inventory-preview glass">
            <div className="section-header-mini">
              <Package size={18} className="teal" />
              <h3>Nivel de Inventario (Critico)</h3>
            </div>
            <div className="inventory-list">
              {stockStatus.map(m => (
                <div key={m.id} className="inv-item">
                  <div className="inv-info">
                    <span>{m.name}</span>
                    <span className="inv-val">{m.level}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className={`progress-bar-fill ${m.level < 20 ? 'critical' : m.level < 50 ? 'warning' : ''}`} style={{ width: `${m.level}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="agenda-preview glass">
            <div className="section-header-mini">
              <Calendar size={18} className="teal" />
              <h3>Próximos Cortes</h3>
              <button
                onClick={handleGenerateRoute}
                className="route-btn-top"
                disabled={agenda.length === 0}
                style={{}}
              >
                <Map size={14} />
                Ruta de Hoy
              </button>
            </div>
            <div className="agenda-list">
              {agenda.length === 0 ? <p className="empty-msg">No hay visitas programadas pronto.</p> : agenda.map(item => (
                <div key={item.id} className="agenda-item">
                  <div className="agenda-info">
                    <strong>{item.name}</strong>
                    <span>{item.daysUntil < 0 ? `Atrasado ${Math.abs(item.daysUntil)} días` : item.daysUntil === 0 ? '¡Hoy!' : `En ${item.daysUntil} días`}</span>
                  </div>
                  <div className="agenda-actions">
                    <a href={item.maps_url} target="_blank" rel="noreferrer" className="nav-icon-btn secondary">
                      <Map size={14} />
                    </a>
                    <button className="nav-icon-btn" onClick={() => navigate('/collections')}>
                      <DollarSign size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="temporal-alerts glass">
            <div className="section-header-mini">
              <Clock size={18} style={{ color: '#0066cc' }} />
              <h3>Rellenos por Temporalidad</h3>
            </div>
            <div className="alerts-list">
              {temporalAlerts.length === 0 ? (
                <p className="empty-msg">No hay alertas de temporalidad.</p>
              ) : (
                temporalAlerts.map(alert => (
                  <div key={alert.id} className="alert-item">
                    <div className="alert-link-content">
                      <div className="alert-main">
                        <strong>{alert.name}</strong>
                        <span className="badge-frequency">{alert.frequency}</span>
                      </div>
                      <span className={`alert-days ${alert.daysUntil <= 0 ? 'critical' : 'warning'}`}>
                        {alert.daysUntil < 0 ? `Atrasado ${Math.abs(alert.daysUntil)} días` : alert.daysUntil === 0 ? 'Toca hoy' : `En ${alert.daysUntil} días`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>



      {/* Settings Modal - Redesigned */}
      {
        showSettingsModal && (
          <div className="modal-overlay">
            <div className="glass modal-content settings-modal-refined" style={{ maxWidth: '500px', width: '90%', padding: '0' }}>
              <div className="modal-header-refined" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Configuración de Marca</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Personaliza la apariencia y parámetros de tu negocio.</p>
              </div>

              <form onSubmit={handleSaveSettings} style={{ padding: '24px' }}>

                {/* Visual Identity Section */}
                <div className="settings-section" style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: '16px' }}>Identidad Visual</h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="input-group-clean">
                      <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-main)' }}>Color Principal</label>
                      <div className="color-picker-styled" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-color)' }}>
                        <input
                          type="color"
                          value={brandColor}
                          onChange={e => setBrandColor(e.target.value)}
                          style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0, background: 'none' }}
                        />
                        <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>{brandColor}</span>
                      </div>
                    </div>

                    <div className="input-group-clean">
                      <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-main)' }}>Logotipo</label>
                      <div className="file-upload-styled" style={{ position: 'relative' }}>
                        <label htmlFor="logo-upload" className="file-upload-trigger" style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '50px',
                          border: '1px dashed var(--border-color)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: 'var(--bg-color)',
                          color: 'var(--text-dim)',
                          fontSize: '0.85rem'
                        }}>
                          {logoFile ? (
                            <span style={{ color: 'var(--primary-color)' }}>Archivo seleccionado</span>
                          ) : logoUrl ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img src={logoUrl} alt="Logo" style={{ height: '20px', width: 'auto' }} />
                              <span>Cambiar</span>
                            </div>
                          ) : (
                            <span>Subir Imagen...</span>
                          )}
                        </label>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={e => setLogoFile(e.target.files[0])}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Finance Section */}
                <div className="settings-section" style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: '16px' }}>Finanzas</h4>
                  <div className="input-group-clean">
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px', color: 'var(--text-main)' }}>Costo Producto Promedio</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '0 0 8px 0' }}>Costo estimado por relleno para calcular ganancias.</p>

                    <div className="currency-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '12px', color: 'var(--text-dim)' }}>$</span>
                      <input
                        type="number"
                        step="0.10"
                        value={productCost}
                        onChange={e => setProductCost(parseFloat(e.target.value))}
                        placeholder="0.00"
                        style={{
                          width: '100%',
                          padding: '10px 10px 10px 25px', /* Left padding for $ */
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-color)',
                          color: 'var(--text-main)',
                          fontSize: '1rem'
                        }}
                      />
                      <span style={{ position: 'absolute', right: '12px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>MXN</span>
                    </div>
                  </div>
                </div>

                {/* Integration Section */}
                <div className="settings-section integration-section">
                  <div className="integration-box" style={{
                    padding: '16px',
                    background: 'var(--bg-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="icon-box-google" style={{ width: '36px', height: '36px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                      </div>
                      <div className="integration-info">
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Google Maps</label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Sincronización de rutas</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => alert('Próximamente')} style={{
                      background: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--primary-color)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}>
                      Conectar
                    </button>
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowSettingsModal(false)} className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 500 }}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={savingSettings} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px var(--primary-glow)' }}>
                    {savingSettings ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }


      <div
        className="version-tag"
      >
        v: 24.01.04-perf-v2
      </div>
    </div >
  )
}

