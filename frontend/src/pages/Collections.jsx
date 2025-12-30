import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, DollarSign, Calendar, TrendingUp, AlertCircle, CheckCircle2, MoreVertical, Plus, Trash2, Search, ArrowDownToLine } from 'lucide-react'

export default function Collections() {
    const [machines, setMachines] = useState([])
    const [filteredMachines, setFilteredMachines] = useState([])
    const [filterQuery, setFilterQuery] = useState('')
    const [collections, setCollections] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedMachine, setSelectedMachine] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Toast State
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type })
        if (type !== 'error') {
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000)
        }
    }
    const hideToast = () => setToast({ ...toast, show: false })

    // Form State for New Collection
    const [newCollection, setNewCollection] = useState({
        gross_amount: '',
        collection_date: new Date().toISOString().split('T')[0],
        next_refill_days: 15, // Default estimate
        notes: '',
        units_sold: 0,
        cost_capsule: 1,
        cost_product: 2.5,
        commission_percent: 0
    })

    // Auto-calculate units when amount changes
    useEffect(() => {
        if (selectedMachine && newCollection.gross_amount) {
            const amount = parseFloat(newCollection.gross_amount)
            const denom = selectedMachine.denomination || 10
            // Default logic: Units = Amount / Denomination
            // But user can override
            const estimatedUnits = Math.round(amount / denom)
            setNewCollection(prev => ({ ...prev, units_sold: estimatedUnits }))
        }
    }, [newCollection.gross_amount, selectedMachine])

    // Computed values for preview
    const commissionAmount = parseFloat(newCollection.gross_amount || 0) * ((newCollection.commission_percent || 0) / 100)

    const totalExpenses = (parseInt(newCollection.units_sold || 0) * (parseFloat(newCollection.cost_capsule || 0) + parseFloat(newCollection.cost_product || 0)))

    const profitAmount = (parseFloat(newCollection.gross_amount || 0) - commissionAmount - totalExpenses)

    useEffect(() => {
        fetchData()
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
                (m.address && m.address.toLowerCase().includes(query))
            )
            setFilteredMachines(filtered)
        }
    }, [filterQuery, machines])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch Machines
            const { data: machinesData } = await supabase
                .from('machines')
                .select('*')
                .eq('current_status', 'Active')
                .order('location_name')

            // Fetch Recent Collections
            const { data: collectionsData } = await supabase
                .from('collections')
                .select(`
          *,
          machines (location_name)
        `)
                .order('collection_date', { ascending: false })
                .limit(20)

            setMachines(machinesData || [])
            setFilteredMachines(machinesData || [])
            setCollections(collectionsData || [])
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleOpenModal = (machine) => {
        setSelectedMachine(machine)
        setNewCollection({
            ...newCollection,
            gross_amount: '',
            notes: '',
            units_sold: 0,
            cost_capsule: 1,
            cost_product: 2.5,
            commission_percent: machine.commission_percent || 0
        })
        setShowModal(true)
    }

    const handleRegisterCollection = async (e) => {
        e.preventDefault()
        if (!selectedMachine) return
        setIsSubmitting(true)

        try {
            const gross = parseFloat(newCollection.gross_amount)
            const commission = gross * (newCollection.commission_percent / 100)

            // Expenses
            const units = parseInt(newCollection.units_sold)
            const costCap = parseFloat(newCollection.cost_capsule)
            const costProd = parseFloat(newCollection.cost_product)
            const totalExp = units * (costCap + costProd)

            const profit = gross - commission - totalExp

            // Calculate next refill date
            const nextDate = new Date()
            nextDate.setDate(nextDate.getDate() + parseInt(newCollection.next_refill_days))

            const { data: { user } } = await supabase.auth.getUser()

            // 1. Insert Collection Record
            const { error } = await supabase.from('collections').insert({
                tenant_id: selectedMachine.tenant_id,
                machine_id: selectedMachine.id,
                collection_date: newCollection.collection_date,
                gross_amount: gross,
                commission_amount: commission,
                net_revenue: (gross - commission), // Cash flow to tenant (before expenses)
                profit_amount: profit, // Real profit
                units_sold: units,
                unit_cost_capsule: costCap,
                unit_cost_product: costProd,
                unit_cost_capsule: costCap,
                unit_cost_product: costProd,
                commission_percent_snapshot: newCollection.commission_percent, // Save the used percent
                next_refill_date_estimate: nextDate.toISOString().split('T')[0],
                notes: newCollection.notes,
                created_by: user.id
            })

            if (error) throw error

            showToast('Corte registrado exitosamente!', 'success')
            setShowModal(false)
            fetchData() // Refresh list

        } catch (err) {
            console.error('Error registering collection:', err)
            showToast(err.message, 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteCollection = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar este corte? Esta acción es irreversible.")) return

        const { error } = await supabase.from('collections').delete().eq('id', id)
        if (error) {
            showToast("Error al eliminar corte: " + error.message, 'error')
        } else {
            showToast("Corte eliminado correctamente", 'success')
            fetchData()
        }
    }

    return (
        <div className="collections-page">
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
                        <h1>Programación de Cortes</h1>
                        <p className="subtitle">Gestión financiera y rutas de servicio</p>
                    </div>
                </div>
            </header>

            <div className="main-grid">
                {/* Left Panel: Active Machines to Service */}
                <div className="panel machine-list-panel glass">
                    <div className="panel-header">
                        <h3>Máquinas Activas</h3>
                        <span className="badge">{filteredMachines.length} Puntos</span>
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

                    <div className="scrollable-list">
                        {filteredMachines.map(machine => (
                            <div key={machine.id} className="machine-item glass-hover">
                                <div className="m-info">
                                    <h4>{machine.location_name}</h4>
                                    <p className="sub-text">{machine.qr_code_uid} • {machine.commission_percent}% Com.</p>
                                </div>
                                <button
                                    className="action-btn-icon"
                                    onClick={() => handleOpenModal(machine)}
                                    title="Registrar Corte"
                                >
                                    <ArrowDownToLine size={20} />
                                </button>
                            </div>
                        ))}
                        {filteredMachines.length === 0 && (
                            <div className="empty-search-state">
                                <p>No se encontraron resultados.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Recent History */}
                <div className="panel history-panel glass">
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
                                        <td>{new Date(col.collection_date).toLocaleDateString()}</td>
                                        <td>{col.machines?.location_name || 'Desconocida'}</td>
                                        <td className="amount">${col.gross_amount}</td>
                                        <td className="amount commission">-${col.commission_amount}</td>
                                        <td className={`amount ${col.profit_amount >= 0 ? 'profit' : 'commission'}`}>
                                            ${col.profit_amount ?? col.net_revenue}
                                        </td>
                                        <td>
                                            <button onClick={() => handleDeleteCollection(col.id)} className="delete-btn-mini">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {collections.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="empty-cell">No hay cortes registrados aún.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal: Register Collection */}
            {showModal && selectedMachine && (
                <div className="modal-overlay">
                    <div className="glass modal-content collection-modal">
                        <div className="modal-header">
                            <h3>Registrar Corte: {selectedMachine.location_name}</h3>
                            <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <form onSubmit={handleRegisterCollection}>
                            <div className="kpi-summary">
                                <div className="kpi-box">
                                    <span className="label">Comisión ({newCollection.commission_percent}%)</span>
                                    <span className="value arg-red">-${commissionAmount.toFixed(2)}</span>
                                </div>
                                <div className="kpi-box">
                                    <span className="label">Gastos (Cápsulas)</span>
                                    <span className="value arg-red">-${totalExpenses.toFixed(2)}</span>
                                </div>
                                <div className="kpi-box highlight">
                                    <span className="label">Ganancia Final</span>
                                    <span className="value">${profitAmount.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="form-section-title">Detalles del Corte</div>
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Comisión (%)</label>
                                    <input
                                        type="number"
                                        min="0" max="100" step="0.5"
                                        value={newCollection.commission_percent}
                                        onChange={e => setNewCollection({ ...newCollection, commission_percent: parseFloat(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Fecha del Corte</label>
                                    <input
                                        type="date"
                                        value={newCollection.collection_date}
                                        onChange={e => setNewCollection({ ...newCollection, collection_date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Monto Recolectado ($)</label>
                                    <input
                                        type="number"
                                        step="0.50"
                                        placeholder="0.00"
                                        value={newCollection.gross_amount}
                                        onChange={e => setNewCollection({ ...newCollection, gross_amount: e.target.value })}
                                        required
                                        autoFocus
                                        className="money-input"
                                    />
                                </div>
                                <div className="input-group info-group">
                                    <label>Capacidad / Precio</label>
                                    <div className="info-display">
                                        <span>${selectedMachine.denomination} MXN</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="input-group">
                                    <label>Unidades Vendidas (Est.)</label>
                                    <input
                                        type="number"
                                        value={newCollection.units_sold}
                                        onChange={e => setNewCollection({ ...newCollection, units_sold: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-section-title mt-4">Calculadora de Costos (Unitarios)</div>
                            <div className="form-grid compact-grid">

                                <div className="input-group">
                                    <label>Costo X Cápsula ($)</label>
                                    <input
                                        type="number" step="0.10"
                                        value={newCollection.cost_capsule}
                                        onChange={e => setNewCollection({ ...newCollection, cost_capsule: e.target.value })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Costo X Juguete ($)</label>
                                    <input
                                        type="number" step="0.10"
                                        value={newCollection.cost_product}
                                        onChange={e => setNewCollection({ ...newCollection, cost_product: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="calc-preview glass">
                                <div className="row">
                                    <span>Monto Bruto:</span>
                                    <span>${newCollection.gross_amount || '0.00'}</span>
                                </div>
                                <div className="row red">
                                    <span>- Comisión ({newCollection.commission_percent}%):</span>
                                    <span>${commissionAmount.toFixed(2)}</span>
                                </div>
                                <div className="row red">
                                    <span>- Costo Producto ({newCollection.units_sold}u x ${parseFloat(newCollection.cost_capsule) + parseFloat(newCollection.cost_product)}):</span>
                                    <span>${totalExpenses.toFixed(2)}</span>
                                </div>
                                <div className="row total">
                                    <span>Ganancia Neta:</span>
                                    <span>${profitAmount.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="form-section-title mt-4">Próxima Visita</div>
                            <div className="input-group">
                                <label>Días estimados para siguiente relleno</label>
                                <div className="days-selector">
                                    {[7, 15, 30, 45].map(days => (
                                        <button
                                            type="button"
                                            key={days}
                                            className={newCollection.next_refill_days == days ? 'active' : ''}
                                            onClick={() => setNewCollection({ ...newCollection, next_refill_days: days })}
                                        >
                                            {days}d
                                        </button>
                                    ))}
                                    <div className="custom-days-wrapper">
                                        <input
                                            type="number"
                                            className="custom-days"
                                            placeholder="Otro"
                                            value={newCollection.next_refill_days}
                                            onChange={e => setNewCollection({ ...newCollection, next_refill_days: e.target.value })}
                                        />
                                        <span>días</span>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Registrando...' : 'Confirmar Corte'}
                                </button>
                            </div>
                        </form>
                    </div >
                </div >
            )
            }

            <style dangerouslySetInnerHTML={{
                __html: `
        .collections-page { padding: 20px; max-width: 1200px; margin: 0 auto; color: white; }
        .page-header { margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .back-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); color: white; transition: all 0.2s; }
        .back-btn:hover { background: var(--primary-color); color: black; }
        .page-header h1 { margin: 0; font-size: 1.8rem; }
        .subtitle { color: var(--text-dim); margin: 4px 0 0 0; font-size: 0.9rem; }

        .main-grid { display: grid; grid-template-columns: 350px 1fr; gap: 24px; }
        @media (max-width: 900px) { .main-grid { grid-template-columns: 1fr; } }

        .panel { border-radius: 16px; overflow: hidden; height: fit-content; }
        .panel-header { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }
        .panel-header h3 { margin: 0; font-size: 1.1rem; }
        .badge { background: var(--primary-color); color: black; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.8rem; }

        .scrollable-list { max-height: 600px; overflow-y: auto; padding: 10px; }
        .machine-item { padding: 16px; margin-bottom: 8px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; border: 1px solid transparent; }
        .glass-hover:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.1); }
        
        .search-box-container { padding: 0 10px 10px 10px; position: relative; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .search-input { 
            width: 100%; box-sizing: border-box; 
            padding: 10px 10px 10px 36px !important; 
            background: rgba(0,0,0,0.2) !important; 
            border: none !important; 
            font-size: 0.9rem !important; 
        }
        .search-icon { position: absolute; left: 20px; top: 50%; transform: translateY(-50%) translateY(-5px); color: var(--text-dim); }
        .empty-search-state { padding: 20px; text-align: center; color: var(--text-dim); font-size: 0.9rem; }

        .m-info h4 { margin: 0 0 4px 0; font-size: 1rem; }
        .sub-text { margin: 0; font-size: 0.8rem; color: var(--text-dim); }
        
        .action-btn { background: var(--primary-color); color: black; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.85rem; }
        .action-btn-icon { 
            background: var(--primary-color);
            color: black; 
            border: none; 
            width: 40px; height: 40px; 
            border-radius: 50%; 
            cursor: pointer; 
            display: flex; align-items: center; justify-content: center; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            transition: all 0.2s;
        }
        .action-btn-icon:hover { transform: scale(1.1); background: #65a30d; }

        .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .history-table { width: 100%; border-collapse: collapse; min-width: 600px; }

        .delete-btn-mini { 
            background: rgba(248, 81, 73, 0.1); 
            border: 1px solid rgba(248, 81, 73, 0.2); 
            color: #f87171; 
            cursor: pointer; 
            padding: 6px; 
            border-radius: 6px; 
            transition: all 0.2s; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
        }
        .delete-btn-mini:hover { background: #f87171; color: white; }
        .history-table th { text-align: left; padding: 16px; color: var(--text-dim); font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .history-table td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.95rem; }
        .amount { font-family: monospace; font-weight: 600; }
        .amount.profit { color: var(--primary-color); }
        .amount.commission { color: #f87171; }
        .empty-cell { text-align: center; color: var(--text-dim); padding: 40px; }

        
        .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
            display: flex; justify-content: center; align-items: center;
            z-index: 1000; padding: 20px;
        }

        /* Modal Specifics */

        /* Modal & Form Styling Updates */
        .collection-modal { 
            max-width: 550px; 
            width: 95%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 25px;
            background: #161b22; 
            border: 1px solid rgba(48, 54, 61, 0.8);
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        }

        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
        .modal-header h3 { margin: 0; font-size: 1.25rem; color: white; line-height: 1.3; }
        .close-btn { background: none; border: none; color: var(--text-dim); font-size: 1.5rem; cursor: pointer; padding: 0; line-height: 1; transition: color 0.2s; }
        .close-btn:hover { color: white; }
        
        /* KPI Summary Grid */
        .kpi-summary { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 12px; margin-bottom: 30px; }
        .kpi-box { 
            background: rgba(13, 17, 23, 0.6); 
            padding: 12px 10px; 
            border-radius: 10px; 
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .kpi-box.highlight { 
            background: rgba(16, 185, 129, 0.08); 
            border: 1px solid rgba(16, 185, 129, 0.2); 
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.05);
        }
        .arg-red { color: #f87171; }
        
        /* Form Layout */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .compact-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
        
        .input-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 0; }
        .input-group label { margin: 0; font-size: 0.85rem; color: var(--text-dim); font-weight: 500; }
        
        /* Dark Theme Inputs */
        input[type="text"],
        input[type="number"],
        input[type="date"],
        .custom-days {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid var(--border-color);
            color: white;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 0.95rem;
            width: 100%;
            transition: all 0.2s ease;
            font-family: inherit;
            box-sizing: border-box; /* Fix sizing issues */
        }
        
        input:focus {
            outline: none;
            border-color: var(--primary-color);
            background: rgba(0, 0, 0, 0.4);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        /* Money Input Special Styling */
        .money-input { 
            font-size: 1.2rem !important; 
            font-weight: 700; 
            color: var(--primary-color) !important; 
            background: rgba(16, 185, 129, 0.05) !important;
            border-color: rgba(16, 185, 129, 0.3) !important;
        }

        /* Read-only Info Display */
        .info-display { 
            background: rgba(255,255,255,0.03); 
            padding: 10px 14px; 
            border-radius: 8px; 
            color: var(--text-dim); 
            font-size: 0.95rem; 
            border: 1px dashed rgba(255,255,255,0.1);
            display: flex; align-items: center;
            height: 42px; /* Accessbility to match inputs */
            box-sizing: border-box;
        }

        /* Calculation Preview Box */
        .calc-preview { 
            background: rgba(0,0,0,0.25); 
            padding: 20px; 
            border-radius: 12px; 
            margin-top: 25px; 
            border: 1px solid rgba(255,255,255,0.05);
        }
        .calc-preview .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.9rem; color: var(--text-dim); }
        .calc-preview .row:last-child { margin-bottom: 0; }
        .calc-preview .row.total { 
            margin-top: 16px; 
            padding-top: 16px; 
            border-top: 1px solid rgba(255,255,255,0.1); 
            font-size: 1.2rem; 
            color: white; 
            font-weight: 700; 
        }

        /* Section Titles */
        .form-section-title {
            font-size: 0.75rem; 
            text-transform: uppercase; 
            letter-spacing: 1.2px; 
            color: var(--primary-color);
            margin: 25px 0 15px 0; 
            font-weight: 700;
            display: flex; align-items: center; gap: 8px;
            opacity: 0.9;
        }
        .form-section-title::after {
            content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08);
        }
        .mt-4 { margin-top: 0; } /* Resetting utility since we used specific spacing */

        /* Days Selector */
        .days-selector { display: grid; grid-template-columns: repeat(4, 1fr) 1.2fr; gap: 10px; width: 100%; }
        .days-selector button { 
            width: 100%;
            min-width: unset;
            background: rgba(255,255,255,0.03); 
            border: 1px solid rgba(255,255,255,0.1); 
            color: var(--text-dim); 
            padding: 10px 0; 
            border-radius: 8px; 
            cursor: pointer; 
            transition: all 0.2s;
            font-size: 0.9rem;
        }
        .days-selector button:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
        .days-selector button.active { 
            background: var(--primary-color); 
            color: black; 
            font-weight: 600; 
            border-color: var(--primary-color); 
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
        }
        
        .custom-days-wrapper { 
            display: flex; align-items: center; justify-content: center; gap: 6px; 
            background: rgba(255,255,255,0.03); 
            padding: 0 10px; 
            border-radius: 8px; 
            border: 1px solid rgba(255,255,255,0.1); 
        }
        .custom-days { 
            width: 35px !important; 
            padding: 5px !important; text-align: center; 
            background: transparent !important; border: none !important; 
            font-weight: 600;
        }
        /* Hide arrows in number input */
        .custom-days::-webkit-outer-spin-button,
        .custom-days::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        /* Modal Actions */
        .modal-actions { 
            display: flex; gap: 16px; margin-top: 35px; padding-top: 25px; 
            border-top: 1px solid rgba(255,255,255,0.08); 
        }
        .btn-secondary { 
            background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; 
            padding: 12px 24px; border-radius: 10px; cursor: pointer; font-weight: 600; flex: 1;
            transition: all 0.2s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.05); border-color: white; }
        
        .btn-primary { 
            flex: 2; 
            background: var(--primary-color); color: rgb(6, 43, 29);
            border: none; padding: 12px 24px; border-radius: 10px; 
            font-weight: 700; cursor: pointer;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
            transition: all 0.2s;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4); }

        /* Toast Styles (Keep existing) */
        .toast-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            cursor: pointer;
        }
        .toast-notification:hover { transform: scale(1.02); }
        .toast-notification.success { background: #10b981; border-left: 4px solid #059669; }
        .toast-notification.error { background: #ef4444; border-left: 4px solid #b91c1c; }
        .toast-notification.info { background: #3b82f6; border-left: 4px solid #2563eb; }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        `}} />
        </div >
    )
}
