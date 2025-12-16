/**
 * Interests Tab - Customer interests, technologies, and future plans
 */

import { useState } from 'react';
import type { LeadInterest, LeadTechnology, LeadFuturePlan, ApiResponse } from '@hail-mary/shared';

interface InterestsTabProps {
  leadId: number;
  interests: LeadInterest[];
  technologies: LeadTechnology[];
  futurePlans: LeadFuturePlan[];
  onUpdate: () => void;
}

export function InterestsTab({ leadId, interests, technologies, futurePlans, onUpdate }: InterestsTabProps) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Interest form state
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [interestForm, setInterestForm] = useState({ category: '', value: '' });

  // Technology form state
  const [showTechForm, setShowTechForm] = useState(false);
  const [techForm, setTechForm] = useState({ type: '', make: '', model: '', notes: '' });

  // Future plan form state
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ planType: '', timeframe: '', notes: '' });

  const handleAddInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/leads/${leadId}/interests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(interestForm),
      });
      const data: ApiResponse<LeadInterest> = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Interest added successfully' });
        setInterestForm({ category: '', value: '' });
        setShowInterestForm(false);
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add interest' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add interest' });
    }
  };

  const handleDeleteInterest = async (id: number) => {
    if (!confirm('Remove this interest?')) return;
    try {
      const res = await fetch(`/api/leads/${leadId}/interests/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data: ApiResponse<null> = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Interest removed' });
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove interest' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to remove interest' });
    }
  };

  const handleAddTechnology = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/leads/${leadId}/technologies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(techForm),
      });
      const data: ApiResponse<LeadTechnology> = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Technology added successfully' });
        setTechForm({ type: '', make: '', model: '', notes: '' });
        setShowTechForm(false);
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add technology' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add technology' });
    }
  };

  const handleDeleteTechnology = async (id: number) => {
    if (!confirm('Remove this technology?')) return;
    try {
      const res = await fetch(`/api/leads/${leadId}/technologies/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data: ApiResponse<null> = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Technology removed' });
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove technology' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to remove technology' });
    }
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/leads/${leadId}/future-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(planForm),
      });
      const data: ApiResponse<LeadFuturePlan> = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Future plan added successfully' });
        setPlanForm({ planType: '', timeframe: '', notes: '' });
        setShowPlanForm(false);
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add plan' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add plan' });
    }
  };

  const handleDeletePlan = async (id: number) => {
    if (!confirm('Remove this plan?')) return;
    try {
      const res = await fetch(`/api/leads/${leadId}/future-plans/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data: ApiResponse<null> = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Plan removed' });
        onUpdate();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove plan' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to remove plan' });
    }
  };

  return (
    <div className="tab-content">
      {message && (
        <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
          {message.text}
        </div>
      )}

      {/* Interests Section */}
      <div className="tab-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Customer Interests</h3>
          <button className="btn-primary" onClick={() => setShowInterestForm(!showInterestForm)}>
            {showInterestForm ? 'Cancel' : '+ Add Interest'}
          </button>
        </div>

        {showInterestForm && (
          <form onSubmit={handleAddInterest} style={{ marginBottom: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
            <div className="form-group">
              <label>Category *</label>
              <input
                type="text"
                value={interestForm.category}
                onChange={e => setInterestForm({ ...interestForm, category: e.target.value })}
                placeholder="e.g., heat_pump, solar, battery"
                required
              />
            </div>
            <div className="form-group">
              <label>Value</label>
              <input
                type="text"
                value={interestForm.value}
                onChange={e => setInterestForm({ ...interestForm, value: e.target.value })}
                placeholder="e.g., air_source"
              />
            </div>
            <button type="submit" className="btn-primary">Add Interest</button>
          </form>
        )}

        {interests.length === 0 ? (
          <p className="empty-state">No interests recorded yet</p>
        ) : (
          interests.map(interest => (
            <div key={interest.id} className="list-item">
              <div className="list-item-content">
                <h4>{interest.category}</h4>
                {interest.value && <p>{interest.value}</p>}
              </div>
              <button className="btn-danger" onClick={() => handleDeleteInterest(interest.id)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* Existing Technologies Section */}
      <div className="tab-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Existing Technologies</h3>
          <button className="btn-primary" onClick={() => setShowTechForm(!showTechForm)}>
            {showTechForm ? 'Cancel' : '+ Add Technology'}
          </button>
        </div>

        {showTechForm && (
          <form onSubmit={handleAddTechnology} style={{ marginBottom: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
            <div className="form-group">
              <label>Type *</label>
              <input
                type="text"
                value={techForm.type}
                onChange={e => setTechForm({ ...techForm, type: e.target.value })}
                placeholder="e.g., boiler, cylinder, pv"
                required
              />
            </div>
            <div className="form-group">
              <label>Make</label>
              <input
                type="text"
                value={techForm.make}
                onChange={e => setTechForm({ ...techForm, make: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                value={techForm.model}
                onChange={e => setTechForm({ ...techForm, model: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={techForm.notes}
                onChange={e => setTechForm({ ...techForm, notes: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary">Add Technology</button>
          </form>
        )}

        {technologies.length === 0 ? (
          <p className="empty-state">No technologies recorded yet</p>
        ) : (
          technologies.map(tech => (
            <div key={tech.id} className="list-item">
              <div className="list-item-content">
                <h4>{tech.type}</h4>
                <p>{[tech.make, tech.model].filter(Boolean).join(' - ')}</p>
                {tech.notes && <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{tech.notes}</p>}
              </div>
              <button className="btn-danger" onClick={() => handleDeleteTechnology(tech.id)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* Future Plans Section */}
      <div className="tab-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Future Plans</h3>
          <button className="btn-primary" onClick={() => setShowPlanForm(!showPlanForm)}>
            {showPlanForm ? 'Cancel' : '+ Add Plan'}
          </button>
        </div>

        {showPlanForm && (
          <form onSubmit={handleAddPlan} style={{ marginBottom: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
            <div className="form-group">
              <label>Plan Type *</label>
              <input
                type="text"
                value={planForm.planType}
                onChange={e => setPlanForm({ ...planForm, planType: e.target.value })}
                placeholder="e.g., extension, loft_conversion"
                required
              />
            </div>
            <div className="form-group">
              <label>Timeframe</label>
              <input
                type="text"
                value={planForm.timeframe}
                onChange={e => setPlanForm({ ...planForm, timeframe: e.target.value })}
                placeholder="e.g., next_year, 2-5_years"
              />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={planForm.notes}
                onChange={e => setPlanForm({ ...planForm, notes: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary">Add Plan</button>
          </form>
        )}

        {futurePlans.length === 0 ? (
          <p className="empty-state">No future plans recorded yet</p>
        ) : (
          futurePlans.map(plan => (
            <div key={plan.id} className="list-item">
              <div className="list-item-content">
                <h4>{plan.planType}</h4>
                {plan.timeframe && <p>Timeframe: {plan.timeframe}</p>}
                {plan.notes && <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{plan.notes}</p>}
              </div>
              <button className="btn-danger" onClick={() => handleDeletePlan(plan.id)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
