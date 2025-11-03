const { Server } = require("socket.io");
const cors = require("cors");
const EventEmitter = require("events");
const express = require("express");
const fs = require("fs").promises;
const http = require("http");
const path = require("path");

const { IndexSystem, Logger, Validator, WriteMutex, Collection, QueryResult } = require("./utilities");

/**
 * JSLiteDB - A lightweight folder-based JSON database with real-time sync capabilities
 * Collections are stored as individual JSON files within a specified folder.
 * @extends EventEmitter
 */
class JSLiteDB extends EventEmitter {

  /**
   * Create a new DB instance.
   * @param {Object} options - Configuration options
   * @param {string} [options.folderPath="./data"] - Folder path for storage (each collection gets its own JSON file)
   * @param {number} [options.autoSaveInterval=0] - Autosave interval in ms (0 disables autosave)
   * @param {boolean} [options.enableServer=false] - Enable REST API server
   * @param {number} [options.serverPort=3000] - Server por
   * @param {boolean} [options.enableRealtime=true] - Enable real-time sync via WebSocke
   * @param {string} [options.apiKey] - Optional API key for authentication
   * @param {boolean} [options.enableIndexing=true] - Enable automatic indexing for performance
   * @param {boolean} [options.lazyLoading=true] - Enable lazy loading for large datasets
   * @param {number} [options.maxMemoryItems=10000] - Maximum items to keep in memory when lazy loading is enabled
   * @param {boolean} [options.enableLogging=true] - Enable request/response logging
   * @param {boolean} [options.enableWriteQueue=false] - Enable write queue for better concurrency (batches operations)
   * @param {number} [options.queueFlushInterval=100] - Write queue flush interval in ms
   */
  constructor(options = {}) {
    super();

    // Folder and file paths
    this.folderPath = path.resolve(options.folderPath || "./data");
    this.indexFilePath = path.join(this.folderPath, ".index.json");

    this.autoSaveInterval = options.autoSaveInterval || 0;

    // Collection-based storage structures
    this.collectionFiles = new Map(); // Map<collection, filepath>
    this.collectionData = new Map(); // Map<collection, Map<id, document>>
    this.cache = new Map(); // key: "collection:id", value: documen
    this.isInitialized = false;

    // Performance options
    this.enableIndexing = options.enableIndexing !== false;
    this.lazyLoading = options.lazyLoading !== false;
    this.maxMemoryItems = options.maxMemoryItems || 10000;
    this.enableLogging = options.enableLogging !== false;

    // Concurrency control
    this.writeMutex = new WriteMutex();
    this.writeQueue = [];
    this.isProcessingQueue = false;
    this.enableWriteQueue = options.enableWriteQueue || false;
    this.queueFlushInterval = options.queueFlushInterval || 100; // ms

    // Indexing system (for future enhancements)
    this.indexes = new Map();
    this.indexedFields = new Set();

    // Server options
    this.enableServer = options.enableServer || false;
    this.serverPort = options.serverPort || 3000;
    this.enableRealtime = options.enableRealtime !== false;
    this.apiKey = options.apiKey || null;

    // Server instances
    this.app = null;
    this.server = null;
    this.io = null;
    this.isServerRunning = false;

    // Logger
    this.logger = new Logger({
      enableConsole: this.enableLogging,
      level: 'info'
    });

    // Note: Initialization is done lazily when first collection is accessed

    if (this.enableServer) {
      // Start server asynchronously to avoid blocking constructor
      process.nextTick(() => {
        this.startServer(this.serverPort).catch(err => {
          this.logger.error('Failed to start server in constructor:', err);
        });
      });
    }
  }

  // ---------------- Core Collection Methods ----------------

  /**
   * Get a collection interface for document operations
   * @param {string} name - Collection name
   * @returns {Collection} Collection interface
   */
  collection(name) {
    return new Collection(this, name);
  }

  /**
   * Get all collection names
   * @returns {string[]} Array of collection names
   */
  async collections() {
    await this._ensureInitialized();
    return Array.from(this.collectionData.keys());
  }

