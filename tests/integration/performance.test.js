const JSLiteDB = require('../../src/index.js');
const TestUtils = require('../test-utils');

describe('Performance Tests', () => {
  let db;
  let tempDir;

  beforeEach(async () => {
    tempDir = await TestUtils.createTempDir();
    db = new JSLiteDB({
      folderPath: tempDir,
      autoSaveInterval: 0,
      enableLogging: false,
      enableIndexing: true
    });
    await TestUtils.withTimeout(db.init());
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
    await TestUtils.cleanupTempDir(tempDir);
  });

  describe('Bulk Operations Performance', () => {
    test('should handle bulk inserts efficiently', async () => {
      const collection = db.collection('performance-test');
      const testData = TestUtils.generateTestData(1000);

      const startTime = Date.now();

      // Insert all documents
      const insertPromises = testData.map((doc, index) =>
        collection.insert(`bulk-${index}`, doc)
      );

      await Promise.all(insertPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Verify all documents were inserted
      const count = await collection.count();
      expect(count).toBe(1000);
    }, 10000); // 10 second timeou

    test('should handle bulk reads efficiently', async () => {
      const collection = db.collection('read-performance');
      const testData = TestUtils.generateTestData(500);

      // Insert test data
      for (let i = 0; i < testData.length; i++) {
        await collection.insert(i, testData[i]);
      }

      const startTime = Date.now();

      // Read all documents
      const readPromises = [];
      for (let i = 0; i < testData.length; i++) {
        readPromises.push(collection.findById(i));
      }

      const results = await Promise.all(readPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // 2 seconds
      expect(results.length).toBe(500);
      expect(results.every(result => result !== null)).toBe(true);
    }, 8000);

    test('should handle bulk updates efficiently', async () => {
      const collection = db.collection('update-performance');
      const testData = TestUtils.generateTestData(300);

      // Insert test data
      for (let i = 0; i < testData.length; i++) {
        await collection.insert(i, testData[i]);
      }

      const startTime = Date.now();

      // Update all documents
      const updatePromises = [];
      for (let i = 0; i < testData.length; i++) {
        updatePromises.push(
          collection.update(i, { ...testData[i], updated: true, timestamp: Date.now() })
        );
      }

      await Promise.all(updatePromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000); // 3 seconds

      // Verify updates
      const updatedDoc = await collection.findById(0);
      expect(updatedDoc.updated).toBe(true);
    }, 8000);

    test('should handle bulk deletes efficiently', async () => {
      const collection = db.collection('delete-performance');
      const testData = TestUtils.generateTestData(200);

      // Insert test data
      for (let i = 0; i < testData.length; i++) {
        await collection.insert(i, testData[i]);
      }

      const startTime = Date.now();

      // Delete all documents
      const deletePromises = [];
      for (let i = 0; i < testData.length; i++) {
        deletePromises.push(collection.delete(i));
      }

      await Promise.all(deletePromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // 2 seconds

      // Verify all deleted
      const count = await collection.count();
      expect(count).toBe(0);
    }, 8000);
  });

  describe('Query Performance', () => {
    let collection;
    const LARGE_DATASET_SIZE = 2000;

    beforeEach(async () => {
      collection = db.collection('query-performance');
      const testData = TestUtils.generateTestData(LARGE_DATASET_SIZE);

      // Insert large datase
      const insertPromises = testData.map((doc, index) =>
        collection.insert(index, doc)
      );
      await Promise.all(insertPromises);
    });

    test('should perform filtered queries efficiently', async () => {
      const startTime = Date.now();

      const results = await collection.find({
        filter: (doc) => doc.age > 25 && doc.active === true
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // 1 second
      expect(results.length).toBeGreaterThan(0);
    });

    test('should perform paginated queries efficiently', async () => {
      const startTime = Date.now();

      const page1 = await collection.find({ limit: 50, skip: 0 });
      const page2 = await collection.find({ limit: 50, skip: 50 });
      const page3 = await collection.find({ limit: 50, skip: 100 });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // 0.5 seconds
      expect(page1.length).toBe(50);
      expect(page2.length).toBe(50);
      expect(page3.length).toBe(50);
    });

    test('should perform count operations efficiently', async () => {
      const startTime = Date.now();

      const totalCount = await collection.count();
      const filteredCount = await collection.count((doc) => doc.age > 30);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // 0.5 seconds
      expect(totalCount).toBe(LARGE_DATASET_SIZE);
      expect(filteredCount).toBeLessThan(totalCount);
    });

    test('should stream large datasets efficiently', async () => {
      const startTime = Date.now();
      let streamedCount = 0;

      for await (const doc of collection.stream()) {
        streamedCount++;
        // Process document (simulating work)
        if (doc.age > 25) {
          // Some processing
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // 2 seconds
      expect(streamedCount).toBe(LARGE_DATASET_SIZE);
    });
  });

  describe('Memory Usage', () => {
    test('should maintain reasonable memory usage with large datasets', async () => {
      const collection = db.collection('memory-test');
      const initialMemory = process.memoryUsage().heapUsed;

      // Insert moderately large datase
      const testData = TestUtils.generateTestData(1000);
      for (let i = 0; i < testData.length; i++) {
        await collection.insert(i, testData[i]);
      }

      const afterInsertMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterInsertMemory - initialMemory;

      // Memory increase should be reasonable (adjust threshold as needed)
      // This is a rough check - exact values depend on system and Node.js version
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Verify data is still accessible after potential GC
      const doc = await collection.findById(0);
      expect(doc).toBeDefined();
      expect(doc.name).toBe('User 1');
    });

    test('should handle cache efficiently', async () => {
      const collection = db.collection('cache-test');

      // Insert data
      for (let i = 0; i < 100; i++) {
        await collection.insert(i, { name: `User ${i}`, data: `Data ${i}` });
      }

      // Access items to populate cache
      for (let i = 0; i < 100; i++) {
        await collection.findById(i);
      }

      const cacheSize = db.cache.size;
      expect(cacheSize).toBeGreaterThan(0);
      expect(cacheSize).toBeLessThanOrEqual(100);

      // Clear cache and verify data can still be accessed
      db.cache.clear();
      expect(db.cache.size).toBe(0);

      const doc = await collection.findById(50);
      expect(doc).toBeDefined();
      expect(doc.name).toBe('User 50');
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent reads efficiently', async () => {
      const collection = db.collection('concurrent-reads');

      // Insert test data
      for (let i = 0; i < 100; i++) {
        await collection.insert(i, { name: `User ${i}`, value: i * 10 });
      }

      const startTime = Date.now();

      // Perform concurrent reads
      const readPromises = [];
      for (let i = 0; i < 50; i++) {
        // Each "thread" reads multiple documents
        const promise = (async () => {
          const results = [];
          for (let j = 0; j < 10; j++) {
            const doc = await collection.findById((i + j) % 100);
            results.push(doc);
          }
          return results;
        })();
        readPromises.push(promise);
      }

      const results = await Promise.all(readPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // 2 seconds
      expect(results.length).toBe(50);
      expect(results[0].length).toBe(10);
    });

    test('should handle mixed concurrent operations', async () => {
      const collection = db.collection('concurrent-mixed');

      const startTime = Date.now();

      const operations = [];

      // Mix of different operations
      for (let i = 0; i < 20; i++) {
        // Inser
        operations.push(
          collection.insert(`concurrent-${i}`, { name: `User ${i}`, type: 'concurrent' })
        );

        // Read (of previously inserted data)
        if (i > 5) {
          operations.push(
            collection.findById(`concurrent-${i - 5}`)
          );
        }

        // Update (of previously inserted data)
        if (i > 10) {
          operations.push(
            collection.update(`concurrent-${i - 10}`, {
              name: `Updated User ${i - 10}`,
              type: 'updated'
            })
          );
        }
      }

      const results = await Promise.all(operations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000); // 3 seconds
      expect(results.length).toBeGreaterThan(0);

      // Verify final state
      const finalCount = await collection.count();
      expect(finalCount).toBe(20);
    });
  });

  describe('File I/O Performance', () => {
    test('should handle file operations efficiently', async () => {
      const collection = db.collection('file-io-test');

      const startTime = Date.now();

      // Perform operations that trigger file I/O
      for (let i = 0; i < 50; i++) {
        await collection.insert(i, {
          name: `File IO Test ${i}`,
          data: {
            description: `This is test data for document ${i}`,
            metadata: {
              created: new Date().toISOString(),
              index: i,
              tags: [`tag-${i % 5}`, `category-${i % 3}`]
            }
          }
        });

        // Force save operation
        await db.save();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // File I/O operations should complete in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Verify data persistence
      const count = await collection.count();
      expect(count).toBe(50);
    }, 10000);
  });
});