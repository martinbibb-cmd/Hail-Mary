import React, { useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core'
import { format } from 'date-fns'
import './DiaryApp.css'

export type EventType = 'site_visit' | 'installation' | 'follow_up' | 'callback'

export interface DiaryEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: EventType
  leadId?: number
  leadName?: string
  notes?: string
}

const eventTypeColors: Record<EventType, string> = {
  site_visit: '#e94560',
  installation: '#27c93f',
  follow_up: '#ffbd2e',
  callback: '#007aff',
}

const eventTypeLabels: Record<EventType, string> = {
  site_visit: 'Site Visit',
  installation: 'Installation',
  follow_up: 'Follow-up',
  callback: 'Callback',
}

export const DiaryApp: React.FC = () => {
  const [events, setEvents] = useState<DiaryEvent[]>([
    // Sample events for demo
    {
      id: '1',
      title: 'Site Visit - John Smith',
      start: new Date(),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000),
      type: 'site_visit',
      leadName: 'John Smith',
    },
    {
      id: '2',
      title: 'Installation - 23 Oak St',
      start: new Date(Date.now() + 24 * 60 * 60 * 1000),
      end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      type: 'installation',
    },
  ])
  const [selectedEvent, setSelectedEvent] = useState<DiaryEvent | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewEvent, setIsNewEvent] = useState(false)
  const [newEventData, setNewEventData] = useState<Partial<DiaryEvent>>({})

  const handleEventClick = useCallback((info: EventClickArg) => {
    const event = events.find(e => e.id === info.event.id)
    if (event) {
      setSelectedEvent(event)
      setIsModalOpen(true)
      setIsNewEvent(false)
    }
  }, [events])

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    setNewEventData({
      start: info.start,
      end: info.end,
      type: 'site_visit',
    })
    setIsNewEvent(true)
    setIsModalOpen(true)
  }, [])

  const handleCreateEvent = useCallback(() => {
    if (!newEventData.title || !newEventData.start) return

    const newEvent: DiaryEvent = {
      id: `event-${Date.now()}`,
      title: newEventData.title,
      start: newEventData.start,
      end: newEventData.end || new Date(newEventData.start.getTime() + 60 * 60 * 1000),
      type: newEventData.type || 'site_visit',
      notes: newEventData.notes,
    }

    setEvents(prev => [...prev, newEvent])
    setIsModalOpen(false)
    setNewEventData({})
  }, [newEventData])

  const handleDeleteEvent = useCallback(() => {
    if (!selectedEvent) return
    setEvents(prev => prev.filter(e => e.id !== selectedEvent.id))
    setIsModalOpen(false)
    setSelectedEvent(null)
  }, [selectedEvent])

  const calendarEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    backgroundColor: eventTypeColors[event.type],
    borderColor: eventTypeColors[event.type],
  }))

  return (
    <div className="diary-app">
      <div className="diary-header">
        <h2>🗓 Diary</h2>
        <div className="diary-legend">
          {Object.entries(eventTypeLabels).map(([type, label]) => (
            <span key={type} className="diary-legend-item">
              <span 
                className="diary-legend-dot" 
                style={{ backgroundColor: eventTypeColors[type as EventType] }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="diary-calendar">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={calendarEvents}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          eventClick={handleEventClick}
          select={handleDateSelect}
          height="100%"
        />
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <div className="diary-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="diary-modal" onClick={e => e.stopPropagation()}>
            <div className="diary-modal-header">
              <h3>{isNewEvent ? 'New Event' : selectedEvent?.title}</h3>
              <button className="diary-modal-close" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="diary-modal-content">
              {isNewEvent ? (
                <>
                  <div className="diary-form-row">
                    <label>Title</label>
                    <input
                      type="text"
                      value={newEventData.title || ''}
                      onChange={e => setNewEventData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Event title..."
                    />
                  </div>

                  <div className="diary-form-row">
                    <label>Type</label>
                    <select
                      value={newEventData.type || 'site_visit'}
                      onChange={e => setNewEventData(prev => ({ 
                        ...prev, 
                        type: e.target.value as EventType 
                      }))}
                    >
                      {Object.entries(eventTypeLabels).map(([type, label]) => (
                        <option key={type} value={type}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="diary-form-row">
                    <label>Date & Time</label>
                    <span className="diary-date-display">
                      {newEventData.start && format(newEventData.start, 'PPP p')}
                      {newEventData.end && newEventData.start !== newEventData.end && (
                        <> - {format(newEventData.end, 'p')}</>
                      )}
                    </span>
                  </div>

                  <div className="diary-form-row">
                    <label>Notes</label>
                    <textarea
                      value={newEventData.notes || ''}
                      onChange={e => setNewEventData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Add notes..."
                      rows={3}
                    />
                  </div>

                  <div className="diary-modal-actions">
                    <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                      Cancel
                    </button>
                    <button className="btn-primary" onClick={handleCreateEvent}>
                      Create Event
                    </button>
                  </div>
                </>
              ) : selectedEvent && (
                <>
                  <div className="diary-event-detail">
                    <span 
                      className="diary-event-type-badge"
                      style={{ backgroundColor: eventTypeColors[selectedEvent.type] }}
                    >
                      {eventTypeLabels[selectedEvent.type]}
                    </span>
                  </div>

                  <div className="diary-event-detail">
                    <label>📅 Date & Time</label>
                    <p>
                      {format(selectedEvent.start, 'PPP')}
                      <br />
                      {format(selectedEvent.start, 'p')} - {format(selectedEvent.end, 'p')}
                    </p>
                  </div>

                  {selectedEvent.leadName && (
                    <div className="diary-event-detail">
                      <label>👤 Lead</label>
                      <p>{selectedEvent.leadName}</p>
                    </div>
                  )}

                  {selectedEvent.notes && (
                    <div className="diary-event-detail">
                      <label>📝 Notes</label>
                      <p>{selectedEvent.notes}</p>
                    </div>
                  )}

                  <div className="diary-modal-actions">
                    <button className="btn-danger" onClick={handleDeleteEvent}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
