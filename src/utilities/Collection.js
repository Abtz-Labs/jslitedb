const fs = require("fs").promises;

/**
 * Collection class - Represents a collection within JSLiteDB
 * Provides methods for CRUD operations on documents within a collection
 */
class Collection {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  /**
   * Insert a document into the collection
   * @param {Object|string|number} documentOrId - Document data (if no ID provided) or Document ID
   * @param {Object} [document] - Document data (if ID is provided as first parameter)
   * @returns {Object} The inserted document with its ID
   */
  async insert(documentOrId, document) {
    await this.db._ensureInitialized();

    return await this.db.writeMutex.acquire(async () => {
      let id;
      let doc;

      // Handle different parameter combinations
      if (document === undefined) {
        // insert(document) - auto-generate ID
        doc = documentOrId;
        id = this.db._generateId();
      } else {
        // insert(id, document) - use provided ID
        id = documentOrId;
        doc = document;
      }

      const stringId = String(id);

      // Get or create collection data
      let collectionData = this.db.collectionData.get(this.name);
      if (!collectionData) {
        collectionData = await this.db._loadCollection(this.name);
      }

      // Check if document already exists
      if (collectionData.has(stringId)) {
        throw new Error(`Document with id '${id}' already exists in collection '${this.name}'`);
      }

      // Add document to collection
      collectionData.set(stringId, doc);

      // Update cache
      this.db._addToCache(`${this.name}:${id}`, doc);

      // Save collection to file
      await this.db._saveCollection(this.name);
      await this.db._saveCollectionIndex();

      this.db.emit('collection:insert', { collection: this.name, id, document: doc });

      return { id, ...doc };
    });
  }

  /**
   * Update a document (upsert)
   * @param {string|number} id - Document ID
   * @param {Object} document - Document data
   * @returns {Object} The updated documen
   */
  async update(id, document) {
    await this.db._ensureInitialized();

    return await this.db.writeMutex.acquire(async () => {
      const stringId = String(id);

      // Get or create collection data
      let collectionData = this.db.collectionData.get(this.name);
      if (!collectionData) {
        collectionData = await this.db._loadCollection(this.name);
      }

      // Update document in collection
      collectionData.set(stringId, document);

      // Update cache
      this.db._addToCache(`${this.name}:${id}`, document);

      // Save collection to file
      await this.db._saveCollection(this.name);
      await this.db._saveCollectionIndex();

      this.db.emit('collection:update', { collection: this.name, id, document });

      return document;
    });
  }

  /**
   * Find a document by ID
   * @param {string|number} id - Document ID
   * @returns {Object|null} The document or null if not found
   */
  async findById(id) {
    await this.db._ensureInitialized();

    const cacheKey = `${this.name}:${id}`;
    if (this.db.cache.has(cacheKey)) {
      return this.db.cache.get(cacheKey);
    }

    const collectionData = this.db.collectionData.get(this.name);
    if (!collectionData) return null;

    const document = collectionData.get(String(id));
    if (!document) return null;

    this.db._addToCache(cacheKey, document);
    return document;
  }

  /**
   * Find documents in the collection
   * @param {Object} options - Query options
   * @param {Function} [options.filter] - Filter function
   * @param {number} [options.limit] - Limit number of results
   * @param {number} [options.skip=0] - Skip number of results
   * @returns {Array} Array of documents with id
   */
  async find(options = {}) {
    await this.db._ensureInitialized();

    const { limit, skip = 0, filter } = options;
    const collectionData = this.db.collectionData.get(this.name);

    if (!collectionData) return [];

    const results = [];
    let skipped = 0;

    for (const [id, document] of collectionData) {
      if (skipped < skip) {
        skipped++;
        continue;
      }

      if (limit && results.length >= limit) break;

      // Apply filter if provided
      if (!filter || (typeof filter === 'function' && filter(document, id))) {
        results.push({
          id: id,
          ...document
        });
      }
    }

    return results;
  }

  /**
   * Find one document matching criteria
   * @param {Function} filter - Filter function
   * @returns {Object|null} First matching document or null
   */
  async findOne(filter) {
    const results = await this.find({ limit: 1, filter });
    return results[0] || null;
  }

  /**
   * Delete a documen
   * @param {string|number} id - Document ID
   * @returns {boolean} True if document existed and was deleted
   */
  async delete(id) {
    await this.db._ensureInitialized();

    return await this.db.writeMutex.acquire(async () => {
      const collectionData = this.db.collectionData.get(this.name);
      if (!collectionData || !collectionData.has(String(id))) {
        return false;
      }

      // Get document before deletion for even
      const document = collectionData.get(String(id));

      // Remove from collection
      collectionData.delete(String(id));

      // Remove from cache
      this.db.cache.delete(`${this.name}:${id}`);

      // Save collection to file
      await this.db._saveCollection(this.name);

      // Clean up empty collection
      if (collectionData.size === 0) {
        this.db.collectionData.delete(this.name);
        const filePath = this.db.collectionFiles.get(this.name);
        if (filePath) {
          try {
            await fs.unlink(filePath);
          } catch (error) {
            // File might not exist, that's ok
          }
        }
        this.db.collectionFiles.delete(this.name);
      }

      await this.db._saveCollectionIndex();

      this.db.emit('collection:delete', { collection: this.name, id, document });

      return true;
    });
  }

  /**
   * Count documents in the collection
   * @param {Function|Object} [options] - Optional filter function or options objec
   * @param {Function} [options.filter] - Filter function when using options objec
   * @returns {number} Number of documents
   */
  async count(options) {
    await this.db._ensureInitialized();

    const collectionData = this.db.collectionData.get(this.name);
    if (!collectionData) return 0;

    // Handle both direct filter function and options objec
    let filter;

    if (typeof options === 'function') {
      filter = options;
    } else if (options && typeof options.filter === 'function') {
      filter = options.filter;
    }

    if (!filter) return collectionData.size;

    // Count with filter
    let count = 0;
    for (const [id, document] of collectionData) {
      if (filter(document, id)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Stream through all documents in the collection
   * @returns {AsyncGenerator} Async generator of documents
   */
  async *stream() {
    await this.db._ensureInitialized();

    const collectionData = this.db.collectionData.get(this.name);
    if (!collectionData) return;

    for (const [id, document] of collectionData) {
      yield {
        id: id,
        ...document
      };
    }
  }

  /**
   * Aggregate operations on the collection
   * @param {Array} operations - Array of aggregation operations
   * @returns {*} Aggregation resul
   */
  async aggregate(operations) {
    await this.db._ensureInitialized();

    const docs = await this.find();
    let result = docs;

    for (const operation of operations) {
      switch (operation.type) {
        case 'match':
          if (typeof operation.filter === 'function') {
            result = result.filter(operation.filter);
          }
          break;
        case 'sort':
          result = result.sort((a, b) => {
            const aVal = this.db._getNestedValue(a, operation.field);
            const bVal = this.db._getNestedValue(b, operation.field);
            const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            return operation.direction === 'desc' ? -comparison : comparison;
          });
          break;
        case 'limit':
          result = result.slice(0, operation.count);
          break;
        case 'skip':
          result = result.slice(operation.count);
          break;
        case 'group':
          const groups = {};
          result.forEach(doc => {
            const groupKey = this.db._getNestedValue(doc, operation.field);
            const key = groupKey !== undefined ? String(groupKey) : 'undefined';
            if (!groups[key]) groups[key] = [];
            groups[key].push(doc);
          });
          result = groups;
          break;
      }
    }

    return result;
  }
}

module.exports = Collection;