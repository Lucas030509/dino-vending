import React, { useState } from 'react'
import { Plus, Camera, Eraser } from 'lucide-react'

export const CollectionModal = ({
    machine = {},
    onClose,
    onSubmit,
    newCollection = {},
    setNewCollection,
    reportForm = {},
    setReportForm,
    machineAlert,
    commissionAmount = 0,
    netProfit = 0,
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
    // We can include sub-logic here, or keep receiving props from parent
    // For Phase 3 refactor, we just move the JSX structure first.

    return (
        <div className="modal-overlay">
            <div className="glass modal-content collection-modal">
                <div className="modal-header">
                    <h3>Registrar Corte: {machine.location_name}</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={onSubmit}>
                    <div className="modal-body-grid">
                        {/* Left Column: Financial Data */}
                        <div className="modal-column">
                            <div className="form-section-title">Datos del Corte</div>

                            <div className="input-group">
                                <label>Fecha del Corte</label>
                                <input
                                    type="date"
                                    value={newCollection.collection_date}
                                    onChange={e => setNewCollection({ ...newCollection, collection_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label>Monto Recolectado ($)</label>
                                <input
                                    type="number"
                                    step="0.50"
                                    placeholder="0.00"
                                    value={newCollection.gross_amount}
                                    onChange={e => setNewCollection({ ...newCollection, gross_amount: e.target.value })}
                                    required
                                    className="money-input"
                                />
                            </div>

                            {/* Commission Logic */}
                            {machine.contract_type === 'rent' ? (
                                <div className="input-group">
                                    <label>Esquema de Pago</label>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', color: '#94a3b8', fontSize: '0.9rem' }}>
                                        Modelo de Renta Fija
                                        <div style={{ color: 'white', marginTop: 4, fontWeight: 'bold' }}>
                                            ${machine?.rent_amount || '0'} / {machine?.rent_periodicity || 'Mes'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="input-group">
                                    <label>Comisión del Lugar (%)</label>
                                    <div className="commission-control">
                                        <input
                                            type="number"
                                            min="0" max="100" step="0.5"
                                            value={newCollection.commission_percent}
                                            onChange={e => setNewCollection({ ...newCollection, commission_percent: parseFloat(e.target.value) })}
                                            required
                                        />
                                        <div className="commission-value">
                                            = ${commissionAmount.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="form-section-title mt-4">Próxima Visita</div>
                            <div className="input-group">
                                <div className="days-selector compact">
                                    {[7, 15, 30].map(days => (
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
                                            placeholder="#"
                                            value={newCollection.next_refill_days}
                                            onChange={e => setNewCollection({ ...newCollection, next_refill_days: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Costs Details */}
                            <div className="details-disclosure">
                                <details>
                                    <summary>Detalles Operativos (Costos)</summary>
                                    <div className="form-grid compact-grid mt-2">
                                        <div className="input-group">
                                            <label>Unidades Vendidas</label>
                                            <input
                                                type="number"
                                                value={newCollection.units_sold}
                                                onChange={e => setNewCollection({ ...newCollection, units_sold: e.target.value })}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Costo Unitario ($)</label>
                                            <input
                                                type="number" step="0.10"
                                                value={newCollection.cost_capsule}
                                                onChange={e => setNewCollection({ ...newCollection, cost_capsule: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </div>

                        {/* Right Column: Evidence & Incidents */}
                        <div className="modal-column">
                            <div className="form-section-title">Evidencia de Visita</div>

                            {/* Evidence Actions Card */}
                            <div className="actions-grid">
                                {/* Photo Action */}
                                <div className="action-card" onClick={() => setShowPhotoModal(true)}>
                                    <div className="action-header">
                                        <span>Foto del Contador</span>
                                        {photoPreview && (
                                            <div className="file-controls">
                                                <button
                                                    className="control-btn danger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPhotoPreview(null);
                                                        setPhotoFile(null);
                                                    }}
                                                >Borrar</button>
                                            </div>
                                        )}
                                    </div>
                                    {photoPreview ? (
                                        <div className="preview-container">
                                            <img src={photoPreview} alt="Preview" className="photo-preview-compact" />
                                        </div>
                                    ) : (
                                        <div className="action-placeholder">
                                            <Camera size={24} />
                                            <span>Tomar / Subir Foto</span>
                                        </div>
                                    )}
                                </div>

                                {/* Signature Action */}
                                <div className="action-card" onClick={() => setShowSignatureModal(true)}>
                                    <div className="action-header">
                                        <span>Firma Encargado</span>
                                        {signaturePreview && (
                                            <div className="file-controls">
                                                <button
                                                    className="control-btn danger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSignaturePreview(null);
                                                    }}
                                                >Borrar</button>
                                            </div>
                                        )}
                                    </div>
                                    {signaturePreview ? (
                                        <div className="preview-container bg-white">
                                            <img src={signaturePreview} alt="Signature" className="sig-preview-compact" />
                                        </div>
                                    ) : (
                                        <div className="action-placeholder">
                                            <Eraser size={24} />
                                            <span>Firmar</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Incidents Section */}
                            <div className="incident-wrapper mt-4">
                                <div className="panel-header" style={{ marginBottom: 10 }}>
                                    <div className="form-section-title" style={{ border: 'none', margin: 0 }}>Reportar Incidencia</div>
                                    <div className="switch-wrapper">
                                        <input
                                            type="checkbox"
                                            checked={reportForm.active}
                                            onChange={e => setReportForm({ ...reportForm, active: e.target.checked })}
                                        />
                                        <span className="switch-slider"></span>
                                    </div>
                                </div>

                                {/* Alert for Pending Issues */}
                                {machineAlert && (
                                    <div style={{
                                        background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)',
                                        color: '#facc15', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '10px',
                                        display: 'flex', gap: '8px', alignItems: 'center'
                                    }}>
                                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                        Esta máquina tiene incidencias pendientes.
                                    </div>
                                )}

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
                                        <div className="checkbox-row" onClick={() => setReportForm({ ...reportForm, remember: !reportForm.remember })}>
                                            <div style={{
                                                width: 18, height: 18, borderRadius: 4, border: '2px solid var(--primary-color)',
                                                background: reportForm.remember ? 'var(--primary-color)' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {reportForm.remember && <span style={{ color: 'black', fontWeight: 'bold' }}>✓</span>}
                                            </div>
                                            <span>Recordar Incidencia (Pendiente)</span>
                                        </div>
                                        <div className="helper-text">
                                            Si activas esto, aparecerá en "Reportes Internos" como pendiente hasta que se resuelva.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <div className="profit-summary">
                            <span className="label">Ganancia Neta Estimada</span>
                            <span className="highlight">${netProfit.toFixed(2)}</span>
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
                                {isSubmitting ? 'Guardando...' : 'Guardar Corte'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
