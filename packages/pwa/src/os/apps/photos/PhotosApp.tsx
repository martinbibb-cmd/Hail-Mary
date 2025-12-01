import React, { useState, useRef, useCallback, useEffect } from 'react'
import './PhotosApp.css'

interface CapturedPhoto {
  id: string
  dataUrl: string
  timestamp: Date
  description?: string
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

  const startCamera = useCallback(async () => {
    try {
      setError(null)
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
    } catch (err) {
      console.error('Camera access failed:', err)
      setError('Unable to access camera. Please ensure camera permissions are granted.')
    }
  }, [facingMode])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }, [stream])

  const capturePhoto = useCallback(() => {
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

    // Create new photo entry
    const newPhoto: CapturedPhoto = {
      id: `photo-${Date.now()}`,
      dataUrl,
      timestamp: new Date(),
    }

    setPhotos(prev => [newPhoto, ...prev])
  }, [])

  const toggleFacingMode = useCallback(async () => {
    stopCamera()
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [stopCamera])

  const deletePhoto = useCallback((photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId))
    setSelectedPhoto(null)
  }, [])

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isStreaming) {
      startCamera()
    }
  }, [facingMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

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
          </div>
          <div className="photo-detail-actions">
            <button className="btn-danger" onClick={() => deletePhoto(selectedPhoto.id)}>
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="photos-app">
      <div className="photos-app-header">
        <h2>📸 Photos</h2>
        {isStreaming && (
          <button className="btn-icon" onClick={toggleFacingMode} title="Switch Camera">
            🔄
          </button>
        )}
      </div>

      {/* Camera View */}
      <div className="camera-section">
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
              <div className="camera-controls">
                <button className="btn-capture" onClick={capturePhoto}>
                  <span className="capture-icon">📸</span>
                </button>
                <button className="btn-stop" onClick={stopCamera}>
                  ✕ Close
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Photo Gallery */}
      <div className="photos-gallery">
        <h3>Captured Photos ({photos.length})</h3>
        {photos.length === 0 ? (
          <p className="photos-empty">No photos captured yet. Use the camera above to take photos.</p>
        ) : (
          <div className="photos-grid">
            {photos.map(photo => (
              <button
                key={photo.id}
                className="photo-thumbnail"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img src={photo.dataUrl} alt="Captured" />
                <span className="photo-time">
                  {photo.timestamp.toLocaleTimeString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
