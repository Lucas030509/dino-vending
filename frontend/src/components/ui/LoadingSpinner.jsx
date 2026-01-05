import React from 'react'

export default function LoadingSpinner() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            color: 'var(--text-dim, #888)',
            gap: '16px'
        }}>
            <div className="spinner"></div>
            <p>Cargando DinoVending...</p>
            <style>{`
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(255,255,255,0.1);
                    border-radius: 50%;
                    border-top-color: var(--primary-color, #10b981);
                    animation: spin 1s ease-in-out infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
