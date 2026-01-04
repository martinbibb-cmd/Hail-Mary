import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useSpineStore } from '../stores/spineStore'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface SpineProperty {
  id: string
  addressLine1: string
  addressLine2?: string | null
  town?: string | null
  postcode: string
}

export function SpinePropertyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [property, setProperty] = useState<SpineProperty | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setActiveAddress = useSpineStore((s) => s.setActiveAddress)
  const setActiveVisitId = useSpineStore((s) => s.setActiveVisitId)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/properties/${id}`, { credentials: 'include' })
        const json = (await res.json()) as ApiResponse<SpineProperty>
        if (!cancelled) {
          if (json.success && json.data) setProperty(json.data)
          else setError(json.error || 'Failed to load property')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load property')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleSetActive = () => {
    if (!property) return
    setActiveAddress({
      id: property.id,
      line1: property.addressLine1,
      line2: property.addressLine2,
      town: property.town,
      postcode: property.postcode,
    })
  }

  const handleStartVisit = async () => {
    if (!property) return
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ propertyId: property.id }),
    })
    const json = (await res.json()) as ApiResponse<{ id: string }>
    if (!json.success) {
      alert(json.error || 'Failed to start visit')
      return
    }
    if (json.data?.id) {
      setActiveVisitId(json.data.id)
      navigate(`/visits/${json.data.id}/job-graph`)
    }
  }

  if (loading) return <div className="loading">Loading property...</div>
  if (error) return <div className="error">{error}</div>
  if (!property) return <div className="error">Property not found</div>

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>Property</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={handleSetActive}>
            Set active property
          </button>
          <button className="btn-primary" onClick={handleStartVisit}>
            Start visit
          </button>
        </div>
      </div>

      <div className="detail-card">
        <h3>Address</h3>
        <p>{property.addressLine1}</p>
        {property.addressLine2 ? <p>{property.addressLine2}</p> : null}
        <p>
          {property.town ? `${property.town}, ` : ''}
          {property.postcode}
        </p>
      </div>

      <Link to="/" className="back-link">
        ← Back to Home
      </Link>
    </div>
  )
}

