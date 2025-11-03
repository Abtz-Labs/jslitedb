# JSLiteDB Test Suite

This directory contains comprehensive tests for JSLiteDB, ensuring stability and reliability across all features.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── jslitedb-core.test.js   # Core database functionality
│   ├── collection.test.js      # Collection class tests
│   ├── queryresult.test.js     # QueryResult class tests
│   └── utilities.test.js       # Utility classes tests
├── integration/             # Integration tests
│   ├── rest-api.test.js        # REST API endpoint tests
│   └── performance.test.js     # Performance and load tests
├── fixtures/                # Test data and fixtures
├── setup.js                 # Jest setup configuration
├── test-utils.js           # Common test utilities
├── run.js                  # Test runner scrip
└── README.md               # This file
```

## Running Tests

### Quick Star
```bash
# Run all tests
npm tes

# Run with coverage repor
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch
```

### Specific Test Suites
```bash
# Unit tests only
npm run test:uni

# Integration tests only
npm run test:integration

# Performance tests only
npm run test:performance

# REST API tests only
npm run test:api
```

### Individual Test Files
```bash
# Core functionality tests
npm run test:core

# Collection class tests
npm run test:collection

# QueryResult class tests
npm run test:queryresul

# Utility classes tests
npm run test:utilities
```

### CI/CD
```bash
# Run tests in CI mode (no watch, with coverage)
npm run test:ci
```

## Test Categories

### Unit Tests

**JSLiteDB Core (`jslitedb-core.test.js`)**
- Database initialization and configuration
- Collection creation and managemen
- Event handling and lifecycle
- Data persistence across instances
- Error handling and edge cases
- Memory management and caching

**Collection Class (`collection.test.js`)**
- Document insertion (auto-ID and custom ID)
- Document retrieval (by ID, with filters, pagination)
- Document updates and upserts
- Document deletion
- Counting and statistics
- Streaming operations
- Aggregation operations

**QueryResult Class (`queryresult.test.js`)**
- Constructor and initialization
- Sorting operations (ascending, descending, nested fields)
- Limiting and skipping results
- Counting and navigation (first, last)
- Data extraction (values, keys, arrays)
- Filtering and mapping operations
- Method chaining
- Edge cases and error handling

**Utility Classes (`utilities.test.js`)**
- IndexSystem: indexing, retrieval, statistics
- Logger: levels, formatting, file outpu
- Validator: input validation, sanitization
- WriteMutex: concurrency control, queuing

### Integration Tests

**REST API (`rest-api.test.js`)**
- Health check endpoints
- CRUD operations via HTTP
- Pagination and filtering
- Authentication and authorization
- Error handling and status codes
- CORS suppor
- Database operations (backup, restore, stats)

**Performance Tests (`performance.test.js`)**
- Bulk operations (insert, read, update, delete)
- Query performance with large datasets
- Memory usage monitoring
- Concurrent operations
- File I/O performance
- Caching efficiency

## Test Utilities

### TestUtils Class (`test-utils.js`)
- `createTempDir()` - Creates isolated test directories
- `cleanupTempDir(path)` - Cleans up test directories
- `generateTestData(count)` - Generates realistic test data
- `withTimeout(promise, ms)` - Adds timeout to promises
- `expectValidDocument(doc, id)` - Common document assertions
- `expectValidCollection(collection)` - Collection validation

### Test Data Generation
The test suite uses structured test data that includes:
- User profiles with nested objects
- Various data types (strings, numbers, booleans, arrays)
- Realistic relationships and patterns
- Edge cases and boundary conditions

## Test Configuration

### Jest Configuration (`package.json`)
- Node.js test environmen
- 30-second timeout for integration tests
- Coverage collection from `src/` directory
- HTML and LCOV coverage reports
- Parallel test execution (50% of CPU cores)

### Setup File (`setup.js`)
- Global test configuration
- Temporary directory managemen
- Console output control
- Unhandled rejection monitoring
- Global test utilities

## Writing New Tests

### Test File Structure
```javascrip
const JSLiteDB = require('../../src/index.js');
const TestUtils = require('../test-utils');

describe('Feature Name', () => {
  let db;
  let tempDir;

  beforeEach(async () => {
    tempDir = await TestUtils.createTempDir();
    db = new JSLiteDB({
      folderPath: tempDir,
      autoSaveInterval: 0,
      enableLogging: false
    });
    await TestUtils.withTimeout(db.init());
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
    await TestUtils.cleanupTempDir(tempDir);
  });

  describe('Specific Functionality', () => {
    test('should do something specific', async () => {
      // Test implementation
    });
  });
});
```

### Best Practices
1. **Isolation**: Each test should be independent and isolated
2. **Cleanup**: Always clean up resources (databases, files, connections)
3. **Assertions**: Use descriptive assertions and error messages
4. **Async/Await**: Properly handle asynchronous operations
5. **Timeouts**: Set appropriate timeouts for long-running operations
6. **Data**: Use realistic test data that represents actual usage
7. **Coverage**: Aim for high code coverage but focus on meaningful tests

### Performance Test Guidelines
- Use appropriate dataset sizes (not too small, not too large)
- Set reasonable performance thresholds
- Test both single operations and bulk operations
- Monitor memory usage for memory leaks
- Test concurrent operations for race conditions

## Continuous Integration

The test suite is designed to run in CI/CD environments:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm run test:ci

- name: Upload Coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/lcov.info
```

## Troubleshooting

### Common Issues

**Tests timing out**
- Increase timeout in Jest configuration
- Check for unresolved promises
- Ensure proper cleanup in afterEach hooks

**File system errors**
- Verify temp directory cleanup
- Check file permissions
- Ensure proper async/await usage

**Memory issues**
- Monitor test data size
- Check for memory leaks in cleanup
- Use appropriate dataset sizes for performance tests

**Flaky tests**
- Add proper delays for async operations
- Ensure test isolation
- Check for race conditions in concurrent tests

### Debug Mode
```bash
# Run tests with debug outpu
DEBUG=* npm tes

# Run specific test with verbose outpu
npm run test:core -- --verbose

# Run tests with Node.js inspector
node --inspect-brk node_modules/.bin/jest tests/unit/collection.test.js
```

## Coverage Reports

Coverage reports are generated in the `coverage/` directory:
- `coverage/html/index.html` - Interactive HTML repor
- `coverage/lcov.info` - LCOV format for CI tools
- Console output shows summary coverage metrics

Target coverage goals:
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%