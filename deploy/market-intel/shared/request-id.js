/**
 * Request ID Utility for Distributed Tracing
 *
 * Provides utilities for generating, propagating, and logging request IDs
 * across service boundaries for better observability.
 */

const crypto = require("crypto")

const REQUEST_ID_HEADER = "x-request-id"
const CORRELATION_ID_HEADER = "x-correlation-id"

/**
 * Generate a new request ID
 * Format: timestamp-randomhex (e.g., "1706184234567-a1b2c3d4")
 * @returns {string}
 */
function generateRequestId() {
  const timestamp = Date.now()
  const random = crypto.randomBytes(4).toString("hex")
  return `${timestamp}-${random}`
}

/**
 * Extract request ID from incoming request headers
 * Falls back to generating a new one if not present
 * @param {Object} headers - Request headers object
 * @returns {string}
 */
function extractRequestId(headers) {
  if (!headers) return generateRequestId()

  // Check common header names (case-insensitive)
  const headerKeys = Object.keys(headers)
  for (const key of headerKeys) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === REQUEST_ID_HEADER || lowerKey === CORRELATION_ID_HEADER) {
      const value = headers[key]
      if (value && typeof value === "string") {
        return value
      }
    }
  }

  return generateRequestId()
}

/**
 * Create headers object with request ID for outgoing requests
 * @param {string} requestId - The request ID to include
 * @param {Object} [existingHeaders] - Existing headers to merge with
 * @returns {Object}
 */
function createRequestIdHeaders(requestId, existingHeaders = {}) {
  return {
    ...existingHeaders,
    [REQUEST_ID_HEADER]: requestId,
    [CORRELATION_ID_HEADER]: requestId,
  }
}

/**
 * Create a logger wrapper that includes request ID in all log messages
 * @param {string} serviceName - Name of the service for log prefix
 * @param {string} [requestId] - Optional request ID to include
 * @returns {Object} - Logger object with info, warn, error methods
 */
function createRequestLogger(serviceName, requestId) {
  const prefix = requestId
    ? `[${serviceName}] [req:${requestId}]`
    : `[${serviceName}]`

  return {
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
    debug: (...args) => console.log(prefix, "[DEBUG]", ...args),
  }
}

/**
 * Middleware-style function to extract and attach request ID to request object
 * For use with Node.js HTTP server or Express-like frameworks
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {string} - The request ID
 */
function attachRequestId(req, res) {
  const requestId = extractRequestId(req.headers)
  req.requestId = requestId

  // Add request ID to response headers for client correlation
  if (res && typeof res.setHeader === "function") {
    res.setHeader(REQUEST_ID_HEADER, requestId)
  }

  return requestId
}

/**
 * Create fetch options with request ID header
 * @param {string} requestId - Request ID to include
 * @param {Object} [options] - Existing fetch options
 * @returns {Object}
 */
function withRequestId(requestId, options = {}) {
  return {
    ...options,
    headers: createRequestIdHeaders(requestId, options.headers),
  }
}

module.exports = {
  REQUEST_ID_HEADER,
  CORRELATION_ID_HEADER,
  generateRequestId,
  extractRequestId,
  createRequestIdHeaders,
  createRequestLogger,
  attachRequestId,
  withRequestId,
}
