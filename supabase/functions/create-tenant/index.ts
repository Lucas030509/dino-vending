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
        // 1. Verificar que quien llama es Super Admin (Seguridad)
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) throw new Error('No autorizado')

        // Consultamos roles
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
        // 2. INICIA LA MAGIA (Usando Service Role Key PROPIO)
        // ---------------------------------------------------------
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('MY_SERVICE_ROLE_KEY') ?? ''
        )

        const { name, email } = await req.json() // YA NO EXIGIMOS PASSWORD

        // A. Crear Empresa (Tenant)
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .insert({ name: name })
            .select()
            .single()

        if (tenantError) throw tenantError

        // B. INVITAR Usuario Auth (ENVÍA EMAIL AUTOMÁTICO)
        // Supabase permite configurar la plantilla en el dashboard.
        const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { tenant_id: tenant.id }, // Se guarda en user_metadata
            redirectTo: 'https://dino-vending.vercel.app/' // Redirige al login/home tras poner pass
        })

        if (authError) {
            // Rollback: Si falla invitación, borrar empresa
            await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
            throw authError
        }

        // C. Vincular Profile
        if (newUser.user) {
            // Upsert para garantizar el link
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: newUser.user.id,
                    tenant_id: tenant.id,
                    role: 'admin',
                    email: email
                })

            if (profileError) console.error("Error linking profile:", profileError)
        }

        return new Response(
            JSON.stringify({
                success: true,
                tenant: tenant,
                user_id: newUser.user?.id,
                message: 'Empresa creada e invitación enviada exitosamente'
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
