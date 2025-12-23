import React, { useEffect, useMemo, useState } from 'react'
import './AssetFeed.css'

type AssetKind = 'audio' | 'image' | 'text' | 'model' | 'other'

export interface VisitAsset {
  id: string
  kind: AssetKind | string
  mimeType: string
  ext: string
  bytes: number | null
  originalFilename: string | null
  createdAt: string | Date
  downloadUrl: string
}

interface Props {
  leadId: string
  visitId: number
  refreshKey: number
}

async function fetchAssets(leadId: string, visitId: number): Promise<VisitAsset[]> {
  const res = await fetch(`/api/leads/${leadId}/visits/${visitId}/assets`, { credentials: 'include' })
  const json = await res.json()
  if (!json?.success) throw new Error(json?.error || 'Failed to load assets')
  return (json.data || []) as VisitAsset[]
}

const formatBytes = (n: number | null) => {
  if (!n || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const TextSnippet: React.FC<{ asset: VisitAsset }> = ({ asset }) => {
  const [snippet, setSnippet] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        setError(null)
        const res = await fetch(asset.downloadUrl, { credentials: 'include' })
        const text = await res.text()
        if (cancelled) return
        const trimmed = text.replace(/\s+/g, ' ').trim()
        setSnippet(trimmed.slice(0, 240))
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load text preview')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [asset.downloadUrl])

  if (error) return <div className="asset-text-preview asset-text-error">{error}</div>
  return <div className="asset-text-preview">{snippet || '…'}</div>
}

export const AssetFeed: React.FC<Props> = ({ leadId, visitId, refreshKey }) => {
  const [assets, setAssets] = useState<VisitAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchAssets(leadId, visitId)
      .then((data) => {
        if (cancelled) return
        setAssets(data)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load assets')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [leadId, visitId, refreshKey])

  const countLabel = useMemo(() => `${assets.length} file${assets.length === 1 ? '' : 's'}`, [assets.length])

  return (
    <div className="asset-feed">
      <div className="asset-feed-header">
        <h3>📎 Media</h3>
        <span className="asset-feed-count">{countLabel}</span>
      </div>

      {loading && <div className="asset-feed-loading">Loading…</div>}
      {error && <div className="asset-feed-error">{error}</div>}

      {!loading && !error && assets.length === 0 && (
        <div className="asset-feed-empty">No imported media yet.</div>
      )}

      <div className="asset-feed-list">
        {assets.map((a) => {
          const createdAt = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)
          const title = a.originalFilename || `${a.id}.${a.ext}`
          const size = formatBytes(a.bytes)
          const kind = (a.kind as string) || 'other'

          return (
            <div key={a.id} className="asset-item">
              <div className="asset-item-meta">
                <div className="asset-item-title">
                  <span className="asset-kind">{kind}</span>
                  <span className="asset-filename" title={title}>{title}</span>
                </div>
                <div className="asset-item-sub">
                  <span>{createdAt.toLocaleString()}</span>
                  {size ? <span>· {size}</span> : null}
                </div>
              </div>

              <div className="asset-item-preview">
                {kind === 'image' && (
                  <img className="asset-image" src={a.downloadUrl} alt={title} loading="lazy" />
                )}
                {kind === 'audio' && (
                  <audio className="asset-audio" controls preload="none" src={a.downloadUrl} />
                )}
                {kind === 'text' && <TextSnippet asset={a} />}
                {kind === 'model' && (
                  <a className="asset-download" href={a.downloadUrl} target="_blank" rel="noreferrer">
                    Download model
                  </a>
                )}
                {kind !== 'image' && kind !== 'audio' && kind !== 'text' && kind !== 'model' && (
                  <a className="asset-download" href={a.downloadUrl} target="_blank" rel="noreferrer">
                    Download file
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

