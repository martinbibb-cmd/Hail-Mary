/**
 * Shared utilities for save operations
 * Used by LeadContextBanner and VisitApp to avoid code duplication
 */

/**
 * Format save timestamp to display time
 * @param timestamp ISO timestamp string
 * @returns Formatted time string (HH:MM) or empty string
 */
export function formatSaveTime(timestamp: string | null): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Export lead data as JSON file
 * Downloads the lead data with pending jobs as a JSON file
 * @param leadId Lead ID to export
 * @param exportData JSON data to export
 */
export function exportLeadAsJsonFile(leadId: string, exportData: string): void {
  const blob = new Blob([exportData], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lead-${leadId}-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
