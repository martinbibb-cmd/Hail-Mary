import React, { useEffect, useMemo, useState } from 'react'
import { useCognitiveProfile } from './CognitiveProfileContext'
import './cognitive.css'

const FOCUS_TIMER_PRESETS = [5, 15, 25]

type ParkingLotIdea = {
  id: string
  text: string
  createdAt: number
}

const PARKING_LOT_KEY = 'hailmary.parkingLot'

const useParkingLot = () => {
  const [ideas, setIdeas] = useState<ParkingLotIdea[]>(() => {
    if (typeof window === 'undefined') return []
    const stored = window.localStorage.getItem(PARKING_LOT_KEY)
    if (!stored) return []
    try {
      return JSON.parse(stored) as ParkingLotIdea[]
    } catch (error) {
      console.warn('Unable to parse parking lot ideas', error)
      return []
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(PARKING_LOT_KEY, JSON.stringify(ideas))
  }, [ideas])

  const addIdea = (text: string) => {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setIdeas((prev) => [
      {
        id,
        text,
        createdAt: Date.now(),
      },
      ...prev,
    ])
  }

  const removeIdea = (id: string) => setIdeas((prev) => prev.filter((idea) => idea.id !== id))

  return { ideas, addIdea, removeIdea }
}

const FocusTimer: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const [durationMinutes, setDurationMinutes] = useState<number>(FOCUS_TIMER_PRESETS[1])
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60)
  const [running, setRunning] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    setRemainingSeconds(durationMinutes * 60)
  }, [durationMinutes])

  useEffect(() => {
    if (!running || !enabled) return

    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setRunning(false)
          setCelebrating(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [running, enabled])

  useEffect(() => {
    if (!celebrating) return
    const timeout = window.setTimeout(() => setCelebrating(false), 2200)
    return () => window.clearTimeout(timeout)
  }, [celebrating])

  if (!enabled) return null

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const progress = Math.min(100, Math.round(((durationMinutes * 60 - remainingSeconds) / (durationMinutes * 60)) * 100))

  return (
    <div className={`focus-timer ${celebrating ? 'celebrate' : ''}`}>
      <div className="focus-timer-header">
        <div>
          <p className="focus-timer-title">Focus Timer</p>
          <p className="focus-timer-subtitle">Visual countdown to reduce time blindness</p>
        </div>
        <div className="focus-timer-presets">
          {FOCUS_TIMER_PRESETS.map((preset) => (
            <button
              key={preset}
              className={preset === durationMinutes ? 'active' : ''}
              onClick={() => {
                setDurationMinutes(preset)
                setRunning(false)
              }}
              type="button"
            >
              {preset}m
            </button>
          ))}
        </div>
      </div>

      <div className="focus-timer-display">
        <div className="focus-timer-time">
          {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </div>
        <div className="focus-timer-controls">
          <button type="button" onClick={() => setRunning((prev) => !prev)}>
            {running ? 'Pause' : 'Start'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false)
              setRemainingSeconds(durationMinutes * 60)
              setCelebrating(false)
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="focus-timer-track" aria-hidden>
        <div className="focus-timer-progress" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

const ParkingLot: React.FC = () => {
  const { ideas, addIdea, removeIdea } = useParkingLot()
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    addIdea(draft.trim())
    setDraft('')
    setOpen(true)
  }

  return (
    <div className={`parking-lot ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="parking-lot-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="parking-lot-panel"
      >
        🅿️ Parking Lot
      </button>

      <div id="parking-lot-panel" className="parking-lot-panel" hidden={!open}>
        <div className="parking-lot-header">
          <div>
            <p className="parking-lot-title">Dump an idea</p>
            <p className="parking-lot-subtitle">Keep your focus; nothing gets lost.</p>
          </div>
          <button type="button" className="parking-lot-close" onClick={() => setOpen(false)} aria-label="Close parking lot">
            ✕
          </button>
        </div>

        <form className="parking-lot-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Drop a thought, link, or reminder"
          />
          <button type="submit" disabled={!draft.trim()}>
            Save
          </button>
        </form>

        {ideas.length === 0 ? (
          <p className="parking-lot-empty">Nothing parked yet.</p>
        ) : (
          <ul className="parking-lot-list">
            {ideas.map((idea) => (
              <li key={idea.id}>
                <div>
                  <p className="parking-lot-idea">{idea.text}</p>
                  <p className="parking-lot-meta">{new Date(idea.createdAt).toLocaleTimeString()}</p>
                </div>
                <button type="button" onClick={() => removeIdea(idea.id)} aria-label="Remove idea">
                  ✓
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const ReadingRuler: React.FC = () => {
  const [position, setPosition] = useState(() => (typeof window !== 'undefined' ? window.innerHeight / 2 : 0))

  useEffect(() => {
    const handleMove = (event: MouseEvent) => setPosition(event.clientY)
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return <div className="reading-ruler" style={{ top: Math.max(0, position - 26) }} />
}

export const CognitiveOverlays: React.FC = () => {
  const { profile, settings } = useCognitiveProfile()

  const showTimer = useMemo(() => profile === 'focus' && settings.focusTimers, [profile, settings.focusTimers])

  return (
    <>
      {showTimer && <FocusTimer enabled />}
      {profile === 'focus' && <ParkingLot />}
      {profile === 'clarity' && <ReadingRuler />}
    </>
  )
}

