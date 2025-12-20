/**
 * Active Customer Guard Hook
 * 
 * Provides a guard function to check if an active customer is selected
 * before allowing capture actions (notes, photos, transcripts, etc.)
 */

import { useLeadStore } from '../stores/leadStore';

export function useActiveCustomerGuard() {
  const leadStore = useLeadStore();
  const activeLeadId = leadStore.currentLeadId;
  const activeLead = activeLeadId ? leadStore.leadById[activeLeadId] : null;

  /**
   * Check if an active customer is selected
   * Returns true if active customer exists, false otherwise
   */
  const hasActiveCustomer = (): boolean => {
    return activeLeadId !== null && activeLead !== null;
  };

  /**
   * Guard function that shows an alert if no active customer is selected
   * Returns true if action should proceed, false if blocked
   */
  const guardAction = (actionName: string = 'this action'): boolean => {
    if (!hasActiveCustomer()) {
      alert(`Please select an active customer before ${actionName}.`);
      return false;
    }
    return true;
  };

  /**
   * Get the active lead ID (for API requests)
   * Returns null if no active customer
   */
  const getActiveLeadId = (): string | null => {
    return activeLeadId;
  };

  return {
    hasActiveCustomer,
    guardAction,
    getActiveLeadId,
    activeLeadId,
    activeLead,
  };
}
