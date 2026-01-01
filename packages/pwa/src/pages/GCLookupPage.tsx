import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './GCLookupPage.css';

interface GCBoilerData {
  gcNumber: string;
  manufacturer: string;
  brand: string;
  model: string;
  fuelType: string;
  boilerType: string;
  efficiency: string;
  outputPowerKw: number;
  quality: {
    score: number;
    hasManufacturer: boolean;
    hasBrand: boolean;
    hasModel: boolean;
    hasEfficiency: boolean;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function GCLookupPage() {
  const [gcNumber, setGcNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GCBoilerData | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gcNumber.trim()) {
      setError('Please enter a GC number');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/gc/${encodeURIComponent(gcNumber.trim())}`, {
        credentials: 'include',
      });

      const data: ApiResponse<{ boiler: GCBoilerData }> = await response.json();

      if (data.success && data.data?.boiler) {
        setResult(data.data.boiler);
      } else {
        setError(data.error || 'Boiler not found');
      }
    } catch (err) {
      console.error('Error looking up GC number:', err);
      setError('Failed to lookup GC number');
    } finally {
      setLoading(false);
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // orange
    return '#ef4444'; // red
  };

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>GC Number Lookup</h1>
        <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
          Look up boiler specifications by GC number
        </p>
      </div>

      <div className="detail-card">
        <form onSubmit={handleLookup} className="gc-lookup-form">
          <div className="form-group">
            <label htmlFor="gcNumber">GC Number</label>
            <input
              id="gcNumber"
              type="text"
              value={gcNumber}
              onChange={(e) => setGcNumber(e.target.value.toUpperCase())}
              placeholder="e.g. 47-116-14"
              disabled={loading}
              className="gc-input"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !gcNumber.trim()}
          >
            {loading ? 'Looking up...' : 'Lookup'}
          </button>
        </form>

        {error && (
          <div className="error-message" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        {result && (
          <div className="gc-result" style={{ marginTop: 24 }}>
            <div className="result-header">
              <h3>Boiler Specifications</h3>
              <div
                className="quality-badge"
                style={{
                  backgroundColor: getQualityColor(result.quality.score),
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Quality: {result.quality.score}%
              </div>
            </div>

            <div className="result-grid">
              <div className="result-item">
                <span className="result-label">GC Number:</span>
                <span className="result-value">{result.gcNumber}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Manufacturer:</span>
                <span className="result-value">{result.manufacturer || 'N/A'}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Brand:</span>
                <span className="result-value">{result.brand || 'N/A'}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Model:</span>
                <span className="result-value">{result.model || 'N/A'}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Fuel Type:</span>
                <span className="result-value">{result.fuelType || 'N/A'}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Boiler Type:</span>
                <span className="result-value">{result.boilerType || 'N/A'}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Efficiency:</span>
                <span className="result-value">{result.efficiency || 'N/A'}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Output Power:</span>
                <span className="result-value">{result.outputPowerKw ? `${result.outputPowerKw} kW` : 'N/A'}</span>
              </div>
            </div>

            <div className="quality-details" style={{ marginTop: 16 }}>
              <h4>Data Quality</h4>
              <ul>
                <li>{result.quality.hasManufacturer ? '✓' : '✗'} Manufacturer</li>
                <li>{result.quality.hasBrand ? '✓' : '✗'} Brand</li>
                <li>{result.quality.hasModel ? '✓' : '✗'} Model</li>
                <li>{result.quality.hasEfficiency ? '✓' : '✗'} Efficiency</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <Link to="/" className="back-link">
        ← Back to Home
      </Link>
    </div>
  );
}
