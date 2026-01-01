import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Camera, Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

export default function PublicReport() {
    const { uid } = useParams()
    const navigate = useNavigate()
    const [machine, setMachine] = useState(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [completed, setCompleted] = useState(false)

    // Form State
    const [reportType, setReportType] = useState('Atorada')
    const [description, setDescription] = useState('')
    const [photo, setPhoto] = useState(null)
    const [previewUrl, setPreviewUrl] = useState('')

    useEffect(() => {
        fetchMachineDetails()
    }, [uid])

    const fetchMachineDetails = async () => {
        try {
            // Find machine by ID (UUID) from the URL param
            const { data, error } = await supabase
                .from('machines')
                .select('location_name, id, qr_code_uid')
                .eq('id', uid)
                .single()

            if (data) {
                setMachine(data)
            } else {
                // If not found, maybe handle error or just allow reporting by UID anyway
                console.warn("Machine not found, reporting by UID only")
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handlePhotoChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setPhoto(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            let photoUrl = ''

            // 1. Upload Photo if exists
            if (photo) {
                const fileExt = photo.name.split('.').pop()
                const fileName = `${uid}_${Date.now()}.${fileExt}`
                const { error: uploadError } = await supabase.storage
                    .from('report-photos')
                    .upload(fileName, photo)

                if (uploadError) {
                    console.error("Storage error:", uploadError)
                    alert("No se pudo subir la foto. Verifica que exista el bucket 'report-photos' público.")
                    // Continue without photo or return? Let's continue.
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('report-photos')
                        .getPublicUrl(fileName)
                    photoUrl = publicUrl
                }
            }

            // 2. Insert Report
            const { error: dbError } = await supabase
                .from('reports')
                .insert({
                    machine_uid: uid,
                    report_type: reportType,
                    description: description,
                    photo_url: photoUrl,
                    status: 'Pending'
                })

            if (dbError) throw dbError

            setCompleted(true)

        } catch (error) {
            console.error(error)
            alert("Error al enviar reporte: " + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (completed) {
        return (
            <div className="report-page success-view">
                <CheckCircle2 size={64} className="success-icon" />
                <h2>¡Reporte Enviado!</h2>
                <p>Gracias por avisarnos. Un técnico revisará la máquina {machine?.qr_code_uid || uid} lo antes posible.</p>
                <div className="card-logo">
                    DinoPlatform
                </div>
            </div>
        )
    }

    return (
        <div className="report-page">
            <header className="report-header">
                <h3>Reportar Problema</h3>
                {loading ? <Loader2 className="spin" /> : (
                    <p className="machine-badge">
                        {machine ? machine.location_name : 'Máquina Desconocida'} ({machine?.qr_code_uid || '...'})
                    </p>
                )}
            </header>

            <form onSubmit={handleSubmit} className="report-form glass">
                <div className="form-group">
                    <label>¿Qué pasó?</label>
                    <select
                        value={reportType}
                        onChange={e => setReportType(e.target.value)}
                        className="input-select"
                    >
                        <option value="Atorada">🔴 Producto Atorado</option>
                        <option value="Rellenar">🟡 Máquina Vacía (Rellenar)</option>
                        <option value="Rota">⚫ Vidrio/Máquina Rota</option>
                        <option value="Tragó Moneda">🪙 Se tragó la moneda</option>
                        <option value="Descompuesta">🔧 Otro / Descompuesta</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Foto (Opcional)</label>
                    <div className={`photo-upload-box ${previewUrl ? 'has-file' : ''}`} onClick={() => document.getElementById('cam-input').click()}>
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="photo-preview" />
                        ) : (
                            <>
                                <Camera size={32} />
                                <span>Tomar foto o subir</span>
                            </>
                        )}
                        <input
                            id="cam-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handlePhotoChange}
                            hidden
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>Comentarios adicionales</label>
                    <textarea
                        rows="3"
                        placeholder="Detalles extra..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    ></textarea>
                </div>

                <button type="submit" className="submit-btn" disabled={submitting}>
                    {submitting ? 'Enviando...' : 'Enviar Reporte'}
                </button>
            </form>

            <style dangerouslySetInnerHTML={{
                __html: `
                .report-page { 
                    max-width: 480px; margin: 0 auto; min-height: 100vh; padding: 20px; 
                    background: #0d1117; color: white; display: flex; flex-direction: column;
                }
                .success-view { alignItems: center; justify-content: center; text-align: center; }
                .success-icon { color: #10b981; margin-bottom: 20px; }
                .card-logo { margin-top: 40px; font-weight: 700; opacity: 0.5; }

                .report-header { text-align: center; margin-bottom: 24px; }
                .report-header h3 { margin: 0 0 8px 0; font-size: 1.5rem; }
                .machine-badge { 
                    background: rgba(255,255,255,0.1); display: inline-block; padding: 4px 12px; 
                    border-radius: 20px; font-size: 0.9rem; color: #aaa;
                }

                .report-form { padding: 24px; border-radius: 16px; display: flex; flex-direction: column; gap: 20px; }
                
                .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #ccc; }
                
                .input-select, textarea {
                    width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px;
                    background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
                    color: white; font-size: 1rem;
                }

                .photo-upload-box {
                    border: 2px dashed rgba(255,255,255,0.2); border-radius: 12px;
                    height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center;
                    color: #888; cursor: pointer; transition: 0.2s; position: relative; overflow: hidden;
                }
                .photo-upload-box:hover { border-color: #10b981; color: #10b981; }
                .photo-preview { width: 100%; height: 100%; object-fit: cover; }

                .submit-btn {
                    background: #10b981; color: black; border: none; padding: 16px; border-radius: 12px;
                    font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: 0.2s;
                }
                .submit-btn:disabled { opacity: 0.7; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}} />
        </div>
    )
}
