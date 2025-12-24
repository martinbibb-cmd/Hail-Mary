import React, { useState, useEffect, useRef } from 'react';
import './ScansApp.css';

interface Scan {
  id: number;
  postcode: string;
  kind: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  deviceId: string | null;
  notes: string | null;
  createdAt: string;
}

const SCAN_KINDS = [
  { value: 'lidar', label: 'LiDAR' },
  { value: 'photogrammetry', label: 'Photogrammetry' },
  { value: 'other', label: 'Other' },
];

export const ScansApp: React.FC = () => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  // Form state
  const [postcode, setPostcode] = useState('');
  const [kind, setKind] = useState('lidar');
  const [deviceId, setDeviceId] = useState('');
  const [notes, setNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchScans();
  }, []);

  const fetchScans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scans?limit=100', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data) {
        setScans(data.data);
      } else {
        setError(data.error || 'Failed to load scans');
      }
    } catch (err) {
      console.error('Error fetching scans:', err);
      setError('Failed to load scans');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setShowModal(true);
    resetForm();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setPostcode('');
    setKind('lidar');
    setDeviceId('');
    setNotes('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!postcode.trim()) {
      alert('Postcode is required');
      return;
    }

    if (!selectedFile) {
      alert('Please select a scan file to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('scan', selectedFile);
      formData.append('postcode', postcode.trim());
      formData.append('kind', kind);
      if (deviceId.trim()) {
        formData.append('deviceId', deviceId.trim());
      }
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      const response = await fetch('/api/scans/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        await fetchScans();
        handleCloseModal();
      } else {
        setError(data.error || 'Failed to upload scan');
      }
    } catch (err) {
      console.error('Error uploading scan:', err);
      setError('Failed to upload scan');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteScan = async (scanId: number) => {
    if (!confirm('Are you sure you want to delete this scan?')) {
      return;
    }

    try {
      const response = await fetch(`/api/scans/${scanId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        await fetchScans();
        setSelectedScan(null);
      } else {
        alert(data.error || 'Failed to delete scan');
      }
    } catch (err) {
      console.error('Error deleting scan:', err);
      alert('Failed to delete scan');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="scans-app">
      <div className="scans-header">
        <h2>Scans</h2>
        <button className="btn-primary" onClick={handleOpenModal}>
          Upload Scan
        </button>
      </div>

      <div className="scans-info">
        <p>Upload LiDAR scans, photogrammetry models, or other 3D data.</p>
        <p className="scans-note">
          Note: Full LiDAR capture coming in January. For now, you can upload scan files manually.
        </p>
      </div>

      {loading && <div className="loading">Loading scans...</div>}

      {error && !showModal && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {!loading && scans.length === 0 && (
        <div className="empty-state">
          <p>No scans yet. Upload your first one!</p>
        </div>
      )}

      {!loading && scans.length > 0 && (
        <div className="scans-list">
          {scans.map((scan) => (
            <div
              key={scan.id}
              className="scan-card"
              onClick={() => setSelectedScan(scan)}
            >
              <div className="scan-icon">
                {scan.kind === 'lidar' && '📡'}
                {scan.kind === 'photogrammetry' && '📷'}
                {scan.kind === 'other' && '📦'}
              </div>
              <div className="scan-info">
                <h3>{scan.filename}</h3>
                <div className="scan-meta">
                  <span className="meta-item">
                    <strong>Postcode:</strong> {scan.postcode}
                  </span>
                  <span className="meta-item">
                    <strong>Type:</strong> {scan.kind}
                  </span>
                  <span className="meta-item">
                    <strong>Size:</strong> {formatFileSize(scan.size)}
                  </span>
                  <span className="meta-item">
                    <strong>Date:</strong> {new Date(scan.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedScan && (
        <div className="modal-overlay" onClick={() => setSelectedScan(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Scan Details</h3>
              <button className="modal-close" onClick={() => setSelectedScan(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="scan-details">
                <div className="detail-row">
                  <span className="detail-label">Filename:</span>
                  <span className="detail-value">{selectedScan.filename}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Postcode:</span>
                  <span className="detail-value">{selectedScan.postcode}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Type:</span>
                  <span className="detail-value">{selectedScan.kind}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Size:</span>
                  <span className="detail-value">{formatFileSize(selectedScan.size)}</span>
                </div>
                {selectedScan.deviceId && (
                  <div className="detail-row">
                    <span className="detail-label">Device:</span>
                    <span className="detail-value">{selectedScan.deviceId}</span>
                  </div>
                )}
                {selectedScan.notes && (
                  <div className="detail-row">
                    <span className="detail-label">Notes:</span>
                    <span className="detail-value">{selectedScan.notes}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Uploaded:</span>
                  <span className="detail-value">
                    {new Date(selectedScan.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>
              </div>
              <button
                className="btn-danger"
                onClick={() => handleDeleteScan(selectedScan.id)}
              >
                Delete Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Scan</h3>
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

              <div className="form-group">
                <label htmlFor="postcode">
                  Postcode <span className="required">*</span>
                </label>
                <input
                  id="postcode"
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                  placeholder="e.g. SW1A 1AA"
                  disabled={uploading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="kind">Type</label>
                <select
                  id="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  disabled={uploading}
                >
                  {SCAN_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="scan">
                  Scan File (.zip, .usdz, .reality, .ply, .obj, etc.) <span className="required">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="scan"
                  type="file"
                  accept=".zip,.usdz,.reality,.ply,.obj,.fbx,.glb,.gltf,.e57"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                {selectedFile && (
                  <div className="file-selected">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="deviceId">Device ID (optional)</label>
                <input
                  id="deviceId"
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="e.g. iPhone 15 Pro"
                  disabled={uploading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes (optional)</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this scan..."
                  rows={3}
                  disabled={uploading}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal} disabled={uploading}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
              >
                {uploading ? 'Uploading...' : 'Upload Scan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