  /**
   * Drop an entire collection
   * @param {string} collectionName - Collection name
   * @returns {boolean} True if collection existed and was dropped
   */
  async dropCollection(collectionName) {
    await this._ensureInitialized();

    if (!this.collectionData.has(collectionName)) {
      return false;
    }

    this.collectionData.delete(collectionName);

    const filePath = this.collectionFiles.get(collectionName);
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, that's ok
      }
    }

    this.collectionFiles.delete(collectionName);

    const keysToRemove = [];
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.startsWith(`${collectionName}:`)) {
        keysToRemove.push(cacheKey);
      }
    }
    keysToRemove.forEach(key => this.cache.delete(key));

    await this._saveCollectionIndex();

    this.emit('collection:dropped', { collection: collectionName });

    return true;
  }
  /**
   * Clear all collections and data
   * @returns {boolean} True if successful
   */
  async clear() {
    await this._ensureInitialized();

    try {
      for (const filePath of this.collectionFiles.values()) {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // File might not exist, that's ok
        }
      }

      // Remove index file
      try {
        await fs.unlink(this.indexFilePath);
      } catch (error) {
        // File might not exist, that's ok
      }

      // Clear all in-memory data
      this.collectionData.clear();
      this.collectionFiles.clear();
      this.cache.clear();

      this.emit('database:cleared');

      return true;
    } catch (error) {
      this.logger.error('Failed to clear database', { error: error.message });
      throw new Error(`Failed to clear database: ${error.message}`);
    }
  }

  /**
   * Get total document count across all collections
   * @returns {number} Total number of documents
   */
  async count() {
    await this._ensureInitialized();

    let total = 0;
    for (const collectionData of this.collectionData.values()) {
      total += collectionData.size;
    }
    return total;
  }

  /**
   * Initialize the database explicitly
   * @returns {Promise<void>}
   */
  async init() {
    await this._ensureInitialized();
  }

  /**
   * Close the database and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    if (this.isServerRunning) {
      await this.stopServer();
    }

    // Clear intervals and timers
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Clear write queue processing
    this.isProcessingQueue = false;

    // Final save if needed
    if (this.isInitialized) {
      try {
        // Save any pending data
        await this._saveCollectionIndex();
      } catch (error) {
        this.logger.error('Error during close:', error);
      }
    }

    // Clear caches
    this.cache.clear();

    this.isInitialized = false;
  }

  /**
   * Get database statistics
   * @returns {Object} Database statistics
   */
  async getStats() {
    await this._ensureInitialized();

    const stats = {
      collections: {},
      totalDocuments: 0,
      cacheSize: this.cache.size,
      lazyLoading: this.lazyLoading,
      folderPath: this.folderPath,
      collectionCount: this.collectionData.size
    };

    for (const [collectionName, collectionData] of this.collectionData) {
      stats.collections[collectionName] = {
        documentCount: collectionData.size,
        filePath: this._getCollectionFilePath(collectionName)
      };
      stats.totalDocuments += collectionData.size;
    }

    return stats;
  }



  // ---------------- Indexing Methods (Placeholder) ----------------

  /**
   * Create an index for a field (placeholder implementation)
   * @param {string} field - Field to index
   */
  createIndex(field) {
    this.indexedFields.add(field);
    // TODO: Implement actual indexing logic for better performance
  }

  /**
   * Drop an index for a field
   * @param {string} field - Field to drop index for
   */
  dropIndex(field) {
    this.indexedFields.delete(field);
    if (this.indexes.has(field)) {
      this.indexes.delete(field);
    }
  }

  /**
   * Get all indexes
   * @returns {Array} Array of indexed fields
   */
  getIndexes() {
    return Array.from(this.indexedFields);
  }

  /**
   * Save all collections to disk
   */
  async save() {
    await this._ensureInitialized();

    // Save all collections
    for (const collectionName of this.collectionData.keys()) {
      await this._saveCollection(collectionName);
    }

    // Save collection index
    await this._saveCollectionIndex();
  }

  // ---------------- Collection Storage Internal Methods ----------------

  /**
   * Get the file path for a collection
   * @param {string} collectionName - Collection name
   * @returns {string} File path for the collection
   */
  _getCollectionFilePath(collectionName) {
    return path.join(this.folderPath, `${collectionName}.json`);
  }

  /**
   * Generate a unique ID for a documen
   * @returns {string} Generated unique ID
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Ensure the data folder exists
   */
  async _ensureFolder() {
    try {
      await fs.mkdir(this.folderPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async _ensureInitialized() {
    if (this.isInitialized) return;

    await this._ensureFolder();

    try {
      await this._loadCollectionIndex();
    } catch (error) {
      this.logger.info('Scanning collections folder...');
      await this._scanCollections();
      await this._saveCollectionIndex();
    }

    this.isInitialized = true;

    const totalDocs = Array.from(this.collectionData.values())
      .reduce((sum, collectionMap) => sum + collectionMap.size, 0);

    this.logger.info(`✅ Initialized ${this.collectionData.size} collections with ${totalDocs} documents`);
  }

  async _scanCollections() {
    this.collectionFiles.clear();
    this.collectionData.clear();

    try {
      const files = await fs.readdir(this.folderPath);

      for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('.')) {
          const collectionName = file.slice(0, -5); // Remove .json extension
          const filePath = path.join(this.folderPath, file);

          this.collectionFiles.set(collectionName, filePath);

          try {
            const content = await fs.readFile(filePath, 'utf8');
            const collectionData = JSON.parse(content);

            const dataMap = new Map();
            for (const [id, document] of Object.entries(collectionData)) {
              dataMap.set(id, document);
            }

            this.collectionData.set(collectionName, dataMap);

            this.logger.info(`Loaded collection '${collectionName}' with ${dataMap.size} documents`);
          } catch (error) {
            this.logger.warn(`Failed to load collection file ${file}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Folder doesn't exist yet, that's ok
    }
  }

  async _saveCollectionIndex() {
    const indexData = {
      version: 2, // Updated version for new folder-based structure
      timestamp: Date.now(),
      collections: Array.from(this.collectionFiles.keys())
    };

    await fs.writeFile(this.indexFilePath, JSON.stringify(indexData), 'utf8');
  }

  async _loadCollectionIndex() {
    const content = await fs.readFile(this.indexFilePath, 'utf8');
    const indexData = JSON.parse(content);

    // Load each collection mentioned in the index
    for (const collectionName of indexData.collections) {
      const filePath = this._getCollectionFilePath(collectionName);
      this.collectionFiles.set(collectionName, filePath);

      try {
        const collectionContent = await fs.readFile(filePath, 'utf8');
        const collectionData = JSON.parse(collectionContent);

        const dataMap = new Map();
        for (const [id, document] of Object.entries(collectionData)) {
          dataMap.set(id, document);
        }

        this.collectionData.set(collectionName, dataMap);
      } catch (error) {
        this.logger.warn(`Failed to load collection ${collectionName}: ${error.message}`);
        // Remove from index if file doesn't exis
        this.collectionFiles.delete(collectionName);
      }
    }
  }

  /**
   * Save a collection to its JSON file
   * @param {string} collectionName - Collection name
   */
  async _saveCollection(collectionName) {
    const collectionData = this.collectionData.get(collectionName);
    if (!collectionData) return;

    const filePath = this._getCollectionFilePath(collectionName);
    const dataObject = Object.fromEntries(collectionData);

    await fs.writeFile(filePath, JSON.stringify(dataObject, null, 2), 'utf8');
    this.collectionFiles.set(collectionName, filePath);
  }

  /**
   * Load a collection from its JSON file
   * @param {string} collectionName - Collection name
   */
  async _loadCollection(collectionName) {
    const filePath = this._getCollectionFilePath(collectionName);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const collectionData = JSON.parse(content);

      const dataMap = new Map();
      for (const [id, document] of Object.entries(collectionData)) {
        dataMap.set(id, document);
      }

      this.collectionData.set(collectionName, dataMap);
      this.collectionFiles.set(collectionName, filePath);

      return dataMap;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Collection doesn't exist yet, create empty one
        const dataMap = new Map();
        this.collectionData.set(collectionName, dataMap);
        return dataMap;
      }
      throw error;
    }
  }

  _addToCache(key, value) {
    if (this.cache.size >= this.maxMemoryItems) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) =>
      current && current[key] !== undefined ? current[key] : undefined, obj
    );
  }

  // ---------------- REST API Server ----------------

  /**
   * Start REST API server with real-time sync
   * @param {number} port - Server por
   * @returns {Promise<void>}
   */
  async startServer(port = 3000) {
    if (this.isServerRunning) {
      console.log(`⚠️  Server is already running on port ${this.serverPort}`);
      return;
    }

    this.app = express();
    this.server = http.createServer(this.app);

    // Enable real-time if requested
    if (this.enableRealtime) {
      this.io = new Server(this.server, {
        cors: {
          origin: "*",
          methods: ["GET", "POST", "PUT", "DELETE"]
        }
      });

      this._setupWebSocket();
    }

    // Middleware
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging middleware
    if (this.enableLogging) {
      const self = this;

      this.app.use((req, res, next) => {
        const startTime = Date.now();
        const originalSend = res.send;

        res.send = function(data) {
          const duration = Date.now() - startTime;
          self.logger.info('API Request', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });

          originalSend.call(this, data);
        };

        next();
      });
    }

    // Error handling middleware
    this.app.use((err, req, res, next) => {
      this.logger.error('API Error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
      });

      if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON in request body'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });

    // API Key middleware
    if (this.apiKey) {
      this.app.use('/api', (req, res, next) => {
        const headerKey = req.headers['x-api-key'];
        const authKey = req.headers.authorization?.replace('Bearer ', '');
        const queryKey = req.query.apiKey;

        const providedKey = headerKey || authKey || queryKey;

        if (providedKey !== this.apiKey) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized - Invalid or missing API key'
          });
        }

        next();
      });
    }

    this._setupRoutes();

    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        this.isServerRunning = true;
        this.serverPort = port;
        this.emit('server:started', { port });

        console.log(`🚀 JSLiteDB Server running on http://localhost:${port}`);
        console.log(`📡 Real-time sync: ${this.enableRealtime ? 'ENABLED' : 'DISABLED'}`);
        console.log(`🔒 API Key: ${this.apiKey ? 'ENABLED' : 'DISABLED'}`);

        resolve();
      }).on('error', reject);
    });
  }

  /**
   * Stop the REST API server
   */
  stopServer() {
    if (!this.isServerRunning) return;

    return new Promise((resolve) => {
      if (this.io) {
        this.io.close();
        this.io = null;
      }

      if (this.server) {
        this.server.close(() => {
          this.isServerRunning = false;
          this.serverPort = null;
          this.server = null;
          this.app = null;
          console.log('🛑 JSLiteDB Server stopped');
          this.emit('server:stopped');
          resolve();
        });
      } else {
        this.isServerRunning = false;
        this.serverPort = null;
        console.log('🛑 JSLiteDB Server stopped');
        this.emit('server:stopped');
        resolve();
      }
    });
  }

  _setupRoutes() {
    const router = express.Router();
    const self = this;

    // Health check
    router.get('/health', async (req, res) => {
      const memoryUsage = process.memoryUsage();
      const stats = await this.getStats();

      res.status(200).json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        realtime: this.enableRealtime,
        collections: stats.collectionCount,
        totalDocuments: stats.totalDocuments,
        folderPath: this.folderPath,
        memoryUsage: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
        },
        features: {
          indexing: this.enableIndexing,
          lazyLoading: this.lazyLoading,
          realtime: this.enableRealtime
        }
      });
    });









    // Index management routes
    router.post('/indexes/:field', (req, res) => {
      try {
        const { field } = req.params;

        if (!field || typeof field !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Field name is required and must be a string'
          });
        }

        this.createIndex(field);
        res.status(201).json({
          success: true,
          message: `Index created for field: ${field}`
        });
      } catch (error) {
        this.logger.error('Index creation failed', {
          field: req.params.field,
          error: error.message
        });

        res.status(500).json({
          success: false,
          error: 'Index creation failed'
        });
      }
    });

    router.delete('/indexes/:field', (req, res) => {
      try {
        const { field } = req.params;

        if (!this.indexedFields.has(field)) {
          return res.status(404).json({
            success: false,
            error: 'Index not found for field'
          });
        }

        this.dropIndex(field);
        res.status(200).json({
          success: true,
          message: `Index dropped for field: ${field}`
        });
      } catch (error) {
        this.logger.error('Index deletion failed', {
          field: req.params.field,
          error: error.message
        });

        res.status(500).json({
          success: false,
          error: 'Index deletion failed'
        });
      }
    });

    router.get('/indexes', (req, res) => {
      res.status(200).json({
        success: true,
        indexes: this.getIndexes()
      });
    });

    // Database operations (must come before collection routes)

    // Database stats
    router.get('/stats', async (req, res) => {
      try {
        const stats = await this.getStats();

        res.status(200).json({
          success: true,
          data: stats
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to get database statistics'
        });
      }
    });

    // Backup
    router.post('/backup', async (req, res) => {
      try {
        const { path } = req.body;

        if (!path) {
          return res.status(400).json({
            success: false,
            error: 'Backup path is required'
          });
        }

        await this.backup(path);

        res.status(200).json({
          success: true,
          message: `Backup created successfully at ${path}`
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Backup failed'
        });
      }
    });

    // Restore
    router.post('/restore', async (req, res) => {
      try {
        const { path } = req.body;

        if (!path) {
          return res.status(400).json({
            success: false,
            error: 'Restore path is required'
          });
        }

        await this.restore(path);

        res.status(200).json({
          success: true,
          message: `Database restored successfully from ${path}`
        });
      } catch (error) {
        if (error.message.includes('ENOENT')) {
          return res.status(400).json({
            success: false,
            error: 'Backup file not found'
          });
        }

        res.status(500).json({
          success: false,
          error: 'Restore failed'
        });
      }
    });

    // Collection-based REST API routes
    // Routes ordered from most specific to least specific to avoid conflicts

    // Get document count in collection (most specific)
    router.get('/:collection/count', async (req, res) => {
      try {
        const { collection: collectionName } = req.params;
        const collection = this.collection(collectionName);
        const count = await collection.count();

        res.status(200).json({
          success: true,
          data: { count }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to count documents'
        });
      }
    });

    // Get document by ID
    router.get('/:collection/:id', async (req, res) => {
      try {
        const { collection: collectionName, id } = req.params;
        const collection = this.collection(collectionName);
        const document = await collection.findById(id);

        if (!document) {
          return res.status(404).json({
            success: false,
            error: 'Document not found'
          });
        }

        res.status(200).json({
          success: true,
          data: { id, ...document }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve document'
        });
      }
    });

    // Update document
    router.put('/:collection/:id', async (req, res) => {
      try {
        const { collection: collectionName, id } = req.params;
        const document = req.body;

        if (!document || typeof document !== 'object') {
          return res.status(400).json({
            success: false,
            error: 'Request body must be a valid JSON object'
          });
        }

        const collection = this.collection(collectionName);
        const result = await collection.update(id, document);

        res.status(200).json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to update document'
        });
      }
    });

    // Delete document
    router.delete('/:collection/:id', async (req, res) => {
      try {
        const { collection: collectionName, id } = req.params;
        const collection = this.collection(collectionName);
        const deleted = await collection.delete(id);

        if (!deleted) {
          return res.status(404).json({
            success: false,
            error: 'Document not found'
          });
        }

        res.status(200).json({
          success: true,
          data: { deleted: true }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to delete document'
        });
      }
    });

    // Get all documents in collection
    router.get('/:collection', async (req, res) => {
      try {
        const { collection: collectionName } = req.params;
        const { limit, skip } = req.query;

        const collection = this.collection(collectionName);
        const documents = await collection.find({
          limit: limit ? parseInt(limit) : undefined,
          skip: skip ? parseInt(skip) : 0
        });

        res.status(200).json({
          success: true,
          data: documents
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve documents'
        });
      }
    });

    // Create document in collection
    router.post('/:collection', async (req, res) => {
      try {
        const { collection: collectionName } = req.params;
        const document = req.body;

        if (!document || typeof document !== 'object') {
          return res.status(400).json({
            success: false,
            error: 'Request body must be a valid JSON object'
          });
        }

        const collection = this.collection(collectionName);
        const result = document.id ?
          await collection.insert(document.id, document) :
          await collection.insert(document);

        res.status(201).json({
          success: true,
          data: result
        });
      } catch (error) {
        if (error.message.includes('already exists')) {
          return res.status(400).json({
            success: false,
            error: 'Document with this ID already exists'
          });
        }

        res.status(500).json({
          success: false,
          error: 'Failed to create document'
        });
      }
    });

    this.app.use('/api', router);
  }

  _setupWebSocket() {
    const self = this;

    this.io.on('connection', async (socket) => {
      this.logger.info('WebSocket client connected', { socketId: socket.id });
      this.emit('client:connected', { socketId: socket.id });

      // Send current collections on connection
      try {
        const collections = await this.collections();

        socket.emit('collections:init', {
          collections,
          message: 'Collection-based storage ready for real-time operations'
        });
      } catch (error) {
        socket.emit('collections:init', {
          collections: [],
          error: 'Failed to load collections'
        });
      }

      // Note: Collection-specific operations should be handled through REST API
      // Real-time updates can be broadcasted when operations occur

      // Handle connection errors
      socket.on('error', (error) => {
        this.logger.error('WebSocket error', {
          socketId: socket.id,
          error: error.message
        });
      });

      socket.on('disconnect', (reason) => {
        this.logger.info('WebSocket client disconnected', {
          socketId: socket.id,
          reason
        });

        this.emit('client:disconnected', { socketId: socket.id, reason });
      });
    });

    // Handle server-level WebSocket errors
    this.io.on('error', (error) => {
      this.logger.error('WebSocket server error', { error: error.message });
    });
  }

  // ---------------- Backup & Restore ----------------

  /**
   * Backup data to a file
   * @param {string} backupPath - Path to backup file
   */
  async backup(backupPath) {
    try {
      await this._ensureInitialized();

      const backupData = {
        version: 2,
        timestamp: Date.now(),
        folderBased: true,
        collections: {}
      };

      // Export all collections
      for (const [collectionName, collectionData] of this.collectionData) {
        backupData.collections[collectionName] = Object.fromEntries(collectionData);
      }

      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), "utf8");
      this.emit("backup", { backupPath }); // Emit event only after successful backup
    } catch (error) {
      throw new Error(`Failed to backup data: ${error.message}`);
    }
  }

  /**
   * Restore data from a backup file
   * @param {string} backupPath - Path to backup file
   */
  async restore(backupPath) {
    // Store current state for potential rollback
    const oldCollectionData = new Map(this.collectionData);
    const oldCollectionFiles = new Map(this.collectionFiles);

    try {
      const content = await fs.readFile(backupPath, "utf8");
      const backupData = JSON.parse(content);

      await this._ensureInitialized();

      // Clear current data
      this.collectionData.clear();
      this.collectionFiles.clear();
      this.cache.clear();

      // Handle different backup formats
      if (backupData.folderBased && backupData.collections) {
        // New folder-based forma
        for (const [collectionName, collectionDoc] of Object.entries(backupData.collections)) {
          const dataMap = new Map();
          for (const [id, document] of Object.entries(collectionDoc)) {
            dataMap.set(id, document);
          }

          this.collectionData.set(collectionName, dataMap);
          await this._saveCollection(collectionName);
        }
      } else {
        // Legacy key-value format - restore to _default collection
        const dataMap = new Map();
        for (const [key, value] of Object.entries(backupData)) {
          dataMap.set(key, value);
        }

        this.collectionData.set('_default', dataMap);
        await this._saveCollection('_default');
      }

      // Save collection index
      await this._saveCollectionIndex();

      // Emit event only after successful restore and save
      this.emit("restore", { backupPath });

    } catch (error) {
      // Rollback changes if restore failed
      this.collectionData = oldCollectionData;
      this.collectionFiles = oldCollectionFiles;

      throw new Error(`Failed to restore data: ${error.message}`);
    }
  }
}

// Export utilities for advanced usage
JSLiteDB.IndexSystem = IndexSystem;
JSLiteDB.Logger = Logger;
JSLiteDB.Validator = Validator;
JSLiteDB.WriteMutex = WriteMutex;
JSLiteDB.Collection = Collection;
JSLiteDB.QueryResult = QueryResult;

module.exports = JSLiteDB;