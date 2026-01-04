/**
 * TopBar (v2 spine)
 *
 * Always visible. If no active address is set, shows "All properties".
 * Setting an active address is an accelerator, not a requirement.
 */

import { useNavigate } from 'react-router-dom'
import { useSpineStore } from '../stores/spineStore'
import './ActivePropertyBar.css'

export function ActivePropertyBar() {
  const navigate = useNavigate()
  const activeAddress = useSpineStore((s) => s.activeAddress)
  const activeVisitId = useSpineStore((s) => s.activeVisitId)
  const clearActiveAddress = useSpineStore((s) => s.clearActiveAddress)

  const handleLeftClick = () => {
    if (!activeAddress) return
    navigate(`/addresses`)
  }

  const handleJobGraphClick = () => {
    if (!activeVisitId) return
    navigate(`/visits/${activeVisitId}/job-graph`)
  }

  return (
    <div className="active-property-bar">
      <button
        type="button"
        className="active-property-bar__left"
        onClick={handleLeftClick}
        aria-label={activeAddress ? 'Open active address' : 'All properties'}
      >
        {activeAddress ? (
          <span className="active-property-bar__value">
            {activeAddress.customerName || activeAddress.line1} • {activeAddress.postcode}
          </span>
        ) : (
          <span className="active-property-bar__value active-property-bar__value--muted">All properties</span>
        )}
      </button>

      <div className="active-property-bar__right">
        {activeVisitId ? (
          <button className="active-property-bar__btn active-property-bar__btn--primary" onClick={handleJobGraphClick}>
            Job Graph
          </button>
        ) : null}
        {activeAddress ? (
          <>
            <button className="active-property-bar__btn active-property-bar__btn--subtle" onClick={clearActiveAddress}>
              Clear
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

