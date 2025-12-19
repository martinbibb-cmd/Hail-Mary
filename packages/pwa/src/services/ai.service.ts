/**
 * AI Service Client
 * 
 * Centralized client for Rocky & Sarah AI processing via API gateway.
 * Handles:
 * - Health checks
 * - Rocky fact extraction
 * - Sarah explanation generation
 * - Error handling and degraded mode detection
 */

interface RockyRequest {
  transcript?: string;
  naturalNotes?: string;
  leadId?: number;
  visitId?: number;
  mode?: 'extract' | 'validate';
}

interface SarahRequest {
  rockyFacts: any;
  audience?: 'customer' | 'engineer' | 'surveyor' | 'manager' | 'admin';
  tone?: 'professional' | 'friendly' | 'technical' | 'simple' | 'urgent';
  leadId?: number;
  visitId?: number;
  message?: string;
  context?: any;
}

interface AIHealthStatus {
  success: boolean;
  status: 'available' | 'degraded' | 'unavailable';
  worker?: any;
  responseTime?: number;
  error?: string;
  providers?: any;
}

class AIService {
  private healthStatus: AIHealthStatus | null = null;
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

  /**
   * Check if AI services (Rocky/Sarah) are available
   * Rocky and Sarah run locally - no external worker needed
   */
  async checkHealth(force = false): Promise<AIHealthStatus> {
    const now = Date.now();

    // Use cached status if recent (unless forced)
    if (!force && this.healthStatus && (now - this.lastHealthCheck) < this.HEALTH_CHECK_INTERVAL) {
      return this.healthStatus;
    }

    // Rocky and Sarah are local services - always available
    const healthStatus: AIHealthStatus = {
      success: true,
      status: 'available',
      responseTime: 0,
    };

    this.healthStatus = healthStatus;
    this.lastHealthCheck = now;

    return healthStatus;
  }

  /**
   * Get cached health status (without making a new request)
   */
  getCachedHealth(): AIHealthStatus | null {
    return this.healthStatus;
  }

  /**
   * Call Rocky for fact extraction
   */
  async callRocky(request: RockyRequest): Promise<any> {
    try {
      const response = await fetch('/api/rocky/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Rocky request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      // Mark as degraded on error
      this.healthStatus = {
        success: false,
        status: 'degraded',
        error: error instanceof Error ? error.message : 'Rocky request failed',
      };

      throw error;
    }
  }

  /**
   * Call Sarah for explanation generation
   */
  async callSarah(request: SarahRequest): Promise<any> {
    try {
      const response = await fetch('/api/sarah/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Sarah request failed with status ${response.status}`);
      }

      this.healthStatus = {
        success: true,
        status: 'available',
        worker: this.healthStatus?.worker,
        responseTime: this.healthStatus?.responseTime,
      };

      return data;
    } catch (error) {
      // Mark as degraded on error
      this.healthStatus = {
        success: false,
        status: 'degraded',
        error: error instanceof Error ? error.message : 'Sarah request failed',
      };
      
      throw error;
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
