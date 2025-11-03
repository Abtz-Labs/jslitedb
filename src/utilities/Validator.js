/**
 * Validator - Input validation utility for JSLiteDB
 * Provides validation for API parameters
 */
class Validator {

  /**
   * Validate pagination parameters
   * @param {*} limit - The limit parameter
   * @param {*} skip - The skip parameter
   * @returns {Object} Validation result with { valid: boolean, error?: string }
   */
  static validatePagination(limit, skip) {
    const errors = [];

    if (limit !== undefined) {
      if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 0) {
        errors.push('Limit must be a non-negative integer');
      } else if (limit > 10000) {
        errors.push('Limit must not exceed 10000');
      }
    }

    if (skip !== undefined) {
      if (typeof skip !== 'number' || !Number.isInteger(skip) || skip < 0) {
        errors.push('Skip must be a non-negative integer');
      } else if (skip > 1000000) {
        errors.push('Skip must not exceed 1000000');
      }
    }

    return errors.length > 0 ? { valid: false, error: errors.join(', ') } : { valid: true };
  }

  /**
   * Validate field name for indexing/querying
   * @param {*} field - The field name to validate
   * @returns {Object} Validation result with { valid: boolean, error?: string }
   */
  static validateFieldName(field) {
    if (typeof field !== 'string') {
      return { valid: false, error: 'Field name must be a string' };
    }

    if (field.length === 0) {
      return { valid: false, error: 'Field name cannot be empty' };
    }

    if (field.length > 100) {
      return { valid: false, error: 'Field name must be less than 100 characters' };
    }

    // Basic dot notation validation
    if (field.startsWith('.') || field.endsWith('.') || field.includes('..')) {
      return {
        valid: false,
        error: 'Invalid dot notation: field cannot start/end with dots or contain consecutive dots'
      };
    }

    return { valid: true };
  }

  /**
   * Validate sort direction
   * @param {*} direction - The sort direction to validate
   * @returns {Object} Validation result with { valid: boolean, error?: string }
   */
  static validateSortDirection(direction) {
    if (direction !== undefined && !['asc', 'desc'].includes(direction)) {
      return {
        valid: false,
        error: 'Sort direction must be either "asc" or "desc"'
      };
    }

    return { valid: true };
  }

  /**
   * Validate query operator
   * @param {*} operator - The query operator to validate
   * @returns {Object} Validation result with { valid: boolean, error?: string }
   */
  static validateQueryOperator(operator) {
    const validOperators = [
      '=', '==', '!=', '>', '<', '>=', '<=',
      'in', 'contains', 'startsWith', 'endsWith'
    ];

    if (!validOperators.includes(operator)) {
      return {
        valid: false,
        error: `Invalid operator. Must be one of: ${validOperators.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Validate aggregation operation
   * @param {*} operation - The aggregation operation to validate
   * @returns {Object} Validation result with { valid: boolean, error?: string }
   */
  static validateAggregationOperation(operation) {
    const validOperations = ['count', 'sum', 'avg', 'min', 'max'];

    if (!validOperations.includes(operation)) {
      return {
        valid: false,
        error: `Invalid operation. Must be one of: ${validOperations.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Validate file path
   * @param {*} filePath - The file path to validate
   * @returns {Object} Validation result with { valid: boolean, error?: string }
   */
  static validateFilePath(filePath) {
    if (typeof filePath !== 'string') {
      return { valid: false, error: 'File path must be a string' };
    }

    if (filePath.length === 0) {
      return { valid: false, error: 'File path cannot be empty' };
    }

    if (filePath.length > 260) {  // Windows MAX_PATH limi
      return { valid: false, error: 'File path too long (max 260 characters)' };
    }

    // Basic security check - prevent path traversal
    if (filePath.includes('..') || filePath.includes('\0')) {
      return {
        valid: false,
        error: 'File path contains invalid characters'
      };
    }

    return { valid: true };
  }

  /**
   * Sanitize string inpu
   * @param {string} input - String to sanitize
   * @returns {string} Sanitized string
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Remove null characters and control characters except newlines and tabs
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Validate multiple parameters at once
   * @param {Object} params - Object with parameters to validate
   * @param {Object} rules - Object with validation rules
   * @returns {Object} Validation result with { valid: boolean, errors: string[] }
   */
  static validateBatch(params, rules) {
    const errors = [];

    for (const [param, rule] of Object.entries(rules)) {
      const value = params[param];
      let result;

      switch (rule.type) {
        case 'field':
          result = this.validateFieldName(value);
          break;
        default:
          continue;
      }

      if (!result.valid) {
        errors.push(`${param}: ${result.error}`);
      }
    }

    return errors.length > 0
      ? { valid: false, errors }
      : { valid: true };
  }
}

module.exports = Validator;