import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ModuleLauncher.css';

interface Module {
  id: string;
  title: string;
  icon: string;
  route: string;
  description: string;
  enabled: boolean;
}

const MODULES: Module[] = [
  {
    id: 'addresses',
    title: 'Addresses',
    icon: '🏘️',
    route: '/addresses',
    description: 'Manage property addresses',
    enabled: true,
  },
  {
    id: 'diary',
    title: 'Diary',
    icon: '📅',
    route: '/diary',
    description: 'View appointments',
    enabled: true,
  },
  {
    id: 'camera',
    title: 'Camera',
    icon: '📷',
    route: '/camera',
    description: 'Capture property photos',
    enabled: true,
  },
  {
    id: 'photos',
    title: 'Photo Library',
    icon: '🖼️',
    route: '/photo-library',
    description: 'Browse photos by property',
    enabled: true,
  },
  {
    id: 'transcripts',
    title: 'Transcripts',
    icon: '📝',
    route: '/transcripts',
    description: 'Survey transcripts',
    enabled: true,
  },
  {
    id: 'scans',
    title: 'Scans',
    icon: '📊',
    route: '/scans',
    description: 'LiDAR & 3D scans',
    enabled: true,
  },
  {
    id: 'engineer',
    title: 'Engineer',
    icon: '🛠️',
    route: '/engineer',
    description: 'AI system designer',
    enabled: true,
  },
  {
    id: 'sarah',
    title: 'Sarah',
    icon: '🧠',
    route: '/sarah',
    description: 'AI survey assistant',
    enabled: true,
  },
  {
    id: 'knowledge',
    title: 'Knowledge',
    icon: '📚',
    route: '/knowledge',
    description: 'Product knowledge base',
    enabled: true,
  },
  {
    id: 'presentation',
    title: 'Packs',
    icon: '📄',
    route: '/presentation',
    description: 'Customer presentations',
    enabled: true,
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: '⚙️',
    route: '/profile',
    description: 'App settings & profile',
    enabled: true,
  },
];

export const ModuleLauncher: React.FC = () => {
  const navigate = useNavigate();

  const enabledModules = MODULES.filter(m => m.enabled);

  return (
    <div className="module-launcher">
      <header className="module-launcher-header">
        <h1>Hail Mary</h1>
        <p className="module-launcher-subtitle">Select a module to continue</p>
      </header>

      <div className="module-grid">
        {enabledModules.map((module) => (
          <button
            key={module.id}
            className="module-tile"
            onClick={() => navigate(module.route)}
          >
            <div className="module-icon">{module.icon}</div>
            <div className="module-info">
              <h3 className="module-title">{module.title}</h3>
              <p className="module-description">{module.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
