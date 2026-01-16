import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { processSyncQueue } from '../../lib/sync';

export default function SyncIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Monitor queue size
    const pendingCount = useLiveQuery(() => db.sync_queue.where('status').equals('pending').count()) || 0;

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            processSyncQueue(); // Trigger sync immediately on reconnect
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Explicit sync processing trigger (if count > 0 and online)
    useEffect(() => {
        if (isOnline && pendingCount > 0) {
            processSyncQueue();
        }
    }, [isOnline, pendingCount]);

    if (pendingCount === 0 && isOnline) return null; // Hidden if everything is perfect

    return (
        <div style={styles.container} className={isOnline ? 'sync-online' : 'sync-offline'}>
            {!isOnline && (
                <>
                    <CloudOff size={16} />
                    <span>Sin Conexión ({pendingCount} pendientes)</span>
                </>
            )}

            {isOnline && pendingCount > 0 && (
                <>
                    <RefreshCw size={16} className="spin" />
                    <span>Sincronizando {pendingCount} cambios...</span>
                </>
            )}

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
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
