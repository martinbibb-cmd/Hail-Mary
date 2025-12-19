import React from 'react';
import './InstallChecklist.css';

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  note?: string;
  autoDetected?: boolean;
}

interface InstallChecklistProps {
  items: ChecklistItem[];
  onItemToggle?: (id: string, checked: boolean) => void;
  exceptions?: string[];
}

/**
 * InstallChecklist - Auto-ticking installation checklist (center panel)
 * 
 * Shows checklist items that get automatically ticked as Rocky detects them
 * in the transcript. Also shows any exceptions/issues flagged.
 */
export const InstallChecklist: React.FC<InstallChecklistProps> = ({
  items,
  onItemToggle,
  exceptions = [],
}) => {
  const handleToggle = (id: string, currentChecked: boolean) => {
    if (onItemToggle) {
      onItemToggle(id, !currentChecked);
    }
  };

  const checkedCount = items.filter((item) => item.checked).length;
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  return (
    <div className="install-checklist">
      <div className="install-checklist-header">
        <h3>✓ Install Checklist</h3>
        <div className="install-checklist-progress">
          <span className="progress-text">
            {checkedCount}/{items.length}
          </span>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="install-checklist-content">
        {items.length === 0 ? (
          <p className="install-checklist-empty">
            No checklist items yet. Rocky will auto-detect work items as you describe the installation.
          </p>
        ) : (
          <div className="checklist-items">
            {items.map((item) => (
              <div key={item.id} className="checklist-item">
                <label className="checklist-item-label">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleToggle(item.id, item.checked)}
                    className="checklist-checkbox"
                  />
                  <span className="checklist-item-text">
                    {item.label}
                    {item.autoDetected && (
                      <span className="checklist-auto-badge">Auto-detected</span>
                    )}
                  </span>
                </label>
                {item.note && (
                  <div className="checklist-item-note">{item.note}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {exceptions.length > 0 && (
          <div className="checklist-exceptions">
            <h4>⚠️ Exceptions / Issues</h4>
            <ul>
              {exceptions.map((exception, idx) => (
                <li key={idx}>{exception}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
