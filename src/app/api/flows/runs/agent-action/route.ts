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
    action?: 'confirm_payment' | 'dispatch_order' | 'toggle_pause'
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

  if (body.action === 'toggle_pause') {
    const isCurrentlyPaused = !!run.vars?.is_paused
    let updatedVars = { ...(run.vars || {}) }

    function getLocalISODate(date: Date): string {
      const offset = 5.5 * 60 * 60 * 1000
      const istDate = new Date(date.getTime() + offset)
      return istDate.toISOString().split('T')[0]
    }

    function getDatesBetween(startDateStr: string, endDateStr: string): string[] {
      const start = new Date(startDateStr)
      const end = new Date(endDateStr)
      const dates: string[] = []
      start.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      while (start <= end) {
        dates.push(getLocalISODate(start))
        start.setDate(start.getDate() + 1)
      }
      return dates
    }

    if (isCurrentlyPaused) {
      // Resume
      let pausedDates = [...(run.vars?.paused_dates || [])]
      if (run.vars?.paused_at) {
        const pausedAtDate = getLocalISODate(new Date(run.vars.paused_at))
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = getLocalISODate(yesterday)
        
        if (pausedAtDate <= yesterdayStr) {
          const dates = getDatesBetween(run.vars.paused_at, yesterdayStr)
          pausedDates = Array.from(new Set([...pausedDates, ...dates]))
        }
      }
      updatedVars.is_paused = false
      updatedVars.paused_at = null
      updatedVars.paused_dates = pausedDates
    } else {
      // Pause
      updatedVars.is_paused = true
      updatedVars.paused_at = new Date().toISOString()
    }

    const { error: updateErr } = await admin
      .from('flow_runs')
      .update({
        vars: updatedVars,
      })
      .eq('id', run.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, is_paused: updatedVars.is_paused })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
