import type { ChecklistItem } from './components';

// Default checklist items (from checklist-config.json)
export const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'boiler_replacement', label: 'Boiler Replacement', checked: false },
  { id: 'system_flush', label: 'System Flush/Cleanse', checked: false },
  { id: 'pipework_modification', label: 'Pipework Modifications', checked: false },
  { id: 'radiator_upgrade', label: 'Radiator Upgrade/Addition', checked: false },
  { id: 'cylinder_replacement', label: 'Hot Water Cylinder Replacement', checked: false },
  { id: 'controls_upgrade', label: 'Controls Upgrade', checked: false },
  { id: 'gas_work', label: 'Gas Supply Work', checked: false },
  { id: 'electrical_work', label: 'Electrical Work', checked: false },
  { id: 'flue_modification', label: 'Flue Modifications', checked: false },
  { id: 'filter_installation', label: 'Magnetic Filter Installation', checked: false },
];

