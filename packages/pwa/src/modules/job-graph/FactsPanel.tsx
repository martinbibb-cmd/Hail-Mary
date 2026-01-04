/**
 * Facts Panel
 *
 * Displays extracted facts grouped by category
 * Allows adding new facts
 */

import { useState } from 'react';
import type { Fact, FactCategory, Confidence } from '@hail-mary/shared';
import { addFact } from '../../services/jobGraph.service';
import { ConfidenceIndicator } from './ConfidenceIndicator';

interface FactsPanelProps {
  facts: Fact[];
  jobGraphId: string;
  onFactAdded: () => void;
}

export function FactsPanel({ facts, jobGraphId, onFactAdded }: FactsPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<FactCategory | 'all'>('all');

  // Group facts by category
  const factsByCategory = facts.reduce((acc, fact) => {
    if (!acc[fact.category]) {
      acc[fact.category] = [];
    }
    acc[fact.category].push(fact);
    return acc;
  }, {} as Record<string, Fact[]>);

  const categories = Object.keys(factsByCategory) as FactCategory[];

  const filteredFacts = filterCategory === 'all' ? facts : facts.filter((f) => f.category === filterCategory);

  return (
    <div className="facts-panel">
      {/* Header */}
      <div className="panel-header">
        <h3>Extracted Facts ({facts.length})</h3>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-secondary">
          {showAddForm ? 'Cancel' : '+ Add Fact'}
        </button>
      </div>

      {/* Add Fact Form */}
      {showAddForm && (
        <AddFactForm
          jobGraphId={jobGraphId}
          onSuccess={() => {
            setShowAddForm(false);
            onFactAdded();
          }}
        />
      )}

      {/* Category Filter */}
      <div className="category-filter">
        <button
          className={`filter-btn ${filterCategory === 'all' ? 'active' : ''}`}
          onClick={() => setFilterCategory('all')}
        >
          All ({facts.length})
        </button>
        {categories.map((category) => (
          <button
            key={category}
            className={`filter-btn ${filterCategory === category ? 'active' : ''}`}
            onClick={() => setFilterCategory(category)}
          >
            {category} ({factsByCategory[category].length})
          </button>
        ))}
      </div>

      {/* Facts List */}
      <div className="facts-list">
        {filteredFacts.length === 0 ? (
          <div className="empty-state">No facts found</div>
        ) : (
          filteredFacts.map((fact) => <FactCard key={fact.id} fact={fact} />)
        )}
      </div>
    </div>
  );
}

interface FactCardProps {
  fact: Fact;
}

function FactCard({ fact }: FactCardProps) {
  return (
    <div className="fact-card">
      <div className="fact-header">
        <div className="fact-info">
          <span className="fact-category">{fact.category}</span>
          <h4 className="fact-key">{fact.key}</h4>
        </div>
        <ConfidenceIndicator confidence={fact.confidence} size="small" showLabel={false} />
      </div>

      <div className="fact-value">
        <strong>Value:</strong> {JSON.stringify(fact.value)}
        {fact.unit && <span className="fact-unit"> {fact.unit}</span>}
      </div>

      <div className="fact-meta">
        <span className="fact-source">Extracted by: {fact.extractedBy}</span>
        {fact.sourceEventId && (
          <span className="fact-event">Event: {fact.sourceEventId.substring(0, 8)}...</span>
        )}
      </div>

      {fact.notes && <div className="fact-notes">{fact.notes}</div>}

      <div className="fact-timestamp">
        Added: {new Date(fact.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

interface AddFactFormProps {
  jobGraphId: string;
  onSuccess: () => void;
}

function AddFactForm({ jobGraphId, onSuccess }: AddFactFormProps) {
  const [category, setCategory] = useState<FactCategory>('property');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [confidence, setConfidence] = useState<Confidence>(70);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !value) return;

    setSubmitting(true);
    try {
      // Try to parse value as JSON, otherwise keep as string
      let parsedValue: unknown = value;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      const result = await addFact(jobGraphId, {
        category,
        key,
        value: parsedValue,
        unit: unit || undefined,
        confidence,
        extractedBy: 'manual',
        notes: notes || undefined,
      });

      if (result) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error adding fact:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const categories: FactCategory[] = [
    'property',
    'existing_system',
    'electrical',
    'gas',
    'water',
    'structure',
    'access',
    'measurements',
    'regulatory',
    'customer',
    'hazards',
    'other',
  ];

  return (
    <form className="add-fact-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as FactCategory)}>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        <label>
          Key
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g., boiler_age"
            required
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Value
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g., 15 or { 'make': 'Worcester Bosch' }"
            required
          />
        </label>

        <label>
          Unit (optional)
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g., years, kW, mm"
          />
        </label>
      </div>

      <label>
        Confidence ({confidence}%)
        <input
          type="range"
          min="0"
          max="100"
          value={confidence}
          onChange={(e) => setConfidence(parseInt(e.target.value) as Confidence)}
        />
      </label>

      <label>
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional context..."
          rows={2}
        />
      </label>

      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? 'Adding...' : 'Add Fact'}
      </button>
    </form>
  );
}
