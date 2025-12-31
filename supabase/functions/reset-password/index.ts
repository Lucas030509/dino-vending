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
        // 1. Auth Check (Super Admin Only)
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

        const { target_tenant_id, new_password } = await req.json()

        if (!target_tenant_id || !new_password) throw new Error('Faltan datos')

        // Buscar el usuario asociado a ese Tenant (Asumimos 1 admin por tenant por ahora)
        // Opcional: Podríamos recibir el user_id directo, pero tenant_id es más seguro desde el UI actual
        const { data: targetProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .eq('tenant_id', target_tenant_id)
            .eq('role', 'admin') // Filtramos al admin principal
            .single() // Asumimos uno principal

        if (profileError || !targetProfile) throw new Error('No se encontró un admin para este cliente')

        console.log(`Reseteando password para: ${targetProfile.email} (${targetProfile.id})`)

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            targetProfile.id,
            { password: new_password }
        )

        if (updateError) throw updateError

        return new Response(
            JSON.stringify({
                success: true,
                message: `Contraseña actualizada para ${targetProfile.email}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        console.error("Reset Error:", error)
        return new Response(JSON.stringify({
            error: error.message || 'Error desconocido'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
