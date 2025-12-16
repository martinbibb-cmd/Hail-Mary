/**
 * Recommendations Tab - System recommendations
 */

import { useState } from 'react';
import type { Recommendation, ApiResponse } from '@hail-mary/shared';

interface RecommendationsTabProps {
  leadId: number;
  recommendations: Recommendation[];
  onUpdate: () => void;
}

export function RecommendationsTab({ leadId, recommendations, onUpdate }: RecommendationsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ option: '', summary: '', rationale: '', dependencies: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/leads/${leadId}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data: ApiResponse<Recommendation> = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Recommendation added successfully' });
        setForm({ option: '', summary: '', rationale: '', dependencies: '' });
        setShowForm(false);
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add recommendation' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add recommendation' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this recommendation?')) return;
    try {
      const res = await fetch(`/api/leads/${leadId}/recommendations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data: ApiResponse<null> = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Recommendation removed' });
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove recommendation' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to remove recommendation' });
    }
  };

  return (
    <div className="tab-content">
      {message && (
        <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
          {message.text}
        </div>
      )}

      <div className="tab-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>System Recommendations</h3>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Recommendation'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} style={{ marginBottom: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
            <div className="form-group">
              <label>Option *</label>
              <input
                type="text"
                value={form.option}
                onChange={e => setForm({ ...form, option: e.target.value })}
                placeholder="A, B, or C"
                required
              />
            </div>
            <div className="form-group">
              <label>Summary *</label>
              <textarea
                value={form.summary}
                onChange={e => setForm({ ...form, summary: e.target.value })}
                placeholder="Brief summary of this option"
                required
              />
            </div>
            <div className="form-group">
              <label>Rationale</label>
              <textarea
                value={form.rationale}
                onChange={e => setForm({ ...form, rationale: e.target.value })}
                placeholder="Why this option is recommended"
              />
            </div>
            <div className="form-group">
              <label>Dependencies</label>
              <textarea
                value={form.dependencies}
                onChange={e => setForm({ ...form, dependencies: e.target.value })}
                placeholder="What needs to happen first"
              />
            </div>
            <button type="submit" className="btn-primary">Add Recommendation</button>
          </form>
        )}

        {recommendations.length === 0 ? (
          <p className="empty-state">No recommendations yet</p>
        ) : (
          recommendations.map(rec => (
            <div key={rec.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0 }}>Option {rec.option}</h4>
                <button className="btn-danger" onClick={() => handleDelete(Number(rec.id))}>
                  Remove
                </button>
              </div>
              <p style={{ margin: '0.5rem 0', fontWeight: '500' }}>{rec.summary}</p>
              {rec.rationale && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  <strong>Rationale:</strong> {rec.rationale}
                </div>
              )}
              {rec.dependencies && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  <strong>Dependencies:</strong> {rec.dependencies}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
