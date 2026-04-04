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

    // --- DETAILED SUMMARY CALCULATION ---
    const summary = Object.values(collectionMap).reduce((acc, curr) => {
        const gross = parseFloat(curr.gross_amount || 0)
        const commission = gross * ((curr.commission_percent || 0) / 100)
        const refill = parseInt(curr.add_stock || 0) // Use Refill Amount for Cost Calculation as per user request

        // Cost Logic Analysis:
        // User requested: "Costo Total: 360 * 2.5 pesos" where 360 is Refill Total.
        // So we use REFILL count, not SALES count for this specific cost calculation.
        const productCost = parseFloat(curr.cost_product || 2.5)
        const capsuleCost = parseFloat(curr.cost_capsule || 1.0)

        // Note: traditionally cost is COGS (sales), but user seems to be tracking 
        // cost of goods REFILLED (to account for inventory movement or simple math).
        // However, if we want "Profit", we usually subtract Cost of Goods SOLD.
        // User example: "Relleno Total: 360... Costo Total: 360 * 2.5".
        // This implies they treat every refill as an expense immediately (Cash Basis Inventory).
        // I will follow the user's explicit formula: Cost = Refill * UnitCost.

        const totalCost = refill * productCost

        // Profit Logic:
        // User example: Ganancia Final = 3600 (Importe) - 900 (Costo).
        // Commission (720) was calculated but NOT subtracted in the user's final equation: 3600-900=2700.
        // This is weird. Usually Ganancia = Importe - Comision - Costo.
        // 3600 - 720 - 900 = 1980.
        // Maybe the user wants to see "Ganancia Bruta" before commission? 
        // Or maybe the location pays the commission?
        // To be safe, I will display all values clearly. 
        // I will interpret "Ganancia Final" as (Importe - Costo - Comision) because that's the real money left.
        // If I follow the user strictly (3600-900), I might be hiding the commission expense.
        // But wait, if I look at the user prompt again:
        // "Ganancia Final=$ 3,600.00-$900.00= $ 2,700.00"
        // THIS IS VERY SPECIFIC. It completely ignores commission subtraction. 
        // It implies the commission might be "internal" or "on top" or simply ignored for this specific "Final Profit" view.
        // OR the user forgot.
        // I will show "Ganancia (Recaudado - Costo)" to be accurate to their request, 
        // AND "Ganancia Neta (Menos Comisión)" to be helpful.

        return {
            totalRefill: acc.totalRefill + refill,
            totalAmount: acc.totalAmount + gross,
            totalCommission: acc.totalCommission + commission,
            totalCost: acc.totalCost + totalCost,
            totalProfit: acc.totalProfit + (gross - totalCost) // Following user formula
        }
    }, { totalRefill: 0, totalAmount: 0, totalCommission: 0, totalCost: 0, totalProfit: 0 })

    return (
        <div className="modal-overlay" style={{ padding: '0', alignItems: 'flex-end', zIndex: 1000, WebkitTapHighlightColor: 'transparent' }}>
            <div className="glass modal-content collection-modal" style={{ 
                width: '100%', 
                maxWidth: '600px', 
                maxHeight: '90vh', 
                overflowY: 'auto', 
                borderBottomLeftRadius: 0, 
                borderBottomRightRadius: 0, 
                borderTopLeftRadius: '24px', 
                borderTopRightRadius: '24px',
                padding: '24px',
                background: '#ffffff',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.1)'
            }}>
                <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', position: 'relative' }}>
                    <div style={{ width: '40px', height: '5px', background: '#e5e7eb', borderRadius: '4px', marginBottom: '16px' }} />
                    <button className="close-btn" onClick={onClose} style={{ position: 'absolute', right: '0', top: '0', background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#6b7280' }}>✕</button>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', textAlign: 'center' }}>Corte: {location.name}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', margin: 0, textAlign: 'center' }}>
                        {location.address} • {machines.length} {machines.length === 1 ? 'Máquina' : 'Máquinas'}
                    </p>
                </div>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {machineAlert && (
                        <div style={{
                            background: 'rgba(234, 179, 8, 0.1)', color: '#d97706', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600
                        }}>
                            <AlertCircle size={24} />
                            <span>{machineAlert.message}</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.95rem', color: 'var(--text-dim)', fontWeight: '600', marginLeft: '4px' }}>Fecha del Corte</label>
                        <input
                            type="date"
                            value={Object.values(collectionMap)[0]?.collection_date || ''}
                            onChange={e => {
                                machines.forEach(m => onUpdateCollection(m.id, 'collection_date', e.target.value))
                            }}
                            required
                            style={{ padding: '16px', borderRadius: '12px', border: '2px solid #e5e7eb', fontSize: '1.1rem', color: 'var(--text-main)', outline: 'none', fontFamily: 'inherit', backgroundColor: '#f9fafb' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {machines.map(m => {
                            const data = collectionMap[m.id] || {}
                            const isRent = m.contract_type === 'rent'
                            const commission = parseFloat(data.gross_amount || 0) * ((data.commission_percent || 0) / 100)

                            return (
                                <div key={m.id} style={{ padding: '20px', borderRadius: '16px', background: '#ffffff', border: '2px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-color)', fontWeight: '700' }}>{m.nickname || m.location_name || `Máquina ${m.id.substring(0, 4)}`}</h4>
                                        {isRent && <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>Renta Fija</span>}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>Monto Recolectado ($)</label>
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.4rem', color: '#94a3b8', fontWeight: '600' }}>$</span>
                                                <input
                                                    type="number" step="0.50" placeholder="0.00"
                                                    value={data.gross_amount || ''}
                                                    onChange={e => onUpdateCollection(m.id, 'gross_amount', e.target.value)}
                                                    required
                                                    style={{ width: '100%', fontSize: '1.6rem', padding: '16px 16px 16px 40px', borderRadius: '12px', border: '2px solid #cbd5e1', fontWeight: '700', backgroundColor: '#f8fafc', color: 'var(--text-main)', outline: 'none', transition: 'all 0.2s ease', touchAction: 'manipulation' }}
                                                    onFocus={(e) => { e.target.style.borderColor = 'var(--primary-color)'; e.target.style.backgroundColor = '#ffffff'; e.target.style.boxShadow = '0 0 0 4px rgba(0, 102, 204, 0.1)'; }}
                                                    onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.backgroundColor = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>Comisión (%)</label>
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <input
                                                        type="number" min="0" max="100" step="0.5"
                                                        value={data.commission_percent !== undefined ? data.commission_percent : ''}
                                                        disabled={isRent}
                                                        onChange={e => onUpdateCollection(m.id, 'commission_percent', e.target.value)}
                                                        style={{ width: '100%', fontSize: '1.3rem', padding: '14px 40px 14px 16px', borderRadius: '12px', border: '2px solid #cbd5e1', backgroundColor: isRent ? '#f1f5f9' : '#f8fafc', fontWeight: '700', color: 'var(--text-main)', outline: 'none', transition: 'all 0.2s', touchAction: 'manipulation' }}
                                                        onFocus={(e) => !isRent && (e.target.style.borderColor = 'var(--primary-color)', e.target.style.backgroundColor = '#ffffff')}
                                                        onBlur={(e) => !isRent && (e.target.style.borderColor = '#cbd5e1', e.target.style.backgroundColor = '#f8fafc')}
                                                    />
                                                    <span style={{ position: 'absolute', right: '16px', color: '#94a3b8', fontWeight: 'bold', fontSize: '1.2rem' }}>%</span>
                                                </div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>Para el Locatario</label>
                                                <div style={{ 
                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                    fontSize: '1.3rem', fontWeight: '800', color: '#059669', 
                                                    backgroundColor: '#d1fae5', borderRadius: '12px', padding: '12px',
                                                    border: '2px solid #a7f3d0'
                                                }}>
                                                    ${commission.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div style={{ padding: '24px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary-color), #2563eb)', color: 'white', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 10px 25px rgba(0, 102, 204, 0.25)' }}>
                        <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600', opacity: 0.9 }}>Resumen del Corte</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '12px' }}>
                            <span style={{ fontSize: '1rem', fontWeight: '500' }}>Total Dinero Recolectado</span>
                            <strong style={{ fontSize: '1.5rem' }}>${summary.totalAmount.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: '500' }}>A Entregar a Locatarios</span>
                            <strong style={{ fontSize: '1.5rem', color: '#fef08a' }}>${summary.totalCommission.toFixed(2)}</strong>
                        </div>
                    </div>

                    <div style={{ marginTop: '8px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: '700' }}>Evidencia (Obligatorio)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div 
                                onClick={() => setShowPhotoModal(true)}
                                style={{ 
                                    background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '16px', padding: photoPreview ? '8px' : '20px', 
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', 
                                    cursor: 'pointer', position: 'relative', overflow: 'hidden', minHeight: '130px', transition: 'border-color 0.2s',
                                }}
                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                                onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                            >
                                {photoPreview ? (
                                    <>
                                        <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', position: 'absolute', top: 0, left: 0 }} />
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); setPhotoFile(null); }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 'bold', backdropFilter: 'blur(4px)' }}>Borrar</button>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ background: '#e0e7ff', padding: '16px', borderRadius: '50%', color: 'var(--primary-color)', marginBottom: '4px' }}>
                                            <Camera size={32} />
                                        </div>
                                        <span style={{ fontSize: '1rem', fontWeight: '600', color: '#475569' }}>Cámara</span>
                                    </>
                                )}
                            </div>
                            
                            <div 
                                onClick={() => setShowSignatureModal(true)}
                                style={{ 
                                    background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '16px', padding: signaturePreview ? '8px' : '20px', 
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', 
                                    cursor: 'pointer', position: 'relative', overflow: 'hidden', minHeight: '130px', transition: 'border-color 0.2s',
                                }}
                                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                                onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                            >
                                {signaturePreview ? (
                                    <>
                                        <img src={signaturePreview} alt="Sig" style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'white', borderRadius: '8px', position: 'absolute', top: 0, left: 0, padding: '8px' }} />
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setSignaturePreview(null); }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 'bold', backdropFilter: 'blur(4px)' }}>Borrar</button>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ background: '#e0e7ff', padding: '16px', borderRadius: '50%', color: 'var(--primary-color)', marginBottom: '4px' }}>
                                            <Eraser size={32} />
                                        </div>
                                        <span style={{ fontSize: '1rem', fontWeight: '600', color: '#475569' }}>Firmar</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '8px', background: '#f8fafc', borderRadius: '16px', border: '2px solid #e2e8f0', overflow: 'hidden' }}>
                        <div 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }}
                            onClick={() => setReportForm({ ...reportForm, active: !reportForm.active })}
                        >
                            <span style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-main)' }}>Reportar Incidencia</span>
                            <div className="switch-wrapper" style={{ margin: 0, pointerEvents: 'none' }}>
                                <input type="checkbox" checked={reportForm.active || false} readOnly />
                                <span className="switch-slider" style={{ width: '48px', height: '26px' }}></span>
                            </div>
                        </div>

                        {reportForm.active && (
                            <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>Tipo de Falla</label>
                                    <select
                                        value={reportForm.type || 'Otro'}
                                        onChange={e => setReportForm({ ...reportForm, type: e.target.value })}
                                        style={{ padding: '14px', borderRadius: '12px', border: '2px solid #cbd5e1', outline: 'none', backgroundColor: 'white', fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: '500' }}
                                    >
                                        <option value="Otro">Otro</option>
                                        <option value="Monedero Bloqueado">Monedero Bloqueado</option>
                                        <option value="Base Dañada">Base Dañada</option>
                                        <option value="Producto Atorado">Producto Atorado</option>
                                        <option value="Pantalla/Software">Pantalla/Software</option>
                                        <option value="Limpieza">Limpieza</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>Observaciones</label>
                                    <textarea
                                        rows="3"
                                        placeholder="Detalla el problema..."
                                        value={reportForm.description || ''}
                                        onChange={e => setReportForm({ ...reportForm, description: e.target.value })}
                                        style={{ padding: '14px', borderRadius: '12px', border: '2px solid #cbd5e1', outline: 'none', backgroundColor: 'white', fontSize: '1.05rem', resize: 'none', fontFamily: 'inherit', color: 'var(--text-main)', fontWeight: '500' }}
                                    ></textarea>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '16px' }}>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            style={{ 
                                background: 'var(--primary-color)', color: 'white', padding: '20px', borderRadius: '16px', 
                                fontSize: '1.2rem', fontWeight: '800', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                boxShadow: '0 8px 25px rgba(0, 102, 204, 0.35)', opacity: isSubmitting ? 0.8 : 1, transition: 'all 0.2s',
                                display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}
                            onMouseDown={e => !isSubmitting && (e.currentTarget.style.transform = 'scale(0.98)')}
                            onMouseUp={e => !isSubmitting && (e.currentTarget.style.transform = 'scale(1)')}
                            onTouchStart={e => !isSubmitting && (e.currentTarget.style.transform = 'scale(0.98)')}
                            onTouchEnd={e => !isSubmitting && (e.currentTarget.style.transform = 'scale(1)')}
                        >
                            {isSubmitting ? 'Guardando Corte...' : 'Finalizar y Guardar Corte'}
                        </button>
                        <button 
                            type="button" 
                            onClick={onClose}
                            style={{ 
                                background: 'transparent', color: '#64748b', padding: '16px', borderRadius: '16px', 
                                fontSize: '1.1rem', fontWeight: '700', border: 'none', cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div >
        </div >
    )
}

export { CollectionModal }
