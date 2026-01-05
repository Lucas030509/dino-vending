import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Info, Image, Clock, CheckSquare, Users, Building2 } from 'lucide-react'
import './Reports.css'

export default function Reports() {
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedImage, setSelectedImage] = useState(null)
    const [activeTab, setActiveTab] = useState('client') // 'client' | 'internal'

    useEffect(() => {
        fetchReports()
    }, [])

    const fetchReports = async () => {
        try {
            // Fetch reports and join with machines to get location name
            // Note: Since machines are identified by UID string in reports, we might need manual join or complex query.
            // For simplicity, let's fetch reports and machines separately or rely on UID context.

            const { data: reportsData, error } = await supabase
                .from('reports')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error

            // Fetch machine names for context
            const { data: machines } = await supabase.from('machines').select('qr_code_uid, location_name')

            const machineMap = {}
            if (machines) {
                machines.forEach(m => machineMap[m.qr_code_uid] = m.location_name)
            }

            const enrichedReports = reportsData.map(r => ({
                ...r,
                location_name: machineMap[r.machine_uid] || 'Ubicación Desconocida'
            }))

            // Sort: Pending first, then by date
            enrichedReports.sort((a, b) => {
                if (a.status === 'Resolved' && b.status !== 'Resolved') return 1;
                if (a.status !== 'Resolved' && b.status === 'Resolved') return -1;
                return new Date(b.created_at) - new Date(a.created_at);
            });

            setReports(enrichedReports)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const [processingId, setProcessingId] = useState(null)

    const handleResolve = async (id) => {
        if (!window.confirm('¿Confirmas que este problema ha sido resuelto?')) return;
        setProcessingId(id)

        try {
            const { error } = await supabase
                .from('reports')
                .update({ status: 'Resolved' })
                .eq('id', id)

            if (error) throw error

            // Optimistic update locally to feel instant
            setReports(current => current.map(r =>
                r.id === id ? { ...r, status: 'Resolved' } : r
            ))

            // Background refresh to be safe
            fetchReports()
        } catch (err) {
            alert('Error al actualizar reporte: ' + err.message)
        } finally {
            setProcessingId(null)
        }
    }

    const typeConfig = {
        'Atorada': { color: '#ef4444', icon: <XCircle size={18} /> },
        'Rellenar': { color: '#eab308', icon: <Info size={18} /> },
        'Rota': { color: '#000000', icon: <AlertTriangle size={18} /> },
        'Tragó Moneda': { color: '#f97316', icon: <Info size={18} /> },
        'Descompuesta': { color: '#64748b', icon: <AlertTriangle size={18} /> }
    }

    return (
        <div className="reports-page">
            <header className="page-header">
                <div className="header-left">
                    <Link to="/" className="back-btn">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1>Reportes de Servicio</h1>
                        <p className="subtitle">Gestión de incidencias</p>
                    </div>
                </div>
            </header>

            <div className="tabs-container">
                <button
                    className={`tab-btn ${activeTab === 'client' ? 'active' : ''}`}
                    onClick={() => setActiveTab('client')}
                >
                    <Users size={16} /> Clientes
                </button>
                <button
                    className={`tab-btn ${activeTab === 'internal' ? 'active' : ''}`}
                    onClick={() => setActiveTab('internal')}
                >
                    <Building2 size={16} /> Internas (Bitácora)
                </button>
            </div>

            {loading ? <p>Cargando reportes...</p> : (
                <div className="reports-list">
                    {reports.filter(r => (r.source || 'client') === activeTab).length === 0 ? (
                        <div className="empty-glass">
                            <CheckCircle2 size={48} className="teal empty-icon" />
                            <p>No hay reportes {activeTab === 'client' ? 'de clientes' : 'internos'} pendientes.</p>
                        </div>
                    ) : (
                        reports.filter(r => (r.source || 'client') === activeTab).map(report => {
                            const config = typeConfig[report.report_type] || { color: '#888', icon: <Info /> }

                            return (
                                <div key={report.id} className={`report-card glass ${report.status === 'Resolved' ? 'resolved' : ''}`} style={{ borderLeftColor: report.status === 'Resolved' ? '#10b981' : config.color }}>
                                    <div className="report-status-stripe mobile-hide" style={{ background: report.status === 'Resolved' ? '#10b981' : config.color }}></div>
                                    <div className="report-content">
                                        <div className="r-header">
                                            <span className="r-type" style={{ color: config.color }}>
                                                {config.icon} {report.report_type}
                                            </span>
                                            <span className="r-date">
                                                <Clock size={12} /> {new Date(report.created_at).toLocaleDateString()} {new Date(report.created_at).toLocaleTimeString().slice(0, 5)}
                                            </span>
                                        </div>

                                        <h3>{report.location_name}</h3>
                                        <p className="r-uid">ID: {report.machine_uid}</p>

                                        {report.description && <p className="r-desc">"{report.description}"</p>}

                                        {report.photo_url && (
                                            <button className="view-photo-btn" onClick={() => setSelectedImage(report.photo_url)}>
                                                <Image size={14} /> Ver Foto
                                            </button>
                                        )}
                                    </div>

                                    <div className="r-actions">
                                        {report.status !== 'Resolved' ? (
                                            <button className="resolve-btn" onClick={() => handleResolve(report.id)} disabled={processingId === report.id}>
                                                <CheckSquare size={16} />
                                                {processingId === report.id ? 'Guardando...' : 'Marcar Resuelto'}
                                            </button>
                                        ) : (
                                            <span className="resolved-badge">Resuelto</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}

            {selectedImage && (
                <div className="image-modal" onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} alt="Evidencia" />
                </div>
            )}


        </div>
    )
}
