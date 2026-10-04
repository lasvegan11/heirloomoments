import { useEffect, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import JSZip from 'jszip'
import { supabase, PLAN_LIMITS } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// "Download all" zips this many files per click, and "Save to Photos" shares
// this many per tap. Kept modest so a big event (180+ files) never builds one
// giant zip in memory — that crashes phones, especially iPhones.
const DOWNLOAD_BATCH = 30
const SHARE_BATCH = 8

// Real file extension from a storage URL (so downloads/saves keep .jpg/.mov/etc).
function uploadExt(url) {
  const ext = (url || '').split('?')[0].split('.').pop()
  return ext && ext.length <= 5 ? ext.toLowerCase() : 'jpg'
}

export default function EventManage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [payingNow, setPayingNow] = useState(false)
  // batched "Download all" + iOS "Save to Photos"
  const [partIndex, setPartIndex] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [canShareFiles, setCanShareFiles] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [shareIndex, setShareIndex] = useState(0)
  const [readyFiles, setReadyFiles] = useState([])
  const [readySet, setReadySet] = useState(-1)
  const [deletingId, setDeletingId] = useState('')
  const [deduping, setDeduping] = useState(false)
  const [dedupeMsg, setDedupeMsg] = useState('')

  const guestUrl = `${window.location.origin}/e/${slug}`

  const fetchEvent = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').eq('slug', slug).eq('host_id', user.id).single()
    if (!data) { navigate('/dashboard'); return }
    setEvent(data)
  }, [slug, user, navigate])

  const fetchUploads = useCallback(async () => {
    if (!event) return
    const { data } = await supabase.from('uploads').select('*').eq('event_id', event.id).order('uploaded_at', { ascending: false })
    setUploads(data || [])
    setLoading(false)
  }, [event])

  useEffect(() => { fetchEvent() }, [fetchEvent])
  useEffect(() => { if (event) fetchUploads() }, [event, fetchUploads])

  // Realtime subscription for new uploads
  useEffect(() => {
    if (!event) return
    const channel = supabase.channel(`event-${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uploads', filter: `event_id=eq.${event.id}` },
        () => fetchUploads())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [event, fetchUploads])

  // Realtime subscription so payment_status flips to 'paid' automatically once the Stripe webhook lands
  useEffect(() => {
    if (!event) return
    const channel = supabase.channel(`event-status-${event.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${event.id}` },
        payload => setEvent(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [event?.id])

  // Can this device hand image files to the OS share sheet? (iPhone/iPad → Photos app)
  useEffect(() => {
    try {
      const probe = new File(['a'], 'a.jpg', { type: 'image/jpeg' })
      if (navigator.canShare && navigator.canShare({ files: [probe] })) setCanShareFiles(true)
    } catch {}
  }, [])

  async function handleCompletePayment() {
    setPayingNow(true)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id, slug: event.slug, plan: event.plan, eventTitle: event.title,
          origin: window.location.origin,
        }),
      })
      const session = await res.json()
      if (!res.ok || !session.url) throw new Error(session.error || 'Could not start checkout')
      window.location.href = session.url
    } catch {
      setPayingNow(false)
    }
  }

  async function updateUploadStatus(uploadId, status) {
    await supabase.from('uploads').update({ status }).eq('id', uploadId)
    fetchUploads()
  }

  async function toggleModeration() {
    const { data } = await supabase.from('events').update({ moderation_enabled: !event.moderation_enabled }).eq('id', event.id).select().single()
    setEvent(data)
  }

  // Download ONE zip of up to DOWNLOAD_BATCH files, one per click. Zipping a
  // whole large event at once builds a huge in-memory blob that crashes phones,
  // so we batch it; STORE avoids re-compressing already-compressed JPEGs.
  async function downloadPart(b) {
    const approved = uploads.filter(u => u.status === 'approved')
    if (!approved.length) return
    const count = Math.ceil(approved.length / DOWNLOAD_BATCH)
    const multi = count > 1
    setDownloading(true)
    try {
      const part = approved.slice(b * DOWNLOAD_BATCH, b * DOWNLOAD_BATCH + DOWNLOAD_BATCH)
      const zip = new JSZip()
      for (let i = 0; i < part.length; i++) {
        setProgressMsg(multi ? `Zip ${b + 1}/${count} — ${i + 1}/${part.length}` : `Preparing ${i + 1}/${part.length}`)
        try {
          const res = await fetch(part[i].file_url)
          const blob = await res.blob()
          const idx = b * DOWNLOAD_BATCH + i + 1
          zip.file(`${String(idx).padStart(3, '0')}.${uploadExt(part[i].file_url)}`, blob)
        } catch {}
      }
      setProgressMsg('Saving…')
      const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = multi ? `${slug}-part-${b + 1}-of-${count}.zip` : `${slug}-photos.zip`
      a.click()
      URL.revokeObjectURL(url)
      setPartIndex(b + 1)
    } catch {}
    setProgressMsg('')
    setDownloading(false)
  }

  // iOS "Save to Photos": fetch a set of files, then (on a second tap) hand them
  // to the native share sheet. Two steps because iOS revokes the tap permission
  // if you await long work before calling navigator.share.
  async function prepareSet(b) {
    const approved = uploads.filter(u => u.status === 'approved')
    const count = Math.ceil(approved.length / SHARE_BATCH)
    if (!approved.length || b >= count) return
    setPreparing(true)
    try {
      const part = approved.slice(b * SHARE_BATCH, b * SHARE_BATCH + SHARE_BATCH)
      const files = []
      for (let i = 0; i < part.length; i++) {
        setProgressMsg(`Loading ${i + 1}/${part.length}…`)
        const res = await fetch(part[i].file_url)
        const blob = await res.blob()
        const idx = b * SHARE_BATCH + i + 1
        files.push(new File([blob], `${String(idx).padStart(3, '0')}.${uploadExt(part[i].file_url)}`, { type: blob.type || 'image/jpeg' }))
      }
      setReadyFiles(files)
      setReadySet(b)
    } catch {}
    setProgressMsg('')
    setPreparing(false)
  }

  async function shareReady() {
    if (readySet < 0 || !readyFiles.length) return
    if (!navigator.canShare || !navigator.canShare({ files: readyFiles })) return
    const approved = uploads.filter(u => u.status === 'approved')
    const count = Math.ceil(approved.length / SHARE_BATCH)
    setSharing(true)
    try {
      await navigator.share({ files: readyFiles, title: event?.title || 'Photos' })
      const done = readySet + 1
      setReadyFiles([]); setReadySet(-1); setShareIndex(done)
      if (done < count) prepareSet(done)
    } catch {
      // AbortError = the host dismissed the share sheet; keep files so they can retry
    }
    setSharing(false)
  }

  function onSaveTap() {
    const approved = uploads.filter(u => u.status === 'approved')
    const count = Math.ceil(approved.length / SHARE_BATCH)
    if (shareIndex >= count) { setShareIndex(0); setReadyFiles([]); setReadySet(-1); prepareSet(0); return }
    if (readySet === shareIndex && readyFiles.length) shareReady()
    else if (!preparing) prepareSet(shareIndex)
  }

  // Delete one upload: storage object + DB row (host is authenticated, so RLS allows both).
  async function deleteUpload(upload) {
    setDeletingId(upload.id)
    const path = upload.file_url.split('/event-media/')[1]
    if (path) await supabase.storage.from('event-media').remove([path])
    await supabase.from('uploads').delete().eq('id', upload.id)
    setDeletingId('')
    fetchUploads()
  }

  // Find byte-identical copies (same photo uploaded more than once) and remove
  // all but one of each. Hashes each file in the browser, then deletes the extras.
  async function removeDuplicates() {
    const approved = uploads.filter(u => u.status === 'approved')
      .slice().sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at)) // oldest first → keep the original
    if (!approved.length) return
    setDeduping(true)
    try {
      const seen = new Map()
      const toDelete = []
      for (let i = 0; i < approved.length; i++) {
        setDedupeMsg(`Scanning ${i + 1}/${approved.length}…`)
        try {
          const buf = await (await fetch(approved[i].file_url)).arrayBuffer()
          const digest = await crypto.subtle.digest('SHA-256', buf)
          const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
          if (seen.has(hash)) toDelete.push(approved[i])
          else seen.set(hash, approved[i])
        } catch {}
      }
      if (!toDelete.length) { setDeduping(false); setDedupeMsg(''); alert('No duplicates found — every photo is unique.'); return }
      if (!confirm(`Found ${toDelete.length} duplicate cop${toDelete.length === 1 ? 'y' : 'ies'}. Remove ${toDelete.length === 1 ? 'it' : 'them'}? (keeps one of each photo)`)) {
        setDeduping(false); setDedupeMsg(''); return
      }
      let done = 0
      for (const up of toDelete) {
        setDedupeMsg(`Removing ${++done}/${toDelete.length}…`)
        const path = up.file_url.split('/event-media/')[1]
        if (path) await supabase.storage.from('event-media').remove([path])
        await supabase.from('uploads').delete().eq('id', up.id)
      }
      await fetchUploads()
    } catch {}
    setDeduping(false)
    setDedupeMsg('')
  }

  async function handleDeleteEvent() {
    if (!confirm('Delete this event and all its uploads? This cannot be undone.')) return
    setDeleting(true)
    await supabase.from('events').delete().eq('id', event.id)
    navigate('/dashboard')
  }

  function downloadQR() {
    const svg = document.getElementById('event-qr')
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = 400; canvas.height = 400
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, 0, 0); const a = document.createElement('a'); a.download = `${slug}-qr.png`; a.href = canvas.toDataURL(); a.click() }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  function printFlyer() {
    const svg = document.getElementById('event-qr')
    const svgData = new XMLSerializer().serializeToString(svg)
    const qrDataUrl = 'data:image/svg+xml;base64,' + btoa(svgData)
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>${event.title} — Scan to Share</title>
      <style>
        @page { margin: 0; }
        body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
        .card { text-align: center; padding: 60px 40px; max-width: 500px; }
        .accent { width: 60px; height: 6px; background: ${event.brand_color}; margin: 0 auto 32px; border-radius: 3px; }
        h1 { font-size: 34px; margin: 0 0 8px; color: #0A0A0A; }
        .date { color: #666; font-size: 16px; margin-bottom: 40px; }
        .qr { border: 2px solid #eee; border-radius: 24px; padding: 24px; display: inline-block; margin-bottom: 32px; }
        .qr img { width: 260px; height: 260px; display: block; }
        .cta { font-size: 26px; font-weight: 700; color: #0A0A0A; margin-bottom: 8px; }
        .sub { color: #666; font-size: 16px; }
        .brand { margin-top: 40px; color: #999; font-size: 12px; }
        .brand b { color: ${event.brand_color}; }
      </style></head>
      <body onload="window.print()">
        <div class="card">
          <div class="accent"></div>
          <h1>${event.title}</h1>
          ${event.date ? `<div class="date">${new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>` : ''}
          <div class="qr"><img src="${qrDataUrl}" /></div>
          <div class="cta">📸 Scan to share your photos</div>
          <div class="sub">Point your phone camera at the code — no app needed</div>
          <div class="brand">Powered by <a href="https://stacktlv.com" target="_blank" rel="noopener noreferrer"><b>STACKT</b></a></div>
        </div>
      </body></html>
    `)
    win.document.close()
  }

  const pending = uploads.filter(u => u.status === 'pending')
  const approved = uploads.filter(u => u.status === 'approved')
  const zipCount = Math.ceil(approved.length / DOWNLOAD_BATCH)
  const shareCount = Math.ceil(approved.length / SHARE_BATCH)
  const readyForCurrent = readySet === shareIndex && readyFiles.length > 0

  if (loading || !event) return <div className="min-h-screen bg-cream flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border px-6 py-4 flex items-center gap-4 max-w-6xl mx-auto">
        <Link to="/dashboard" className="text-espresso-soft hover:text-espresso transition-colors text-sm">← Dashboard</Link>
        <span className="serif text-lg tracking-wide">Share <span className="text-gold">2</span> Share</span>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Event header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: event.brand_color }} />
              <h1 className="serif text-4xl">{event.title}</h1>
            </div>
            <p className="text-espresso-soft">{event.date ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'No date set'}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a href={`/e/${slug}/wall`} target="_blank" rel="noreferrer" className="btn-secondary text-sm py-2">📺 Open Photo Wall</a>
            <a href={guestUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm py-2">👁 Preview Guest Page</a>
          </div>
        </div>

        {event.payment_status === 'pending' && (
          <div className="card border-yellow-500/40 bg-yellow-500/5 mb-8 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="font-medium">⚠ Payment pending</div>
              <div className="text-espresso-soft text-sm">This event's {PLAN_LIMITS[event.plan]?.label || event.plan} plan payment hasn't completed yet — guests can't upload until it's paid.</div>
            </div>
            <button onClick={handleCompletePayment} disabled={payingNow} className="btn-primary text-sm py-2 px-4">
              {payingNow ? 'Redirecting…' : 'Complete payment →'}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-border">
          {[['overview', 'Overview'], ['moderation', `Moderation${pending.length ? ` (${pending.length})` : ''}`], ['gallery', `Gallery (${approved.length})`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === key ? 'border-gold text-gold' : 'border-transparent text-espresso-soft hover:text-espresso'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* QR Code */}
            <div className="card flex flex-col items-center">
              <h3 className="font-bold text-lg mb-4 self-start">QR Code</h3>
              <div className="bg-white p-4 rounded-2xl mb-4">
                <QRCodeSVG id="event-qr" value={guestUrl} size={220} fgColor="#0A0A0A" />
              </div>
              <p className="text-espresso-soft text-xs text-center mb-4 break-all">{guestUrl}</p>
              <div className="flex gap-3 w-full">
                <button onClick={downloadQR} className="btn-secondary text-sm py-2 flex-1">Download PNG</button>
                <button onClick={() => navigator.clipboard.writeText(guestUrl)} className="btn-secondary text-sm py-2 flex-1">Copy Link</button>
              </div>
              <button onClick={printFlyer} className="btn-secondary text-sm py-2 w-full mt-3">🖨 Print table flyer</button>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <div className="card">
                <h3 className="font-bold text-lg mb-4">Event Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-cream rounded-xl p-4">
                    <div className="text-3xl font-bold text-gold">{approved.length}</div>
                    <div className="text-espresso-soft text-sm">Approved uploads</div>
                  </div>
                  <div className="bg-cream rounded-xl p-4">
                    <div className="text-3xl font-bold text-yellow-500">{pending.length}</div>
                    <div className="text-espresso-soft text-sm">Pending review</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Moderation</div>
                    <div className="text-espresso-soft text-sm">Review before uploads appear publicly</div>
                  </div>
                  <button onClick={toggleModeration}
                    className={`w-12 h-6 rounded-full transition-colors relative ${event.moderation_enabled ? 'bg-gold' : 'bg-border'}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${event.moderation_enabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              {approved.length > 0 && (
                <div className="space-y-2">
                  {canShareFiles && (
                    <button onClick={onSaveTap} disabled={sharing || preparing || downloading} className="btn-secondary w-full text-sm py-3">
                      {preparing ? 'Loading…'
                        : sharing ? 'Opening…'
                        : readyForCurrent ? `📲 Tap to save ${readyFiles.length} to Photos`
                        : shareIndex >= shareCount ? '📲 Save to Photos again'
                        : shareCount <= 1 ? '📲 Save all to Photos'
                        : shareIndex === 0 ? `📲 Save to Photos · ${shareCount} sets`
                        : `📲 Save to Photos · set ${shareIndex + 1} of ${shareCount}`}
                    </button>
                  )}

                  <button onClick={() => downloadPart(partIndex >= zipCount ? 0 : partIndex)} disabled={downloading || sharing} className="btn-secondary w-full text-sm py-3">
                    {downloading ? (progressMsg || 'Zipping…')
                      : zipCount <= 1 ? `⬇ Download all ${approved.length}`
                      : partIndex === 0 ? `⬇ Download all ${approved.length} · ${zipCount} zips`
                      : partIndex < zipCount ? `⬇ Download zip ${partIndex + 1} of ${zipCount}`
                      : '⬇ Download again'}
                  </button>

                  {progressMsg && !downloading && <p className="text-espresso-soft text-xs text-center">{progressMsg}</p>}
                  {!downloading && !preparing && !sharing && zipCount > 1 && partIndex > 0 && partIndex < zipCount && (
                    <p className="text-espresso-soft text-xs text-center">Zip {partIndex} of {zipCount} saved — tap for the next.</p>
                  )}
                  {canShareFiles && !downloading && !preparing && !sharing && shareIndex === 0 && (
                    <p className="text-espresso-soft text-xs text-center">On iPhone? “Save to Photos” sends them to your album, a set at a time.</p>
                  )}
                </div>
              )}

              {approved.length > 1 && (
                <button onClick={removeDuplicates} disabled={deduping || downloading || sharing} className="btn-secondary w-full text-sm py-3">
                  {deduping ? (dedupeMsg || 'Scanning…') : '🧹 Remove duplicate photos'}
                </button>
              )}

              <button onClick={handleDeleteEvent} disabled={deleting} className="w-full py-3 text-sm text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 rounded-xl transition-colors">
                {deleting ? 'Deleting…' : '🗑 Delete this event'}
              </button>
            </div>
          </div>
        )}

        {/* MODERATION TAB */}
        {tab === 'moderation' && (
          <div>
            {pending.length === 0 ? (
              <div className="card text-center py-16">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="font-bold text-lg">All caught up</h3>
                <p className="text-espresso-soft mt-1">No uploads pending review</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pending.map(upload => (
                  <div key={upload.id} className="card p-3">
                    {upload.file_type === 'photo'
                      ? <img src={upload.file_url} alt="" className="w-full aspect-square object-cover rounded-xl mb-3" />
                      : <video src={upload.file_url} className="w-full aspect-square object-cover rounded-xl mb-3" controls />
                    }
                    {upload.caption && <p className="text-xs text-espresso-soft mb-3 truncate">{upload.caption}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => updateUploadStatus(upload.id, 'approved')} className="flex-1 bg-green-500/10 text-green-400 text-xs py-2 rounded-lg hover:bg-green-500/20 transition-colors">✓ Approve</button>
                      <button onClick={() => updateUploadStatus(upload.id, 'rejected')} className="flex-1 bg-red-500/10 text-red-400 text-xs py-2 rounded-lg hover:bg-red-500/20 transition-colors">✗ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GALLERY TAB */}
        {tab === 'gallery' && (
          <div>
            {approved.length === 0 ? (
              <div className="card text-center py-16">
                <div className="text-4xl mb-3">📷</div>
                <h3 className="font-bold text-lg">No approved uploads yet</h3>
                <p className="text-espresso-soft mt-1">Share your QR code to start collecting moments</p>
              </div>
            ) : (
              <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
                {approved.map(upload => (
                  <div key={upload.id} className="break-inside-avoid relative group">
                    {upload.file_type === 'photo'
                      ? <img src={upload.file_url} alt={upload.caption || ''} loading="lazy" className="w-full rounded-xl" />
                      : <video src={upload.file_url} controls preload="metadata" className="w-full rounded-xl" />
                    }
                    <button onClick={() => deleteUpload(upload)} disabled={deletingId === upload.id}
                      title="Delete this upload"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-xs flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-600">
                      {deletingId === upload.id ? '…' : '✕'}
                    </button>
                    {upload.caption && <p className="text-xs text-espresso-soft mt-1 px-1">{upload.caption}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
