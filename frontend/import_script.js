
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/simonsanchez/Desktop/DINO/frontend/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function importLocations() {
    console.log("Authenticating as ale.reguero@gmail.com...");
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'ale.reguero@gmail.com',
        password: 'Lucas2026#'
    });

    if (loginError) {
        console.error("Login failed:", loginError.message);
        return;
    }

    const user = session.user;
    console.log("Logged in:", user.id);

    // Get Tenant ID
    let tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
        tenantId = profile?.tenant_id;
    }

    console.log("User Tenant ID:", tenantId);

    // --- FIX: SYNC PROFILE FOR RLS ---
    // Ensure the profile exists and has the correct tenant_id so that RLS policies using (SELECT tenant_id FROM profiles) work.
    if (user && tenantId) {
        console.log("Syncing Profile to ensure RLS access...");
        const { error: upsertError } = await supabase.from('profiles').upsert({
            id: user.id,
            email: session.user.email,
            tenant_id: tenantId,
            role: 'admin'
        }, { onConflict: 'id' }).select(); // select to return data and confirm consistency

        if (upsertError) {
            console.warn("⚠️ Warning: Profile sync failed. RLS might block inserts. Error:", upsertError.message);
        } else {
            console.log("Profile synced successfully.");
        }
    }
    // ---------------------------------

    // Read CSV
    const csvPath = '/Users/simonsanchez/Desktop/Imagenes/puntos_de_venta.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf8');

    Papa.parse(csvContent, {
        header: true,
        complete: async (results) => {
            const rows = results.data;
            console.log(`Found ${rows.length} rows in CSV.`);

            const locationsToInsert = [];

            for (const row of rows) {
                if (!row.name) continue;

                const csvTenantId = row.tenant_id ? row.tenant_id.trim() : null;

                // Use CSV tenant ID if available, else fallback to user's
                const targetTenantId = csvTenantId || tenantId;

                locationsToInsert.push({
                    tenant_id: targetTenantId,
                    name: row.name,
                    address: row.adress || row.address,
                    google_maps_url: row.google_maps_url,
                    district: row.district
                });
            }

            if (locationsToInsert.length > 0) {
                console.log(`Processing ${locationsToInsert.length} locations...`);

                const myTenantRows = locationsToInsert.filter(r => r.tenant_id === tenantId);
                const otherTenantRows = locationsToInsert.filter(r => r.tenant_id !== tenantId);

                // 1. Own Tenant
                if (myTenantRows.length > 0) {
                    console.log(`Checking ${myTenantRows.length} locations for current tenant (${tenantId})...`);
                    const { data: existingData } = await supabase.from('locations').select('name').eq('tenant_id', tenantId);
                    const existingNames = new Set(existingData?.map(l => l.name.toLowerCase().trim()) || []);
                    const toInsert = myTenantRows.filter(l => !existingNames.has(l.name.toLowerCase().trim()));

                    if (toInsert.length > 0) {
                        console.log(`Inserting ${toInsert.length} new locations for current tenant...`);
                        const { error } = await supabase.from('locations').insert(toInsert);
                        if (error) console.error("Error inserting my rows:", error);
                        else console.log(`Success! ${toInsert.length} locations inserted.`);
                    } else {
                        console.log("No new locations for current tenant (duplicates).");
                    }
                }

                // 2. Others
                if (otherTenantRows.length > 0) {
                    // This is expected to fail if User is not admin of those tenants?
                    // But maybe we are targeting Simon's rows here (valid for Simon, not Ale).
                    console.log(`Skipping ${otherTenantRows.length} locations belonging to other tenants.`);
                }
            } else {
                console.log("No valid locations found.");
            }
        }
    });
}

importLocations();
