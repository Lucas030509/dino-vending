import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { LogOut, LayoutGrid, Users, Plus, ShieldOff, ShieldCheck, DollarSign, Key } from 'lucide-react'
import './AdminDashboard.css'

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
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '15px' }}>
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
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>
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
                            <p style={{ color: 'var(--text-dim)' }}>Entrega estas credenciales al cliente ahora mismo.</p>
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

                        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '15px' }}>
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


        </div>
    )
}
