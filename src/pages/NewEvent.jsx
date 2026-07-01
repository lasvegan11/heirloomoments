import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, slugify, PLAN_LIMITS } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function NewEvent() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [brandColor, setBrandColor] = useState('#FF7A1A')
  const [moderation, setModeration] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const plan = profile?.plan || 'free'
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
    }).select().single()
    if (error) { setError(error.message); setLoading(false) }
    else navigate(`/dashboard/events/${data.slug}`)
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4 max-w-6xl mx-auto">
        <Link to="/dashboard" className="text-espresso-soft hover:text-espresso transition-colors">← Dashboard</Link>
        <span className="serif text-lg tracking-wide">Heirloo<span className="text-gold">moments</span></span>
      </header>
      <main className="max-w-xl mx-auto px-6 py-12">
        <h1 className="serif text-4xl mb-2">Create an event</h1>
        <p className="text-espresso-soft mb-8">Your QR code will be ready instantly</p>
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
          <div className="card bg-gold/5 border-gold/20">
            <div className="text-sm text-espresso-soft">
              <span className="text-gold font-semibold capitalize">{plan}</span> plan limits: {limits.max_uploads === 999999 ? 'Unlimited' : limits.max_uploads} uploads · {limits.retention_days}-day storage
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Create event & get QR code →'}
          </button>
        </form>
      </main>
    </div>
  )
}
