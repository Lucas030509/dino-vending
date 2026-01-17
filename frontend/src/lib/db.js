import Dexie from 'dexie';

export const db = new Dexie('DinoDatabase');

db.version(2).stores({ // Bump version to 2
    // Entities mirrored from Supabase
    locations: 'id, name, district, tenant_id',
    machines: 'id, location_name, location_id, zone, tenant_id', // Added location_id
    routes: 'id, scheduled_date, status, tenant_id',
    route_stops: 'id, route_id, machine_id, status',
    collections: 'id, collection_date, record_type, machine_id, tenant_id', // Stores both Refills and Cortes
    reports: 'id, reported_at, status, machine_id, tenant_id',

    // Sync Queue for Offline Actions
    sync_queue: '++id, table_name, action_type, payload, status, created_at'
});

// Helper to save data efficiently
export async function bulkSave(table, items) {
    if (!items || items.length === 0) return;
    await db.table(table).bulkPut(items);
}

// Helper to clear data (usually on logout)
export async function clearLocalData() {
    await db.machines.clear();
    await db.routes.clear();
    await db.route_stops.clear();
    await db.sync_queue.clear();
}
