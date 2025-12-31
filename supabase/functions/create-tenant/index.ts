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

        // B. Crear Usuario (Estrategia "Silent Create" para evitar errores de SMTP/Rate Limit)
        console.log(`Creando/Buscando usuario: ${email}`)

        let targetUserId = null;

        // 1. Intentamos crear usuario nuevo (Confirmado automáticamente)
        const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            email_confirm: true, // Confirmado directo
            user_metadata: { tenant_id: tenant.id }
        })

        if (createError) {
            // Si falla, verificamos si es porque ya existe
            console.log("Error creando usuario, verificando existencia...", createError.message)

            // Nota: createUser devuelve error si ya existe. Buscamos y vinculamos.
            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
            const existingUser = users.find(u => u.email === email)

            if (existingUser) {
                console.log("Usuario ya existe. Vinculando ID:", existingUser.id)
                targetUserId = existingUser.id
            } else {
                // Error real (ej. email inválido) -> Rollback
                console.error("Error fatal creando usuario:", createError)
                await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
                throw createError
            }
        } else {
            targetUserId = createdUser.user.id
            console.log("Usuario creado con éxito (Silent). ID:", targetUserId)
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
            if (profileError) console.error("Error linking profile:", profileError)
        }

        return new Response(
            JSON.stringify({
                success: true,
                tenant: tenant,
                user_id: targetUserId,
                message: 'Empresa registrada. El usuario ha sido dado de alta exitosamente.'
            }),
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
