import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'

export default function PhotoWall() {
  const { slug } = useParams()
  const [event, setEvent] = useState(null)
  const [uploads, setUploads] = useState([])
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const guestUrl = typeof window !== 'undefined' ? window.location.origin + '/e/' + slug : ''

  useEffect(() => {
    async function fetchEvent() {
      const { data } = await supabase.from('events').select('*').eq('slug', slug).single()
      if (!data) { setNotFound(true); return }
      setEvent(data)
    }
    fetchEvent()
  }, [slug])

  const fetchUploads = useCallback(async () => {
    if (!event) return
    const { data } = await supabase.from('uploads').select('*').eq('event_id', event.id).eq('status', 'approved').order('uploaded_at', { ascending: false })
    setUploads(data || [])
  }, [event])

  useEffect(() => { if (event) fetchUploads() }, [event, fetchUploads])

  useEffect(() => {
    if (!event) return
    const channel = supabase.channel('wall-' + event.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uploads', filter: 'event_id=eq.' + event.id },
        () => fetchUploads())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [event, fetchUploads])

  useEffect(() => {
    if (uploads.length <= 1 || paused) return
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % uploads.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [uploads.length, paused])

  useEffect(() => { setCurrent(0) }, [uploads.length])

  const brandColor = event?.brand_color || '#FF7A1A'

  if (notFound) return (
    <div className="min-h-screen bg-cream flex items-center justify-center text-center px-6">
      <div><div className="text-5xl mb-4">🔍</div><h2 className="text-xl font-bold">Event not found</h2></div>
    </div>
  )

  if (!event) return <div className="min-h-screen bg-cream flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>

  const currentUpload = uploads[current]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#1A1512' }}>
      <div className="flex items-center justify-between px-8 py-4 z-10" style={{ borderBottom: '1px solid ' + brandColor + '30' }}>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: brandColor }} />
          <span className="serif text-white text-xl">{event.title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: brandColor + '20', color: brandColor }}>LIVE</span>
        </div>
        <div className="flex items-center gap-4">
          {uploads.length > 1 && (
            <button onClick={() => setPaused(p => !p)} className="text-espresso-soft hover:text-white transition-colors text-sm flex items-center gap-1.5">
              {paused ? '▶ Play' : '⏸ Pause'}
            </button>
          )}
          <div className="text-espresso-soft text-sm">
            {uploads.length} photo{uploads.length !== 1 ? 's' : ''} shared
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative">
        {uploads.length === 0 ? (
          <div className="text-center">
            <div className="bg-white p-6 rounded-3xl inline-block mb-6">
              <QRCodeSVG value={guestUrl} size={200} fgColor="#0A0A0A" />
            </div>
            <h2 className="serif text-4xl text-white mb-3">Scan to share your photos</h2>
            <p className="text-espresso-soft text-lg">Point your phone camera at the code above</p>
          </div>
        ) : currentUpload ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {currentUpload.file_type === 'photo'
              ? <img src={currentUpload.file_url} alt="" className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl" style={{ maxHeight: 'calc(100vh - 200px)' }} />
              : <video src={currentUpload.file_url} autoPlay muted loop className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl" style={{ maxHeight: 'calc(100vh - 200px)' }} />
            }
            {(currentUpload.caption || currentUpload.uploader_name) && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-full text-sm backdrop-blur-sm max-w-lg text-center">
                {currentUpload.caption}
                {currentUpload.uploader_name && <span className="text-espresso-soft"> — {currentUpload.uploader_name}</span>}
              </div>
            )}
            {/* Mini QR in corner so people can always join */}
            <div className="absolute top-4 right-4 bg-white p-2 rounded-xl opacity-80">
              <QRCodeSVG value={guestUrl} size={64} fgColor="#0A0A0A" />
            </div>
          </div>
        ) : null}
      </div>

      {uploads.length > 1 && (
        <div className="px-8 pb-6">
          <div className="flex gap-2 overflow-x-auto pb-3 justify-center">
            {uploads.slice(0, 12).map((upload, i) => (
              <button key={upload.id} onClick={() => setCurrent(i)}
                className={'flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ' + (i === current ? 'scale-110' : 'opacity-50 border-transparent')}
                style={{ borderColor: i === current ? brandColor : 'transparent' }}>
                {upload.file_type === 'photo'
                  ? <img src={upload.file_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xl">🎥</div>
                }
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 justify-center mt-2">
            {uploads.slice(0, 20).map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ backgroundColor: i === current ? brandColor : '#333', transform: i === current ? 'scale(1.5)' : 'scale(1)' }} />
            ))}
          </div>
        </div>
      )}

      <div className="text-center pb-4 text-espresso-soft/60 text-xs">
        Powered by <a href="https://stacktlv.com" target="_blank" rel="noopener noreferrer" style={{ color: brandColor }} className="font-semibold">STACKT</a>
      </div>
    </div>
  )
}
