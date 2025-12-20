/**
 * Visit Summary Generator
 *
 * Generates a concise visit summary from transcript and extracted data.
 * Uses local deterministic rules (no AI call needed for v1).
 */

import type { KeyDetails } from '../os/apps/visit/components';
import type { ChecklistItem } from '../os/apps/visit/components';

export interface VisitSummary {
  overview: string;
  keyFindings: string[];
  workRequired: string[];
  nextActions: string[];
  generatedAt: string;
}

/**
 * Generate a visit summary from transcript and extracted data
 */
export function generateVisitSummary(
  transcript: string,
  keyDetails: KeyDetails,
  checklistItems: ChecklistItem[],
  exceptions: string[]
): VisitSummary {
  const generatedAt = new Date().toISOString();

  // 1. Overview - summarize what was covered
  const overview = generateOverview(transcript, keyDetails);

  // 2. Key Findings - important details extracted
  const keyFindings = generateKeyFindings(keyDetails, exceptions);

  // 3. Work Required - from checklist
  const workRequired = generateWorkRequired(checklistItems);

  // 4. Next Actions - what needs to happen next
  const nextActions = generateNextActions(keyDetails, checklistItems, exceptions);

  return {
    overview,
    keyFindings,
    workRequired,
    nextActions,
    generatedAt,
  };
}

/**
 * Generate overview paragraph
 */
function generateOverview(transcript: string, keyDetails: KeyDetails): string {
  const wordCount = transcript.split(/\s+/).length;
  const detailCount = Object.keys(keyDetails).filter(k => keyDetails[k] !== undefined).length;

  let overview = `Survey visit completed with ${wordCount} words of transcript recorded. `;

  if (detailCount > 0) {
    overview += `Captured ${detailCount} key details including `;

    const details = [];
    if (keyDetails.propertyType) details.push('property type');
    if (keyDetails.boilerMakeModel) details.push('boiler details');
    if (keyDetails.systemType) details.push('system configuration');
    if (keyDetails.pipeSize) details.push('pipework');
    if (keyDetails.mainFuse) details.push('electrical capacity');

    overview += details.slice(0, 3).join(', ');
    if (details.length > 3) overview += `, and ${details.length - 3} more`;
    overview += '.';
  }

  return overview;
}

/**
 * Generate key findings list
 */
function generateKeyFindings(keyDetails: KeyDetails, exceptions: string[]): string[] {
  const findings: string[] = [];

  // Property info
  if (keyDetails.propertyType) {
    let finding = `Property: ${keyDetails.propertyType}`;
    if (keyDetails.bedrooms) finding += `, ${keyDetails.bedrooms} bedroom(s)`;
    findings.push(finding);
  }

  // Boiler info
  if (keyDetails.boilerMakeModel) {
    let finding = `Existing boiler: ${keyDetails.boilerMakeModel}`;
    if (keyDetails.boilerAge) finding += ` (${keyDetails.boilerAge} years old)`;
    findings.push(finding);
  }

  // System info
  if (keyDetails.systemType) {
    findings.push(`Heating system: ${keyDetails.systemType}`);
  }

  // Electrical capacity
  if (keyDetails.mainFuse) {
    findings.push(`Main fuse rating: ${keyDetails.mainFuse}A`);
  }

  // Pipework
  if (keyDetails.pipeSize) {
    findings.push(`Gas pipe size: ${keyDetails.pipeSize}`);
  }

  // Exceptions/issues
  if (exceptions.length > 0) {
    findings.push(`⚠️ ${exceptions.length} issue(s) flagged during visit`);
  }

  return findings;
}

/**
 * Generate work required list from checklist
 */
function generateWorkRequired(checklistItems: ChecklistItem[]): string[] {
  const required = checklistItems
    .filter(item => item.checked)
    .map(item => {
      let text = item.label;
      if (item.note) text += ` (${item.note})`;
      if (item.autoDetected) text += ' [auto-detected]';
      return text;
    });

  return required.length > 0 ? required : ['No specific work items identified yet'];
}

/**
 * Generate next actions
 */
function generateNextActions(
  keyDetails: KeyDetails,
  checklistItems: ChecklistItem[],
  exceptions: string[]
): string[] {
  const actions: string[] = [];

  // If there are exceptions, address them first
  if (exceptions.length > 0) {
    actions.push('Review and address flagged issues');
  }

  // If checklist has items, create quote
  const checkedCount = checklistItems.filter(item => item.checked).length;
  if (checkedCount > 0) {
    actions.push(`Prepare quote for ${checkedCount} work item(s)`);
  }

  // If key details missing, follow up
  const missingDetails = [];
  if (!keyDetails.mainFuse) missingDetails.push('electrical capacity');
  if (!keyDetails.pipeSize) missingDetails.push('gas pipe sizing');
  if (!keyDetails.boilerMakeModel) missingDetails.push('existing boiler details');

  if (missingDetails.length > 0) {
    actions.push(`Confirm: ${missingDetails.join(', ')}`);
  }

  // Default action
  if (actions.length === 0) {
    actions.push('Complete property assessment and prepare quote');
  }

  return actions;
}

/**
 * Format summary as plain text for display/export
 */
export function formatSummaryAsText(summary: VisitSummary): string {
  let text = '# Visit Summary\n\n';

  text += `**Generated:** ${new Date(summary.generatedAt).toLocaleString('en-GB')}\n\n`;

  text += `## Overview\n${summary.overview}\n\n`;

  text += `## Key Findings\n`;
  summary.keyFindings.forEach(finding => {
    text += `- ${finding}\n`;
  });
  text += '\n';

  text += `## Work Required\n`;
  summary.workRequired.forEach(work => {
    text += `- ${work}\n`;
  });
  text += '\n';

  text += `## Next Actions\n`;
  summary.nextActions.forEach(action => {
    text += `- ${action}\n`;
  });

  return text;
}
