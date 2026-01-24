/**
 * BuildBadge Component
 * 
 * Displays build metadata in a small fixed badge at bottom-right of the screen.
 * Shows Git SHA (short), build time, and environment.
 * Helps identify exactly what code is running on each device.
 * 
 * FIX 5: Only visible in dev mode or when ?dev=1 query parameter is present
 */

import { useState, useMemo } from 'react'

export function BuildBadge() {
  const [expanded, setExpanded] = useState(false)

  // FIX 5: Only show in dev mode or with ?dev=1 query parameter
  // Memoize to avoid parsing URL on every render
  const isDev = useMemo(() => {
    return __BUILD_ENV__ === 'development' || 
           new URLSearchParams(window.location.search).get('dev') === '1'
  }, [])
  
  if (!isDev) {
    return null
  }

  // Format build time as relative time (e.g., "2 hours ago")
  const formatBuildTime = (isoString: string) => {
    const buildTime = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - buildTime.getTime()
    
    // Handle edge case where system clock is behind build time
    if (diffMs < 0) {
      return 'just now'
    }
    
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) {
      return 'just now'
    } else if (diffMins < 60) {
      return `${diffMins}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return buildTime.toLocaleDateString()
    }
  }

  const buildTime = formatBuildTime(__BUILD_TIME__)
  const buildDate = new Date(__BUILD_TIME__).toLocaleString()

  return (
    <div
      className="build-badge"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        padding: expanded ? '10px 12px' : '6px 10px',
        borderRadius: '8px',
        fontSize: expanded ? '12px' : '11px',
        fontFamily: 'ui-monospace, Menlo, Monaco, monospace',
        zIndex: 9999,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        // Ensure badge is above most UI but below modals/overlays
        pointerEvents: 'auto',
      }}
      onClick={() => setExpanded(!expanded)}
      title="Click to expand build details"
    >
      {expanded ? (
        <div style={{ minWidth: '200px' }}>
          <div style={{ marginBottom: '6px', color: '#9ca3af', fontSize: '10px', fontWeight: '600' }}>
            BUILD INFO
          </div>
          <div style={{ display: 'grid', gap: '4px' }}>
            <div>
              <span style={{ color: '#9ca3af' }}>SHA:</span>{' '}
              <span style={{ fontWeight: '600' }}>{__GIT_SHA__}</span>
            </div>
            <div>
              <span style={{ color: '#9ca3af' }}>Built:</span>{' '}
              <span>{buildDate}</span>
            </div>
            <div>
              <span style={{ color: '#9ca3af' }}>Env:</span>{' '}
              <span
                style={{
                  color: __BUILD_ENV__ === 'production' ? '#10b981' : '#f59e0b',
                  fontWeight: '600',
                }}
              >
                {__BUILD_ENV__}
              </span>
            </div>
            <div>
              <span style={{ color: '#9ca3af' }}>Version:</span>{' '}
              <span>{__APP_VERSION__}</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#9ca3af' }}>Build:</span>
          <span style={{ fontWeight: '600' }}>{__GIT_SHA__}</span>
          <span style={{ color: '#9ca3af' }}>•</span>
          <span>{buildTime}</span>
        </div>
      )}
    </div>
  )
}
