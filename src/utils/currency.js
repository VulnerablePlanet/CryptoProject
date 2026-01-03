/**
 * Currency Utility Module
 * Centralized currency conversion and formatting for COP support
 * 
 * This module provides a single source of truth for currency formatting
 * and USD to COP conversion across the entire application.
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Global currency configuration
 * @property {number} copRate - USD to COP exchange rate
 * @property {object} locales - Locale settings for each currency
 * @property {object} formatOptions - Intl.NumberFormat options for each currency
 */
export const CURRENCY_CONFIG = {
  copRate: 4400, // Default USD to COP exchange rate
  locales: {
    usd: 'en-US',
    cop: 'es-CO'
  },
  formatOptions: {
    usd: {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    },
    cop: {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }
  }
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert USD value to COP
 * @param {number} usdValue - Value in USD
 * @returns {number} Value in COP
 */
export const convertToCOP = (usdValue) => {
  if (!usdValue || isNaN(usdValue)) return 0
  return usdValue * CURRENCY_CONFIG.copRate
}

/**
 * Update the COP exchange rate dynamically
 * Useful for fetching real-time exchange rates from an external API
 * @param {number} newRate - New USD to COP exchange rate
 */
export const updateCopRate = (newRate) => {
  if (newRate && !isNaN(newRate) && newRate > 0) {
    CURRENCY_CONFIG.copRate = newRate
  }
}

/**
 * Get the current COP exchange rate
 * @returns {number} Current USD to COP exchange rate
 */
export const getCopRate = () => CURRENCY_CONFIG.copRate

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format a value as USD currency
 * @param {number} value - Value to format
 * @param {object} options - Optional formatting options override
 * @returns {string} Formatted USD string
 */
export const formatUSD = (value, options = {}) => {
  if (value === null || value === undefined || isNaN(value)) return '$0.00'
  
  const formatOptions = {
    ...CURRENCY_CONFIG.formatOptions.usd,
    // Adjust decimal places based on value magnitude
    maximumFractionDigits: value < 1 ? 6 : 2,
    ...options
  }
  
  return new Intl.NumberFormat(
    CURRENCY_CONFIG.locales.usd,
    formatOptions
  ).format(value)
}

/**
 * Format a value as COP currency (converts from USD first)
 * @param {number} usdValue - Value in USD to convert and format
 * @param {object} options - Optional formatting options override
 * @returns {string} Formatted COP string
 */
export const formatCOP = (usdValue, options = {}) => {
  if (usdValue === null || usdValue === undefined || isNaN(usdValue)) return 'COP $0'
  
  const copValue = convertToCOP(usdValue)
  
  const formatOptions = {
    ...CURRENCY_CONFIG.formatOptions.cop,
    ...options
  }
  
  return new Intl.NumberFormat(
    CURRENCY_CONFIG.locales.cop,
    formatOptions
  ).format(copValue)
}

/**
 * Format a value as COP with Colombian flag emoji prefix
 * @param {number} usdValue - Value in USD to convert and format
 * @returns {string} Formatted COP string with flag emoji
 */
export const formatCOPWithFlag = (usdValue) => {
  return `🇨🇴 ${formatCOP(usdValue)}`
}

/**
 * Format a number with compact notation (K, M, B)
 * @param {number} value - Value to format
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Compact formatted string
 */
export const formatCompact = (value, locale = 'en-US') => {
  if (value === null || value === undefined || isNaN(value)) return '0'
  
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 2
  }).format(value)
}

/**
 * Format a percentage value
 * @param {number} value - Percentage value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0%'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  CURRENCY_CONFIG,
  convertToCOP,
  updateCopRate,
  getCopRate,
  formatUSD,
  formatCOP,
  formatCOPWithFlag,
  formatCompact,
  formatPercentage
}
