import { supabase } from './supabase';
import { db, bulkSave } from './db';

/**
 * Synchronizes data from Supabase to local Dexie DB.
 * Should be called on app start and periodically when online.
 */
export async function syncFromSupabase() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // Not logged in

        // 1. Get Tenant ID (Assuming it's in metadata or we fetch it)
        // Ideally we fetch profiles once and store locally too, but let's keep it simple for now
        // This query mimics the logic in RoutePlanner
        let tenantId = user.user_metadata?.tenant_id;
        if (!tenantId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('id', user.id)
                .single();
            tenantId = profile?.tenant_id;
        }

        if (!tenantId) return;

        console.log("🔄 Starting Sync for Tenant:", tenantId);

        // 1.5 Fetch Locations (New Architecture)
        const { data: locations, error: locError } = await supabase
            .from('locations')
            .select('id, name, address, district, tenant_id')
            .eq('tenant_id', tenantId);

        if (locations && !locError) {
            await bulkSave('locations', locations);
            console.log(`✅ Synced ${locations.length} locations`);
        } else if (locError) {
            console.error("Error syncing locations", locError);
        }

        // 2. Fetch Machines (Now linked to Locations)
        const { data: machines, error: machinesError } = await supabase
            .from('machines')
            .select('*')
            .eq('current_status', 'Active')
            .eq('tenant_id', tenantId); // Important: Filter by tenant to avoid leaking data

        if (machines && !machinesError) {
            await bulkSave('machines', machines);
            console.log(`✅ Synced ${machines.length} machines`);
        } else if (machinesError) {
            console.error("Error syncing machines", machinesError);
        }

        // 3. Fetch Routes
        const { data: routes, error: routesError } = await supabase
            .from('routes')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('scheduled_date', { ascending: false })
            .limit(50); // Sync recent routes only to save space

        if (routes && !routesError) {
            await bulkSave('routes', routes);
            console.log(`✅ Synced ${routes.length} routes`);
        }

        // 4. Fetch Route Stops (for the synced routes)
        if (routes && routes.length > 0) {
            const routeIds = routes.map(r => r.id);
            const { data: stops, error: stopsError } = await supabase
                .from('route_stops')
                .select('*')
                .in('route_id', routeIds);

            if (stops && !stopsError) {
                await bulkSave('route_stops', stops);
                console.log(`✅ Synced ${stops.length} stops`);
            }
        }

        // 5. Fetch Collections (Refills & Cuts) - Limit 100
        const { data: collections, error: collError } = await supabase
            .from('collections')
            .select('*, machines(location_name, address)') // Include JOIN for local display
            .eq('tenant_id', tenantId)
            .order('collection_date', { ascending: false })
            .limit(100);

        if (collections && !collError) {
            // Flatten the joined data slightly for easier indexing/usage if needed, 
            // but Dexie stores raw objects fine. We might need to handle the join manually in UI or store flat.
            // For simplicity, store as is.
            await bulkSave('collections', collections);
            console.log(`✅ Synced ${collections.length} collections`);
        }

        // 6. Fetch Pending Reports
        const { data: reports, error: repError } = await supabase
            .from('reports')
            .select('*')
            .eq('tenant_id', tenantId)
            .in('status', ['pending', 'in_progress'])
            .limit(50);

        if (reports && !repError) {
            await bulkSave('reports', reports);
            console.log(`✅ Synced ${reports.length} reports`);
        }

    } catch (e) {
        console.error("Sync failed:", e);
    }
}

/**
 * Adds an item to the sync queue and performs an optimistic update on local DB.
 * @param {string} table Name of the table (e.g., 'routes', 'route_stops')
 * @param {string} actionType 'INSERT' | 'UPDATE' | 'DELETE'
 * @param {object} payload The data to be sent
 */
export async function addToSyncQueue(table, actionType, payload) {
    try {
        // 1. Optimistic Local Update
        if (actionType === 'INSERT') {
            await db.table(table).put(payload);
        } else if (actionType === 'UPDATE') {
            await db.table(table).update(payload.id, payload);
        } else if (actionType === 'DELETE') {
            await db.table(table).delete(payload.id);
        }

        // 2. Add to Queue
        await db.sync_queue.add({
            table_name: table,
            action_type: actionType,
            payload: payload,
            status: 'pending',
            created_at: new Date().toISOString()
        });

        console.log(`📥 Queued ${actionType} for ${table}`);

        // 3. Try processing immediately (if online)
        if (navigator.onLine) {
            processSyncQueue();
        }

    } catch (e) {
        console.error("Error adding to sync queue:", e);
        throw e; // Propagate to UI to show error if needed
    }
}

/**
 * Processes the sync queue, sending pending items to Supabase.
 */
export async function processSyncQueue() {
    if (!navigator.onLine) return;

    try {
        const pendingItems = await db.sync_queue
            .where('status').equals('pending')
            .sortBy('created_at');

        if (pendingItems.length === 0) return;

        console.log(`🔄 Processing ${pendingItems.length} queue items...`);

        for (const item of pendingItems) {
            try {
                let error = null;

                if (item.action_type === 'INSERT') {
                    const { error: insertError } = await supabase.from(item.table_name).insert(item.payload);
                    error = insertError;
                } else if (item.action_type === 'UPDATE') {
                    // Exclude ID from payload for update match, or handle carefully
                    const { id, ...updates } = item.payload;
                    const { error: updateError } = await supabase.from(item.table_name).update(updates).eq('id', id);
                    error = updateError;
                } else if (item.action_type === 'DELETE') {
                    const { error: deleteError } = await supabase.from(item.table_name).delete().eq('id', item.payload.id);
                    error = deleteError;
                }

                if (error) throw error;

                // Success: Remove from queue
                await db.sync_queue.delete(item.id);
                console.log(`✅ Synced item ${item.id} (${item.table_name})`);

            } catch (itemError) {
                console.error(`❌ Global Sync Error for item ${item.id}:`, itemError);
                // Optional: Mark as 'failed' or implementing retry logic later
                // For now, we leave it 'pending' to retry next time
            }
        }
    } catch (e) {
        console.error("Queue processing failed:", e);
    }
}
