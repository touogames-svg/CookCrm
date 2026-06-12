import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'

async function requireUser(): Promise<
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; status: number; body: { error: string } }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } }
  }
  return { ok: true, userId: user.id, supabase }
}

export async function POST(request: Request) {
  const guard = await requireUser()
  if (!guard.ok) {
    return NextResponse.json(guard.body, { status: guard.status })
  }

  const body = (await request.json().catch(() => null)) as {
    runId?: string
    action?: 'confirm_payment' | 'dispatch_order'
    paymentRef?: string
    riderName?: string
    trackingLink?: string
  } | null

  if (!body || !body.runId || !body.action) {
    return NextResponse.json({ error: 'Missing runId or action' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // Fetch the run to ensure it exists and matches
  const { data: run, error: runErr } = await admin
    .from('flow_runs')
    .select('*')
    .eq('id', body.runId)
    .maybeSingle()

  if (runErr || !run) {
    return NextResponse.json({ error: runErr?.message || 'Run not found' }, { status: 404 })
  }

  if (body.action === 'confirm_payment') {
    if (!body.paymentRef) {
      return NextResponse.json({ error: 'Missing paymentRef' }, { status: 400 })
    }

    const { error: updateErr } = await admin
      .from('flow_runs')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        end_reason: 'payment_verified_by_agent',
        vars: {
          ...(run.vars || {}),
          payment_ref: body.paymentRef.trim(),
        },
      })
      .eq('id', run.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (body.action === 'dispatch_order') {
    if (!body.riderName || !body.trackingLink) {
      return NextResponse.json({ error: 'Missing riderName or trackingLink' }, { status: 400 })
    }

    const { error: updateErr } = await admin
      .from('flow_runs')
      .update({
        vars: {
          ...(run.vars || {}),
          dispatched: true,
          rider_name: body.riderName,
          tracking_link: body.trackingLink,
          dispatched_at: new Date().toISOString(),
        },
      })
      .eq('id', run.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
