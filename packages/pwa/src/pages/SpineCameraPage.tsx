import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSpineStore } from '../stores/spineStore'
import './SpineCameraPage.css'

type GeoCapture =
  | {
      lat: number
      lng: number
      accuracy: number
      ts: string
    }
  | null

type RecentVisitItem = {
  visitId: string
  visitStartedAt: string
  property: {
    id: string
    addressLine1: string
    addressLine2?: string | null
    town?: string | null
    postcode: string
  }
}

function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob())
}

async function getBestGeo(): Promise<GeoCapture> {
  if (!('geolocation' in navigator)) return null

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 6000,
        maximumAge: 30_000,
        enableHighAccuracy: true,
      })
    })
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      ts: new Date(pos.timestamp).toISOString(),
    }
  } catch {
    return null
  }
}

export function SpineCameraPage() {
  const navigate = useNavigate()

  const activeProperty = useSpineStore((s) => s.activeProperty)
  const activeVisitId = useSpineStore((s) => s.activeVisitId)
  const setActiveProperty = useSpineStore((s) => s.setActiveProperty)
  const setActiveVisitId = useSpineStore((s) => s.setActiveVisitId)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [capturedGeo, setCapturedGeo] = useState<GeoCapture>(null)
  const [capturedTs, setCapturedTs] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [locationUnavailable, setLocationUnavailable] = useState(false)

  const [saving, setSaving] = useState(false)

  const [attachOpen, setAttachOpen] = useState(false)
  const [attachLoading, setAttachLoading] = useState(false)
  const [recentVisits, setRecentVisits] = useState<RecentVisitItem[]>([])
  const [quickAddressLine1, setQuickAddressLine1] = useState('')
  const [quickPostcode, setQuickPostcode] = useState('')
  const [pendingSave, setPendingSave] = useState(false)

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start camera'
      setError(msg)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) stream.getTracks().forEach((t) => t.stop())
    setStream(null)
    if (videoRef.current) videoRef.current.srcObject = null
  }, [stream])

  // Request location permission on entering camera screen (best-effort)
  useEffect(() => {
    let cancelled = false
    getBestGeo()
      .then((geo) => {
        if (cancelled) return
        setLocationUnavailable(!geo)
      })
      .catch(() => {
        if (!cancelled) setLocationUnavailable(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const v = videoRef.current
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    if (!ctx) return

    c.width = v.videoWidth
    c.height = v.videoHeight
    ctx.drawImage(v, 0, 0)

    const dataUrl = c.toDataURL('image/jpeg', 0.9)
    setCapturedDataUrl(dataUrl)
    setCapturedTs(new Date().toISOString())

    const geo = await getBestGeo()
    setCapturedGeo(geo)
    setLocationUnavailable(!geo)
  }, [])

  const resetCapture = useCallback(() => {
    setCapturedDataUrl(null)
    setCapturedGeo(null)
    setCapturedTs(null)
    setCaption('')
    setPendingSave(false)
  }, [])

  const loadRecentVisits = useCallback(async () => {
    setAttachLoading(true)
    try {
      const res = await fetch('/api/feed?limit=50', { credentials: 'include' })
      const json = (await res.json()) as any
      const events: any[] = Array.isArray(json?.data) ? json.data : []
      const seen = new Set<string>()
      const visits: RecentVisitItem[] = []

      for (const e of events) {
        const visitId = e?.visit?.id
        const property = e?.property
        if (!visitId || !property?.id) continue
        if (seen.has(visitId)) continue
        seen.add(visitId)
        visits.push({
          visitId,
          visitStartedAt: e.visit.startedAt,
          property: {
            id: property.id,
            addressLine1: property.addressLine1,
            addressLine2: property.addressLine2,
            town: property.town,
            postcode: property.postcode,
          },
        })
        if (visits.length >= 12) break
      }

      setRecentVisits(visits)
    } catch {
      setRecentVisits([])
    } finally {
      setAttachLoading(false)
    }
  }, [])

  const ensureVisitId = useCallback(async (): Promise<string | null> => {
    if (activeVisitId) return activeVisitId

    if (activeProperty?.id) {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ propertyId: activeProperty.id }),
      })
      const json = (await res.json()) as any
      if (!json?.success || !json?.data?.id) throw new Error(json?.error || 'Failed to create visit')
      setActiveVisitId(json.data.id)
      return json.data.id
    }

    // No active property -> must attach
    setAttachOpen(true)
    loadRecentVisits()
    return null
  }, [activeVisitId, activeProperty?.id, loadRecentVisits, setActiveVisitId])

  const uploadAndCreateEvent = useCallback(
    async (visitId: string) => {
      if (!capturedDataUrl) throw new Error('No photo captured')

      setSaving(true)
      try {
        const blob = await blobFromDataUrl(capturedDataUrl)
        const form = new FormData()
        form.append('file', blob, `photo-${Date.now()}.jpg`)

        const uploadRes = await fetch('/api/uploads/photo', {
          method: 'POST',
          credentials: 'include',
          body: form,
        })
        const uploadJson = (await uploadRes.json()) as any
        const imageUrl: string | undefined = uploadJson?.imageUrl
        if (!uploadRes.ok || !imageUrl) throw new Error(uploadJson?.error || 'Upload failed')

        const eventRes = await fetch(`/api/visits/${visitId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: 'photo',
            ts: capturedTs,
            payload: {
              imageUrl,
              caption: caption.trim() ? caption.trim() : null,
              device: navigator.platform || 'web',
            },
            geo: capturedGeo,
          }),
        })
        const eventJson = (await eventRes.json()) as any
        if (!eventRes.ok || !eventJson?.success) throw new Error(eventJson?.error || 'Failed to create event')

        resetCapture()
        navigate('/')
      } finally {
        setSaving(false)
      }
    },
    [caption, capturedDataUrl, capturedGeo, capturedTs, navigate, resetCapture]
  )

  const onSave = useCallback(async () => {
    try {
      const visitId = await ensureVisitId()
      if (!visitId) {
        setPendingSave(true)
        return
      }
      await uploadAndCreateEvent(visitId)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save photo')
    }
  }, [ensureVisitId, uploadAndCreateEvent])

  // If user was forced into attach flow, continue once visit is set
  useEffect(() => {
    if (!pendingSave) return
    if (!capturedDataUrl) return
    if (!activeVisitId) return
    setPendingSave(false)
    uploadAndCreateEvent(activeVisitId).catch((e) => {
      alert(e instanceof Error ? e.message : 'Failed to save photo')
    })
  }, [activeVisitId, capturedDataUrl, pendingSave, uploadAndCreateEvent])

  const attachHeader = useMemo(() => {
    if (attachLoading) return 'Loading recent visits…'
    if (recentVisits.length === 0) return 'No recent visits found'
    return 'Pick a recent visit'
  }, [attachLoading, recentVisits.length])

  const createQuickPropertyAndVisit = useCallback(async () => {
    const addressLine1 = quickAddressLine1.trim()
    const postcode = quickPostcode.trim()
    if (!addressLine1 || !postcode) {
      alert('Postcode + address line 1 are required')
      return
    }

    setAttachLoading(true)
    try {
      const propRes = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ addressLine1, postcode }),
      })
      const propJson = (await propRes.json()) as any
      if (!propRes.ok || !propJson?.success || !propJson?.data?.id) throw new Error(propJson?.error || 'Failed to create property')

      const p = propJson.data
      setActiveProperty({
        id: p.id,
        addressLine1: p.addressLine1,
        addressLine2: p.addressLine2,
        town: p.town,
        postcode: p.postcode,
      })

      const visitRes = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ propertyId: p.id }),
      })
      const visitJson = (await visitRes.json()) as any
      if (!visitRes.ok || !visitJson?.success || !visitJson?.data?.id) throw new Error(visitJson?.error || 'Failed to create visit')

      setActiveVisitId(visitJson.data.id)
      setAttachOpen(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create quick property')
    } finally {
      setAttachLoading(false)
    }
  }, [quickAddressLine1, quickPostcode, setActiveProperty, setActiveVisitId])

  return (
    <div className="spine-camera">
      <div className="spine-camera__topbar">
        <button className="spine-camera__btn" onClick={() => navigate('/')}>
          ← Home
        </button>
        <div className="spine-camera__status">
          {activeProperty ? (
            <span className="spine-camera__pill">
              {activeProperty.addressLine1} • {activeProperty.postcode}
            </span>
          ) : (
            <span className="spine-camera__pill spine-camera__pill--muted">No active property</span>
          )}
        </div>
      </div>

      {error ? (
        <div className="spine-camera__error">
          <div>{error}</div>
          <button className="btn-primary" onClick={startCamera}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="spine-camera__stage">
        {!capturedDataUrl ? (
          <>
            <video ref={videoRef} className="spine-camera__video" playsInline muted />
            <canvas ref={canvasRef} className="spine-camera__canvas" />

            <div className="spine-camera__controls">
              <button className="spine-camera__shutter" onClick={capture} aria-label="Take photo" />
              <div className="spine-camera__hint">
                {locationUnavailable ? 'Location unavailable (photo still saves)' : 'Location ready'}
              </div>
            </div>
          </>
        ) : (
          <div className="spine-camera__review">
            <img className="spine-camera__preview" src={capturedDataUrl} alt="Captured" />
            <div className="spine-camera__form">
              <label className="spine-camera__label">Caption (optional)</label>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Boiler position before…" />
              <div className="spine-camera__review-actions">
                <button className="btn-secondary" onClick={resetCapture} disabled={saving}>
                  Retake
                </button>
                <button className="btn-primary" onClick={onSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              {locationUnavailable ? <div className="spine-camera__micro">Location unavailable</div> : null}
            </div>
          </div>
        )}
      </div>

      {attachOpen ? (
        <div className="spine-camera__sheet">
          <div className="spine-camera__sheet-card">
            <div className="spine-camera__sheet-title">Attach photo</div>
            <div className="spine-camera__sheet-sub">
              No active property. Choose an existing visit or create a quick property.
            </div>

            <div className="spine-camera__sheet-section">
              <div className="spine-camera__sheet-section-title">{attachHeader}</div>
              {attachLoading ? (
                <div className="spine-camera__sheet-muted">Loading…</div>
              ) : recentVisits.length === 0 ? (
                <div className="spine-camera__sheet-muted">Create a quick property below.</div>
              ) : (
                <div className="spine-camera__visit-list">
                  {recentVisits.map((v) => (
                    <button
                      key={v.visitId}
                      className="spine-camera__visit-item"
                      onClick={() => {
                        setActiveProperty({
                          id: v.property.id,
                          addressLine1: v.property.addressLine1,
                          addressLine2: v.property.addressLine2,
                          town: v.property.town,
                          postcode: v.property.postcode,
                        })
                        setActiveVisitId(v.visitId)
                        setAttachOpen(false)
                      }}
                    >
                      <div className="spine-camera__visit-title">{v.property.addressLine1}</div>
                      <div className="spine-camera__visit-sub">
                        {v.property.postcode} • {new Date(v.visitStartedAt).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="spine-camera__sheet-section">
              <div className="spine-camera__sheet-section-title">Create quick property</div>
              <div className="spine-camera__quick-grid">
                <input
                  value={quickPostcode}
                  onChange={(e) => setQuickPostcode(e.target.value)}
                  placeholder="Postcode (e.g. SW1A 1AA)"
                />
                <input
                  value={quickAddressLine1}
                  onChange={(e) => setQuickAddressLine1(e.target.value)}
                  placeholder="Address line 1"
                />
              </div>
              <div className="spine-camera__sheet-actions">
                <button className="btn-secondary" onClick={() => setAttachOpen(false)} disabled={attachLoading}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={createQuickPropertyAndVisit} disabled={attachLoading}>
                  Create & continue
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

