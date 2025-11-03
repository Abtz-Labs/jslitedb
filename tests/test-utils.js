const fs = require('fs').promises;
const path = require('path');

/**
 * Test utilities for JSLiteDB tests
 */
class TestUtils {
  static async createTempDir() {
    const tempDir = path.join(__dirname, '..', 'temp', `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  static async cleanupTempDir(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  static async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async waitForFile(filePath, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        await fs.access(filePath);
        return true;
      } catch (error) {
        await this.delay(10);
      }
    }
    return false;
  }

  static generateTestData(count = 10) {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        age: 20 + (i % 50),
        active: i % 2 === 0,
        tags: [`tag${i % 3}`, `category${i % 4}`],
        profile: {
          bio: `This is user ${i + 1}`,
          location: `City ${i % 5}`,
          preferences: {
            theme: i % 2 === 0 ? 'dark' : 'light',
            notifications: i % 3 === 0
          }
        },
        createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString()
      });
    }
    return data;
  }

  static async withTimeout(promise, timeoutMs = 5000) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    );
    return Promise.race([promise, timeout]);
  }

  static expectValidDocument(doc, expectedId) {
    expect(doc).toBeDefined();
    expect(doc).not.toBeNull();
    expect(typeof doc).toBe('object');
    if (expectedId !== undefined) {
      expect(doc.id).toBe(expectedId);
    }
  }

  static expectValidCollection(collection) {
    expect(collection).toBeDefined();
    expect(typeof collection.insert).toBe('function');
    expect(typeof collection.find).toBe('function');
    expect(typeof collection.findById).toBe('function');
    expect(typeof collection.update).toBe('function');
    expect(typeof collection.delete).toBe('function');
    expect(typeof collection.count).toBe('function');
  }
}

module.exports = TestUtils;