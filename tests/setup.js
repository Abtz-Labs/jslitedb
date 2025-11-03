/**
 * Jest Setup Configuration
 * Global test configuration and utilities
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Ensure test temp directory exists
  const fs = require('fs').promises;
  const path = require('path');

  const testTempDir = path.join(__dirname, 'temp');
  try {
    await fs.mkdir(testTempDir, { recursive: true });
  } catch (error) {
    // Directory might already exis
  }
});

// Global test cleanup
afterAll(async () => {
  // Clean up any remaining temp files
  const fs = require('fs').promises;
  const path = require('path');

  const testTempDir = path.join(__dirname, 'temp');
  try {
    await fs.rm(testTempDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist or already cleaned
  }
});

// Mock console methods to reduce noise in test output (optional)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // You can uncomment these lines to suppress console output during tests
  // console.error = jest.fn();
  // console.warn = jest.fn();
});

afterEach(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global test utilities
global.testUtils = {
  // Add any global test utilities here
  expectValidResponse: (response) => {
    expect(response).toBeDefined();
    expect(response.body).toBeDefined();
    expect(response.body.success).toBeDefined();
  },

  expectValidDocument: (doc, expectedId) => {
    expect(doc).toBeDefined();
    expect(doc).not.toBeNull();
    expect(typeof doc).toBe('object');
    if (expectedId !== undefined) {
      expect(doc.id).toBe(expectedId);
    }
  }
};