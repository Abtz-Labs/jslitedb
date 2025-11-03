const { IndexSystem, Logger, Validator, WriteMutex } = require('../../src/utilities');
const fs = require('fs').promises;
const path = require('path');
const TestUtils = require('../test-utils');

describe('Utility Classes', () => {
  describe('IndexSystem', () => {
    let indexSystem;

    beforeEach(() => {
      indexSystem = new IndexSystem('testField');
    });

    test('should create IndexSystem with field name', () => {
      expect(indexSystem).toBeInstanceOf(IndexSystem);
      expect(indexSystem.field).toBe('testField');
      expect(indexSystem.index).toBeInstanceOf(Map);
    });

    test('should add values to index', () => {
      indexSystem.add('key1', { testField: 'value1' });
      indexSystem.add('key2', { testField: 'value1' });
      indexSystem.add('key3', { testField: 'value2' });

      expect(indexSystem.hasValue('value1')).toBe(true);
      expect(indexSystem.hasValue('value2')).toBe(true);
      expect(indexSystem.hasValue('value3')).toBe(false);
    });

    test('should get keys by value', () => {
      indexSystem.add('key1', { testField: 'value1' });
      indexSystem.add('key2', { testField: 'value1' });
      indexSystem.add('key3', { testField: 'value2' });

      const keys1 = indexSystem.get('value1');
      const keys2 = indexSystem.get('value2');

      expect(keys1.has('key1')).toBe(true);
      expect(keys1.has('key2')).toBe(true);
      expect(keys1.size).toBe(2);
      expect(keys2.has('key3')).toBe(true);
      expect(keys2.size).toBe(1);
    });

    test('should remove values from index', () => {
      indexSystem.add('key1', { testField: 'value1' });
      indexSystem.add('key2', { testField: 'value1' });

      indexSystem.remove('key1', { testField: 'value1' });

      const keys = indexSystem.get('value1');
      expect(keys.has('key1')).toBe(false);
      expect(keys.has('key2')).toBe(true);
      expect(keys.size).toBe(1);
    });

    test('should clear index', () => {
      indexSystem.add('key1', 'value1');
      indexSystem.add('key2', 'value2');

      indexSystem.clear();

      expect(indexSystem.size()).toBe(0);
      expect(indexSystem.hasValue('value1')).toBe(false);
    });

    test('should get statistics', () => {
      indexSystem.add('key1', { testField: 'value1' });
      indexSystem.add('key2', { testField: 'value1' });
      indexSystem.add('key3', { testField: 'value2' });

      const stats = indexSystem.getStats();

      expect(stats.field).toBe('testField');
      expect(stats.uniqueValues).toBe(2);
      expect(stats.totalDocuments).toBe(3);
      expect(stats.distribution.value1).toBe(2);
      expect(stats.distribution.value2).toBe(1);
    });
  });

  describe('Logger', () => {
    let tempDir;
    let logFile;

    beforeEach(async () => {
      tempDir = await TestUtils.createTempDir();
      logFile = path.join(tempDir, 'test.log');
    });

    afterEach(async () => {
      await TestUtils.cleanupTempDir(tempDir);
    });

    test('should create logger with default options', () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
      expect(logger.level).toBe('info');
      expect(logger.enableConsole).toBe(true);
    });

    test('should create logger with custom options', () => {
      const logger = new Logger({
        level: 'debug',
        enableConsole: false,
        logFile: logFile
      });

      expect(logger.level).toBe('debug');
      expect(logger.enableConsole).toBe(false);
      expect(logger.logFile).toBe(logFile);
    });

    test('should log messages at different levels', () => {
      const logger = new Logger({ level: 'debug', enableConsole: false });

      // Should not throw
      expect(() => {
        logger.debug('Debug message');
        logger.info('Info message');
        logger.warn('Warning message');
        logger.error('Error message');
      }).not.toThrow();
    });

    test('should respect log level filtering', () => {
      const logger = new Logger({ level: 'warn', enableConsole: false });

      expect(logger.shouldLog('debug')).toBe(false);
      expect(logger.shouldLog('info')).toBe(false);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('error')).toBe(true);
    });

    test('should change log level', () => {
      const logger = new Logger({ level: 'info' });

      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');

      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });

    test('should create child logger with context', () => {
      const parentLogger = new Logger({ enableConsole: false });
      const childLogger = parentLogger.child({ module: 'test' });

      expect(childLogger).toBeInstanceOf(Logger);
      // Child should inherit parent settings
      expect(childLogger.enableConsole).toBe(false);
    });

    test('should handle metadata in log messages', () => {
      const logger = new Logger({ enableConsole: false });

      expect(() => {
        logger.info('Test message', { user: 'test', action: 'test' });
        logger.error('Error message', { error: 'test error', stack: 'test stack' });
      }).not.toThrow();
    });
  });

  describe('Validator', () => {
    test('should validate pagination parameters', () => {
      expect(Validator.validatePagination(10, 0).valid).toBe(true);
      expect(Validator.validatePagination(10, 5).valid).toBe(true);
      expect(Validator.validatePagination(undefined, undefined).valid).toBe(true);

      expect(Validator.validatePagination(-1, 0).valid).toBe(false);
      expect(Validator.validatePagination(10, -1).valid).toBe(false);
      expect(Validator.validatePagination('10', 0).valid).toBe(false);
    });

    test('should validate field names', () => {
      expect(Validator.validateFieldName('name').valid).toBe(true);
      expect(Validator.validateFieldName('user.name').valid).toBe(true);
      expect(Validator.validateFieldName('data.profile.age').valid).toBe(true);

      expect(Validator.validateFieldName('').valid).toBe(false);
      expect(Validator.validateFieldName(null).valid).toBe(false);
      expect(Validator.validateFieldName(123).valid).toBe(false);
    });

    test('should validate sort directions', () => {
      expect(Validator.validateSortDirection('asc').valid).toBe(true);
      expect(Validator.validateSortDirection('desc').valid).toBe(true);

      expect(Validator.validateSortDirection('ascending').valid).toBe(false);
      expect(Validator.validateSortDirection('DESC').valid).toBe(false);
      expect(Validator.validateSortDirection(123).valid).toBe(false);
    });

    test('should validate query operators', () => {
      const validOperators = ['=', '==', '!=', '>', '<', '>=', '<=', 'in', 'contains', 'startsWith', 'endsWith'];

      validOperators.forEach(op => {
        expect(Validator.validateQueryOperator(op).valid).toBe(true);
      });

      expect(Validator.validateQueryOperator('invalid').valid).toBe(false);
      expect(Validator.validateQueryOperator(123).valid).toBe(false);
    });

    test('should validate aggregation operations', () => {
      const validOperations = ['count', 'sum', 'avg', 'min', 'max'];

      validOperations.forEach(op => {
        expect(Validator.validateAggregationOperation(op).valid).toBe(true);
      });

      expect(Validator.validateAggregationOperation('invalid').valid).toBe(false);
    });

    test('should validate file paths', () => {
      expect(Validator.validateFilePath('/valid/path/file.json').valid).toBe(true);
      expect(Validator.validateFilePath('./relative/path.json').valid).toBe(true);

      expect(Validator.validateFilePath('').valid).toBe(false);
      expect(Validator.validateFilePath(null).valid).toBe(false);
      expect(Validator.validateFilePath(123).valid).toBe(false);
    });

    test('should sanitize strings', () => {
      expect(Validator.sanitizeString('normal string')).toBe('normal string');
      expect(Validator.sanitizeString('string\x00with\x01control\x02chars')).not.toContain('\x00');
      expect(Validator.sanitizeString('string\x00with\x01control\x02chars')).toBe('stringwithcontrolchars');
    });

    test('should validate batch parameters', () => {
      const params = {
        key: 'validKey',
        value: { data: 'test' },
        number: 123,
        field: 'name'
      };

      const rules = {
        key: { type: 'key' },
        value: { type: 'value' },
        number: { type: 'number' },
        field: { type: 'field' }
      };

      const result = Validator.validateBatch(params, rules);
      expect(result.valid).toBe(true);
    });

    test('should return errors for invalid batch parameters', () => {
      const params = {
        key: '', // invalid
        value: undefined, // invalid
        number: 'not-a-number', // invalid
        field: 123 // invalid
      };

      const rules = {
        key: { type: 'key' },
        value: { type: 'value' },
        number: { type: 'number' },
        field: { type: 'field' }
      };

      const result = Validator.validateBatch(params, rules);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('WriteMutex', () => {
    let mutex;

    beforeEach(() => {
      mutex = new WriteMutex();
    });

    test('should create WriteMutex', () => {
      expect(mutex).toBeInstanceOf(WriteMutex);
      expect(mutex.locked).toBe(false);
      expect(Array.isArray(mutex.queue)).toBe(true);
    });

    test('should acquire and release lock', async () => {
      expect(mutex.locked).toBe(false);

      const acquirePromise = mutex.acquire();
      expect(mutex.locked).toBe(true);

      await acquirePromise;

      mutex.release();
      expect(mutex.locked).toBe(false);
    });

    test('should queue operations when locked', async () => {
      let operation1Started = false;
      let operation1Completed = false;
      let operation2Started = false;
      let operation2Completed = false;

      // Start first operation
      const promise1 = mutex.acquire().then(() => {
        operation1Started = true;
        // Simulate some work
        return TestUtils.delay(50);
      }).then(() => {
        operation1Completed = true;
        mutex.release();
      });

      // Wait a bit to let first operation star
      await TestUtils.delay(10);

      // Try to start second operation while first is running
      const promise2 = mutex.acquire().then(() => {
        operation2Started = true;
        return TestUtils.delay(10);
      }).then(() => {
        operation2Completed = true;
        mutex.release();
      });

      // Wait a bit more
      await TestUtils.delay(10);

      // At this point, first should be started but not completed, second not started
      expect(operation1Started).toBe(true);
      expect(operation1Completed).toBe(false);
      expect(operation2Started).toBe(false);

      // Wait for both to complete
      await Promise.all([promise1, promise2]);

      expect(operation1Completed).toBe(true);
      expect(operation2Completed).toBe(true);
    });

    test('should provide status information', async () => {
      let status = mutex.getStatus();
      expect(status.locked).toBe(false);
      expect(status.queueLength).toBe(0);

      const acquirePromise = mutex.acquire();
      status = mutex.getStatus();
      expect(status.locked).toBe(true);

      await acquirePromise;
      mutex.release();

      status = mutex.getStatus();
      expect(status.locked).toBe(false);
    });

    test('should handle multiple queued operations', async () => {
      const operations = [];
      const promises = [];

      // Queue multiple operations
      for (let i = 0; i < 3; i++) {
        const promise = mutex.acquire().then(() => {
          operations.push(i);
          return TestUtils.delay(10);
        }).then(() => {
          mutex.release();
        });
        promises.push(promise);
      }

      await Promise.all(promises);

      // All operations should have completed
      expect(operations).toHaveLength(3);
      expect(operations).toEqual([0, 1, 2]);
    });
  });
});