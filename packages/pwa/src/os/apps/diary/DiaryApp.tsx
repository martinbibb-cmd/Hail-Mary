import React, { useState, useCallback, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core'
import { format } from 'date-fns'
import { useSpineStore } from '../../../stores/spineStore'
import './DiaryApp.css'

// Use relative URL to work in both dev and production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export type AppointmentType = 'SURVEY' | 'REVISIT' | 'CALLBACK' | 'INSTALL' | 'SERVICE_REPAIR'
export type AppointmentStatus = 'PLANNED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

export interface Appointment {
  id: string
  addressId: string
  type: AppointmentType
  status: AppointmentStatus
  startAt: string
  endAt: string | null
  createdByUserId: number
  assignedUserId: number | null
  notesRichText: string | null
  createdAt: string
  updatedAt: string
}

export interface DiaryEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: AppointmentType
  status: AppointmentStatus
  addressId: string
  notes?: string | null
}

const appointmentTypeColors: Record<AppointmentType, string> = {
  SURVEY: '#3b82f6',
  INSTALL: '#10b981',
  REVISIT: '#f59e0b',
  CALLBACK: '#8b5cf6',
  SERVICE_REPAIR: '#ef4444',
}

const appointmentTypeLabels: Record<AppointmentType, string> = {
  SURVEY: 'Survey',
  INSTALL: 'Installation',
  REVISIT: 'Revisit',
  CALLBACK: 'Callback',
  SERVICE_REPAIR: 'Service/Repair',
}

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  PLANNED: 'Planned',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const DiaryApp: React.FC = () => {
  const { activeAddress } = useSpineStore()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<DiaryEvent | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewEvent, setIsNewEvent] = useState(false)
  const [newEventData, setNewEventData] = useState<Partial<DiaryEvent>>({})

  // Fetch appointments from API
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const url = `${API_BASE_URL}/api/address-appointments`
      console.log('Fetching appointments from:', url)

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Fetch failed with status:', response.status, errorText)
        throw new Error(`Failed to fetch appointments (${response.status})`)
      }

      const data = await response.json()

      if (data.success && data.data?.appointments) {
        setAppointments(data.data.appointments)
      } else {
        throw new Error(data.error || 'Failed to fetch appointments')
      }
    } catch (err) {
      const errorMessage = (err as Error).message || 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load appointments on mount
  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const handleEventClick = useCallback((info: EventClickArg) => {
    const appointment = appointments.find(a => a.id === info.event.id)
    if (appointment) {
      const event: DiaryEvent = {
        id: appointment.id,
        title: appointmentTypeLabels[appointment.type],
        start: new Date(appointment.startAt),
        end: new Date(appointment.endAt || appointment.startAt),
        type: appointment.type,
        status: appointment.status,
        addressId: appointment.addressId,
        notes: appointment.notesRichText,
      }
      setSelectedEvent(event)
      setIsModalOpen(true)
      setIsNewEvent(false)
    }
  }, [appointments])

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    if (!activeAddress) {
      alert('Please select an address first from the Addresses app')
      return
    }

    setNewEventData({
      start: info.start,
      end: info.end,
      type: 'SURVEY',
      status: 'PLANNED',
      addressId: activeAddress.id,
    })
    setIsNewEvent(true)
    setIsModalOpen(true)
  }, [activeAddress])

  const handleCreateEvent = useCallback(async () => {
    if (!newEventData.start || !newEventData.type || !newEventData.addressId) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/addresses/${newEventData.addressId}/appointments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            type: newEventData.type,
            status: newEventData.status || 'PLANNED',
            startAt: newEventData.start.toISOString(),
            endAt: newEventData.end?.toISOString() || null,
            notes: newEventData.notes || null,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create appointment')
      }

      // Refresh appointments
      await fetchAppointments()

      setIsModalOpen(false)
      setNewEventData({})
    } catch (err) {
      alert(`Error creating appointment: ${(err as Error).message}`)
      console.error('Error creating appointment:', err)
    }
  }, [newEventData, fetchAppointments])

  const handleUpdateEvent = useCallback(async (updates: Partial<Appointment>) => {
    if (!selectedEvent) return

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/address-appointments/${selectedEvent.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(updates),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update appointment')
      }

      // Refresh appointments
      await fetchAppointments()

      setIsModalOpen(false)
      setSelectedEvent(null)
    } catch (err) {
      alert(`Error updating appointment: ${(err as Error).message}`)
      console.error('Error updating appointment:', err)
    }
  }, [selectedEvent, fetchAppointments])

  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEvent) return

    if (!confirm('Are you sure you want to cancel this appointment?')) return

    // Mark as cancelled instead of deleting
    await handleUpdateEvent({ status: 'CANCELLED' })
  }, [selectedEvent, handleUpdateEvent])

  // Convert appointments to calendar events
  const calendarEvents = appointments
    .filter(apt => apt.status !== 'CANCELLED') // Hide cancelled appointments
    .map(appointment => ({
      id: appointment.id,
      title: `${appointmentTypeLabels[appointment.type]} - ${appointmentStatusLabels[appointment.status]}`,
      start: new Date(appointment.startAt),
      end: new Date(appointment.endAt || appointment.startAt),
      backgroundColor: appointmentTypeColors[appointment.type],
      borderColor: appointmentTypeColors[appointment.type],
    }))

  if (loading && appointments.length === 0) {
    return (
      <div className="diary-app">
        <div className="diary-header">
          <h2>🗓 Diary</h2>
        </div>
        <div className="diary-loading">
          <p>Loading appointments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="diary-app">
      <div className="diary-header">
        <h2>🗓 Diary</h2>
        {activeAddress && (
          <div className="diary-active-address">
            <span className="diary-address-label">Active:</span>
            <span className="diary-address-value">
              {activeAddress.customerName} - {activeAddress.postcode}
            </span>
          </div>
        )}
        <div className="diary-legend">
          {Object.entries(appointmentTypeLabels).map(([type, label]) => (
            <span key={type} className="diary-legend-item">
              <span
                className="diary-legend-dot"
                style={{ backgroundColor: appointmentTypeColors[type as AppointmentType] }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="diary-error">
          <p>⚠️ {error}</p>
          <button onClick={fetchAppointments}>Retry</button>
        </div>
      )}

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
              <h3>{isNewEvent ? 'New Appointment' : selectedEvent?.title}</h3>
              <button className="diary-modal-close" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="diary-modal-content">
              {isNewEvent ? (
                <>
                  {!activeAddress && (
                    <div className="diary-warning">
                      ⚠️ Please select an address first from the Addresses app
                    </div>
                  )}

                  <div className="diary-form-row">
                    <label>Type</label>
                    <select
                      value={newEventData.type || 'SURVEY'}
                      onChange={e => setNewEventData(prev => ({
                        ...prev,
                        type: e.target.value as AppointmentType
                      }))}
                    >
                      {Object.entries(appointmentTypeLabels).map(([type, label]) => (
                        <option key={type} value={type}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="diary-form-row">
                    <label>Status</label>
                    <select
                      value={newEventData.status || 'PLANNED'}
                      onChange={e => setNewEventData(prev => ({
                        ...prev,
                        status: e.target.value as AppointmentStatus
                      }))}
                    >
                      {Object.entries(appointmentStatusLabels).map(([status, label]) => (
                        <option key={status} value={status}>{label}</option>
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
                    <button
                      className="btn-primary"
                      onClick={handleCreateEvent}
                      disabled={!activeAddress}
                    >
                      Create Appointment
                    </button>
                  </div>
                </>
              ) : selectedEvent && (
                <>
                  <div className="diary-event-detail">
                    <span
                      className="diary-event-type-badge"
                      style={{ backgroundColor: appointmentTypeColors[selectedEvent.type] }}
                    >
                      {appointmentTypeLabels[selectedEvent.type]}
                    </span>
                    <span className="diary-event-status-badge">
                      {appointmentStatusLabels[selectedEvent.status]}
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

                  {selectedEvent.notes && (
                    <div className="diary-event-detail">
                      <label>📝 Notes</label>
                      <div
                        className="diary-notes-content"
                        dangerouslySetInnerHTML={{ __html: selectedEvent.notes }}
                      />
                    </div>
                  )}

                  <div className="diary-modal-actions">
                    {selectedEvent.status === 'PLANNED' && (
                      <button
                        className="btn-primary"
                        onClick={() => handleUpdateEvent({ status: 'CONFIRMED' })}
                      >
                        Confirm
                      </button>
                    )}
                    {selectedEvent.status === 'CONFIRMED' && (
                      <button
                        className="btn-success"
                        onClick={() => handleUpdateEvent({ status: 'COMPLETED' })}
                      >
                        Mark Complete
                      </button>
                    )}
                    <button className="btn-danger" onClick={handleDeleteEvent}>
                      Cancel Appointment
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
