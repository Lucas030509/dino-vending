// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        // 1. Auth Check (Super Admin)
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) throw new Error('No autorizado')

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'super_admin') throw new Error('Requiere Super Admin')

        // 2. Admin Logic
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('MY_SERVICE_ROLE_KEY') ?? ''
        )

        const { name, email } = await req.json()

        // A. Crear Tenant
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .insert({ name: name })
            .select()
            .single()

        if (tenantError) throw tenantError

        let targetUserId = null
        let message = 'Empresa creada e invitación enviada.'

        // B. Intentar Invitar o Buscar Usuario
        console.log(`Procesando usuario: ${email}`)

        try {
            const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
                data: { tenant_id: tenant.id },
                redirectTo: 'https://dino-vending.vercel.app/'
            })

            if (inviteError) throw inviteError
            targetUserId = newUser.user.id

        } catch (inviteErr: any) {
            console.log("Error invitando (posiblemente ya existe):", inviteErr)

            // Si falla, buscamos si el usuario YA EXISTE
            // Nota: listUsers es seguro con service_role
            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
            const existingUser = users.find(u => u.email === email)

            if (existingUser) {
                console.log("Usuario ya existe. Vinculando ID:", existingUser.id)
                targetUserId = existingUser.id
                message = 'Empresa creada. El usuario ya existía, se le ha dado acceso.'
            } else {
                // Error real (ej. rate limit, email inválido) -> Rollback
                await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
                throw inviteErr // Re-lanzar error original
            }
        }

        // C. Vincular/Actualizar Profile
        if (targetUserId) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: targetUserId,
                    tenant_id: tenant.id,
                    role: 'admin',
                    email: email
                })
            if (profileError) throw profileError
        }

        return new Response(
            JSON.stringify({ success: true, tenant, message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        console.error("Critical Error:", error)
        return new Response(JSON.stringify({
            error: error.message || 'Error desconocido'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
