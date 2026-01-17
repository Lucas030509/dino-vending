
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '/Users/simonsanchez/Desktop/DINO/frontend/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMachineLinks() {
    console.log("Starting machine-location link fix...");

    // 1. Authenticate as Ale (since we are fixing her data mostly based on context)
    // Or Simon? The issue shown was "Alex Pizza Coyoacan" which sounds like Simon's data potentially?
    // Let's authenticate as Simon first as the user session in browser was simon.montero.junior@gmail.com.
    console.log("Authenticating as ale.reguero@gmail.com...");
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'ale.reguero@gmail.com',
        password: 'Lucas2026#'
    });

    if (loginError) {
        console.error("Login failed:", loginError);
        return;
    }
    let tenantId = session.user.user_metadata?.tenant_id;
    if (!tenantId) {
        console.log("Tenant ID missing in metadata, fetching from profiles...");
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        tenantId = profile?.tenant_id;
    }
    console.log("Tenant ID:", tenantId);

    // 2. Fetch all Locations for this tenant
    const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('id, name')
        .eq('tenant_id', tenantId);

    if (locError) {
        console.error("Error fetching locations:", locError);
        return;
    }
    console.log(`Found ${locations.length} locations active.`);

    // 3. Fetch all Machines for this tenant
    const { data: machines, error: machError } = await supabase
        .from('machines')
        .select('id, location_name, location_id, qr_code_uid')
        .eq('tenant_id', tenantId);

    if (machError) {
        console.error("Error fetching machines:", machError);
        return;
    }
    console.log(`Found ${machines.length} machines.`);

    let updatedCount = 0;

    // 4. Match and Update
    for (const machine of machines) {
        // Skip if already linked correctly (optional, but good for speed)
        // But maybe location_id is old/dead.
        // We trust location_name over id if id points to nowhere?
        // Actually, if location_name exists, let's ensure location_id points to it.

        if (!machine.location_name) continue;

        const cleanMacName = machine.location_name.trim().toLowerCase();

        // Find matching location
        const match = locations.find(l => l.name.trim().toLowerCase() === cleanMacName);

        if (match) {
            if (machine.location_id !== match.id) {
                console.log(`Relinking ${machine.qr_code_uid || 'Machine'}: "${machine.location_name}" -> ID: ${match.id}`);

                const { error } = await supabase
                    .from('machines')
                    .update({ location_id: match.id })
                    .eq('id', machine.id);

                if (error) console.error("Error updating machine:", error);
                else updatedCount++;
            }
        } else {
            console.log(`Warning: Machine ${machine.qr_code_uid} has location "${machine.location_name}" but no matching Location found in DB.`);
        }
    }

    console.log(`Finished. Updated ${updatedCount} machines.`);
}

fixMachineLinks();
