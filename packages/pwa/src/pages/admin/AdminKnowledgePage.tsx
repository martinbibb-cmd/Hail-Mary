/**
 * Admin Knowledge Page
 * 
 * Provides PDF document upload and management for the knowledge system:
 * - Upload PDF manuals, guides, compliance docs
 * - View uploaded documents
 * - Delete documents
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './AdminKnowledgePage.css';

interface KnowledgeDocument {
  id: number;
  title: string;
  source: string;
  manufacturer?: string;
  modelRange?: string;
  documentType?: string;
  pageCount?: number;
  createdAt: string;
}

export const AdminKnowledgePage: React.FC = () => {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    manufacturer: '',
    modelRange: '',
    documentType: 'manual',
    tags: '',
  });

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/knowledge', {
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success && data.data) {
        setDocuments(data.data);
      } else {
        setError(data.error || 'Failed to load documents');
      }
    } catch (err) {
      setError('Failed to load documents');
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        // Auto-populate title from filename if empty
        if (!formData.title) {
          const fileName = selectedFile.name.replace('.pdf', '');
          setFormData({ ...formData, title: fileName });
        }
        setError(null);
      } else {
        setError('Please select a PDF file');
        setFile(null);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    if (!formData.title) {
      setError('Please provide a title for the document');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('pdf', file);
      uploadFormData.append('title', formData.title);
      if (formData.manufacturer) uploadFormData.append('manufacturer', formData.manufacturer);
      if (formData.modelRange) uploadFormData.append('modelRange', formData.modelRange);
      if (formData.documentType) uploadFormData.append('documentType', formData.documentType);
      if (formData.tags) uploadFormData.append('tags', JSON.stringify(formData.tags.split(',').map(t => t.trim())));

      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        credentials: 'include',
        body: uploadFormData,
      });
      
      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        // If response is not JSON, show raw text
        const text = await res.text();
        setError(`Upload failed (HTTP ${res.status}): ${text.substring(0, 500)}`);
        return;
      }
      
      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (res.status === 413) {
        setError('File too large. Maximum upload size is 50MB.');
      } else if (data.success) {
        setSuccess(data.message || 'Document uploaded successfully');
        // Reset form
        setFile(null);
        setFormData({
          title: '',
          manufacturer: '',
          modelRange: '',
          documentType: 'manual',
          tags: '',
        });
        // Reset file input
        const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // Reload documents
        loadDocuments();
      } else {
        // Show detailed error with status code
        const errorDetails = data.details ? ` (${data.details})` : '';
        setError(`Upload failed (HTTP ${res.status}): ${data.error || 'Unknown error'}${errorDetails}`);
      }
    } catch (err) {
      setError('Failed to upload document');
      console.error('Error uploading document:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/knowledge/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.status === 401 || res.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else if (data.success) {
        setSuccess('Document deleted successfully');
        loadDocuments();
      } else {
        setError(data.error || 'Failed to delete document');
      }
    } catch (err) {
      setError('Failed to delete document');
      console.error('Error deleting document:', err);
    }
  };

  if (loading && documents.length === 0) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="page-header">
          <h1>📚 Knowledge Management</h1>
          <Link to="/" className="btn-secondary">← Back to Dashboard</Link>
        </div>

        <p className="page-subtitle">
          Upload PDF manuals and guides to power Sarah & Rocky's knowledge base
        </p>

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {success && (
          <div className="alert alert-success">{success}</div>
        )}

        {/* Upload Section */}
        <div className="upload-section">
          <h2>Upload New Document</h2>
          <form onSubmit={handleUpload} className="upload-form">
            <div className="form-row">
              <label htmlFor="pdf-file-input">
                PDF File *
                <input
                  id="pdf-file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
              {file && <span className="file-name">Selected: {file.name}</span>}
            </div>

            <div className="form-row">
              <label htmlFor="title">
                Document Title *
                <input
                  id="title"
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Worcester 4000 Installation Manual"
                  required
                  disabled={uploading}
                />
              </label>
            </div>

            <div className="form-row">
              <label htmlFor="manufacturer">
                Manufacturer
                <input
                  id="manufacturer"
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleInputChange}
                  placeholder="e.g., Worcester, Vaillant"
                  disabled={uploading}
                />
              </label>
            </div>

            <div className="form-row">
              <label htmlFor="modelRange">
                Model Range
                <input
                  id="modelRange"
                  type="text"
                  name="modelRange"
                  value={formData.modelRange}
                  onChange={handleInputChange}
                  placeholder="e.g., 4000 series"
                  disabled={uploading}
                />
              </label>
            </div>

            <div className="form-row">
              <label htmlFor="documentType">
                Document Type
                <select
                  id="documentType"
                  name="documentType"
                  value={formData.documentType}
                  onChange={handleInputChange}
                  disabled={uploading}
                >
                  <option value="manual">Installation Manual</option>
                  <option value="user_guide">User Guide</option>
                  <option value="compliance_doc">Compliance Document</option>
                  <option value="service_guide">Service Guide</option>
                  <option value="technical_spec">Technical Specification</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label htmlFor="tags">
                Tags (comma-separated)
                <input
                  id="tags"
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  placeholder="e.g., boiler, installation, clearance"
                  disabled={uploading}
                />
              </label>
            </div>

            <button
              type="submit"
              className="btn-primary btn-block"
              disabled={uploading || !file}
            >
              {uploading ? '📤 Uploading...' : '📤 Upload Document'}
            </button>
          </form>
        </div>

        {/* Documents List */}
        <div className="documents-section">
          <h2>Uploaded Documents</h2>
          {documents.length === 0 ? (
            <p className="empty-state">No documents uploaded yet. Upload your first PDF above!</p>
          ) : (
            <div className="documents-grid">
              {documents.map(doc => (
                <div key={doc.id} className="document-card">
                  <div className="document-info">
                    <h3>📄 {doc.title}</h3>
                    {doc.manufacturer && (
                      <p className="document-meta">
                        <strong>Manufacturer:</strong> {doc.manufacturer}
                      </p>
                    )}
                    {doc.modelRange && (
                      <p className="document-meta">
                        <strong>Model Range:</strong> {doc.modelRange}
                      </p>
                    )}
                    {doc.documentType && (
                      <p className="document-meta">
                        <strong>Type:</strong> {doc.documentType}
                      </p>
                    )}
                    {doc.pageCount && (
                      <p className="document-meta">
                        <strong>Pages:</strong> {doc.pageCount}
                      </p>
                    )}
                    <p className="document-date">
                      Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="document-actions">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => handleDelete(doc.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminKnowledgePage;
