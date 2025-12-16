/**
 * Quotes Tab - View quotes for this lead
 */

import type { Quote } from '@hail-mary/shared';

interface QuotesTabProps {
  leadId: number;
  quotes: Quote[];
  onUpdate: () => void;
}

export function QuotesTab({ quotes }: QuotesTabProps) {
  if (quotes.length === 0) {
    return (
      <div className="tab-content">
        <div className="tab-section">
          <h3>Quotes</h3>
          <p className="empty-state">No quotes created yet for this lead</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="tab-section">
        <h3>Quotes</h3>
        {quotes.map(quote => (
          <div key={quote.id} className="list-item">
            <div className="list-item-content">
              <h4>{quote.quoteNumber}: {quote.title}</h4>
              <p>Status: {quote.status}</p>
              <p>Valid until: {new Date(quote.validUntil).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
