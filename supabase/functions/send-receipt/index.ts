import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { collection_id } = await req.json()

    if (!collection_id) throw new Error('Falta collection_id')

    // 1. Obtener datos del corte y de la máquina
    const { data: collection, error: colError } = await supabase
      .from('collections')
      .select('*, machines(*)')
      .eq('id', collection_id)
      .single()

    if (colError || !collection) throw new Error('Corte no encontrado')

    const machine = collection.machines
    const contactEmail = machine.contact_email

    if (!contactEmail) {
      return new Response(JSON.stringify({ message: 'La máquina no tiene email de contacto' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. Preparar datos para el correo
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('Falta RESEND_API_KEY')
      throw new Error('Servidor de correo no configurado (Falta API Key)')
    }

    const formattedDate = new Date(collection.collection_date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    // Links de evidencia (asegurándonos que sean accesibles)
    // Nota: Asumimos que las URLs guardadas son públicas o firmadas.
    // Si son del bucket público 'collection-evidence', son accesibles directamente.
    const photoHtml = collection.evidence_photo_url
      ? `<div style="margin-bottom: 20px;">
           <p style="margin-bottom: 5px; color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold;">Foto del Contador</p>
           <img src="${collection.evidence_photo_url}" alt="Evidencia Contador" style="max-width: 100%; border-radius: 8px; border: 1px solid #eee;">
         </div>`
      : ''

    const signatureHtml = collection.evidence_signature_url
      ? `<div style="margin-top: 20px;">
           <p style="margin-bottom: 5px; color: #666; font-size: 12px; text-transform: uppercase; font-weight: bold;">Conformidad (Firma)</p>
           <img src="${collection.evidence_signature_url}" alt="Firma" style="max-height: 80px; border: 1px dashed #ccc; padding: 10px; border-radius: 4px; background: #fff;">
         </div>`
      : ''

    // 3. HTML del Correo (Ticket Style - Conditional)
    const isRent = machine.contract_type === 'rent'
    const reportTitle = isRent ? 'Comprobante de Servicio' : 'Recibo de Corte'

    let financialDetailsHtml = ''

    if (isRent) {
      // Mensaje simple para Renta
      financialDetailsHtml = `
        <div style="background: #ecfdf5; color: #065f46; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #a7f3d0;">
            <p style="margin: 0; font-weight: bold; font-size: 16px;">✅ Servicio Completado</p>
            <p style="margin: 8px 0 0 0; font-size: 13px;">La máquina ha sido visitada, rellenada y verificada correctamente.</p>
        </div>
       `
    } else {
      // Detalle financiero para Comisión
      financialDetailsHtml = `
          <div class="row">
            <span class="label">Monto Recolectado</span>
            <span class="value">$${collection.gross_amount.toFixed(2)}</span>
          </div>
          
          <div class="divider"></div>

          <div class="row">
             <span class="label">Comisión Pactada</span>
             <span class="value">${collection.commission_percent_snapshot}%</span>
          </div>

          <div class="total-row">
            <span>A Pagar (Comisión):</span>
            <span class="highlight">$${collection.commission_amount.toFixed(2)}</span>
          </div>
       `
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; padding: 20px; }
          .ticket { max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e4e4e7; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px dashed #f4f4f5; padding-bottom: 20px; }
          .title { font-size: 18px; font-weight: 800; color: #18181b; margin: 0; }
          .subtitle { color: #71717a; font-size: 14px; margin-top: 5px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
          .label { color: #71717a; }
          .value { font-weight: 600; color: #27272a; text-align: right; }
          .divider { height: 1px; background: #e4e4e7; margin: 15px 0; }
          .total-row { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 2px solid #18181b; font-size: 16px; font-weight: 800; }
          .highlight { color: #059669; }
          .expense { color: #dc2626; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #a1a1aa; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <h1 class="title">${reportTitle}</h1>
            <p class="subtitle">${machine.location_name}</p>
            <p style="font-size: 12px; color: #a1a1aa; margin: 0;">${formattedDate}</p>
          </div>

          ${financialDetailsHtml}


          <div style="margin-top: 25px; background: #f8fafc; padding: 15px; border-radius: 8px;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b; font-weight: bold;">DETALLES OPERATIVOS</p>
            <div class="row" style="margin:0;">
                <span class="label" style="font-size: 12px;">Unidades Vendidas (Est.)</span>
                <span class="value" style="font-size: 12px;">${collection.units_sold} u</span>
            </div>
            <div class="row" style="margin:5px 0 0 0;">
                <span class="label" style="font-size: 12px;">Próxima Visita (Est.)</span>
                <span class="value" style="font-size: 12px;">${new Date(collection.next_visit_date).toLocaleDateString()}</span>
            </div>
          </div>

          <div style="margin-top: 25px;">
            ${photoHtml}
            ${signatureHtml}
          </div>

          <div class="footer">
            <p>Generado automáticamente por DinoVending 🦖</p>
          </div>
        </div>
      </body>
      </html>
    `

    // 4. Enviar usando Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'DinoVending <onboarding@resend.dev>', // O tu dominio verificado si tienes uno
        to: [contactEmail],
        subject: `Recibo de Corte - ${machine.location_name}`,
        html: htmlContent
      })
    })

    const emailData = await res.json()

    if (!res.ok) {
      console.error('Error Resend:', emailData)
      throw new Error('Error enviando correo: ' + JSON.stringify(emailData))
    }

    return new Response(JSON.stringify(emailData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
