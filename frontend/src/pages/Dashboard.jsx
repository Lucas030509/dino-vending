import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { LogOut, DollarSign, Settings, LayoutGrid, CheckCircle2, AlertCircle, Calendar, TrendingUp, Package, Map, MapPin, FileText, ShieldCheck } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'


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
  const [pendingReports, setPendingReports] = useState(0)
  const [todayRoutesCount, setTodayRoutesCount] = useState(0)


  // Branding State
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [brandColor, setBrandColor] = useState('#10b981')
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

        machinesData.forEach(m => {
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
      }
    } catch (e) { console.error(e) } finally {
      setLoading(false)
    }
  }

  const handleGenerateRoute = () => {
    if (agenda.length === 0) return

    // Construct Google Maps URL: dir/Origin/Dest/Waypoint1/Waypoint2...
    // We'll use "Mi+Ubicacion" as origin if possible, or just list the points.
    // The most compatible URL for multiple points:
    // https://www.google.com/maps/dir/?api=1&origin=My+Location&waypoints=Addr1|Addr2...

    const waypoints = agenda
      .map(item => encodeURIComponent(item.address || item.name))
      .join('|')

    const url = `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${encodeURIComponent(agenda[agenda.length - 1].address || agenda[agenda.length - 1].name)}&waypoints=${waypoints}`

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
        .select('brand_color, logo_url')
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
          logo_url: finalLogoUrl
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
            <LayoutGrid size={20} />
            <span className="hide-mobile">Maquinas</span>
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
          style={{ cursor: todayRoutesCount > 0 ? 'pointer' : 'default', borderColor: todayRoutesCount > 0 ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)' }}
        >
          <Map className="icon teal" style={{ background: todayRoutesCount > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)' }} />
          <div className="stat-content">
            <span className="label">Rutas de Hoy</span>
            <span className="value" style={{ color: todayRoutesCount > 0 ? 'var(--primary-color)' : 'white' }}>{todayRoutesCount}</span>
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: 'var(--primary-color)' }}
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
                style={{ opacity: agenda.length === 0 ? 0.5 : 1, cursor: agenda.length === 0 ? 'not-allowed' : 'pointer', filter: agenda.length === 0 ? 'grayscale(100%)' : 'none' }}
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
        </div>
      </div>



      {/* Settings Modal */}
      {
        showSettingsModal && (
          <div className="modal-overlay">
            <div className="glass modal-content settings-modal">
              <h3>Configuración de Marca</h3>
              <form onSubmit={handleSaveSettings}>
                <div className="input-group">
                  <label>Color de Marca</label>
                  <div className="color-picker-wrapper">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="color-input"
                    />
                    <span className="color-value">{brandColor}</span>
                  </div>
                </div>

                <div className="input-group">
                  <label>Logotipo del Negocio</label>
                  <div className="file-upload-wrapper">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setLogoFile(e.target.files[0])}
                      className="file-input"
                    />
                    {logoUrl && !logoFile && (
                      <div className="current-logo-preview">
                        <img src={logoUrl} alt="Current Logo" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="input-group" style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Map size={20} className="teal" />
                    <label style={{ margin: 0, color: 'white' }}>Integración Google Maps</label>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 12 }}>
                    Vincula tu cuenta para sincronizar rutas automáticamente con tu calendario (Próximamente).
                  </p>
                  <button type="button" className="google-btn" onClick={() => alert('La integración completa estará disponible pronto. Por ahora usamos enlaces profundos seguros.')}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="G" width="16" />
                    Conectar cuenta de Google
                  </button>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowSettingsModal(false)} className="btn-secondary">Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={savingSettings}>
                    {savingSettings ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      <style dangerouslySetInnerHTML={{
        __html: `
        :root {
            /* Fallback */
            --primary-color: #10b981;
            --primary-glow: rgba(16, 185, 129, 0.2);
        }

        .notification-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: #ef4444;
            color: white;
            font-size: 0.7rem;
            font-weight: bold;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #0d1117;
        }

        .dashboard {
          padding-bottom: 80px;
        }

        .features-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-top: 24px; }
        @media (max-width: 1000px) { .features-grid { grid-template-columns: 1fr; } }

        .section-header-mini { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
        .section-header-mini h3 { font-size: 1rem; margin: 0; color: white; opacity: 0.9; }

        .side-panels { display: flex; flex-direction: column; gap: 24px; }
        .inventory-preview, .agenda-preview, .chart-section { padding: 24px; border-radius: 16px; height: fit-content; }
        
        .inventory-list { margin-top: 15px; }
        .inv-item { margin-bottom: 12px; }
        .inv-info { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px; }
        .inv-val { font-weight: 700; color: var(--primary-color); }
        .progress-bar-bg { background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; overflow: hidden; }
        .progress-bar-fill { background: var(--primary-color); height: 100%; border-radius: 3px; }
        .progress-bar-fill.warning { background: #facc15; }
        .progress-bar-fill.critical { background: #f87171; box-shadow: 0 0 8px rgba(248, 113, 113, 0.4); }

        .agenda-list { margin-top: 15px; display: flex; flex-direction: column; gap: 10px; }
        .agenda-item { 
            background: rgba(255,255,255,0.03); padding: 12px 16px; border-radius: 10px;
            display: flex; justify-content: space-between; align-items: center;
            border: 1px solid rgba(255,255,255,0.02);
        }
        .agenda-info { display: flex; flex-direction: column; gap: 2px; }
        .agenda-info strong { font-size: 0.9rem; }
        .agenda-info span { font-size: 0.75rem; color: var(--text-dim); }
        .nav-icon-btn { background: rgba(16, 185, 129, 0.1); border: none; color: var(--primary-color); padding: 8px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .nav-icon-btn.secondary { background: rgba(255,255,255,0.05); color: white; }
        .agenda-actions { display: flex; gap: 8px; }

        .route-btn-top {
            margin-left: auto;
            background: var(--primary-color);
            color: black;
            border: none;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .route-btn-top:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 0 10px var(--primary-glow); }

        .empty-msg { color: var(--text-dim); font-size: 0.85rem; text-align: center; margin: 20px 0; }
        
        .dash-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          gap: 24px; /* Default gap for smaller screens before wrap */
        }
        
        .brand { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            flex-shrink: 0; /* Prevent title from squashing */
        }
        .brand h1 { font-size: 1.5rem; margin: 0; white-space: nowrap; }
        .brand span { color: var(--primary-color); }
        .brand-logo { height: 40px; object-fit: contain; }
        
        .badge-god-mini {
            background: linear-gradient(45deg, #f59e0b, #ef4444); 
            padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; 
            font-weight: bold; color: white; vertical-align: middle;
            margin-left: 4px;
        }

        .header-actions { display: flex; gap: 12px; }

        @media (max-width: 768px) {
            .dash-header { gap: 16px; } /* Space between logo and buttons */
            .header-actions { 
                overflow-x: auto; 
                padding-bottom: 5px; /* Space for scrollbar */
                max-width: 100%;
                -webkit-overflow-scrolling: touch; /* Smooth scroll iOS */
            }
            .nav-btn span.hide-mobile { display: none; }
        }

        .nav-btn, .logout-btn {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-dim);
          padding: 8px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-btn:hover, .logout-btn:hover { border-color: var(--primary-color); color: white; }
        .nav-btn { background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2); color: var(--primary-color); }

        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        
        .stat-card {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .stat-card .icon { padding: 10px; border-radius: 12px; }
        .stat-card .icon.teal { background: rgba(16, 185, 129, 0.1); color: var(--primary-color); }
        .stat-card .icon.red { background: rgba(248, 81, 73, 0.1); color: var(--text-error); }
        
        .stat-content { display: flex; flex-direction: column; }
        .stat-content .label { font-size: 0.8rem; color: var(--text-dim); text-transform: capitalize; }
        .stat-content .value { font-size: 1.4rem; font-weight: 700; }
        
        .four-cols { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important; }

        
        .modal-actions { display: flex; gap: 12px; margin-top: 24px; }
        .modal-actions button { flex: 1; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .btn-secondary { background: transparent; border: 1px solid var(--border-color); color: var(--text-dim); }

        
        .color-picker-wrapper { display: flex; align-items: center; gap: 12px; }
        .color-input { width: 50px; height: 50px; padding: 0; border: none; border-radius: 8px; cursor: pointer; }
        .file-upload-wrapper { display: flex; flex-direction: column; gap: 12px; }
        .current-logo-preview img { max-height: 60px; object-fit: contain; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; }
        
        .google-btn {
            background: white; color: #333; border: none; padding: 8px 12px; border-radius: 6px; 
            font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; cursor: pointer;
            transition: 0.2s;
        }
        .google-btn:hover { background: #f1f5f9; }

        .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
            display: flex; justify-content: center; align-items: center;
            z-index: 1000; padding: 20px;
        }
        }
      `}} />
      <div style={{ position: 'fixed', bottom: 5, right: 10, color: 'var(--text-dim)', fontSize: '0.7rem', opacity: 0.5, pointerEvents: 'none' }}>
        v: 24.01.03-fix-gps
      </div>
    </div >
  )
}

