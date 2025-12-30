import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Info, Image, Clock, CheckSquare } from 'lucide-react'

export default function Reports() {
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedImage, setSelectedImage] = useState(null)

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

    const handleResolve = async (id) => {
        const { error } = await supabase
            .from('reports')
            .update({ status: 'Resolved' })
            .eq('id', id)

        if (!error) fetchReports()
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
                        <p className="subtitle">Gestión de incidencias reportadas por usuarios</p>
                    </div>
                </div>
            </header>

            {loading ? <p>Cargando reportes...</p> : (
                <div className="reports-list">
                    {reports.length === 0 ? (
                        <div className="empty-glass">
                            <CheckCircle2 size={48} className="teal" style={{ opacity: 0.5, marginBottom: 10 }} />
                            <p>No tienes reportes pendientes. ¡Todo marcha bien!</p>
                        </div>
                    ) : (
                        reports.map(report => {
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
                                            <button className="resolve-btn" onClick={() => handleResolve(report.id)}>
                                                <CheckSquare size={16} /> Marcar Resuelto
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

            <style dangerouslySetInnerHTML={{
                __html: `
                .reports-page { padding: 20px; max-width: 800px; margin: 0 auto; color: white; padding-bottom: 80px; }
                 .page-header { margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between; }
                .header-left { display: flex; align-items: center; gap: 16px; }
                .back-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); color: white; transition: all 0.2s; }
                .back-btn:hover { background: var(--primary-color); color: black; }
                .page-header h1 { margin: 0; font-size: 1.8rem; }
                .subtitle { color: var(--text-dim); margin: 4px 0 0 0; font-size: 0.9rem; }
                
                .empty-glass { background: rgba(255,255,255,0.05); padding: 40px; border-radius: 12px; text-align: center; color: #888; }

                .report-card { 
                    position: relative; margin-bottom: 16px; border-radius: 12px; overflow: hidden; 
                    display: flex; justify-content: space-between; align-items: center;
                     background: rgba(22, 27, 34, 0.6); border: 1px solid rgba(255,255,255,0.08);
                    transition: 0.2s;
                }
                @media (max-width: 600px) {
                    .report-card { flex-direction: column; align-items: stretch; }
                    .r-actions { border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end; }
                    .report-status-stripe { height: 100%; width: 6px; order: -1; }
                    .report-card { border-left: 6px solid transparent; } /* Fallback layout fix */
                    .report-status-stripe { display: none; } /* Hide stripe on mobile col layout, use border-left instead */
                }
                .report-card.resolved { opacity: 0.6; filter: grayscale(0.5); }
                
                .report-status-stripe { width: 6px; align-self: stretch; flex-shrink: 0; }
                .report-content { padding: 16px; flex: 1; }
                
                .r-header { display: flex; gap: 12px; font-size: 0.85rem; margin-bottom: 6px; align-items: center; }
                .r-type { font-weight: 700; display: flex; align-items: center; gap: 6px; }
                .r-date { color: #666; display: flex; align-items: center; gap: 4px; }
                
                .report-content h3 { margin: 0 0 2px 0; font-size: 1.1rem; }
                .r-uid { font-size: 0.8rem; color: #666; font-family: monospace; margin: 0 0 8px 0; }
                .r-desc { font-style: italic; color: #ccc; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; display: inline-block; margin-top: 4px; }

                .view-photo-btn { 
                    background: rgba(255,255,255,0.1); border: none; color: white; margin-top: 8px; 
                    padding: 6px 12px; border-radius: 12px; font-size: 0.8rem; cursor: pointer; display: flex; gap: 6px; align-items: center;
                }
                .view-photo-btn:hover { background: rgba(255,255,255,0.2); }

                .r-actions { padding: 16px; }
                .resolve-btn { 
                    background: var(--primary-color); color: black; border: none; padding: 8px 16px; 
                    border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; gap: 6px; align-items: center;
                }
                .resolved-badge { color: #10b981; font-weight: 600; border: 1px solid #10b981; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; }

                .image-modal { 
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2000;
                    background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; pading: 20px;
                }
                .image-modal img { max-width: 90%; max-height: 90vh; border-radius: 8px; }
            `}} />
        </div>
    )
}
