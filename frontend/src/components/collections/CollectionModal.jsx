import React, { useState } from 'react'
import { Plus, Camera, Eraser, AlertCircle } from 'lucide-react'

const CollectionModal = ({
    location = {},
    onClose,
    onSubmit,
    collectionMap = {}, // Changed from newCollection (flat) to Map { machineId: { gross_amount... } }
    onUpdateCollection, // Fn(machineId, field, value)
    reportForm = {},
    setReportForm,
    machineAlert,
    totalProfit = 0, // Calculated in parent
    signatureRef,
    clearSignature,
    signaturePreview,
    setSignaturePreview,
    photoPreview,
    setPhotoPreview,
    showPhotoModal,
    setShowPhotoModal,
    showSignatureModal,
    setShowSignatureModal,
    photoFile,
    setPhotoFile,
    isSubmitting = false
}) => {
    // Sort machines by id or alias for consistency
    const machines = location.machines || []

    return (
        <div className="modal-overlay">
            <div className="glass modal-content collection-modal" style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                    <h3>Corte: {location.name}</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                        {location.address} • {machines.length} Máquinas
                    </p>
                </div>

                <form onSubmit={onSubmit}>
                    <div className="modal-body-grid" style={{ display: 'flex', flexDirection: 'column' }}>

                        {machineAlert && (
                            <div style={{
                                background: 'rgba(234, 179, 8, 0.1)',
                                color: '#fbbf24',
                                padding: '12px',
                                borderRadius: '8px',
                                marginBottom: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                border: '1px solid rgba(234, 179, 8, 0.2)'
                            }}>
                                <AlertCircle size={20} />
                                <span style={{ fontWeight: 500 }}>{machineAlert.message}</span>
                            </div>
                        )}

                        {/* Global Settings */}
                        <div className="input-group" style={{ marginBottom: 20 }}>
                            <label>Fecha del Corte (Global)</label>
                            <input
                                type="date"
                                // Assuming first machine dictates date, or passed separately? 
                                // Let's use the first machine's date for display or a separate global prop.
                                // For now, read from first entry in map
                                value={Object.values(collectionMap)[0]?.collection_date || ''}
                                onChange={e => {
                                    machines.forEach(m => onUpdateCollection(m.id, 'collection_date', e.target.value))
                                }}
                                required
                            />
                        </div>

                        {/* MACHINES LOOP */}
                        <div className="machines-grid-list" style={{ display: 'grid', gap: '15px' }}>
                            {machines.map(m => {
                                const data = collectionMap[m.id] || {}
                                const isRent = m.contract_type === 'rent'
                                const commission = parseFloat(data.gross_amount || 0) * ((data.commission_percent || 0) / 100)
                                const expenses = (parseInt(data.units_sold || 0) * (parseFloat(data.cost_capsule || 0) + parseFloat(data.cost_product || 0)))
                                const profit = (parseFloat(data.gross_amount || 0) - commission - expenses)

                                return (
                                    <div key={m.id} className="machine-row-card glass" style={{ padding: '15px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                                            <h4 style={{ margin: 0, color: 'var(--primary-color)' }}>{m.nickname || m.location_name || `Máquina ${m.id.substring(0, 4)}`} ({m.product_type})</h4>
                                            {isRent && <span className="badge-god-mini">Renta Fija</span>}
                                        </div>

                                        <div className="form-grid compact-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                            <div className="input-group">
                                                <label>Monto ($)</label>
                                                <input
                                                    type="number" step="0.50" placeholder="0.00"
                                                    value={data.gross_amount}
                                                    onChange={e => onUpdateCollection(m.id, 'gross_amount', e.target.value)}
                                                    required
                                                    className="money-input"
                                                />
                                            </div>

                                            <div className="input-group">
                                                <label>Comisión (%)</label>
                                                <input
                                                    type="number" min="0" max="100" step="0.5"
                                                    value={data.commission_percent}
                                                    disabled={isRent} // Locked if rent
                                                    onChange={e => onUpdateCollection(m.id, 'commission_percent', e.target.value)}
                                                />
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>
                                                    -${commission.toFixed(2)}
                                                </div>
                                            </div>

                                            <div className="input-group">
                                                <label>Ganancia</label>
                                                <div className="fake-input" style={{ color: '#10b981', fontWeight: 'bold' }}>
                                                    ${profit.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Hidden/Advanced toggle could go here for costs/units override */}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Shared Evidence Section */}
                        <div className="form-section-title mt-4">Evidencia de Visita (Compartida)</div>
                        <div className="actions-grid">
                            <div className="action-card" onClick={() => setShowPhotoModal(true)}>
                                <div className="action-header">
                                    <span>Foto del Contador</span>
                                    {photoPreview && <button type="button" className="control-btn danger" onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); setPhotoFile(null); }}>Borrar</button>}
                                </div>
                                {photoPreview ? <img src={photoPreview} alt="Preview" className="photo-preview-compact" /> : <div className="action-placeholder"><Camera size={24} /><span>Tomar Foto</span></div>}
                            </div>
                            <div className="action-card" onClick={() => setShowSignatureModal(true)}>
                                <div className="action-header">
                                    <span>Firma Encargado</span>
                                    {signaturePreview && <button type="button" className="control-btn danger" onClick={(e) => { e.stopPropagation(); setSignaturePreview(null); }}>Borrar</button>}
                                </div>
                                {signaturePreview ? <img src={signaturePreview} alt="Sig" className="sig-preview-compact bg-white" /> : <div className="action-placeholder"><Eraser size={24} /><span>Firmar</span></div>}
                            </div>
                        </div>

                        {/* Incidents Section - Shared for the Location Visit */}
                        <div className="incident-wrapper mt-4">
                            <div className="panel-header" style={{ marginBottom: 10 }}>
                                <div className="form-section-title" style={{ border: 'none', margin: 0 }}>Reportar Incidencia (Sitio)</div>
                                <div className="switch-wrapper">
                                    <input
                                        type="checkbox"
                                        checked={reportForm.active || false}
                                        onChange={e => setReportForm({ ...reportForm, active: e.target.checked })}
                                    />
                                    <span className="switch-slider"></span>
                                </div>
                            </div>

                            {reportForm.active && (
                                <div className="incident-panel">
                                    <div className="input-group">
                                        <label>Tipo de Falla</label>
                                        <select
                                            className="dark-select"
                                            value={reportForm.type}
                                            onChange={e => setReportForm({ ...reportForm, type: e.target.value })}
                                        >
                                            <option value="Otro">Otro</option>
                                            <option value="Monedero Bloqueado">Monedero Bloqueado</option>
                                            <option value="Base Dañada">Base Dañada</option>
                                            <option value="Producto Atorado">Producto Atorado</option>
                                            <option value="Pantalla/Software">Pantalla/Software</option>
                                            <option value="Limpieza">Limpieza</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label>Observaciones</label>
                                        <textarea
                                            className="search-input"
                                            rows="3"
                                            placeholder="Detalla el problema..."
                                            value={reportForm.description}
                                            onChange={e => setReportForm({ ...reportForm, description: e.target.value })}
                                        ></textarea>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <div className="profit-summary">
                            <span className="label">Ganancia Neta Estimada</span>
                            <span className="highlight">${totalProfit.toFixed(2)}</span>
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn-secondary" onClick={onClose}>
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="btn-primary full-width"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Guardando...' : 'Guardar Corte Global'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

export { CollectionModal } // Export as named export to match import usage
