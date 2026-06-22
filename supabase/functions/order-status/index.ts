// Public order lookup for the customer confirmation / status page.
// POST { session_id } -> the single matching order's NON-sensitive fields, or null.
//
// Keyed by the Stripe Checkout Session id, a long unguessable token only the buyer
// holds, so no extra auth is needed. We deliberately do NOT accept the (guessable)
// pickup code here, and we never return phone or any other order's data — this avoids
// order enumeration while letting a customer (re)open their own order via a saved link.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { session_id } = await req.json()
    if (typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
      return new Response(JSON.stringify({ error: 'invalid session_id' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Only safe-to-show columns — no phone, no Stripe ids, no fee/net.
    const { data, error } = await supabase
      .from('orders')
      .select('pickup_code, status, items, subtotal, tax, total, pickup_date, pickup_time, customer_name, note, created_at')
      .eq('stripe_session_id', session_id)
      .maybeSingle()
    if (error) throw new Error(error.message)

    // null = order not in the DB yet (webhook still processing) — the client retries.
    return new Response(JSON.stringify({ order: data ?? null }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
