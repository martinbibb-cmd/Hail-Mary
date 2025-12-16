/**
 * Customer Tab - Contact information
 */

import { useState, useEffect } from 'react';
import type { LeadContact, ApiResponse, UpdateLeadContactDto } from '@hail-mary/shared';

interface CustomerTabProps {
  leadId: number;
  contact?: LeadContact;
  onUpdate: () => void;
}

export function CustomerTab({ leadId, contact, onUpdate }: CustomerTabProps) {
  const [form, setForm] = useState<UpdateLeadContactDto>({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    addressLine1: contact?.addressLine1 || '',
    addressLine2: contact?.addressLine2 || '',
    city: contact?.city || '',
    postcode: contact?.postcode || '',
    country: contact?.country || 'UK',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (contact) {
      setForm({
        name: contact.name,
        phone: contact.phone || '',
        email: contact.email || '',
        addressLine1: contact.addressLine1 || '',
        addressLine2: contact.addressLine2 || '',
        city: contact.city || '',
        postcode: contact.postcode || '',
        country: contact.country || 'UK',
      });
    }
  }, [contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/contact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data: ApiResponse<LeadContact> = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Contact information saved successfully' });
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save contact information' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Contact Information</h3>
        {message && (
          <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Address Line 1</label>
            <input
              type="text"
              value={form.addressLine1}
              onChange={e => setForm({ ...form, addressLine1: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Address Line 2</label>
            <input
              type="text"
              value={form.addressLine2}
              onChange={e => setForm({ ...form, addressLine2: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>City</label>
            <input
              type="text"
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Postcode</label>
            <input
              type="text"
              value={form.postcode}
              onChange={e => setForm({ ...form, postcode: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Country</label>
            <input
              type="text"
              value={form.country}
              onChange={e => setForm({ ...form, country: e.target.value })}
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
