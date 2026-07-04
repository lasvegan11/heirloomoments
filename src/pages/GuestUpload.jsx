import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MAX_VIDEO_MB = 100
const MAX_PHOTO_MB = 25
const MAX_VIDEO_SECONDS = 60
const PHOTO_MAX_DIMENSION = 2000
const PHOTO_QUALITY = 0.82

async function compressImage(file) {
  if (file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

function getVideoDuration(file) {
  return new Promise(resolve => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration) }
    video.onerror = () => { URL.revokeObjectURL(video.src); resolve(0) }
    video.src = URL.createObjectURL(file)
  })
}

function getVideoPoster(file) {
  return new Promise(resolve => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      URL.revokeObjectURL(video.src)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null) }
    video.src = URL.createObjectURL(file)
  })
}

export default function GuestUpload() {
  const { slug } = useParams()
  const [event, setEvent] = useState(null)
  const [uploads, setUploads] = useState([])
  const [caption, setCaption] = useState('')
  const [guestName, setGuestName] = useState('')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const [shareMsg, setShareMsg] = useState('')
  const [processing, setProcessing] = useState(false)
  const [failedFiles, setFailedFiles] = useState([])
  const fileRef = useRef()

  const guestUrl = typeof window !== 'undefined' ? window.location.href : ''

  useEffect(() => { fetchEvent() }, [slug])

  async function fetchEvent() {
    const { data } = await supabase.from('events').select('*').eq('slug', slug).single()
    if (!data) { setNotFound(true); return }
    setEvent(data)
    fetchUploads(data.id)
  }

  async function fetchUploads(eventId) {
    const { data, count } = await supabase.from('uploads').select('*', { count: 'exact' })
      .eq('event_id', eventId).eq('status', 'approved').order('uploaded_at', { ascending: false }).limit(20)
    setUploads(data || [])
    setUploadCount(count || 0)
  }

  useEffect(() => {
    if (!event) return
    const channel = supabase.channel(`guest-${event.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'uploads', filter: `event_id=eq.${event.id}` },
        () => fetchUploads(event.id))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [event])

  async function handleFileChange(e) {
    const selected = Array.from(e.target.files)
    if (!selected.length) return
    setError('')
    setProcessing(true)
    const valid = []
    for (const f of selected) {
      const isVideo = f.type.startsWith('video')
      if (isVideo) {
        const duration = await getVideoDuration(f)
        if (duration > MAX_VIDEO_SECONDS) {
          setError('"' + f.name + '" is too long. Clips must be under ' + MAX_VIDEO_SECONDS + ' seconds.')
          continue
        }
        if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
          setError('"' + f.name + '" is too large. Videos must be under ' + MAX_VIDEO_MB + 'MB.')
          continue
        }
        const poster = await getVideoPoster(f)
        valid.push({ file: f, preview: URL.createObjectURL(f), poster, id: Math.random().toString(36).slice(2) })
      } else {
        const compressed = await compressImage(f)
        if (compressed.size > MAX_PHOTO_MB * 1024 * 1024) {
          setError('"' + f.name + '" is too large. Photos must be under ' + MAX_PHOTO_MB + 'MB.')
          continue
        }
        valid.push({ file: compressed, preview: URL.createObjectURL(compressed), id: Math.random().toString(36).slice(2) })
      }
    }
    setFiles(prev => [...prev, ...valid])
    setProcessing(false)
  }

  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  async function handleUpload() {
    if (!files.length || !event) return
    const { count } = await supabase.from('uploads').select('*', { count: 'exact', head: true }).eq('event_id', event.id)
    if (event.max_uploads < 999999 && count + files.length > event.max_uploads) {
      setError('This event allows ' + event.max_uploads + ' uploads total and is nearly full.'); return
    }
    setUploading(true); setError('')
    setProgress({ done: 0, total: files.length })
    const status = event.moderation_enabled ? 'pending' : 'approved'
    let done = 0
    const failed = []
    for (const item of files) {
      const { file } = item
      const ext = file.name.split('.').pop()
      const fileName = 'events/' + event.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
      const { error: storageError } = await supabase.storage.from('event-media').upload(fileName, file, { upsert: false })
      if (!storageError) {
        const { data: { publicUrl } } = supabase.storage.from('event-media').getPublicUrl(fileName)
        const fileType = file.type.startsWith('video') ? 'video' : 'photo'
        const { error: insertError } = await supabase.from('uploads').insert({
          event_id: event.id, file_url: publicUrl, file_type: fileType,
          caption: caption || null, uploader_name: guestName || null, status
        })
        if (insertError) failed.push(item)
      } else {
        failed.push(item)
      }
      done++
      setProgress({ done, total: files.length })
    }
    setFailedFiles(failed)
    setUploaded(true); setUploading(false)
  }

  function handleUploadAnother() {
    setFiles([]); setCaption(''); setUploaded(false); setError(''); setProgress({ done: 0, total: 0 }); setFailedFiles([])
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleRetryFailed() {
    setFiles(failedFiles)
    setFailedFiles([])
    setUploaded(false)
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text: 'Share your photos from ' + event.title + '!', url: guestUrl }) } catch {}
    } else {
      navigator.clipboard.writeText(guestUrl)
      setShareMsg('Link copied!')
      setTimeout(() => setShareMsg(''), 2000)
    }
  }

  const brandColor = event?.brand_color || '#FF7A1A'

  if (notFound) return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 text-center">
      <div><div className="text-5xl mb-4">🔍</div><h2 className="serif text-3xl mb-2">Event not found</h2><p className="text-espresso-soft">Double-check the link or QR code and try again.</p></div>
    </div>
  )

  if (!event) return <div className="min-h-screen bg-cream flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-cream pb-10">
      <div className="px-6 pt-10 pb-8 text-center relative" style={{ borderBottom: '2px solid ' + brandColor + '20' }}>
        <div className="w-3 h-3 rounded-full mx-auto mb-4" style={{ backgroundColor: brandColor }} />
        <h1 className="serif text-3xl mb-1">{event.title}</h1>
        {event.date && <p className="text-espresso-soft text-sm">{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>}
        <p className="text-espresso-soft text-xs mt-2">{uploadCount} moment{uploadCount !== 1 ? 's' : ''} shared</p>
        <button onClick={handleShare} className="absolute top-8 right-6 text-sm px-3 py-1.5 rounded-full border border-border hover:border-gold transition-colors">
          {shareMsg || '↗ Share'}
        </button>
      </div>

      <div className="px-6 py-8 max-w-md mx-auto">
        {uploaded ? (
          <div className="card text-center py-10">
            <div className="text-5xl mb-4">{failedFiles.length > 0 ? '⚠️' : '🎉'}</div>
            <h2 className="serif text-2xl mb-2">
              {failedFiles.length > 0
                ? (progress.total - failedFiles.length) + ' of ' + progress.total + ' shared'
                : (event.moderation_enabled ? progress.total + ' submitted for review!' : progress.total + ' moment' + (progress.total !== 1 ? 's' : '') + ' shared!')}
            </h2>
            <p className="text-espresso-soft text-sm mb-6">
              {failedFiles.length > 0
                ? failedFiles.length + ' failed to upload — check your connection and try again.'
                : (event.moderation_enabled ? 'They\'ll appear once approved by the host.' : 'They\'re now in the live album below.')}
            </p>
            {failedFiles.length > 0 ? (
              <button onClick={handleRetryFailed} className="btn-primary w-full" style={{ backgroundColor: brandColor }}>
                Retry {failedFiles.length} failed
              </button>
            ) : (
              <button onClick={handleUploadAnother} className="btn-primary w-full" style={{ backgroundColor: brandColor }}>
                Share more
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={handleFileChange} className="hidden" id="file-input" disabled={processing} />
            {files.length === 0 ? (
              <label htmlFor="file-input" className={'card flex flex-col items-center justify-center py-16 transition-colors ' + (processing ? 'opacity-50' : 'cursor-pointer hover:border-gold')}>
                <div className="text-5xl mb-4">{processing ? '⏳' : '📸'}</div>
                <p className="font-semibold mb-1">{processing ? 'Processing…' : 'Tap to add photos or videos'}</p>
                <p className="text-espresso-soft text-sm">{processing ? 'Just a moment' : 'Select as many as you want'}</p>
              </label>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {files.map(item => (
                    <div key={item.id} className="relative aspect-square">
                      {item.file.type.startsWith('video')
                        ? <video src={item.preview} poster={item.poster || undefined} muted playsInline controls className="w-full h-full object-cover rounded-xl" />
                        : <img src={item.preview} alt="" className="w-full h-full object-cover rounded-xl" />
                      }
                      <button onClick={() => removeFile(item.id)}
                        className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">✕</button>
                    </div>
                  ))}
                  <label htmlFor="file-input" className={'aspect-square border-2 border-dashed border-border rounded-xl flex items-center justify-center transition-colors text-2xl text-espresso-soft ' + (processing ? 'opacity-50' : 'cursor-pointer hover:border-gold')}>
                    {processing ? '⏳' : '+'}
                  </label>
                </div>
                <p className="text-espresso-soft text-xs text-center">{files.length} selected</p>
                <input className="input" placeholder="Your name (optional)" value={guestName} onChange={e => setGuestName(e.target.value)} maxLength={50} />
                <input className="input" placeholder="Add a caption (optional)" value={caption} onChange={e => setCaption(e.target.value)} maxLength={200} />
              </>
            )}
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            {files.length > 0 && (
              <button onClick={handleUpload} disabled={uploading} className="btn-primary w-full py-4 text-lg" style={{ backgroundColor: brandColor }}>
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading {progress.done}/{progress.total}…
                  </span>
                ) : 'Share ' + files.length + ' moment' + (files.length !== 1 ? 's' : '') + ' ✨'}
              </button>
            )}
          </div>
        )}
      </div>

      {uploads.length > 0 && (
        <div className="px-6 max-w-md mx-auto">
          <h3 className="text-sm font-semibold text-espresso-soft mb-4">Live from the event · {uploadCount} total</h3>
          <div className="columns-2 gap-3 space-y-3">
            {uploads.map(upload => (
              <div key={upload.id} className="break-inside-avoid">
                {upload.file_type === 'photo'
                  ? <img src={upload.file_url} alt={upload.caption || ''} className="w-full rounded-xl" />
                  : <video src={upload.file_url} controls className="w-full rounded-xl" />
                }
                {(upload.caption || upload.uploader_name) && (
                  <p className="text-xs text-espresso-soft mt-1 px-1">
                    {upload.caption}{upload.uploader_name && <span className="text-espresso-soft"> · {upload.uploader_name}</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center mt-10 text-espresso-soft text-xs">
        Powered by <a href="https://stacktlv.com" target="_blank" rel="noopener noreferrer" style={{ color: brandColor }} className="font-semibold">STACKT</a>
      </div>
    </div>
  )
}
