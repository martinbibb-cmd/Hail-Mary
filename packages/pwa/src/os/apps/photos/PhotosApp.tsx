import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useLeadStore } from '../../../stores/leadStore'
import './PhotosApp.css'

interface PhotoLocation {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  altitudeAccuracy: number | null
}

/**
 * Calculate haversine distance between two points on Earth
 * @returns Distance in meters
 */
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in meters
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * Calculate 3D distance (includes altitude difference)
 */
function calculate3DDistance(
  horizontalDistance: number,
  alt1: number | null,
  alt2: number | null
): { horizontal: number; vertical: number | null; total3D: number | null } {
  // If both altitudes are available, compute 3D distance
  if (alt1 != null && alt2 != null) {
    const vertical = Math.abs(alt2 - alt1)
    const total3D = Math.sqrt(horizontalDistance * horizontalDistance + vertical * vertical)
    return { horizontal: horizontalDistance, vertical, total3D }
  }
  
  return { horizontal: horizontalDistance, vertical: null, total3D: null }
}

/**
 * Format distance for display
 */
function formatDistance(meters: number): string {
  if (meters < 1) {
    return '<1m'
  } else if (meters < 1000) {
    return `${Math.round(meters)}m`
  } else {
    return `${(meters / 1000).toFixed(2)}km`
  }
}

interface PhotoMetadata {
  location?: PhotoLocation
  deviceInfo?: {
    userAgent: string
    platform: string
  }
}

interface CapturedPhoto {
  id: string
  dataUrl: string
  timestamp: Date
  description?: string
  notes?: string
  metadata?: PhotoMetadata
  category?: string
  leadId?: string | number
  fileId?: number
}

interface LeadStoreState {
  currentLeadId: string | null
}

