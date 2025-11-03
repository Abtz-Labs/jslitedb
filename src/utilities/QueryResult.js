/**
 * QueryResult class - Represents the result of a query operation
 * Provides chainable methods for result manipulation and filtering
 */
class QueryResult {
  constructor(results) {
    this.results = results || [];
  }

  sort(field, direction = 'asc') {
    this.results.sort((a, b) => {
      const aVal = this._getValueByPath(a.value, field);
      const bVal = this._getValueByPath(b.value, field);

      if (aVal === bVal) return 0;

      const comparison = aVal > bVal ? 1 : -1;

      return direction === 'desc' ? -comparison : comparison;
    });

    return this;
  }

  limit(count) {
    this.results = this.results.slice(0, count);
    return this;
  }

  skip(count) {
    this.results = this.results.slice(count);
    return this;
  }

  count() {
    return this.results.length;
  }

  first() {
    return this.results[0];
  }

  last() {
    return this.results[this.results.length - 1];
  }

  toArray() {
    return [...this.results];
  }

  values() {
    return this.results.map(item => item.value);
  }

  keys() {
    return this.results.map(item => item.key);
  }

  filter(filter) {
    this.results = this.results.filter(item => filter(item.value, item.key));
    return this;
  }

  map(mapper) {
    return this.results.map(item => mapper(item.value, item.key));
  }

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

module.exports = QueryResult;