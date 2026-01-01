import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LogOut, LayoutGrid, Users, Plus, ShieldOff, ShieldCheck, DollarSign, Key } from 'lucide-react'

export default function AdminDashboard({ session }) {
    const [tenants, setTenants] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    // New Tenant Form State
    const [newTenant, setNewTenant] = useState({
        name: '',
        email: '',
        password: ''
    })
    const [creating, setCreating] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    // Reset Password State
    const [resetModal, setResetModal] = useState(false)
    const [resetPassword, setResetPassword] = useState('')
    const [targetTenantReset, setTargetTenantReset] = useState(null)

    // Success Modal State
    const [successModal, setSuccessModal] = useState(false)
    const [createdCredentials, setCreatedCredentials] = useState(null)

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
        setErrorMsg('')

        try {
            // Llamada a la Edge Function segura (MANUAL mode w/ Password)
            const { data, error } = await supabase.functions.invoke('create-tenant', {
                body: {
                    name: newTenant.name,
                    email: newTenant.email,
                    password: newTenant.password
                }
            })

            if (error) throw error
            if (data && data.error) throw new Error(data.data || data.error)

            // Success
            const credentials = { email: newTenant.email, password: newTenant.password }
            setCreatedCredentials(credentials)
            setNewTenant({ name: '', email: '', password: '' })
            setShowModal(false)
            setSuccessModal(true)
            fetchTenants()
        } catch (err) {
            console.error('Full Error Object:', err)
            const details = err.context ? JSON.stringify(err.context) : err.message
            alert(`Error técnico: ${details}. \nRevisa la consola.`)
            setErrorMsg('Fallo al crear: ' + details)
        } finally {
            setCreating(false)
        }
    }

    const openResetModal = (id, name) => {
        setTargetTenantReset({ id, name })
        setResetPassword('')
        setResetModal(true)
    }

    const handleConfirmReset = async (e) => {
        e.preventDefault()
        if (!targetTenantReset || !resetPassword) return

        setLoading(true)
        try {
            const { data, error } = await supabase.functions.invoke('reset-password', {
                body: {
                    target_tenant_id: targetTenantReset.id,
                    new_password: resetPassword
                }
            })

            if (error) throw error
            if (data && data.error) throw new Error(data.error)

            alert(`¡Contraseña actualizada exitosamente para ${targetTenantReset.name}!`)
            setResetModal(false)
            setTargetTenantReset(null)
        } catch (err) {
            console.error(err)
            // Intentar extraer mensaje real si viene del Edge Function
            let msg = err.message
            if (err.context && err.context.json) {
                // A veces el cliente de Supabase guarda la respuesta JSON aquí
                const body = await err.context.json().catch(() => ({}))
                if (body.error) msg = body.error
            } else if (msg.includes("non-2xx")) {
                msg = "Posible causa: El cliente no tiene usuario Admin vinculado o hubo un error de servidor."
            }
            alert('Error al resetear: ' + msg)
        } finally {
            setLoading(false)
        }
    }

    // Delete State
    const [deleteModal, setDeleteModal] = useState(false)
    const [targetTenant, setTargetTenant] = useState(null)

    const handleDeleteTenant = (id, name) => {
        setTargetTenant({ id, name })
        setDeleteModal(true)
    }

    const confirmDelete = async () => {
        if (!targetTenant) return

        setLoading(true)
        try {
            const { error } = await supabase.from('tenants').delete().eq('id', targetTenant.id)
            if (error) throw error

            alert('Empresa eliminada correctamente.')
            setDeleteModal(false)
            setTargetTenant(null)
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
                                            onClick={() => openResetModal(t.id, t.name)}
                                            style={{ color: '#fbbf24', marginRight: '8px' }}
                                        >
                                            <Key size={16} /> Reset
                                        </button>
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
                            <div className="input-group">
                                <label>Contraseña Inicial</label>
                                <input
                                    type="text"
                                    value={newTenant.password}
                                    onChange={e => setNewTenant({ ...newTenant, password: e.target.value })}
                                    required
                                    placeholder="Contraseña segura"
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

            {/* Delete Confirmation Modal */}
            {deleteModal && targetTenant && (
                <div className="modal-overlay">
                    <div className="glass modal-content" style={{ borderColor: '#ef4444' }}>
                        <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldOff /> Zona de Peligro
                        </h3>
                        <p>¿Estás seguro que deseas eliminar la empresa <strong>{targetTenant.name}</strong>?</p>
                        <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                            Esta acción es <strong>IRREVERSIBLE</strong>. Se perderán el historial, usuarios y configuración de este cliente.
                        </p>

                        <div className="modal-actions">
                            <button
                                onClick={() => { setDeleteModal(false); setTargetTenant(null); }}
                                className="btn-secondary"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="btn-primary"
                                style={{ background: '#ef4444', border: 'none', color: 'white' }}
                                disabled={loading}
                            >
                                {loading ? 'Eliminando...' : 'Sí, Eliminar Definitivamente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Credentials Modal */}
            {successModal && createdCredentials && (
                <div className="modal-overlay">
                    <div className="glass modal-content success-modal">
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div className="success-icon-container">
                                <ShieldCheck size={40} color="#10b981" />
                            </div>
                            <h3 style={{ color: '#10b981', margin: '10px 0' }}>¡Cliente Creado Exitosamente!</h3>
                            <p style={{ color: '#cbd5e1' }}>Entrega estas credenciales al cliente ahora mismo.</p>
                        </div>

                        <div className="credentials-box">
                            <div className="credential-row">
                                <span className="label">Usuario:</span>
                                <code className="value">{createdCredentials.email}</code>
                            </div>
                            <div className="credential-row">
                                <span className="label">Contraseña:</span>
                                <code className="value highlight">{createdCredentials.password}</code>
                            </div>
                        </div>

                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', marginTop: '15px' }}>
                            Recomendación: Pide al usuario que cambie su contraseña al ingresar.
                        </p>

                        <div className="modal-actions" style={{ justifyContent: 'center' }}>
                            <button
                                onClick={() => setSuccessModal(false)}
                                className="btn-primary"
                                style={{ background: '#10b981', width: '100%' }}
                            >
                                Entendido, Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetModal && targetTenantReset && (
                <div className="modal-overlay">
                    <div className="glass modal-content">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                            <Key /> Resetear Contraseña
                        </h3>
                        <p>Estás cambiando la contraseña para el admin de <strong>{targetTenantReset.name}</strong>.</p>

                        <form onSubmit={handleConfirmReset}>
                            <div className="input-group">
                                <label>Nueva Contraseña</label>
                                <input
                                    type="text"
                                    value={resetPassword}
                                    onChange={e => setResetPassword(e.target.value)}
                                    required
                                    className="admin-input"
                                    placeholder="Nueva contraseña..."
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setResetModal(false)} className="btn-secondary">Cancelar</button>
                                <button type="submit" className="btn-primary" style={{ background: '#fbbf24', color: 'black' }} disabled={loading}>
                                    {loading ? 'Guardando...' : 'Guardar Nueva Contraseña'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                :root {
                    --admin-primary: #8b5cf6;
                    --admin-bg: #0f172a;
                    --glass-bg: rgba(30, 41, 59, 0.7);
                    --glass-border: rgba(255, 255, 255, 0.1);
                }

                .admin-dashboard {
                    padding: 30px;
                    color: white;
                    min-height: 100vh;
                    background: radial-gradient(circle at top right, #312e81 0%, #0f172a 60%, #020617 100%);
                    font-family: 'Inter', sans-serif;
                }

                /* GLASSMORPHISM UTILS */
                .glass {
                    background: var(--glass-bg);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid var(--glass-border);
                    border-radius: 16px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }

                /* HEADER */
                .admin-header {
                    display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px;
                }
                .brand h1 { font-size: 2rem; margin: 0; font-weight: 800; letter-spacing: -1px; }
                .brand h1 span { color: var(--admin-primary); background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .badge-god { 
                    background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); 
                    padding: 6px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 800; 
                    margin-left: 12px; vertical-align: middle; box-shadow: 0 2px 10px rgba(239, 68, 68, 0.3);
                }

                /* BUTTONS */
                button { cursor: pointer; transition: all 0.2s; font-weight: 600; font-size: 0.9rem; border: none; outline: none; border-radius: 8px; }
                button:active { transform: scale(0.98); }
                
                .btn-primary { 
                    padding: 10px 20px; 
                    display: flex; align-items: center; gap: 8px; 
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
                    color: white; 
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
                }
                .btn-primary:hover { filter: brightness(1.1); box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4); }
                
                .btn-secondary { background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; }
                .btn-secondary:hover { background: rgba(255,255,255,0.1); color: white; }

                .logout-btn { 
                    background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 8px 16px; border: 1px solid rgba(239, 68, 68, 0.2); 
                    display: flex; gap: 8px; align-items: center;
                }
                .logout-btn:hover { background: #ef4444; color: white; }

                /* STATS */
                .admin-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 40px; }
                .stat-card { padding: 24px; align-items: flex-start; }
                .stat-card .icon { margin-bottom: 16px; padding: 12px; border-radius: 12px; }
                .icon.purple { background: rgba(139, 92, 246, 0.2); color: #a78bfa; }
                .icon.blue { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
                .icon.green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
                .stat-content { display: flex; flex-direction: column; }
                .stat-card .label { color: #94a3b8; font-size: 0.9rem; margin-bottom: 4px; }
                .stat-card .value { font-size: 2rem; font-weight: 700; color: white; }

                /* CONTENT & TABLE */
                .content-section { padding: 30px; }
                .section-header h2 { margin: 0; font-weight: 600; font-size: 1.25rem; }
                
                .table-responsive { overflow-x: auto; }
                .admin-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: 10px; }
                .admin-table th { text-align: left; color: #94a3b8; padding: 12px 16px; font-weight: 500; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .admin-table tbody tr { background: rgba(255,255,255,0.02); transition: background 0.2s; }
                .admin-table tbody tr:hover { background: rgba(255,255,255,0.05); }
                .admin-table td { padding: 16px; vertical-align: middle; }
                .admin-table td:first-child { border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
                .admin-table td:last-child { border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
                
                .tenant-name { font-weight: 600; font-size: 1rem; color: #e2e8f0; }
                .tenant-id { font-size: 0.75rem; color: #64748b; font-family: 'Courier New', monospace; opacity: 0.7; }
                
                .status-badge { 
                    padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; 
                    background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2);
                }

                .action-btn { 
                    background: transparent; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px; 
                    border-radius: 6px; font-size: 0.85rem; border: 1px solid transparent;
                }
                .action-btn:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }

                /* MODALS */
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center; z-index: 50;
                }
                .modal-content { width: 100%; max-width: 450px; padding: 30px; border: 1px solid rgba(255,255,255,0.15); animation: modalIn 0.3s ease-out; }
                
                @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

                .modal-content h3 { margin-top: 0; margin-bottom: 20px; font-size: 1.25rem; font-weight: 600; }
                
                .input-group { margin-bottom: 20px; }
                .input-group label { display: block; color: #94a3b8; font-size: 0.9rem; margin-bottom: 8px; font-weight: 500; }
                .admin-input {
                    background: rgba(0,0,0,0.2); border: 1px solid rgba(255, 255, 255, 0.1); 
                    color: white; padding: 12px; border-radius: 8px; width: 100%; font-size: 0.95rem; transition: border-color 0.2s;
                }
                .admin-input:focus { outline: none; border-color: var(--admin-primary); background: rgba(0,0,0,0.3); }

                .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; }
                
                /* CREDENTIALS BOX */
                .credentials-box {
                    background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; border: 1px dashed #334155; margin-top: 20px;
                }
                .credential-row { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center; }
                .credential-row:last-child { margin-bottom: 0; }
                .credential-row .label { color: #94a3b8; font-size: 0.9rem; }
                .credential-row .value { 
                    font-family: 'Courier New', monospace; color: #e2e8f0; background: rgba(255,255,255,0.05); 
                    padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);
                }
                .credential-row .value.highlight { color: #ffeb3b; border-color: rgba(253, 224, 71, 0.2); background: rgba(253, 224, 71, 0.1); font-weight: bold; }
                
                .success-icon-container {
                    background: rgba(16, 185, 129, 0.1); width: 80px; height: 80px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; margin: 0 auto;
                }
            `}</style>
        </div>
    )
}
