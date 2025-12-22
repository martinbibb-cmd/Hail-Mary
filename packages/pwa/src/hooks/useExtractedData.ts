/**
 * useExtractedData Hook
 *
 * React hook for accessing auto-extracted data from background transcription.
 * Use this hook in any component to get property, boiler, quotation, and
 * occupancy data that was extracted from voice transcripts.
 *
 * Usage:
 * ```tsx
 * function PropertyModule() {
 *   const { property, boiler, confidence, isAvailable } = useExtractedData(leadId);
 *
 *   return (
 *     <div>
 *       {isAvailable && (
 *         <div>
 *           Property Type: {property.propertyType}
 *           <AutoPopulatedBadge confidence={confidence} />
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */

import { useEffect, useState } from 'react';
import { backgroundTranscriptionProcessor } from '../services/backgroundTranscriptionProcessor';
import type { ExtractedData } from '../services/enhancedDataExtractor';

export interface UseExtractedDataResult extends ExtractedData {
  /**
   * Whether extracted data is available
   */
  isAvailable: boolean;

  /**
   * Timestamp of last update
   */
  lastUpdated?: string;

  /**
   * Reload data from storage
   */
  refresh: () => void;

  /**
   * Clear extracted data
   */
  clear: () => void;
}

/**
 * Hook to access extracted data for a specific lead
 */
export function useExtractedData(leadId: string | null): UseExtractedDataResult {
  const [data, setData] = useState<ExtractedData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | undefined>(undefined);

  const loadData = () => {
    if (!leadId) {
      setData(null);
      setLastUpdated(undefined);
      return;
    }

    const extracted = backgroundTranscriptionProcessor.getExtractedData(leadId);
    if (extracted) {
      setData(extracted);
      // @ts-ignore - lastUpdated is stored in metadata
      setLastUpdated(extracted.lastUpdated);
    } else {
      setData(null);
      setLastUpdated(undefined);
    }
  };

  const clearData = () => {
    if (!leadId) return;
    backgroundTranscriptionProcessor.clearExtractedData(leadId);
    setData(null);
    setLastUpdated(undefined);
  };

  useEffect(() => {
    loadData();

    // Set up polling to check for updates (every 5 seconds)
    const interval = setInterval(loadData, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [leadId]);

  if (!data) {
    return {
      property: {},
      boiler: {},
      quotation: {},
      occupancy: {},
      issues: [],
      notes: [],
      confidence: 0,
      isAvailable: false,
      lastUpdated,
      refresh: loadData,
      clear: clearData,
    };
  }

  return {
    ...data,
    isAvailable: true,
    lastUpdated,
    refresh: loadData,
    clear: clearData,
  };
}

/**
 * Hook to check if a specific field has been auto-populated
 */
export function useIsFieldAutoPopulated(
  leadId: string | null,
  fieldName: string
): {
  isAutoPopulated: boolean;
  confidence: number;
  value: unknown;
} {
  const extracted = useExtractedData(leadId);

  if (!extracted.isAvailable) {
    return {
      isAutoPopulated: false,
      confidence: 0,
      value: undefined,
    };
  }

  // Check if field exists in any of the data categories
  const categories = [extracted.property, extracted.boiler, extracted.quotation, extracted.occupancy];

  for (const category of categories) {
    if (fieldName in category) {
      const value = category[fieldName as keyof typeof category];
      if (value !== undefined && value !== null) {
        return {
          isAutoPopulated: true,
          confidence: extracted.confidence,
          value,
        };
      }
    }
  }

  return {
    isAutoPopulated: false,
    confidence: 0,
    value: undefined,
  };
}

/**
 * Hook to get all auto-populated field names for a lead
 */
export function useAutoPopulatedFields(leadId: string | null): string[] {
  const extracted = useExtractedData(leadId);

  if (!extracted.isAvailable) {
    return [];
  }

  const fields: string[] = [];

  // Collect all non-empty fields from each category
  const categories = {
    ...extracted.property,
    ...extracted.boiler,
    ...extracted.quotation,
    ...extracted.occupancy,
  };

  for (const [key, value] of Object.entries(categories)) {
    if (value !== undefined && value !== null) {
      fields.push(key);
    }
  }

  return fields;
}
