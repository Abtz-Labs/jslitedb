const request = require('supertest');
const JSLiteDB = require('../../src/index.js');
const TestUtils = require('../test-utils');

describe('REST API Integration', () => {
  let db;
  let app;
  let tempDir;
  let server;

  beforeAll(async () => {
    tempDir = await TestUtils.createTempDir();
    db = new JSLiteDB({
      folderPath: tempDir,
      enableServer: true,
      serverPort: 0, // Use random available por
      enableLogging: false,
      autoSaveInterval: 0
    });

    await TestUtils.withTimeout(db.init());

    // Wait for server to star
    await TestUtils.delay(100);

    app = db.app;
    server = db.server;
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
    await TestUtils.cleanupTempDir(tempDir);
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('Collection Operations', () => {
    const testCollection = 'api-test-users';
    const testDocument = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      active: true
    };

    describe('POST /api/:collection', () => {
      test('should create document with auto-generated ID', async () => {
        const response = await request(app)
          .post(`/api/${testCollection}`)
          .send(testDocument)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBeDefined();
        expect(response.body.data.name).toBe(testDocument.name);
        expect(response.body.data.email).toBe(testDocument.email);
      });

      test('should create document with custom ID', async () => {
        const customDoc = { ...testDocument, name: 'Jane Doe' };

        const response = await request(app)
          .post(`/api/${testCollection}`)
          .send({ id: 'custom-123', ...customDoc })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe('custom-123');
        expect(response.body.data.name).toBe('Jane Doe');
      });

      test('should return error for duplicate ID', async () => {
        const duplicateDoc = { ...testDocument, name: 'Duplicate' };

        await request(app)
          .post(`/api/${testCollection}`)
          .send({ id: 'duplicate-test', ...duplicateDoc })
          .expect(201);

        await request(app)
          .post(`/api/${testCollection}`)
          .send({ id: 'duplicate-test', ...duplicateDoc })
          .expect(400);
      });

      test('should validate request body', async () => {
        await request(app)
          .post(`/api/${testCollection}`)
          .send()
          .expect(400);
      });
    });

    describe('GET /api/:collection/:id', () => {
      let createdDocId;

      beforeEach(async () => {
        const response = await request(app)
          .post(`/api/${testCollection}`)
          .send(testDocument);
        createdDocId = response.body.data.id;
      });

      test('should retrieve document by ID', async () => {
        const response = await request(app)
          .get(`/api/${testCollection}/${createdDocId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(createdDocId);
        expect(response.body.data.name).toBe(testDocument.name);
      });

      test('should return 404 for non-existent document', async () => {
        await request(app)
          .get(`/api/${testCollection}/non-existent`)
          .expect(404);
      });
    });

    describe('PUT /api/:collection/:id', () => {
      let createdDocId;

      beforeEach(async () => {
        const response = await request(app)
          .post(`/api/${testCollection}`)
          .send(testDocument);
        createdDocId = response.body.data.id;
      });

      test('should update existing document', async () => {
        const updatedData = {
          name: 'John Updated',
          email: 'john.updated@example.com',
          age: 31
        };

        const response = await request(app)
          .put(`/api/${testCollection}/${createdDocId}`)
          .send(updatedData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('John Updated');
        expect(response.body.data.age).toBe(31);
      });

      test('should create document if it does not exist (upsert)', async () => {
        const newDoc = {
          name: 'New User',
          email: 'new@example.com'
        };

        const response = await request(app)
          .put(`/api/${testCollection}/new-upsert-id`)
          .send(newDoc)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('New User');
      });
    });

    describe('DELETE /api/:collection/:id', () => {
      let createdDocId;

      beforeEach(async () => {
        const response = await request(app)
          .post(`/api/${testCollection}`)
          .send(testDocument);
        createdDocId = response.body.data.id;
      });

      test('should delete existing document', async () => {
        const response = await request(app)
          .delete(`/api/${testCollection}/${createdDocId}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify document is deleted
        await request(app)
          .get(`/api/${testCollection}/${createdDocId}`)
          .expect(404);
      });

      test('should return 404 for non-existent document', async () => {
        await request(app)
          .delete(`/api/${testCollection}/non-existent`)
          .expect(404);
      });
    });

    describe('GET /api/:collection', () => {
      beforeEach(async () => {
        // Create multiple test documents
        const testDocs = TestUtils.generateTestData(10);
        for (let i = 0; i < testDocs.length; i++) {
          await request(app)
            .post(`/api/${testCollection}`)
            .send({ id: testDocs[i].id, ...testDocs[i] });
        }
      });

      test('should retrieve all documents', async () => {
        const response = await request(app)
          .get(`/api/${testCollection}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      test('should support pagination with limit', async () => {
        const response = await request(app)
          .get(`/api/${testCollection}?limit=5`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBeLessThanOrEqual(5);
      });

      test('should support pagination with skip', async () => {
        const response = await request(app)
          .get(`/api/${testCollection}?skip=3`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      test('should support pagination with both limit and skip', async () => {
        const response = await request(app)
          .get(`/api/${testCollection}?limit=3&skip=2`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBeLessThanOrEqual(3);
      });
    });

    describe('GET /api/:collection/count', () => {
      beforeEach(async () => {
        // Create test documents
        const testDocs = TestUtils.generateTestData(7);
        for (let i = 0; i < testDocs.length; i++) {
          await request(app)
            .post(`/api/${testCollection}`)
            .send({ id: `count-test-${testDocs[i].id}`, ...testDocs[i] });
        }
      });

      test('should return document count', async () => {
        const response = await request(app)
          .get(`/api/${testCollection}/count`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(typeof response.body.data.count).toBe('number');
        expect(response.body.data.count).toBeGreaterThan(0);
      });
    });
  });

  describe('Database Operations', () => {
    describe('GET /stats', () => {
      test('should return database statistics', async () => {
        const response = await request(app)
          .get('/api/stats')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.collections).toBeDefined();
        expect(typeof response.body.data.totalDocuments).toBe('number');
      });
    });

    describe('POST /backup', () => {
      test('should create backup', async () => {
        const backupPath = `/tmp/test-backup-${Date.now()}.json`;

        const response = await request(app)
          .post('/api/backup')
          .send({ path: backupPath })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('Backup created');
      });

      test('should require backup path', async () => {
        await request(app)
          .post('/api/backup')
          .send({})
          .expect(400);
      });
    });

    describe('POST /restore', () => {
      test('should require restore path', async () => {
        await request(app)
          .post('/api/restore')
          .send({})
          .expect(400);
      });

      test('should handle non-existent backup file', async () => {
        await request(app)
          .post('/api/restore')
          .send({ path: '/non/existent/backup.json' })
          .expect(400);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid collection names', async () => {
      await request(app)
        .get('/api//')
        .expect(404);
    });

    test('should handle malformed JSON', async () => {
      await request(app)
        .post('/api/test')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    test('should return empty array for non-existent collection', async () => {
      const response = await request(app)
        .get('/api/non-existent-collection')
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('Authentication', () => {
    describe('with API key', () => {
      let authenticatedDb;
      let authenticatedApp;
      let authenticatedServer;

      beforeAll(async () => {
        const authTempDir = await TestUtils.createTempDir();
        authenticatedDb = new JSLiteDB({
          folderPath: authTempDir,
          enableServer: true,
          serverPort: 0,
          apiKey: 'test-api-key-123',
          enableLogging: false,
          autoSaveInterval: 0
        });

        await TestUtils.withTimeout(authenticatedDb.init());
        await TestUtils.delay(100);

        authenticatedApp = authenticatedDb.app;
        authenticatedServer = authenticatedDb.server;
      });

      afterAll(async () => {
        if (authenticatedDb) {
          await authenticatedDb.close();
        }
      });

      test('should reject requests without API key', async () => {
        await request(authenticatedApp)
          .get('/api/stats')
          .expect(401);
      });

      test('should reject requests with invalid API key', async () => {
        await request(authenticatedApp)
          .get('/api/stats')
          .set('Authorization', 'Bearer invalid-key')
          .expect(401);
      });

      test('should accept requests with valid API key', async () => {
        await request(authenticatedApp)
          .get('/api/stats')
          .set('Authorization', 'Bearer test-api-key-123')
          .expect(200);
      });

      test('should accept API key in query parameter', async () => {
        await request(authenticatedApp)
          .get('/api/stats?apiKey=test-api-key-123')
          .expect(200);
      });
    });
  });

  describe('CORS Support', () => {
    test('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/collections/test/documents')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    test('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});