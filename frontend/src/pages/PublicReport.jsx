import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Camera, Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import './PublicReport.css'

import { Toast } from '../components/ui/Toast' // Check path validity. Likely ../../components or ../components depending on folder. Pages is src/pages. Components is src/components. So ../components/ui/Toast is correct.

export default function PublicReport() {
    const { uid } = useParams()
    const navigate = useNavigate()
    const [machine, setMachine] = useState(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [completed, setCompleted] = useState(false)

    // Toast State
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
    const showToast = (message, type = 'info') => {
        setToast({ show: true, message, type })
    }
    const hideToast = () => setToast({ ...toast, show: false })

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
                    showToast("No se pudo subir la foto. Se enviará sin ella.", 'error')
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
            showToast("Error al enviar reporte: " + error.message, 'error')
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
            <Toast
                show={toast.show}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
            />
            <header className="report-header">
                <h3>Reportar Problema</h3>
                {loading ? <Loader2 className="spin" /> : (
                    <p className="machine-badge">
                        {machine ? machine.location_name : 'Máquina Desconocida'} ({machine?.qr_code_uid || '...'})
                    </p>
                )}
            </header>

            <form onSubmit={handleSubmit} className="report-form">
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
        </div>
    )
}
