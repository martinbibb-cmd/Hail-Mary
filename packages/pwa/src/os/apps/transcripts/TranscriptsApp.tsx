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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'audio'>('paste');
  const [processingState, setProcessingState] = useState<'idle' | 'uploading' | 'transcribing' | 'saving'>('idle');
  const [transcriptionProgress, setTranscriptionProgress] = useState<string>('');

  // Form state
  const [postcode, setPostcode] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

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
    setSelectedAudioFile(null);
    setActiveTab('paste');
    setTranscriptionProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const handlePasteSubmit = async () => {
    if (!postcode.trim()) {
      setError('Postcode is required');
      return;
    }

    if (!text.trim()) {
      setError('Transcript text is required');
      return;
    }

    setProcessingState('saving');
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
      setProcessingState('idle');
    }
  };

  const handleFileUpload = async () => {
    if (!postcode.trim()) {
      setError('Postcode is required');
      return;
    }

    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setProcessingState('uploading');
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
      setProcessingState('idle');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAudioFile(file);
    }
  };

  const handleAudioUpload = async () => {
    if (!postcode.trim()) {
      setError('Postcode is required');
      return;
    }

    if (!selectedAudioFile) {
      setError('Please select an audio file to upload');
      return;
    }

    setProcessingState('uploading');
    setError(null);
    setTranscriptionProgress('Uploading audio file...');

    try {
      // Step 1: Transcribe audio using Whisper
      const formData = new FormData();
      formData.append('audio', selectedAudioFile);
      formData.append('language', 'en-GB');

      setProcessingState('transcribing');
      setTranscriptionProgress('Transcribing audio with AI...');
      const transcribeResponse = await fetch('/api/transcription/whisper-transcribe', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const transcribeData = await transcribeResponse.json();
      if (!transcribeData.success || !transcribeData.data?.text) {
        throw new Error(transcribeData.error || 'Failed to transcribe audio');
      }

      const transcribedText = transcribeData.data.text;
      
      setProcessingState('saving');
      setTranscriptionProgress('Transcription complete! Saving...');

      // Step 2: Save the transcript
      const response = await fetch('/api/transcripts', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postcode: postcode.trim(),
          title: title.trim() || `Audio transcription - ${selectedAudioFile.name}`,
          text: transcribedText,
          source: 'audio',
          notes: notes.trim() || `Transcribed from: ${selectedAudioFile.name}`,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTranscriptionProgress('Saved successfully!');
        await fetchTranscripts();
        // Close modal after showing success message briefly
        setTimeout(() => {
          handleCloseModal();
        }, 1000);
      } else {
        setError(data.error || 'Failed to save transcript');
      }
    } catch (err) {
      console.error('Error processing audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to process audio');
    } finally {
      setProcessingState('idle');
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

  const handleViewTranscript = (transcript: Transcript) => {
    setSelectedTranscript(transcript);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedTranscript(null);
  };

  const handleDownloadTranscript = (transcript: Transcript) => {
    if (!transcript.rawText) {
      setError('No transcript text available to download');
      return;
    }

    const blob = new Blob([transcript.rawText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${transcript.title || `transcript-${transcript.id}`}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
              <div className="transcript-actions">
                <button
                  className="btn-secondary btn-small"
                  onClick={() => handleViewTranscript(transcript)}
                >
                  View Full Text
                </button>
                <button
                  className="btn-secondary btn-small"
                  onClick={() => handleDownloadTranscript(transcript)}
                  disabled={!transcript.rawText}
                >
                  Download
                </button>
              </div>
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
              <button
                className={`tab ${activeTab === 'audio' ? 'active' : ''}`}
                onClick={() => setActiveTab('audio')}
              >
                Audio File
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
                  disabled={processingState !== 'idle'}
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
                  disabled={processingState !== 'idle'}
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
                    disabled={processingState !== 'idle'}
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
                    disabled={processingState !== 'idle'}
                  />
                  {selectedFile && (
                    <div className="file-selected">Selected: {selectedFile.name}</div>
                  )}
                </div>
              )}

              {activeTab === 'audio' && (
                <div className="form-group">
                  <label htmlFor="audioFile">
                    Audio File (.mp3, .wav, .m4a, .webm, .ogg) <span className="required">*</span>
                  </label>
                  <input
                    ref={audioInputRef}
                    id="audioFile"
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                    onChange={handleAudioFileSelect}
                    disabled={processingState !== 'idle'}
                  />
                  {selectedAudioFile && (
                    <div className="file-selected">Selected: {selectedAudioFile.name}</div>
                  )}
                  {processingState !== 'idle' && transcriptionProgress && (
                    <div className="transcription-progress">
                      <div className="progress-spinner"></div>
                      <span>{transcriptionProgress}</span>
                    </div>
                  )}
                  <div className="audio-help-text">
                    Audio will be automatically transcribed using AI before being saved.
                  </div>
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
                  disabled={processingState !== 'idle'}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal} disabled={processingState !== 'idle'}>
                Cancel
              </button>
              {activeTab === 'paste' && (
                <button className="btn-primary" onClick={handlePasteSubmit} disabled={processingState !== 'idle'}>
                  {processingState === 'saving' ? 'Saving...' : 'Save Transcript'}
                </button>
              )}
              {activeTab === 'upload' && (
                <button className="btn-primary" onClick={handleFileUpload} disabled={processingState !== 'idle'}>
                  {processingState === 'uploading' ? 'Uploading...' : 'Upload Transcript'}
                </button>
              )}
              {activeTab === 'audio' && (
                <button className="btn-primary" onClick={handleAudioUpload} disabled={processingState !== 'idle'}>
                  {processingState === 'transcribing' ? 'Transcribing...' : processingState === 'saving' ? 'Saving...' : 'Transcribe & Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedTranscript && (
        <div className="modal-overlay" onClick={handleCloseDetailModal}>
          <div className="modal-content modal-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedTranscript.title || `Transcript #${selectedTranscript.id}`}</h3>
              <button className="modal-close" onClick={handleCloseDetailModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-meta">
                <div className="meta-item">
                  <span className="meta-label">Status:</span>
                  <span className="meta-value">{getStatusBadge(selectedTranscript.status)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Postcode:</span>
                  <span className="meta-value">{selectedTranscript.postcode || 'N/A'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Source:</span>
                  <span className="meta-value">{selectedTranscript.source || 'unknown'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Created:</span>
                  <span className="meta-value">
                    {new Date(selectedTranscript.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>
              </div>

              {selectedTranscript.notes && (
                <div className="detail-section">
                  <h4>Notes</h4>
                  <p>{selectedTranscript.notes}</p>
                </div>
              )}

              <div className="detail-section">
                <h4>Full Transcript</h4>
                <div className="transcript-full-text">
                  {selectedTranscript.rawText || 'No transcript text available'}
                </div>
              </div>

              {selectedTranscript.error && (
                <div className="detail-section">
                  <h4>Error</h4>
                  <div className="transcript-error">{selectedTranscript.error}</div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => handleDownloadTranscript(selectedTranscript)}
                disabled={!selectedTranscript.rawText}
              >
                Download
              </button>
              <button className="btn-primary" onClick={handleCloseDetailModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
