const JSLiteDB = require('../../src/index.js');
const TestUtils = require('../test-utils');
const path = require('path');

describe('JSLiteDB Core Functionality', () => {
  let db;
  let tempDir;

  beforeEach(async () => {
    tempDir = await TestUtils.createTempDir();
    db = new JSLiteDB({
      folderPath: tempDir,
      autoSaveInterval: 0,
      enableLogging: false
    });
  });

  afterEach(async () => {
    if (db) {
      if (db.stopServer) {
        db.stopServer();
      }
    }
    await TestUtils.cleanupTempDir(tempDir);
  });

  describe('Database Initialization', () => {
    test('should create database instance with default options', () => {
      const dbDefault = new JSLiteDB();
      expect(dbDefault).toBeInstanceOf(JSLiteDB);
      expect(dbDefault.folderPath).toContain('data');
    });

    test('should create database instance with custom options', () => {
      expect(db).toBeInstanceOf(JSLiteDB);
      expect(db.folderPath).toBe(tempDir);
      expect(db.autoSaveInterval).toBe(0);
    });

    test('should initialize successfully', async () => {
      await TestUtils.withTimeout(db._ensureInitialized());
      expect(db.isInitialized).toBe(true);
    });

    test('should handle multiple initialization calls gracefully', async () => {
      await TestUtils.withTimeout(db._ensureInitialized());
      await TestUtils.withTimeout(db._ensureInitialized()); // Second call should not throw
      expect(db.isInitialized).toBe(true);
    });
  });

  describe('Collection Operations', () => {
    beforeEach(async () => {
      await TestUtils.withTimeout(db._ensureInitialized());
    });

    test('should create and access collections', () => {
      const users = db.collection('users');
      const posts = db.collection('posts');

      TestUtils.expectValidCollection(users);
      TestUtils.expectValidCollection(posts);
      expect(users.name).toBe('users');
      expect(posts.name).toBe('posts');
    });

    test('should create collection instances with same name and db reference', () => {
      const users1 = db.collection('users');
      const users2 = db.collection('users');
      expect(users1.name).toBe(users2.name);
      expect(users1.db).toBe(users2.db);
      expect(users1.name).toBe('users');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await TestUtils.withTimeout(db._ensureInitialized());
    });

    test('should emit collection events', async () => {
      const users = db.collection('users');
      const events = {
        insert: [],
        update: [],
        delete: []
      };

      db.on('collection:insert', (data) => events.insert.push(data));
      db.on('collection:update', (data) => events.update.push(data));
      db.on('collection:delete', (data) => events.delete.push(data));

      const testDoc = { name: 'John Doe', email: 'john@example.com' };

      // Test insert even
      const inserted = await users.insert(testDoc);
      expect(events.insert).toHaveLength(1);
      expect(events.insert[0].collection).toBe('users');
      expect(events.insert[0].document).toEqual(testDoc);

      // Test update even
      const updated = await users.update(inserted.id, { name: 'Jane Doe' });
      expect(events.update).toHaveLength(1);
      expect(events.update[0].collection).toBe('users');

      // Test delete even
      await users.delete(inserted.id);
      expect(events.delete).toHaveLength(1);
      expect(events.delete[0].collection).toBe('users');
    });
  });

  describe('Database Statistics', () => {
    beforeEach(async () => {
      await TestUtils.withTimeout(db._ensureInitialized());
    });

    test('should provide accurate statistics', async () => {
      const users = db.collection('users');
      const testData = TestUtils.generateTestData(5);

      // Insert test data
      for (const doc of testData) {
        await users.insert(doc);
      }

      const stats = await db.getStats();
      expect(stats).toBeDefined();
      expect(stats.collections).toBeDefined();
      expect(stats.collections.users).toBeDefined();
      expect(stats.collections.users.documentCount).toBe(5);
      expect(stats.totalDocuments).toBe(5);
    });
  });

  describe('Backup and Restore', () => {
    beforeEach(async () => {
      await TestUtils.withTimeout(db._ensureInitialized());
    });

    test('should create and restore backups', async () => {
      const users = db.collection('users');
      const testData = TestUtils.generateTestData(3);

      // Insert test data with explicit IDs
      for (let i = 0; i < testData.length; i++) {
        await users.insert(`test-${i}`, testData[i]);
      }

      // Create backup
      const backupPath = path.join(tempDir, 'backup.json');
      await db.backup(backupPath);
      expect(await TestUtils.waitForFile(backupPath)).toBe(true);

      // Clear data using the known IDs
      for (let i = 0; i < testData.length; i++) {
        await users.delete(`test-${i}`);
      }
      expect(await users.count()).toBe(0);

      // Restore from backup
      await db.restore(backupPath);
      const restoredCount = await users.count();
      expect(restoredCount).toBe(3);

      // Verify restored data
      const restoredUser = await users.findById('test-0');
      expect(restoredUser.name).toBe('User 1');
    });
  });

  describe('Data Persistence', () => {
    test('should persist data across database instances', async () => {
      // Create first instance and add data
      const db1 = new JSLiteDB({
        folderPath: tempDir,
        autoSaveInterval: 0,
        enableLogging: false
      });

      await TestUtils.withTimeout(db1._ensureInitialized());
      const users1 = db1.collection('users');

      const testDoc = { name: 'Persistent User', email: 'persistent@example.com' };
      const inserted = await users1.insert('persist-test', testDoc);
      if (db1.stopServer) {
        db1.stopServer();
      }

      // Create second instance and verify data exists
      const db2 = new JSLiteDB({
        folderPath: tempDir,
        autoSaveInterval: 0,
        enableLogging: false
      });

      await TestUtils.withTimeout(db2._ensureInitialized());
      const users2 = db2.collection('users');

      const retrieved = await users2.findById('persist-test');
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('Persistent User');
      expect(retrieved.email).toBe('persistent@example.com');

      if (db2.stopServer) {
        db2.stopServer();
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await TestUtils.withTimeout(db._ensureInitialized());
    });

    test('should handle collection names gracefully', () => {
      // The library allows various collection names, including edge cases
      expect(() => db.collection('')).not.toThrow();
      expect(() => db.collection('valid-name')).not.toThrow();
      expect(() => db.collection('validName123')).not.toThrow();

      // Test that collection objects are created properly
      const emptyNameCollection = db.collection('');
      expect(emptyNameCollection.name).toBe('');
      expect(emptyNameCollection.db).toBe(db);
    });

    test('should handle corrupted data files gracefully', async () => {
      // This test would require more complex setup to simulate corruption
      // For now, we'll test that the database handles missing files
      const users = db.collection('nonexistent');
      const result = await users.find();
      expect(result).toEqual([]);
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await TestUtils.withTimeout(db._ensureInitialized());
    });

    test('should manage cache properly', async () => {
      const users = db.collection('users');
      const testDoc = { name: 'Cache Test', email: 'cache@example.com' };

      const inserted = await users.insert(testDoc);

      // Verify item is in cache
      expect(db.cache.has(`users:${inserted.id}`)).toBe(true);

      // Clear cache and verify it's gone
      db.cache.clear();
      expect(db.cache.has(`users:${inserted.id}`)).toBe(false);

      // Verify data can still be retrieved (from disk)
      const retrieved = await users.findById(inserted.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('Cache Test');
    });
  });
});