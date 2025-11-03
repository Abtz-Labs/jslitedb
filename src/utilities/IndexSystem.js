/**
 * IndexSystem - A simple indexing system for optimized queries
 * Provides O(1) lookups for indexed fields instead of O(n) full scans
 */
class IndexSystem {
  /**
   * Create a new index for a specific field
   * @param {string} field - The field to index (supports dot notation)
   */
  constructor(field) {
    this.field = field;
    this.index = new Map();
  }

  /**
   * Add an entry to the index
   * @param {string} key - The document key
   * @param {*} value - The document value
   */
  add(key, value) {
    const fieldValue = this._getValueByPath(value, this.field);
    if (fieldValue !== undefined) {
      if (!this.index.has(fieldValue)) {
        this.index.set(fieldValue, new Set());
      }
      this.index.get(fieldValue).add(key);
    }
  }

  /**
   * Remove an entry from the index
   * @param {string} key - The document key
   * @param {*} value - The document value
   */
  remove(key, value) {
    const fieldValue = this._getValueByPath(value, this.field);
    if (fieldValue !== undefined && this.index.has(fieldValue)) {
      this.index.get(fieldValue).delete(key);
      if (this.index.get(fieldValue).size === 0) {
        this.index.delete(fieldValue);
      }
    }
  }

  /**
   * Get all keys that match a field value
   * @param {*} value - The value to search for
   * @returns {Set<string>} Set of matching keys
   */
  get(value) {
    return this.index.get(value) || new Set();
  }

  /**
   * Clear the entire index
   */
  clear() {
    this.index.clear();
  }

  /**
   * Get the size of the index (number of unique values)
   * @returns {number} Number of unique indexed values
   */
  size() {
    return this.index.size;
  }

  /**
   * Get all indexed values
   * @returns {*[]} Array of all indexed values
   */
  getIndexedValues() {
    return Array.from(this.index.keys());
  }

  /**
   * Check if a value exists in the index
   * @param {*} value - The value to check
   * @returns {boolean} True if value exists in index
   */
  hasValue(value) {
    return this.index.has(value);
  }

  /**
   * Get statistics about the index
   * @returns {Object} Index statistics
   */
  getStats() {
    const stats = {
      field: this.field,
      uniqueValues: this.index.size,
      totalDocuments: 0,
      distribution: {}
    };

    for (const [value, keys] of this.index) {
      const count = keys.size;
      stats.totalDocuments += count;
      stats.distribution[value] = count;
    }

    return stats;
  }

  /**
   * Extract value from object using dot notation path
   * @private
   * @param {Object} obj - The object to extract from
   * @param {string} pathStr - The dot notation path
   * @returns {*} The extracted value or undefined
   */
  _getValueByPath(obj, pathStr) {
    const keys = pathStr.split(".");
    let result = obj;
    for (const key of keys) {
      if (result && Object.prototype.hasOwnProperty.call(result, key)) {
        result = result[key];
      } else {
        return undefined;
      }
    }
    return result;
  }
}

module.exports = IndexSystem;