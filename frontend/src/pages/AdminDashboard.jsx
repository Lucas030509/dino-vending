import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LogOut, LayoutGrid, Users, Plus, ShieldOff, ShieldCheck, DollarSign } from 'lucide-react'

export default function AdminDashboard({ session }) {
    const [tenants, setTenants] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    // New Tenant Form State
    const [newTenant, setNewTenant] = useState({
        name: '',
        email: ''
    })
    const [creating, setCreating] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    useEffect(() => {
        fetchTenants()
    }, [])

    const fetchTenants = async () => {
        try {
            // This query requires Super Admin RLS policy
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setTenants(data || [])
        } catch (err) {
            console.error('Error fetching tenants:', err)
            // If error is 403/RLS, it means user is not super_admin properly
        } finally {
            setLoading(false)
        }
    }

    const handleCreateTenant = async (e) => {
        e.preventDefault()
        setCreating(true)
        try {
            // Llamada a la Edge Function segura
            const { data, error } = await supabase.functions.invoke('create-tenant', {
                body: {
                    name: newTenant.name,
                    email: newTenant.email
                }
            })

            if (error) throw error
            // Mágicamente la función puede devolver error en data si no falla HTTP pero sí lógica
            if (data && data.error) throw new Error(data.data || data.error)

            // Success
            setNewTenant({ name: '', email: '' })
            setShowModal(false)
            fetchTenants()
            alert('¡Empresa creada! El usuario ha sido registrado (sin contraseña). Pídale que use la opción "Olvidé mi contraseña" para entrar.')
        } catch (err) {
            console.error('Full Error Object:', err)
            // Intentamos mostrar detalles si vienen en el body de la respuesta (que a veces queda en data o en properties del error)
            const details = err.context ? JSON.stringify(err.context) : err.message
            alert(`Error técnico: ${details}. \nRevisa la consola para más detalles.`)
            setErrorMsg('Fallo al crear: ' + details)
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteTenant = async (id, name) => {
        if (!window.confirm(`¿Estás SEGURO de eliminar la empresa "${name}"?\nEsta acción es irreversible y borrará todos sus datos.`)) return

        setLoading(true)
        try {
            const { error } = await supabase.from('tenants').delete().eq('id', id)
            if (error) throw error

            alert('Empresa eliminada correctamente.')
            fetchTenants()
        } catch (err) {
            console.error(err)
            alert('Error al eliminar: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
    }

    return (
        <div className="admin-dashboard">
            <header className="admin-header">
                <div className="brand">
                    <h1 onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>Dino<span>Admin</span></h1>
                    <span className="badge-god">GOD MODE</span>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => window.location.href = '/'} className="btn-secondary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <LayoutGrid size={18} /> Ir a Operación
                    </button>
                    <button onClick={handleLogout} className="logout-btn">
                        <LogOut size={20} />
                        <span>Salir</span>
                    </button>
                </div>
            </header>

            <div className="admin-stats">
                <div className="stat-card glass">
                    <Users size={24} className="icon purple" />
                    <div className="content">
                        <span className="label">Total Clientes</span>
                        <span className="value">{tenants.length}</span>
                    </div>
                </div>
                {/* Placeholder stats */}
                <div className="stat-card glass">
                    <LayoutGrid size={24} className="icon blue" />
                    <div className="content">
                        <span className="label">Total Máquinas</span>
                        <span className="value">--</span>
                    </div>
                </div>
                <div className="stat-card glass">
                    <DollarSign size={24} className="icon green" />
                    <div className="content">
                        <span className="label">Ingresos MRR</span>
                        <span className="value">$0.00</span>
                    </div>
                </div>
            </div>

            <div className="content-section glass">
                <div className="section-header">
                    <h2>Empresas Registradas</h2>
                    <button className="btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={18} /> Nueva Empresa
                    </button>
                </div>

                <div className="table-responsive">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Empresa</th>
                                <th>Fecha Registro</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(t => (
                                <tr key={t.id}>
                                    <td>
                                        <div className="tenant-name">{t.name}</div>
                                        <div className="tenant-id">{t.id}</div>
                                    </td>
                                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <span className="status-badge active">Activo</span>
                                    </td>
                                    <td>
                                        <button
                                            className="action-btn text-only"
                                            onClick={() => handleDeleteTenant(t.id, t.name)}
                                            style={{ color: '#ef4444' }}
                                        >
                                            <ShieldOff size={16} /> Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="glass modal-content">
                        <h3>Registrar Nuevo Cliente</h3>
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '15px' }}>
                            Nota: Esto crea el registro de la empresa. El usuario Auth debes crearlo aparte.
                        </p>
                        {errorMsg && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem' }}>
                                {errorMsg}
                            </div>
                        )}
                        <form onSubmit={handleCreateTenant}>
                            <div className="input-group">
                                <label>Nombre del Negocio</label>
                                <input
                                    type="text"
                                    value={newTenant.name}
                                    onChange={e => setNewTenant({ ...newTenant, name: e.target.value })}
                                    required
                                    className="admin-input"
                                />
                            </div>
                            <div className="input-group">
                                <label>Email Admin (Referencia)</label>
                                <input
                                    type="email"
                                    value={newTenant.email}
                                    onChange={e => setNewTenant({ ...newTenant, email: e.target.value })}
                                    required
                                    className="admin-input"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                                <button type="submit" className="btn-primary purple" disabled={creating}>
                                    {creating ? 'Creando...' : 'Crear Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                :root {
                    --admin-primary: #8b5cf6; /* Violet */
                    --admin-bg: #0f172a;
                }
                .admin-dashboard {
                    padding: 20px;
                    color: white;
                    min-height: 100vh;
                    background: radial-gradient(circle at top right, #1e1b4b 0%, #0f172a 100%);
                }
                .admin-header {
                    display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px;
                }
                .brand h1 { font-size: 1.8rem; margin: 0; display: inline-block; margin-right: 12px; }
                .brand h1 span { color: var(--admin-primary); }
                .badge-god { 
                    background: linear-gradient(45deg, #f59e0b, #ef4444); 
                    padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; vertical-align: middle;
                }

                .admin-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
                .stat-card { padding: 20px; display: flex; align-items: center; gap: 16px; border: 1px solid rgba(139, 92, 246, 0.2); }
                .icon.purple { color: #a78bfa; background: rgba(139, 92, 246, 0.1); padding: 10px; border-radius: 12px; }
                .stat-content { display: flex; flex-direction: column; }
                .value { font-size: 1.5rem; font-weight: 700; }

                .content-section { padding: 24px; border-radius: 16px; min-height: 400px; }
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                
                .admin-table { width: 100%; border-collapse: collapse; }
                .admin-table th { text-align: left; color: #94a3b8; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }
                .admin-table td { padding: 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
                
                .tenant-name { font-weight: 600; font-size: 1rem; }
                .tenant-id { font-size: 0.75rem; color: #64748b; font-family: monospace; }
                
                .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; background: rgba(16, 185, 129, 0.1); color: #10b981; }

                .btn-primary.purple { background: var(--admin-primary); color: white; border: none; }
                .btn-primary.purple:hover { background: #7c3aed; }
                
                .admin-input {
                    background: rgba(0,0,0,0.3); border: 1px solid rgba(139, 92, 246, 0.3); color: white; padding: 10px; border-radius: 8px; width: 100%;
                }
                .admin-input:focus { outline: none; border-color: var(--admin-primary); }
            `}</style>
        </div>
    )
}