export const PhotosApp: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [photos, setPhotos] = useState<CapturedPhoto[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<CapturedPhoto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt')
  const [isSaving, setIsSaving] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesText, setNotesText] = useState('')
  
  const currentLeadId = useLeadStore((state: LeadStoreState) => state.currentLeadId)

  // Calculate distance from previous photo (per visit/lead)
  const distanceInfo = useMemo(() => {
    if (!selectedPhoto?.metadata?.location) return null
    
    // Find the previous photo in the list (photos are sorted newest first)
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id)
    if (currentIndex === -1 || currentIndex >= photos.length - 1) return null
    
    // Get the next photo in the array (which is the previous chronologically)
    const previousPhoto = photos[currentIndex + 1]
    if (!previousPhoto?.metadata?.location) return null
    
    const currentLoc = selectedPhoto.metadata.location
    const prevLoc = previousPhoto.metadata.location
    
    const horizontalDistance = getDistanceFromLatLonInMeters(
      currentLoc.latitude,
      currentLoc.longitude,
      prevLoc.latitude,
      prevLoc.longitude
    )
    
    return calculate3DDistance(
      horizontalDistance,
      currentLoc.altitude,
      prevLoc.altitude
    )
  }, [selectedPhoto, photos])

  const getStorageKey = useCallback((leadId: string | null) => {
    return leadId ? `hail-mary:photos:${leadId}` : null
  }, [])

  // Load persisted photos for the active lead (so refresh keeps attachment)
  useEffect(() => {
    const storageKey = getStorageKey(currentLeadId)
    if (!storageKey) return

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        setPhotos([])
        setSelectedPhoto(null)
        return
      }

      const parsed: Array<Omit<CapturedPhoto, 'timestamp'> & { timestamp: string }> = JSON.parse(raw)
      const hydrated: CapturedPhoto[] = parsed.map((p) => ({
        ...p,
        timestamp: new Date(p.timestamp),
      }))

      setPhotos(hydrated)
      setSelectedPhoto(null)
    } catch (err) {
      console.warn('Failed to load persisted photos for lead:', err)
      setPhotos([])
      setSelectedPhoto(null)
    }
  }, [currentLeadId, getStorageKey])

  // Persist photos per active lead
  useEffect(() => {
    const storageKey = getStorageKey(currentLeadId)
    if (!storageKey) return

    try {
      const serializable = photos.map((p) => ({
        ...p,
        timestamp: p.timestamp.toISOString(),
      }))
      localStorage.setItem(storageKey, JSON.stringify(serializable))
    } catch (err) {
      console.warn('Failed to persist photos for lead:', err)
    }
  }, [currentLeadId, getStorageKey, photos])

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      
      // Request location permission
      if ('geolocation' in navigator && locationPermission === 'prompt') {
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          setLocationPermission(result.state as 'granted' | 'denied' | 'prompt')
        }).catch(() => {
          // Fallback if permissions API not available
          setLocationPermission('prompt')
        })
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }
      
      setStream(mediaStream)
      setIsStreaming(true)
      setIsFullScreen(true)
    } catch (err) {
      console.error('Camera access failed:', err)
      // Provide specific error messages based on error type
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied. Please grant camera permission in your browser settings.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera and try again.')
        } else if (err.name === 'NotReadableError') {
          setError('Camera is in use by another application. Please close other apps using the camera.')
        } else {
          setError(`Camera error: ${err.message}`)
        }
      } else {
        setError('Unable to access camera. Please ensure camera permissions are granted.')
      }
    }
  }, [facingMode, locationPermission])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
    setIsFullScreen(false)
  }, [stream])

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0)

    // Get image data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

    // Capture location if available (including altitude)
    let location: PhotoLocation | undefined
    if ('geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 60000,
            enableHighAccuracy: true, // Request high accuracy to get altitude when available
          })
        })
        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
        }
        setLocationPermission('granted')
      } catch (err) {
        const geoError = err as GeolocationPositionError
        console.warn('Failed to get location:', geoError)
        
        // Provide user-friendly error messages
        if (geoError.code === 1) {
          setLocationPermission('denied')
          console.info('Location permission denied by user')
        } else if (geoError.code === 2) {
          console.warn('Location position unavailable')
        } else if (geoError.code === 3) {
          console.warn('Location request timed out')
        }
      }
    }

    // Capture device metadata
    const metadata: PhotoMetadata = {
      location,
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      },
    }

    // Create new photo entry
    const newPhoto: CapturedPhoto = {
      id: `photo-${Date.now()}`,
      dataUrl,
      timestamp: new Date(),
      metadata,
      leadId: currentLeadId ? parseInt(currentLeadId, 10) : undefined,
    }

    setPhotos(prev => [newPhoto, ...prev])
  }, [currentLeadId])

  const toggleFacingMode = useCallback(async () => {
    stopCamera()
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [stopCamera])

  const deletePhoto = useCallback((photoId: string) => {
    setPhotos((prev: CapturedPhoto[]) => prev.filter((p: CapturedPhoto) => p.id !== photoId))
    setSelectedPhoto(null)
  }, [])

  const savePhotoNotes = useCallback(async () => {
    if (!selectedPhoto) return
    
    setIsSaving(true)
    try {
      // Update local photo with notes
      const updatedPhoto = { ...selectedPhoto, notes: notesText }
      setPhotos((prev: CapturedPhoto[]) => prev.map((p: CapturedPhoto) => p.id === selectedPhoto.id ? updatedPhoto : p))
      setSelectedPhoto(updatedPhoto)
      setEditingNotes(false)
      
      // TODO: Save to backend if photo has fileId
      if (updatedPhoto.fileId && updatedPhoto.leadId) {
        const response = await fetch(`/api/leads/${updatedPhoto.leadId}/photos/${updatedPhoto.fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            caption: notesText,
          }),
        })
        
        if (!response.ok) {
          console.warn('Failed to save notes to backend')
        }
      }
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setIsSaving(false)
    }
  }, [selectedPhoto, notesText])

  const uploadPhotoToBackend = useCallback(async (photo: CapturedPhoto) => {
    if (!photo.leadId) {
      const errorMsg = 'Cannot upload photo without an active lead. Please select a lead first.'
      console.warn(errorMsg)
      setError(errorMsg)
      return
    }

    try {
      // Convert dataUrl to blob
      const response = await fetch(photo.dataUrl)
      const blob = await response.blob()
      
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', blob, `photo-${photo.id}.jpg`)
      formData.append('category', photo.category || 'property')
      
      // Upload to files API
      const uploadResponse = await fetch('/api/files', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        throw new Error(`File upload failed (${uploadResponse.status}): ${errorData.error || uploadResponse.statusText}`)
      }
      
      const uploadResult = await uploadResponse.json()
      const fileId = uploadResult.data.id
      
      // Create photo record in leadPhotos
      const photoResponse = await fetch(`/api/leads/${photo.leadId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileId,
          category: photo.category || 'property',
          caption: photo.notes || photo.description,
          takenAt: photo.timestamp.toISOString(),
        }),
      })
      
      if (!photoResponse.ok) {
        const errorData = await photoResponse.json().catch(() => ({}))
        throw new Error(`Photo record creation failed (${photoResponse.status}): ${errorData.error || photoResponse.statusText}`)
      }
      
      const photoResult = await photoResponse.json()
      
      // Update local photo with backend IDs
      setPhotos((prev: CapturedPhoto[]) => prev.map((p: CapturedPhoto) => 
        p.id === photo.id 
          ? { ...p, fileId: photoResult.data.id }
          : p
      ))
      
      return photoResult.data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Error uploading photo:', errorMessage)
      setError(errorMessage)
      throw error
    }
  }, [])

  // Restart camera when facing mode changes
  // Note: We only want to restart when facingMode changes, not when startCamera reference changes
  useEffect(() => {
    if (isStreaming) {
      startCamera()
    }
  }, [facingMode, isStreaming, startCamera])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      }
    }
  }, [stream])

  // Initialize notes text when photo is selected
  useEffect(() => {
    if (selectedPhoto) {
      setNotesText(selectedPhoto.notes || '')
      setEditingNotes(false)
    }
  }, [selectedPhoto])

  // Photo detail view
  if (selectedPhoto) {
    return (
      <div className="photos-app">
        <div className="photos-app-header">
          <button className="btn-back" onClick={() => setSelectedPhoto(null)}>
            ← Back
          </button>
          <h2>Photo Detail</h2>
        </div>

        <div className="photo-detail">
          <img src={selectedPhoto.dataUrl} alt="Captured" className="photo-detail-image" />
          
          <div className="photo-detail-info">
            <p className="photo-timestamp">
              📅 {selectedPhoto.timestamp.toLocaleString()}
            </p>
            
            {selectedPhoto.metadata?.location && (
              <div className="photo-location">
                <p className="photo-location-text">
                  📍 Location: {selectedPhoto.metadata.location.latitude.toFixed(6)}, {selectedPhoto.metadata.location.longitude.toFixed(6)}
                </p>
                <p className="photo-location-accuracy">
                  Accuracy: ±{Math.round(selectedPhoto.metadata.location.accuracy)}m
                </p>
                
                {/* Altitude display */}
                {selectedPhoto.metadata.location.altitude !== null && (
                  <p className="photo-altitude">
                    ⛰️ Altitude: {Math.round(selectedPhoto.metadata.location.altitude)}m
                    {selectedPhoto.metadata.location.altitudeAccuracy !== null && (
                      <span className="photo-altitude-accuracy">
                        {' '}(±{Math.round(selectedPhoto.metadata.location.altitudeAccuracy)}m)
                      </span>
                    )}
                  </p>
                )}
                
                {/* Distance from previous photo */}
                {distanceInfo && (
                  <div className="photo-distance">
                    <p className="photo-distance-text">
                      📏 Distance from previous: {formatDistance(distanceInfo.horizontal)}
                    </p>
                    {distanceInfo.vertical != null && distanceInfo.total3D != null && (
                      <p className="photo-distance-3d">
                        ↕️ Vertical: {formatDistance(distanceInfo.vertical)} • 
                        3D: {formatDistance(distanceInfo.total3D)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {!selectedPhoto.metadata?.location && locationPermission === 'denied' && (
              <p className="photo-no-location">
                📍 Location not available (permission denied)
              </p>
            )}
          </div>

          <div className="photo-notes-section">
            <div className="photo-notes-header">
              <h3>Notes</h3>
              {!editingNotes && (
                <button 
                  className="btn-edit" 
                  onClick={() => setEditingNotes(true)}
                  disabled={isSaving}
                >
                  ✏️ Edit
                </button>
              )}
            </div>
            
            {editingNotes ? (
              <div className="photo-notes-edit">
                <textarea
                  className="photo-notes-textarea"
                  value={notesText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotesText(e.target.value)}
                  placeholder="Add notes about this photo..."
                  rows={4}
                  autoFocus
                />
                <div className="photo-notes-actions">
                  <button 
                    className="btn-primary" 
                    onClick={savePhotoNotes}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : '💾 Save'}
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => {
                      setNotesText(selectedPhoto.notes || '')
                      setEditingNotes(false)
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="photo-notes-display">
                {selectedPhoto.notes ? (
                  <p>{selectedPhoto.notes}</p>
                ) : (
                  <p className="photo-notes-empty">No notes added yet</p>
                )}
              </div>
            )}
          </div>

          <div className="photo-detail-actions">
            {!selectedPhoto.fileId && selectedPhoto.leadId && (
              <button 
                className="btn-primary" 
                onClick={() => uploadPhotoToBackend(selectedPhoto)}
                disabled={isSaving}
              >
                ☁️ Upload to Lead
              </button>
            )}
            <button className="btn-danger" onClick={() => deletePhoto(selectedPhoto.id)}>
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`photos-app ${isFullScreen ? 'photos-app-fullscreen' : ''}`}>
      {!isFullScreen && (
        <div className="photos-app-header">
          <h2>📸 Photos</h2>
          {!currentLeadId && (
            <span className="photos-warning">⚠️ No lead selected</span>
          )}
        </div>
      )}

      {/* Camera View */}
      <div className={`camera-section ${isFullScreen ? 'camera-section-fullscreen' : ''}`}>
        {error && (
          <div className="camera-error">
            <p>{error}</p>
            <button className="btn-primary" onClick={startCamera}>
              Try Again
            </button>
          </div>
        )}

        {!error && (
          <div className="camera-container">
            <video
              ref={videoRef}
              className={`camera-video ${isStreaming ? 'active' : ''}`}
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="camera-canvas" />

            {!isStreaming ? (
              <div className="camera-placeholder">
                <button className="btn-primary btn-large" onClick={startCamera}>
                  📷 Start Camera
                </button>
              </div>
            ) : (
              <>
                {isFullScreen && (
                  <div className="camera-fullscreen-header">
                    <button className="btn-exit-fullscreen" onClick={stopCamera}>
                      ✕ Exit
                    </button>
                    <button className="btn-icon-fullscreen" onClick={toggleFacingMode} title="Switch Camera">
                      🔄
                    </button>
                  </div>
                )}
                <div className="camera-controls">
                  <button className="btn-capture" onClick={capturePhoto}>
                    <span className="capture-icon">📸</span>
                  </button>
                  {!isFullScreen && (
                    <button className="btn-stop" onClick={stopCamera}>
                      ✕ Close
                    </button>
                  )}
                </div>
                {locationPermission === 'granted' && (
                  <div className="camera-location-indicator">
                    📍 Location enabled
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Photo Gallery - Hidden in fullscreen */}
      {!isFullScreen && (
        <div className="photos-gallery">
          <h3>Captured Photos ({photos.length})</h3>
          {photos.length === 0 ? (
            <p className="photos-empty">No photos captured yet. Use the camera above to take photos.</p>
          ) : (
            <div className="photos-grid">
              {photos.map((photo: CapturedPhoto) => (
                <button
                  key={photo.id}
                  className="photo-thumbnail"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img src={photo.dataUrl} alt="Captured" />
                  <span className="photo-time">
                    {photo.timestamp.toLocaleTimeString()}
                  </span>
                  {photo.metadata?.location && (
                    <span className="photo-has-location" title="Has location data">
                      📍
                    </span>
                  )}
                  {photo.notes && (
                    <span className="photo-has-notes" title="Has notes">
                      📝
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
