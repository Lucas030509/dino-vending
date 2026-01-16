import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, ArrowDownCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';

export default function SyncIndicator({ isDownloading }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Monitor queue size
    const pendingCount = useLiveQuery(() => db.sync_queue.where('status').equals('pending').count()) || 0;

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 3 States: Offline, Downloading, Uploading (Syncing)
    if (pendingCount === 0 && !isDownloading && isOnline) return null; // Hidden if perfect

    return (
        <div style={styles.container} className={isOnline ? 'sync-online' : 'sync-offline'}>
            {!isOnline && (
                <>
                    <CloudOff size={16} />
                    <span>Sin Conexión ({pendingCount} pendientes)</span>
                </>
            )}

            {isOnline && isDownloading && (
                <>
                    <ArrowDownCircle size={16} className="bounce" />
                    <span>Bajando datos...</span>
                </>
            )}

            {isOnline && !isDownloading && pendingCount > 0 && (
                <>
                    <RefreshCw size={16} className="spin" />
                    <span>Subiendo {pendingCount} cambios...</span>
                </>
            )}

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                .bounce {
                    animation: bounce 1s infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
            `}</style>
        </div>
    );
}

const styles = {
    container: {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#333',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 9999,
        fontSize: '0.85rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)'
    }
}
