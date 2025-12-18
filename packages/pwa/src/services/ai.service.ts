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
}

class AIService {
  private healthStatus: AIHealthStatus | null = null;
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

  /**
   * Check if AI Worker is available
   */
  async checkHealth(force = false): Promise<AIHealthStatus> {
    const now = Date.now();
    
    // Use cached status if recent (unless forced)
    if (!force && this.healthStatus && (now - this.lastHealthCheck) < this.HEALTH_CHECK_INTERVAL) {
      return this.healthStatus;
    }

    try {
      const response = await fetch('/api/ai/health', {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      
      this.healthStatus = data;
      this.lastHealthCheck = now;
      
      return data;
    } catch (error) {
      const errorStatus: AIHealthStatus = {
        success: false,
        status: 'unavailable',
        error: error instanceof Error ? error.message : 'Health check failed',
      };
      
      this.healthStatus = errorStatus;
      this.lastHealthCheck = now;
      
      return errorStatus;
    }
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
      const response = await fetch('/api/ai/rocky', {
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
      const response = await fetch('/api/ai/sarah', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Sarah request failed with status ${response.status}`);
      }

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
