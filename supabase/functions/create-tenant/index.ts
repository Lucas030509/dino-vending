// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Verificar que quien llama es Super Admin (Seguridad ante todo)
        // Obtenemos el cliente con el contexto del usuario actual
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) throw new Error('No autorizado')

        // Consultamos la tabla profiles para ver si es super_admin
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || profile.role !== 'super_admin') {
            return new Response(JSON.stringify({ error: 'No tienes permisos de Super Admin' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // ---------------------------------------------------------
        // 2. INICIA LA MAGIA (Usando Service Role Key)
        // ---------------------------------------------------------
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('MY_SERVICE_ROLE_KEY') ?? ''
        )

        const { name, email, password } = await req.json()

        // A. Crear Emrpesa (Tenant)
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .insert({ name: name })
            .select()
            .single()

        if (tenantError) throw tenantError

        // B. Crear Usuario Auth
        const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Confirmamos auto para que pueda entrar ya
            user_metadata: { tenant_id: tenant.id } // Guardamos referencia en metadata también
        })

        if (authError) {
            // Rollback: Si falla el usuario, borramos la empresa para no dejar basura
            await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
            throw authError
        }

        // C. Vincular Profile (Actualizar el profile que se crea automáticamente por trigger, O crearlo si no existe)
        // Nota: Si tienes un Trigger "on auth.users insert -> create profile", solo actualizamos.
        // Si no, lo insertamos. Haremos un upsert seguro.

        // Esperamos un poco (100ms) por si el trigger es asíncrono, aunque upsert maneja esto.
        if (newUser.user) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: newUser.user.id,
                    tenant_id: tenant.id,
                    role: 'admin', // El primer usuario de una empresa es Admin
                    email: email
                })

            if (profileError) console.error("Error linking profile:", profileError)
        }

        return new Response(
            JSON.stringify({
                success: true,
                tenant: tenant,
                user_id: newUser.user?.id,
                message: 'Empresa y Usuario creados exitosamente'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
