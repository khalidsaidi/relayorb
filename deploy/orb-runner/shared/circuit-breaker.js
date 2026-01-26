/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascade failures by stopping calls to a failing service
 * and returning fallback responses until the service recovers.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests return fallback immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

const CircuitState = {
  CLOSED: "closed",
  OPEN: "open",
  HALF_OPEN: "half_open",
}

/**
 * @typedef {Object} CircuitBreakerConfig
 * @property {number} [failureThreshold=5] - Number of failures before opening circuit
 * @property {number} [successThreshold=2] - Number of successes in half-open to close circuit
 * @property {number} [timeout=30000] - Time in ms before attempting to half-open
 * @property {number} [halfOpenMaxConcurrent=1] - Max concurrent requests in half-open state
 * @property {function} [onStateChange] - Callback when circuit state changes
 * @property {function} [onFailure] - Callback when a failure is recorded
 */

class CircuitBreaker {
  /**
   * @param {string} name - Identifier for this circuit breaker
   * @param {CircuitBreakerConfig} config
   */
  constructor(name, config = {}) {
    this.name = name
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = null
    this.halfOpenInFlight = 0

    this.failureThreshold = config.failureThreshold ?? 5
    this.successThreshold = config.successThreshold ?? 2
    this.timeout = config.timeout ?? 30000
    this.halfOpenMaxConcurrent = config.halfOpenMaxConcurrent ?? 1
    this.onStateChange = config.onStateChange
    this.onFailure = config.onFailure
  }

  /**
   * Get current circuit state and metrics
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      isOpen: this.state === CircuitState.OPEN,
      isClosed: this.state === CircuitState.CLOSED,
      isHalfOpen: this.state === CircuitState.HALF_OPEN,
    }
  }

  /**
   * Transition to a new state
   * @private
   */
  _transitionTo(newState) {
    if (this.state === newState) return

    const oldState = this.state
    this.state = newState

    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0
      this.successCount = 0
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0
      this.halfOpenInFlight = 0
    }

    console.log(`[CircuitBreaker:${this.name}] State change: ${oldState} -> ${newState}`)
    this.onStateChange?.(oldState, newState, this.getStatus())
  }

  /**
   * Record a successful call
   */
  recordSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1)
      this.successCount++

      if (this.successCount >= this.successThreshold) {
        this._transitionTo(CircuitState.CLOSED)
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0
    }
  }

  /**
   * Record a failed call
   * @param {Error} error - The error that occurred
   */
  recordFailure(error) {
    this.lastFailureTime = Date.now()
    this.onFailure?.(error, this.getStatus())

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1)
      this._transitionTo(CircuitState.OPEN)
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++

      if (this.failureCount >= this.failureThreshold) {
        this._transitionTo(CircuitState.OPEN)
      }
    }
  }

  /**
   * Check if a request should be allowed through
   * @returns {boolean} True if request should proceed, false if circuit is open
   */
  allowRequest() {
    if (this.state === CircuitState.CLOSED) {
      return true
    }

    if (this.state === CircuitState.OPEN) {
      const now = Date.now()
      const timeSinceFailure = now - (this.lastFailureTime || 0)

      if (timeSinceFailure >= this.timeout) {
        this._transitionTo(CircuitState.HALF_OPEN)
        // Fall through to half-open logic
      } else {
        return false
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenInFlight < this.halfOpenMaxConcurrent) {
        this.halfOpenInFlight++
        return true
      }
      return false
    }

    return true
  }

  /**
   * Execute a function with circuit breaker protection
   * @template T
   * @param {function(): Promise<T>} fn - The async function to execute
   * @param {function(): T} [fallback] - Optional fallback function when circuit is open
   * @returns {Promise<T>}
   */
  async execute(fn, fallback) {
    if (!this.allowRequest()) {
      console.log(`[CircuitBreaker:${this.name}] Circuit OPEN, returning fallback`)
      if (fallback) {
        return fallback()
      }
      throw new Error(`Circuit breaker ${this.name} is open`)
    }

    try {
      const result = await fn()
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure(error)
      throw error
    }
  }

  /**
   * Force the circuit to a specific state (for testing/recovery)
   * @param {string} state - One of: "closed", "open", "half_open"
   */
  forceState(state) {
    if (Object.values(CircuitState).includes(state)) {
      this._transitionTo(state)
    }
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset() {
    this._transitionTo(CircuitState.CLOSED)
    this.lastFailureTime = null
  }
}

/**
 * Create a circuit breaker wrapper for fetch-based API calls
 * @param {string} name - Circuit breaker name
 * @param {CircuitBreakerConfig} config
 * @returns {CircuitBreaker}
 */
function createCircuitBreaker(name, config = {}) {
  return new CircuitBreaker(name, config)
}

module.exports = {
  CircuitBreaker,
  CircuitState,
  createCircuitBreaker,
}
