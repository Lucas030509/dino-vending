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

        const { name, email, password } = await req.json()

        if (!password) throw new Error('La contraseña es obligatoria en modo manual')

        // A. Crear Tenant
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .insert({ name: name })
            .select()
            .single()

        if (tenantError) throw tenantError

        let targetUserId = null

        // B. Crear Usuario con Password Manual
        console.log(`Creando usuario manual: ${email}`)

        const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { tenant_id: tenant.id }
        })

        if (createError) {
            // Si falla, verificamos si es porque ya existe
            console.log("Error creando usuario, verificando existencia...", createError.message)

            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
            const existingUser = users.find(u => u.email === email)

            if (existingUser) {
                console.log("Usuario ya existe. Vinculando y ACTUALIZANDO PASSWORD para ID:", existingUser.id)
                targetUserId = existingUser.id

                // IMPORTANTE: Forzamos la actualización de contraseña para que coincida con lo que el Admin escribió
                const { error: updatePassError } = await supabaseAdmin.auth.admin.updateUserById(
                    existingUser.id,
                    { password: password }
                )
                if (updatePassError) console.error("Error actualizando password de usuario existente:", updatePassError)

            } else {
                console.error("Error fatal creando usuario:", createError)
                await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
                throw createError
            }
        } else {
            targetUserId = createdUser.user.id
            console.log("Usuario creado con éxito. ID:", targetUserId)
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
                message: 'Cliente creado exitosamente. Entrega las credenciales al usuario.'
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
