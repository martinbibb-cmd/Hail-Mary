/**
 * Files App - Browse and manage uploaded files
 * 
 * Features:
 * - Browse all user files
 * - Filter by category (Photos, Quotes, Exports, etc.)
 * - Upload new files
 * - Open/preview files
 */

import React, { useState, useEffect, useRef } from 'react';
import './FilesApp.css';

// File info interface matching API response
interface FileInfo {
  id: number;
  userId: number;
  visitId: number | null;
  filename: string;
  mimeType: string;
  size: number;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// File categories for filtering
const categories = [
  { id: 'all', label: 'All Files', icon: '📁' },
  { id: 'photos', label: 'Photos', icon: '📸' },
  { id: 'quotes', label: 'Quotes', icon: '💰' },
  { id: 'exports', label: 'Exports', icon: '📤' },
  { id: 'other', label: 'Other', icon: '📄' },
];

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper to format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Get icon for file type
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.includes('word')) return '📘';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗';
  if (mimeType.startsWith('text/')) return '📝';
  return '📄';
}

export const FilesApp: React.FC = () => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch files from API
  const fetchFiles = async (category?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') {
        params.append('category', category);
      }
      
      const response = await fetch(`/api/files?${params}`, {
        credentials: 'include',
      });
      
      const data: ApiResponse<FileInfo[]> = await response.json();
      
      if (data.success && data.data) {
        setFiles(data.data);
      } else {
        setError(data.error || 'Failed to load files');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  // Load files on mount and when category changes
  useEffect(() => {
    fetchFiles(activeCategory);
  }, [activeCategory]);

  // Handle file upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Determine category from file type
      let category = 'other';
      if (file.type.startsWith('image/')) {
        category = 'photos';
      }
      formData.append('category', category);
      
      const response = await fetch('/api/files', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      const data: ApiResponse<FileInfo> = await response.json();
      
      if (data.success && data.data) {
        // Refresh the file list
        fetchFiles(activeCategory);
      } else {
        setError(data.error || 'Failed to upload file');
      }
    } catch (err) {
      setError('Failed to upload file');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Open file in new tab
  const handleOpenFile = (file: FileInfo) => {
    window.open(`/api/files/${file.id}`, '_blank');
  };

  // Delete file
  const handleDeleteFile = async (file: FileInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Delete "${file.filename}"?`)) return;
    
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchFiles(activeCategory);
      } else {
        setError(data.error || 'Failed to delete file');
      }
    } catch (err) {
      setError('Failed to delete file');
    }
  };

  return (
    <div className="files-app">
      {/* Sidebar */}
      <div className="files-sidebar">
        <h3>Categories</h3>
        <ul className="files-category-list">
          {categories.map(cat => (
            <li key={cat.id}>
              <button
                className={`files-category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span className="category-icon">{cat.icon}</span>
                <span className="category-label">{cat.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Main content */}
      <div className="files-content">
        {/* Toolbar */}
        <div className="files-toolbar">
          <h2>
            {categories.find(c => c.id === activeCategory)?.icon}{' '}
            {categories.find(c => c.id === activeCategory)?.label}
          </h2>
          <div className="files-actions">
            <button
              className="files-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '⏳ Uploading...' : '📤 Upload'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </div>
        
        {/* Error message */}
        {error && (
          <div className="files-error">
            ⚠️ {error}
          </div>
        )}
        
        {/* File list */}
        <div className="files-list">
          {loading ? (
            <div className="files-loading">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="files-empty">
              <span className="empty-icon">📂</span>
              <p>No files yet</p>
              <p className="empty-hint">Click "Upload" to add files</p>
            </div>
          ) : (
            <table className="files-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr
                    key={file.id}
                    className="files-row"
                    onClick={() => handleOpenFile(file)}
                  >
                    <td className="file-name">
                      <span className="file-icon">{getFileIcon(file.mimeType)}</span>
                      <span className="file-filename">{file.filename}</span>
                    </td>
                    <td className="file-size">{formatFileSize(file.size)}</td>
                    <td className="file-date">{formatDate(file.createdAt)}</td>
                    <td className="file-actions">
                      <button
                        className="file-delete-btn"
                        onClick={(e) => handleDeleteFile(file, e)}
                        title="Delete file"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
