import React, { useState, useEffect, useRef } from 'react';
import './TranscriptsApp.css';

interface Transcript {
  id: number;
  postcode: string | null;
  title: string | null;
  rawText: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  processedAt: string | null;
  error: string | null;
  summary: string | null;
}

export const TranscriptsApp: React.FC = () => {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [uploading, setUploading] = useState(false);

  // Form state
  const [postcode, setPostcode] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTranscripts();
  }, []);

  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/transcripts?limit=100', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data) {
        setTranscripts(data.data);
      } else {
        setError(data.error || 'Failed to load transcripts');
      }
    } catch (err) {
      console.error('Error fetching transcripts:', err);
      setError('Failed to load transcripts');
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
    setTitle('');
    setText('');
    setNotes('');
    setSelectedFile(null);
    setActiveTab('paste');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePasteSubmit = async () => {
    if (!postcode.trim()) {
      alert('Postcode is required');
      return;
    }

    if (!text.trim()) {
      alert('Transcript text is required');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/transcripts', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postcode: postcode.trim(),
          title: title.trim() || undefined,
          text: text.trim(),
          source: 'manual',
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchTranscripts();
        handleCloseModal();
      } else {
        setError(data.error || 'Failed to create transcript');
      }
    } catch (err) {
      console.error('Error creating transcript:', err);
      setError('Failed to create transcript');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!postcode.trim()) {
      alert('Postcode is required');
      return;
    }

    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('postcode', postcode.trim());
      if (title.trim()) {
        formData.append('title', title.trim());
      }
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      const response = await fetch('/api/transcripts/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        await fetchTranscripts();
        handleCloseModal();
      } else {
        setError(data.error || 'Failed to upload transcript');
      }
    } catch (err) {
      console.error('Error uploading transcript:', err);
      setError('Failed to upload transcript');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      new: { label: 'New', className: 'status-new' },
      processing: { label: 'Processing', className: 'status-processing' },
      processed: { label: 'Processed', className: 'status-processed' },
      completed: { label: 'Completed', className: 'status-completed' },
      error: { label: 'Error', className: 'status-error' },
    };

    const statusInfo = statusMap[status] || { label: status, className: 'status-default' };
    return <span className={`status-badge ${statusInfo.className}`}>{statusInfo.label}</span>;
  };

  return (
    <div className="transcripts-app">
      <div className="transcripts-header">
        <h2>Transcripts</h2>
        <button className="btn-primary" onClick={handleOpenModal}>
          Add Transcript
        </button>
      </div>

      {loading && <div className="loading">Loading transcripts...</div>}

      {error && !showModal && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {!loading && transcripts.length === 0 && (
        <div className="empty-state">
          <p>No transcripts yet. Create your first one!</p>
        </div>
      )}

      {!loading && transcripts.length > 0 && (
        <div className="transcripts-list">
          {transcripts.map((transcript) => (
            <div key={transcript.id} className="transcript-card">
              <div className="transcript-header">
                <h3>{transcript.title || `Transcript #${transcript.id}`}</h3>
                {getStatusBadge(transcript.status)}
              </div>
              <div className="transcript-meta">
                <div className="meta-item">
                  <span className="meta-label">Postcode:</span>
                  <span className="meta-value">{transcript.postcode || 'N/A'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Source:</span>
                  <span className="meta-value">{transcript.source || 'unknown'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Created:</span>
                  <span className="meta-value">
                    {new Date(transcript.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>
              </div>
              {transcript.rawText && (
                <div className="transcript-preview">
                  {transcript.rawText.substring(0, 200)}
                  {transcript.rawText.length > 200 ? '...' : ''}
                </div>
              )}
              {transcript.error && (
                <div className="transcript-error">Error: {transcript.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Transcript</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <div className="modal-tabs">
              <button
                className={`tab ${activeTab === 'paste' ? 'active' : ''}`}
                onClick={() => setActiveTab('paste')}
              >
                Paste / Type
              </button>
              <button
                className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                Upload File
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
                <label htmlFor="title">Title (optional)</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Auto-generated if left empty"
                  disabled={uploading}
                />
              </div>

              {activeTab === 'paste' && (
                <div className="form-group">
                  <label htmlFor="text">
                    Transcript Text <span className="required">*</span>
                  </label>
                  <textarea
                    id="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste or type your transcript here..."
                    rows={12}
                    disabled={uploading}
                  />
                </div>
              )}

              {activeTab === 'upload' && (
                <div className="form-group">
                  <label htmlFor="file">
                    File Upload (.txt, .md, .json) <span className="required">*</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    id="file"
                    type="file"
                    accept=".txt,.md,.json"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                  {selectedFile && (
                    <div className="file-selected">Selected: {selectedFile.name}</div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="notes">Notes (optional)</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                  disabled={uploading}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal} disabled={uploading}>
                Cancel
              </button>
              {activeTab === 'paste' && (
                <button className="btn-primary" onClick={handlePasteSubmit} disabled={uploading}>
                  {uploading ? 'Saving...' : 'Save Transcript'}
                </button>
              )}
              {activeTab === 'upload' && (
                <button className="btn-primary" onClick={handleFileUpload} disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload Transcript'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
