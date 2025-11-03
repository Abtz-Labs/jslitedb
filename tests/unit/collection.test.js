const JSLiteDB = require('../../src/index.js');
const TestUtils = require('../test-utils');

describe('Collection Class', () => {
  let db;
  let collection;
  let tempDir;

  beforeEach(async () => {
    tempDir = await TestUtils.createTempDir();
    db = new JSLiteDB({
      folderPath: tempDir,
      autoSaveInterval: 0,
      enableLogging: false
    });
    await TestUtils.withTimeout(db._ensureInitialized());
    collection = db.collection('testCollection');
  });

  afterEach(async () => {
    if (db) {
      if (db.stopServer) {
        db.stopServer();
      }
    }
    await TestUtils.cleanupTempDir(tempDir);
  });

  describe('Document Insertion', () => {
    test('should insert document with auto-generated ID', async () => {
      const doc = { name: 'John', age: 30 };
      const result = await collection.insert(doc);

      TestUtils.expectValidDocument(result);
      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
      expect(result.id).toBeDefined();
    });

    test('should insert document with custom ID', async () => {
      const doc = { name: 'Jane', age: 25 };
      const result = await collection.insert('custom-id', doc);

      TestUtils.expectValidDocument(result, 'custom-id');
      expect(result.name).toBe('Jane');
      expect(result.age).toBe(25);
    });

    test('should handle numeric IDs', async () => {
      const doc = { name: 'NumericID', value: 123 };
      const result = await collection.insert(42, doc);

      TestUtils.expectValidDocument(result, 42);
      expect(result.name).toBe('NumericID');
    });

    test('should prevent duplicate IDs', async () => {
      const doc1 = { name: 'First' };
      const doc2 = { name: 'Second' };

      await collection.insert('duplicate-id', doc1);
      await expect(collection.insert('duplicate-id', doc2)).rejects.toThrow();
    });

    test('should handle complex nested documents', async () => {
      const complexDoc = {
        user: {
          name: 'Complex User',
          details: {
            age: 30,
            preferences: {
              theme: 'dark',
              notifications: true
            }
          }
        },
        tags: ['tag1', 'tag2'],
        metadata: {
          created: new Date().toISOString(),
          version: 1
        }
      };

      const result = await collection.insert(complexDoc);
      TestUtils.expectValidDocument(result);
      expect(result.user.name).toBe('Complex User');
      expect(result.user.details.preferences.theme).toBe('dark');
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('Document Retrieval', () => {
    let testData;

    beforeEach(async () => {
      testData = TestUtils.generateTestData(10);
      for (let i = 0; i < testData.length; i++) {
        await collection.insert(testData[i].id, testData[i]);
      }
    });

    test('should find document by ID', async () => {
      const doc = await collection.findById(1);
      TestUtils.expectValidDocument(doc, 1);
      expect(doc.name).toBe('User 1');
      expect(doc.email).toBe('user1@example.com');
    });

    test('should return null for non-existent ID', async () => {
      const doc = await collection.findById('non-existent');
      expect(doc).toBeNull();
    });

    test('should find all documents', async () => {
      const docs = await collection.find();
      expect(docs).toHaveLength(10);
      expect(docs[0].name).toBe('User 1');
    });

    test('should find documents with filter', async () => {
      const activeDocs = await collection.find({
        filter: (doc) => doc.active === true
      });

      expect(activeDocs.length).toBeGreaterThan(0);
      activeDocs.forEach(doc => {
        expect(doc.active).toBe(true);
      });
    });

    test('should find documents with limit', async () => {
      const limitedDocs = await collection.find({ limit: 3 });
      expect(limitedDocs).toHaveLength(3);
    });

    test('should find documents with skip', async () => {
      const skippedDocs = await collection.find({ skip: 5 });
      expect(skippedDocs).toHaveLength(5);
    });

    test('should find documents with limit and skip', async () => {
      const paginatedDocs = await collection.find({ skip: 2, limit: 3 });
      expect(paginatedDocs).toHaveLength(3);
    });

    test('should find one document with filter', async () => {
      const doc = await collection.findOne((doc) => doc.age > 25);
      expect(doc).toBeDefined();
      expect(doc.age).toBeGreaterThan(25);
    });

    test('should return null when findOne finds no matches', async () => {
      const doc = await collection.findOne((doc) => doc.age > 100);
      expect(doc).toBeNull();
    });
  });

  describe('Document Updates', () => {
    test('should update existing document', async () => {
      const originalDoc = { name: 'Original', value: 100 };
      const inserted = await collection.insert('update-test', originalDoc);

      const updatedDoc = { name: 'Updated', value: 200, newField: 'added' };
      const result = await collection.update('update-test', updatedDoc);

      expect(result.name).toBe('Updated');
      expect(result.value).toBe(200);
      expect(result.newField).toBe('added');

      // Verify persistence
      const retrieved = await collection.findById('update-test');
      expect(retrieved.name).toBe('Updated');
      expect(retrieved.newField).toBe('added');
    });

    test('should create document if it does not exist (upsert)', async () => {
      const newDoc = { name: 'Upserted', value: 300 };
      const result = await collection.update('new-id', newDoc);

      expect(result.name).toBe('Upserted');
      expect(result.value).toBe(300);

      // Verify it exists
      const retrieved = await collection.findById('new-id');
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('Upserted');
    });
  });

  describe('Document Deletion', () => {
    beforeEach(async () => {
      await collection.insert('delete-test', { name: 'ToDelete', value: 123 });
    });

    test('should delete existing document', async () => {
      const result = await collection.delete('delete-test');
      expect(result).toBe(true);

      const retrieved = await collection.findById('delete-test');
      expect(retrieved).toBeNull();
    });

    test('should return false for non-existent document', async () => {
      const result = await collection.delete('non-existent');
      expect(result).toBe(false);
    });

    test('should handle deletion of last document in collection', async () => {
      // Create a fresh collection with only one documen
      const singleDocCollection = db.collection('singleDoc');
      await singleDocCollection.insert('only-one', { data: 'test' });

      const result = await singleDocCollection.delete('only-one');
      expect(result).toBe(true);

      const count = await singleDocCollection.count();
      expect(count).toBe(0);
    });
  });

  describe('Document Counting', () => {
    beforeEach(async () => {
      const testData = TestUtils.generateTestData(15);
      for (let i = 0; i < testData.length; i++) {
        await collection.insert(testData[i].id, testData[i]);
      }
    });

    test('should count all documents', async () => {
      const count = await collection.count();
      expect(count).toBe(15);
    });

    test('should count documents with filter function', async () => {
      const activeCount = await collection.count((doc) => doc.active === true);
      expect(activeCount).toBeGreaterThan(0);
      expect(activeCount).toBeLessThan(15);
    });

    test('should count documents with options object', async () => {
      const youngCount = await collection.count({
        filter: (doc) => doc.age < 30
      });
      expect(youngCount).toBeGreaterThan(0);
    });

    test('should return 0 for empty collection', async () => {
      const emptyCollection = db.collection('empty');
      const count = await emptyCollection.count();
      expect(count).toBe(0);
    });
  });

  describe('Document Streaming', () => {
    beforeEach(async () => {
      const testData = TestUtils.generateTestData(5);
      for (let i = 0; i < testData.length; i++) {
        await collection.insert(testData[i].id, testData[i]);
      }
    });

    test('should stream all documents', async () => {
      const streamedDocs = [];
      for await (const doc of collection.stream()) {
        streamedDocs.push(doc);
      }

      expect(streamedDocs).toHaveLength(5);
      expect(streamedDocs[0].name).toBe('User 1');
    });

    test('should handle empty collection stream', async () => {
      const emptyCollection = db.collection('empty');
      const streamedDocs = [];

      for await (const doc of emptyCollection.stream()) {
        streamedDocs.push(doc);
      }

      expect(streamedDocs).toHaveLength(0);
    });
  });

  describe('Aggregation Operations', () => {
    beforeEach(async () => {
      const testData = TestUtils.generateTestData(10);
      for (let i = 0; i < testData.length; i++) {
        await collection.insert(testData[i].id, testData[i]);
      }
    });

    test('should perform match aggregation', async () => {
      const result = await collection.aggregate([
        { type: 'match', filter: (doc) => doc.active === true }
      ]);

      expect(Array.isArray(result)).toBe(true);
      result.forEach(doc => {
        expect(doc.active).toBe(true);
      });
    });

    test('should perform sort aggregation', async () => {
      const result = await collection.aggregate([
        { type: 'sort', field: 'age', direction: 'asc' }
      ]);

      expect(Array.isArray(result)).toBe(true);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].age).toBeGreaterThanOrEqual(result[i - 1].age);
      }
    });

    test('should perform limit aggregation', async () => {
      const result = await collection.aggregate([
        { type: 'limit', count: 3 }
      ]);

      expect(result).toHaveLength(3);
    });

    test('should perform skip aggregation', async () => {
      const allDocs = await collection.find();
      const result = await collection.aggregate([
        { type: 'skip', count: 2 }
      ]);

      expect(result).toHaveLength(allDocs.length - 2);
    });

    test('should perform group aggregation', async () => {
      const result = await collection.aggregate([
        { type: 'group', field: 'active' }
      ]);

      expect(typeof result).toBe('object');
      expect(result.true).toBeDefined();
      expect(result.false).toBeDefined();
      expect(Array.isArray(result.true)).toBe(true);
      expect(Array.isArray(result.false)).toBe(true);
    });

    test('should chain multiple aggregation operations', async () => {
      const result = await collection.aggregate([
        { type: 'match', filter: (doc) => doc.age >= 25 },
        { type: 'sort', field: 'name', direction: 'asc' },
        { type: 'limit', count: 3 }
      ]);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(3);
      result.forEach(doc => {
        expect(doc.age).toBeGreaterThanOrEqual(25);
      });
    });
  });
});