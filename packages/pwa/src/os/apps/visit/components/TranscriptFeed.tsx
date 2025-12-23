import React from 'react';
import './TranscriptFeed.css';

export interface TranscriptSegment {
  id: string;
  timestamp: Date;
  speaker?: 'user' | 'system';
  text: string;
}

interface TranscriptFeedProps {
  segments: TranscriptSegment[];
}

/**
 * TranscriptFeed - Live transcription stream display (left panel)
 * 
 * Shows timestamped transcript segments as they're captured, NOT as chat bubbles.
 * Similar to Depot-voice-notes style.
 */
export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({
  segments,
}) => {
  return (
    <div className="transcript-feed">
      <div className="transcript-feed-header">
        <h3>📝 Live transcript</h3>
      </div>

      <div className="transcript-feed-content">
        {segments.length === 0 && (
          <p className="transcript-feed-empty">
            Waiting for transcript segments…
          </p>
        )}

        {segments.map((segment) => (
          <div key={segment.id} className="transcript-segment">
            <div className="transcript-segment-time">
              {segment.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
            <div className="transcript-segment-text">{segment.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
