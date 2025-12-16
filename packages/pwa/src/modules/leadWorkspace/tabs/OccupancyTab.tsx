/**
 * Occupancy Tab - Who lives there and their priorities
 */

import { useState, useEffect } from 'react';
import type { LeadOccupancy, ApiResponse, UpdateLeadOccupancyDto } from '@hail-mary/shared';

interface OccupancyTabProps {
  leadId: number;
  occupancy?: LeadOccupancy;
  onUpdate: () => void;
}

export function OccupancyTab({ leadId, occupancy, onUpdate }: OccupancyTabProps) {
  const [form, setForm] = useState<UpdateLeadOccupancyDto>({
    occupants: occupancy?.occupants,
    schedule: occupancy?.schedule || '',
    priorities: occupancy?.priorities || '',
    notes: occupancy?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (occupancy) {
      setForm({
        occupants: occupancy.occupants,
        schedule: occupancy.schedule || '',
        priorities: occupancy.priorities || '',
        notes: occupancy.notes || '',
      });
    }
  }, [occupancy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/occupancy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data: ApiResponse<LeadOccupancy> = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Occupancy information saved successfully' });
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save occupancy information' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Occupancy Information</h3>
        {message && (
          <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Number of Occupants</label>
            <input
              type="number"
              min="1"
              value={form.occupants || ''}
              onChange={e => setForm({ ...form, occupants: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <div className="form-group">
            <label>Schedule</label>
            <textarea
              value={form.schedule}
              onChange={e => setForm({ ...form, schedule: e.target.value })}
              placeholder="e.g., Work from home most days, Out 9-5 weekdays"
            />
          </div>

          <div className="form-group">
            <label>Priorities</label>
            <textarea
              value={form.priorities}
              onChange={e => setForm({ ...form, priorities: e.target.value })}
              placeholder="What matters most to the customer? e.g., Quiet system, Energy efficiency, Low running costs"
            />
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
