import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, slugify, PLAN_LIMITS } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// Prices in dollars, for display only. Actual charge amount is set
// server-side in api/create-checkout-session.js — keep both in sync.
const PLAN_PRICES = { free: '$19', plus: '$39', pro: '$99' }

export default function NewEvent() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [brandColor, setBrandColor] = useState('#FF7A1A')
  const [moderation, setModeration] = useState(false)
  const [plan, setPlan] = useState('free')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const limits = PLAN_LIMITS[plan]

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const slug = slugify(title)
    const { data, error } = await supabase.from('events').insert({
      host_id: user.id,
      title,
      date: date || null,
      slug,
      brand_color: brandColor,
      moderation_enabled: moderation,
      max_uploads: limits.max_uploads,
      retention_days: limits.retention_days,
      payment_status: 'pending',
      plan,
    }).select().single()

    if (error) { setError(error.message); setLoading(false); return }

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: data.id, slug: data.slug, plan, eventTitle: data.title,
          origin: window.location.origin,
        }),
      })
      const session = await res.json()
      if (!res.ok || !session.url) throw new Error(session.error || 'Could not start checkout')
      window.location.href = session.url
    } catch {
      navigate(`/dashboard/events/${data.slug}`)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4 max-w-6xl mx-auto">
        <Link to="/dashboard" className="text-espresso-soft hover:text-espresso transition-colors">← Dashboard</Link>
        <span className="serif text-lg tracking-wide">Share <span className="text-gold">2</span> Share</span>
      </header>
      <main className="max-w-xl mx-auto px-6 py-12">
        <h1 className="serif text-4xl mb-2">Create an event</h1>
        <p className="text-espresso-soft mb-8">Your QR code will be ready right after payment</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Event title *</label>
            <input className="input" placeholder="e.g. Maria & Carlos Wedding" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Event date</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Brand color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-12 h-12 rounded-xl border border-border cursor-pointer bg-cream-deep" />
              <input className="input" value={brandColor} onChange={e => setBrandColor(e.target.value)} placeholder="#FF7A1A" />
            </div>
          </div>
          <div className="flex items-center justify-between card">
            <div>
              <div className="font-medium">Moderation</div>
              <div className="text-espresso-soft text-sm">Review uploads before they appear publicly</div>
            </div>
            <button type="button" onClick={() => setModeration(!moderation)}
              className={`w-12 h-6 rounded-full transition-colors relative ${moderation ? 'bg-gold' : 'bg-border'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${moderation ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Choose a plan</label>
            <div className="grid grid-cols-3 gap-3">
              {['free', 'plus', 'pro'].map(key => {
                const l = PLAN_LIMITS[key]
                const selected = plan === key
                return (
                  <button type="button" key={key} onClick={() => setPlan(key)}
                    className={`card text-center py-4 ${selected ? 'border-gold' : ''}`}>
                    <div className="uppercase tracking-widest text-xs text-espresso-soft mb-2">{l.label}</div>
                    <div className="serif text-2xl mb-2">{PLAN_PRICES[key]}</div>
                    <div className="text-espresso-soft text-xs">{l.max_uploads === 999999 ? 'Unlimited' : l.max_uploads} uploads</div>
                    <div className="text-espresso-soft text-xs">{l.retention_days}-day storage</div>
                  </button>
                )
              })}
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Redirecting to payment…' : `Continue to payment (${PLAN_PRICES[plan]}) →`}
          </button>
        </form>
      </main>
    </div>
  )
}
