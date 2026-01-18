import React, { useState, useEffect, useRef } from 'react';
import { useSpineStore } from '../../../stores/spineStore';
import './PhotoLibraryApp.css';

interface Photo {
  id: number;
  postcode: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  storagePath: string;
  notes: string | null;
  tag: string | null;
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
}

interface PhotoMetadata {
  file: File;
  notes: string;
  tag: string;
  latitude: number | null;
  longitude: number | null;
}

const PHOTO_TAGS = [
  'boiler',
  'flue',
  'meter',
  'radiators',
  'cylinder',
  'consumer_unit',
  'pipework',
  'thermostat',
  'external',
  'roof',
  'other',
];

export const PhotoLibraryApp: React.FC = () => {
  const activeAddress = useSpineStore((s) => s.activeAddress);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoMetadata[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Form state
  const [postcode, setPostcode] = useState('');
  const [notes, setNotes] = useState('');
  const [tag, setTag] = useState('');
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPhotos();
  }, []);

  useEffect(() => {
    // Request location permission
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setLocationEnabled(true);
        },
        (err) => {
          console.warn('Location access denied:', err);
          setLocationEnabled(false);
        }
      );
    }
  }, []);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/photos?limit=100', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data) {
        setPhotos(data.data);
      } else {
        setError(data.error || 'Failed to load photos');
      }
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    if (!activeAddress) {
      alert('Please select an address first from the Addresses app');
      return;
    }
    setShowModal(true);
    resetForm();
    // Auto-set postcode from active address
    setPostcode(activeAddress.postcode);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setPostcode('');
    setNotes('');
    setTag('');
    setSelectedPhotos([]);
    setCurrentPhotoIndex(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const photoMetadataList: PhotoMetadata[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      photoMetadataList.push({
        file,
        notes: '',
        tag: '',
        latitude: locationEnabled && currentLocation ? currentLocation.lat : null,
        longitude: locationEnabled && currentLocation ? currentLocation.lon : null,
      });
    }

    setSelectedPhotos(photoMetadataList);
    setCurrentPhotoIndex(0);
  };

  const handleUpdateCurrentPhoto = () => {
    if (currentPhotoIndex >= selectedPhotos.length) return;

    const updated = [...selectedPhotos];
    updated[currentPhotoIndex] = {
      ...updated[currentPhotoIndex],
      notes,
      tag,
      latitude: locationEnabled && currentLocation ? currentLocation.lat : null,
      longitude: locationEnabled && currentLocation ? currentLocation.lon : null,
    };

    setSelectedPhotos(updated);

    // Move to next photo or upload if this was the last one
    if (currentPhotoIndex < selectedPhotos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
      // Load metadata for next photo
      const nextPhoto = updated[currentPhotoIndex + 1];
      setNotes(nextPhoto.notes);
      setTag(nextPhoto.tag);
    }
  };

  const handleUploadAll = async () => {
    // REQUIRED: addressId must be present to anchor photos
    if (!activeAddress?.id) {
      alert('Please select an address first from the Addresses app');
      return;
    }

    if (!postcode.trim()) {
      alert('Postcode is required');
      return;
    }

    if (selectedPhotos.length === 0) {
      alert('Please select at least one photo');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload photos one by one
      for (const photoMeta of selectedPhotos) {
        const formData = new FormData();
        formData.append('photo', photoMeta.file);
        formData.append('addressId', activeAddress.id); // REQUIRED: anchor to property
        formData.append('postcode', postcode.trim());
        if (photoMeta.notes) {
          formData.append('notes', photoMeta.notes);
        }
        if (photoMeta.tag) {
          formData.append('tag', photoMeta.tag);
        }
        if (photoMeta.latitude !== null) {
          formData.append('latitude', String(photoMeta.latitude));
        }
        if (photoMeta.longitude !== null) {
          formData.append('longitude', String(photoMeta.longitude));
        }

        const response = await fetch('/api/photos', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to upload photo');
        }
      }

      await fetchPhotos();
      handleCloseModal();
    } catch (err) {
      console.error('Error uploading photos:', err);
      setError((err as Error).message || 'Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        await fetchPhotos();
        setSelectedPhoto(null);
      } else {
        alert(data.error || 'Failed to delete photo');
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
      alert('Failed to delete photo');
    }
  };

  const currentPhoto = selectedPhotos[currentPhotoIndex];

  return (
    <div className="photo-library-app">
      <div className="photo-library-header">
        <h2>Photo Library</h2>
        <button className="btn-primary" onClick={handleOpenModal}>
          Add Photos
        </button>
      </div>

      {loading && <div className="loading">Loading photos...</div>}

      {error && !showModal && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {!loading && photos.length === 0 && (
        <div className="empty-state">
          <p>No photos yet. Add your first one!</p>
        </div>
      )}

      {!loading && photos.length > 0 && (
        <div className="photos-grid">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="photo-card"
              onClick={() => setSelectedPhoto(photo)}
            >
              <div className="photo-thumbnail">
                <img src={`/uploads/${photo.filename}`} alt={photo.filename} loading="lazy" />
              </div>
              <div className="photo-info">
                <div className="photo-postcode">{photo.postcode}</div>
                {photo.tag && <div className="photo-tag">{photo.tag}</div>}
                <div className="photo-date">
                  {new Date(photo.createdAt).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content modal-photo-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedPhoto.filename}</h3>
              <button className="modal-close" onClick={() => setSelectedPhoto(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <img
                src={`/uploads/${selectedPhoto.filename}`}
                alt={selectedPhoto.filename}
                className="photo-full"
              />
              <div className="photo-details">
                <div className="detail-row">
                  <span className="detail-label">Postcode:</span>
                  <span className="detail-value">{selectedPhoto.postcode}</span>
                </div>
                {selectedPhoto.tag && (
                  <div className="detail-row">
                    <span className="detail-label">Tag:</span>
                    <span className="detail-value">{selectedPhoto.tag}</span>
                  </div>
                )}
                {selectedPhoto.notes && (
                  <div className="detail-row">
                    <span className="detail-label">Notes:</span>
                    <span className="detail-value">{selectedPhoto.notes}</span>
                  </div>
                )}
                {selectedPhoto.latitude && selectedPhoto.longitude && (
                  <div className="detail-row">
                    <span className="detail-label">Location:</span>
                    <span className="detail-value">
                      {selectedPhoto.latitude}, {selectedPhoto.longitude}
                    </span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Size:</span>
                  <span className="detail-value">
                    {(selectedPhoto.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Uploaded:</span>
                  <span className="detail-value">
                    {new Date(selectedPhoto.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>
              </div>
              <button
                className="btn-danger"
                onClick={() => handleDeletePhoto(selectedPhoto.id)}
              >
                Delete Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Photos</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="error-message">
                  {error}
                  <button onClick={() => setError(null)}>×</button>
                </div>
              )}

              {activeAddress && (
                <div className="active-address-info">
                  <div className="info-label">Attaching to:</div>
                  <div className="info-value">
                    <strong>{activeAddress.customerName || activeAddress.line1}</strong>
                    {activeAddress.line2 && <div>{activeAddress.line2}</div>}
                    {activeAddress.town && <div>{activeAddress.town}</div>}
                    <div>{activeAddress.postcode}</div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="photos">
                  Select Photos <span className="required">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                {selectedPhotos.length > 0 && (
                  <div className="files-selected">
                    {selectedPhotos.length} photo(s) selected
                    {currentPhotoIndex < selectedPhotos.length && (
                      <span> - Editing {currentPhotoIndex + 1} of {selectedPhotos.length}</span>
                    )}
                  </div>
                )}
              </div>

              {currentPhoto && (
                <>
                  <div className="current-photo-preview">
                    <img
                      src={URL.createObjectURL(currentPhoto.file)}
                      alt="Preview"
                      className="preview-image"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="tag">Tag (optional)</label>
                    <select
                      id="tag"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      disabled={uploading}
                    >
                      <option value="">Select a tag...</option>
                      {PHOTO_TAGS.map((t) => (
                        <option key={t} value={t}>
                          {t.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="notes">Notes (optional)</label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add description or notes..."
                      rows={3}
                      disabled={uploading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={locationEnabled && currentLocation !== null}
                        disabled
                      />
                      <span>
                        Location {locationEnabled ? 'enabled' : 'disabled'}
                        {currentLocation && ` (${currentLocation.lat.toFixed(6)}, ${currentLocation.lon.toFixed(6)})`}
                      </span>
                    </label>
                  </div>

                  {currentPhotoIndex < selectedPhotos.length - 1 && (
                    <button
                      className="btn-secondary"
                      onClick={handleUpdateCurrentPhoto}
                      disabled={uploading}
                    >
                      Next Photo →
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal} disabled={uploading}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleUploadAll}
                disabled={uploading || selectedPhotos.length === 0}
              >
                {uploading ? 'Uploading...' : `Upload ${selectedPhotos.length} Photo(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
