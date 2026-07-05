import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchEvents()
  }, [user])

  async function fetchEvents() {
    const { data } = await supabase
      .from('events')
      .select('*, uploads(count)')
      .eq('host_id', user.id)
      .order('created_at', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/" className="serif text-xl tracking-wide">Share <span className="text-gold">2</span> Share</Link>
        <div className="flex items-center gap-4">
          <span className="text-espresso-soft text-sm hidden md:block">{profile?.email || user?.email}</span>
          <button onClick={handleSignOut} className="text-espresso-soft hover:text-espresso text-sm transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="serif text-4xl">Your Events</h1>
            <p className="text-espresso-soft mt-1">Manage your photo sharing events</p>
          </div>
          <Link to="/dashboard/events/new" className="btn-primary">+ New Event</Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>
        ) : events.length === 0 ? (
          <div className="card text-center py-20">
            <div className="text-5xl mb-4">📸</div>
            <h3 className="text-xl font-bold mb-2">No events yet</h3>
            <p className="text-espresso-soft mb-6">Create your first event and start collecting moments</p>
            <Link to="/dashboard/events/new" className="btn-primary inline-block">Create your first event</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => (
              <Link key={event.id} to={`/dashboard/events/${event.slug}`} className="card hover:border-gold transition-colors group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-3 h-3 rounded-full mt-1" style={{ backgroundColor: event.brand_color || '#FF7A1A' }} />
                  <span className="text-xs text-espresso-soft">{new Date(event.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="serif text-xl mb-1 group-hover:text-gold transition-colors">{event.title}</h3>
                <p className="text-espresso-soft text-sm mb-4">{event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'No date set'}</p>
                <div className="flex items-center gap-3 text-xs text-espresso-soft flex-wrap">
                  <span>📷 {event.uploads?.[0]?.count || 0} uploads</span>
                  {event.moderation_enabled && <span>🔍 Moderation on</span>}
                  {event.payment_status === 'pending' && <span className="text-yellow-600 font-semibold">⚠ Payment pending</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
