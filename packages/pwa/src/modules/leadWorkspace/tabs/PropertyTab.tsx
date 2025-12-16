/**
 * Property Tab - Property details and construction
 */

import { useState, useEffect } from 'react';
import type { Property, ApiResponse, UpdatePropertyDto } from '@hail-mary/shared';

interface PropertyTabProps {
  leadId: number;
  property?: Property;
  onUpdate: () => void;
}

export function PropertyTab({ leadId, property, onUpdate }: PropertyTabProps) {
  const [form, setForm] = useState<UpdatePropertyDto>({
    type: property?.type || '',
    ageBand: property?.ageBand || '',
    construction: property?.construction || {},
    notes: property?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (property) {
      setForm({
        type: property.type || '',
        ageBand: property.ageBand || '',
        construction: property.construction || {},
        notes: property.notes || '',
      });
    }
  }, [property]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/property`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data: ApiResponse<Property> = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Property information saved successfully' });
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save property information' });
    } finally {
      setSaving(false);
    }
  };

  const construction = form.construction as Record<string, string> || {};

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Property Information</h3>
        {message && (
          <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Property Type</label>
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            >
              <option value="">Select type...</option>
              <option value="detached">Detached</option>
              <option value="semi-detached">Semi-detached</option>
              <option value="terraced">Terraced</option>
              <option value="flat">Flat</option>
              <option value="bungalow">Bungalow</option>
            </select>
          </div>

          <div className="form-group">
            <label>Age Band</label>
            <select
              value={form.ageBand}
              onChange={e => setForm({ ...form, ageBand: e.target.value })}
            >
              <option value="">Select age band...</option>
              <option value="pre-1919">Pre-1919</option>
              <option value="1919-1944">1919-1944</option>
              <option value="1945-1964">1945-1964</option>
              <option value="1965-1980">1965-1980</option>
              <option value="1981-1990">1981-1990</option>
              <option value="1991-2002">1991-2002</option>
              <option value="2003-2010">2003-2010</option>
              <option value="post-2010">Post-2010</option>
            </select>
          </div>

          <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Construction Details</h4>

          <div className="form-group">
            <label>Walls</label>
            <select
              value={construction.walls || ''}
              onChange={e => setForm({ 
                ...form, 
                construction: { ...construction, walls: e.target.value }
              })}
            >
              <option value="">Select...</option>
              <option value="solid">Solid</option>
              <option value="cavity">Cavity</option>
              <option value="timber_frame">Timber Frame</option>
            </select>
          </div>

          <div className="form-group">
            <label>Roof</label>
            <select
              value={construction.roof || ''}
              onChange={e => setForm({ 
                ...form, 
                construction: { ...construction, roof: e.target.value }
              })}
            >
              <option value="">Select...</option>
              <option value="pitched">Pitched</option>
              <option value="flat">Flat</option>
            </select>
          </div>

          <div className="form-group">
            <label>Floors</label>
            <select
              value={construction.floors || ''}
              onChange={e => setForm({ 
                ...form, 
                construction: { ...construction, floors: e.target.value }
              })}
            >
              <option value="">Select...</option>
              <option value="solid">Solid</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="form-group">
            <label>Additional Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
