/**
 * Active Property Bar (v2 spine)
 *
 * Always visible. If no active property is set, shows "All properties".
 * Setting an active property is an accelerator, not a requirement.
 */

import { useNavigate } from 'react-router-dom'
import { useSpineStore } from '../stores/spineStore'
import './ActivePropertyBar.css'

export function ActivePropertyBar() {
  const navigate = useNavigate()
  const activeProperty = useSpineStore((s) => s.activeProperty)
  const clearActiveProperty = useSpineStore((s) => s.clearActiveProperty)

  const handleOpen = () => {
    if (!activeProperty) return
    navigate(`/properties/${activeProperty.id}`)
  }

  return (
    <div className="active-property-bar">
      <div className="active-property-bar__left">
        <span className="active-property-bar__label">Active Property</span>
        {activeProperty ? (
          <span className="active-property-bar__value">
            {activeProperty.addressLine1} • {activeProperty.postcode}
          </span>
        ) : (
          <span className="active-property-bar__value active-property-bar__value--muted">
            All properties
          </span>
        )}
      </div>

      <div className="active-property-bar__right">
        {activeProperty ? (
          <>
            <button className="active-property-bar__btn" onClick={handleOpen}>
              Open
            </button>
            <button className="active-property-bar__btn active-property-bar__btn--subtle" onClick={clearActiveProperty}>
              Clear
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

