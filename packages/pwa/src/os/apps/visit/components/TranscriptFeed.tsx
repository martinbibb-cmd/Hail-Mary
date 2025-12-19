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
  isRecording: boolean;
  liveTranscript?: string;
}

/**
 * TranscriptFeed - Live transcription stream display (left panel)
 * 
 * Shows timestamped transcript segments as they're captured, NOT as chat bubbles.
 * Similar to Depot-voice-notes style.
 */
export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({
  segments,
  isRecording,
  liveTranscript,
}) => {
  return (
    <div className="transcript-feed">
      <div className="transcript-feed-header">
        <h3>📝 Transcript</h3>
        {isRecording && (
          <span className="transcript-feed-recording">
            <span className="recording-dot"></span>
            Recording
          </span>
        )}
      </div>

      <div className="transcript-feed-content">
        {segments.length === 0 && !liveTranscript && (
          <p className="transcript-feed-empty">
            Start recording to capture your visit notes. Speak naturally about the property,
            existing system, and any issues or requirements.
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

        {liveTranscript && (
          <div className="transcript-segment transcript-segment-live">
            <div className="transcript-segment-time">
              {new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
            <div className="transcript-segment-text transcript-segment-interim">
              {liveTranscript}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
