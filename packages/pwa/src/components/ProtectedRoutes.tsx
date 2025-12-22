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

export const RockyToolWithGuard: React.FC = () => {
  const [showLeadDrawer, setShowLeadDrawer] = useState(false);

  return (
    <>
      <LeadGuard 
        onRequestLead={() => setShowLeadDrawer(true)}
        message="Rocky requires an active lead to process and save notes."
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
        message="Sarah requires an active lead to provide context-aware assistance."
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
        message="Photos must be attached to an active lead."
      >
        <PhotosApp />
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
        message="Visit Notes require an active lead so recordings, notes, and transcripts can be saved correctly."
      >
        <VisitApp />
      </LeadGuard>
      <LeadDrawer isOpen={showLeadDrawer} onClose={() => setShowLeadDrawer(false)} />
    </>
  );
};
