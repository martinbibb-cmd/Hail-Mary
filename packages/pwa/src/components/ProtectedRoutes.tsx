/**
 * Protected Route Components with Lead Guards
 * 
 * Wrappers for components that require an active lead.
 */

import React, { useState } from 'react';
import { LeadGuard } from './LeadGuard';
import { LeadDrawer } from './LeadDrawer';
import { RockyTool } from '../modules/rocky';
import { SarahTool } from '../modules/sarah';
import { PhotosApp } from '../os/apps/photos/PhotosApp';
import { VisitApp } from '../os/apps/visit/VisitApp';
import { MEDIA_RECEIVER_ONLY } from '../config/featureFlags';

export const RockyToolWithGuard: React.FC = () => {
  const [showLeadDrawer, setShowLeadDrawer] = useState(false);

  return (
    <>
      <LeadGuard 
        onRequestLead={() => setShowLeadDrawer(true)}
        message="Rocky requires an active context (customer or property address) to process and save notes."
      >
        <RockyTool />
      </LeadGuard>
      <LeadDrawer isOpen={showLeadDrawer} onClose={() => setShowLeadDrawer(false)} />
    </>
  );
};

export const SarahToolWithGuard: React.FC = () => {
  const [showLeadDrawer, setShowLeadDrawer] = useState(false);

  return (
    <>
      <LeadGuard 
        onRequestLead={() => setShowLeadDrawer(true)}
        message="Sarah requires an active context (customer or property address) to provide context-aware assistance."
      >
        <SarahTool />
      </LeadGuard>
      <LeadDrawer isOpen={showLeadDrawer} onClose={() => setShowLeadDrawer(false)} />
    </>
  );
};

export const PhotosAppWithGuard: React.FC = () => {
  const [showLeadDrawer, setShowLeadDrawer] = useState(false);

  return (
    <>
      <LeadGuard 
        onRequestLead={() => setShowLeadDrawer(true)}
        message="Photos require a property address to be anchored correctly. Select a customer or address first."
      >
        {MEDIA_RECEIVER_ONLY ? (
          <div style={{ padding: 16 }}>
            <h2>Photos capture disabled</h2>
            <p>
              Atlas is running in <strong>receiver-only</strong> mode tonight.
              Use <strong>Import media</strong> on the Visit screen header to attach photos/audio/files.
            </p>
          </div>
        ) : (
          <PhotosApp />
        )}
      </LeadGuard>
      <LeadDrawer isOpen={showLeadDrawer} onClose={() => setShowLeadDrawer(false)} />
    </>
  );
};

export const VisitAppWithGuard: React.FC = () => {
  const [showLeadDrawer, setShowLeadDrawer] = useState(false);

  return (
    <>
      <LeadGuard
        onRequestLead={() => setShowLeadDrawer(true)}
        message="Visit Notes require an active context (customer or property address) so recordings, notes, and transcripts can be saved correctly."
      >
        <VisitApp />
      </LeadGuard>
      <LeadDrawer isOpen={showLeadDrawer} onClose={() => setShowLeadDrawer(false)} />
    </>
  );
};
