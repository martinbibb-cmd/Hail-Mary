import React from 'react';
import { useTranscriptionStore } from '../../../stores/transcriptionStore';
import type { TranscriptSegment } from '../../../stores/transcriptionStore';
import './TranscriptFeed.css';

interface TranscriptFeedProps {
  segments: TranscriptSegment[];
  onRoleSwitch?: (segmentId: string, newRole: 'expert' | 'customer') => void;
}

/**
 * TranscriptFeed - Live transcription stream display with role-based chat
 * 
 * Shows timestamped transcript segments with role indicators (Expert/Customer).
 * Supports role-switching for accessibility and deaf customer support.
 */
export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({
  segments,
  onRoleSwitch,
}) => {
  const currentRole = useTranscriptionStore((state) => state.currentRole);
  const setCurrentRole = useTranscriptionStore((state) => state.setCurrentRole);

  const handleRoleChange = (role: 'expert' | 'customer') => {
    setCurrentRole(role);
  };

  const handleSwitchRole = (segmentId: string, currentSegmentRole: 'expert' | 'customer' | undefined) => {
    if (!onRoleSwitch) return;
    const newRole = currentSegmentRole === 'expert' ? 'customer' : 'expert';
    onRoleSwitch(segmentId, newRole);
  };

  return (
    <div className="transcript-feed">
      <div className="transcript-feed-header">
        <h3>📝 Live transcript</h3>
        <div className="role-selector">
          <button
            className={`role-button ${currentRole === 'expert' ? 'active' : ''}`}
            onClick={() => handleRoleChange('expert')}
            title="Expert (Surveyor) mode"
          >
            👨‍🔧 Expert
          </button>
          <button
            className={`role-button ${currentRole === 'customer' ? 'active' : ''}`}
            onClick={() => handleRoleChange('customer')}
            title="Customer mode"
          >
            👤 Customer
          </button>
        </div>
      </div>

      <div className="transcript-feed-content">
        {segments.length === 0 && (
          <p className="transcript-feed-empty">
            Waiting for transcript segments…
          </p>
        )}

        {segments.map((segment) => {
          const segmentRole = segment.role || 'expert';
          const roleClass = segmentRole === 'customer' ? 'chat-customer' : 'chat-expert';
          
          return (
            <div key={segment.id} className={`transcript-segment ${roleClass}`}>
              <div className="transcript-segment-header">
                <div className="transcript-segment-role">
                  {segmentRole === 'customer' ? '👤 Customer' : '👨‍🔧 Expert'}
                </div>
                <div className="transcript-segment-time">
                  {segment.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              </div>
              <div className="transcript-segment-text">{segment.text}</div>
              {onRoleSwitch && (
                <button
                  className="switch-role-button"
                  onClick={() => handleSwitchRole(segment.id, segmentRole)}
                  title={`Switch to ${segmentRole === 'expert' ? 'Customer' : 'Expert'}`}
                >
                  ⇄ Switch Role
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
