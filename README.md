# JSLiteDB 🚀

[![npm version](https://img.shields.io/npm/v/jslitedb.svg)](https://www.npmjs.com/package/jslitedb)
[![npm downloads](https://img.shields.io/npm/dt/jslitedb.svg)](https://www.npmjs.com/package/jslitedb)
[![license](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20Commercial-blue.svg)](LICENSE)

**Collection-based JSON database for NodeJS** <br />
Local database + REST API + Real-time Sync

✅ **ZERO configuration** <br />
✅ Out of the box **Firebase**/**MongoDB** Alternative! <br />
✅ Recommended for Small to Medium Scale Apps <br />
✅ Lightweight <br />
✅ Local-first <br />
✅ RESTful API built-in <br />
✅ Real-time sync <br />
✅ Works with React, Vue, Angular, Mobile Apps, etc

❌ **Firebase** is expensive, vendor lock-in, and has complex pricing <br />
❌ **MongoDB** is heavy, and requires separate server setup <br />
❌ **Redis** is in-memory only, and has no persistence by default <br />

## Features

### Core
- **Collection-based storage** — Organize data into collections like MongoDB
- **JSON-based files** — Simple, readable, git-friendly individual collection files
- **Query System** — Collection-based queries with `find()`, `where()`, filtering
- **Method Chaining** — Fluent API for more complex queries
- **Automatic indexing** — Built-in performance optimization

### RESTful API
- **Zero configuration** — Call `startServer()` and it's live!
- **Full CRUD** — `GET`, `POST`, `PUT`, `DELETE` endpoints
- **Query API** — Filter, sort, pagination via HTTP
- **Basic Authentication** — Optional API key protection

### Real-time Sync
- **WebSocket integration** — Powered by Socket.io
- **Live updates** — All clients sync instantly
- **Event-driven** — Listen to data changes in real-time

### Developer Friendly
- **TypeScript ready** — Full type definitions
- **Events** — Hook into all database operations
- **Backup & Restore** — Easy data management
- **Auto-save** — Configurable intervals
- **Collection-based architecture** — Clean, organized data structure

## Installation

```bash
npm install jslitedb express socket.io socket.io-client cors
```

## Quick Start (Local Database)

```ts
const JSLiteDB = require('jslitedb');
const db = new JSLiteDB();

// Initialize database
// (optional - done automatically on first operation)
await db.init();

// Basic operations
const users = db.collection('users');

users.insert('user:1', { name: 'John', age: 25 }); // With defined ID
users.insert({ name: 'John', age: 25 }); // With generated ID

console.log(users.findOne('user:1')); 
// Outputs { name: 'John', age: 25 }

// Query system
const topUsers = users.find()
  .sort('score', 'desc')
  .limit(2)
  .values();

// Clean shutdown
// (optional but recommended)
await db.close();
```

## Database Lifecycle

### Initialization

```ts
const db = new JSLiteDB({
  folderPath: './data',
  autoSaveInterval: 5000,
  enableIndexing: true
});

await db.init();
```

> **Note**: <br />
> Database initialization is automatic when you perform the first operation, but calling `init()` explicitly can be useful for:
> - Error handling during startup
> - Ensuring database is ready before server starts
> - Testing scenarios where you need predictable initialization timing

### Cleanup and Shutdown

```ts
await db.close();
```

The `close()` method will:
- Stop the REST API server (if running)
- Save any pending data to disk
- Clear internal caches
- Clean up resources and timers

**Best practices**:
- Always call `close()` before your application exits
- Use it in process signal handlers for graceful shutdowns
- Essential for testing to prevent resource leaks

```ts
// Example: Graceful shutdown on SIGINT
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await db.close();
  process.exit(0);
});
```

## REST API Server

### Start Server

```ts
const JSLiteDB = require('jslitedb');

const db = new JSLiteDB({
  enableServer: true, // Enable RESTful API
  serverPort: 3000, // Defaults the server port
  enableRealtime: true, // Enable WebSocket
  apiKey: '[YOUR-SECRET-KEY]' // Optional authentication
});

// Or start manually:
// await db.startServer(3000);

// 🚀 Server is now running on http://localhost:3000
```

### API Endpoints

#### Health Check
```bash
GET /api/health
```

#### Collection-based Operations

**Create Document**
```bash
POST /api/:collection
Content-Type: application/json

# For auto-generated ID
{ "name": "John", "age": 25 }

# For custom ID
{ "id": "user123", "name": "John", "age": 25 }
```

**Get Document by ID**
```bash
GET /api/:collection/:id
```

**Update Document**
```bash
PUT /api/:collection/:id
Content-Type: application/json

{ "name": "John", "age": 26 }
```

**Delete Document**
```bash
DELETE /api/:collection/:id
```

**Get All Documents (with pagination)**
```bash
GET /api/:collection
GET /api/:collection?limit=10
GET /api/:collection?skip=20&limit=10
```

**Get Document Count**
```bash
GET /api/:collection/count
```

#### Database Operations

**Get Database Statistics**
```bash
GET /api/stats
```

**Backup Database**
```bash
POST /api/backup
Content-Type: application/json

{ "path": "/path/to/backup.json" }
```

**Restore Database**
```bash
POST /api/restore
Content-Type: application/json

{ "path": "/path/to/backup.json" }
```

### API Examples

**Create a user:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{ "name": "John Doe", "email": "john@example.com", "age": 25 }'
```

**Get a user:**
```bash
curl http://localhost:3000/api/users/user123
```

**Update a user:**
```bash
curl -X PUT http://localhost:3000/api/users/user123 \
  -H "Content-Type: application/json" \
  -d '{ "name": "John Updated", "age": 26 }'
```

**Get all users with pagination:**
```bash
curl "http://localhost:3000/api/users?limit=10&skip=0"
```

**Get user count:**
```bash
curl http://localhost:3000/api/users/count
```

### API Authentication

```ts
// Server side
const db = new JSLiteDB({
  apiKey: '[YOUR-SECRET-KEY-123]'
});
```

**Client side** - Multiple authentication methods supported:

```ts
// Method 1: X-API-Key header
fetch('http://localhost:3000/api/users', {
  headers: {
    'X-API-Key': '[YOUR-SECRET-KEY-123]'
  }
});

// Method 2: Authorization Bearer token
fetch('http://localhost:3000/api/users', {
  headers: {
    'Authorization': 'Bearer [YOUR-SECRET-KEY-123]'
  }
});

// Method 3: Query parameter
fetch('http://localhost:3000/api/users?apiKey=[YOUR-SECRET-KEY-123]');
```

## Real-time Sync

### Server Setup

```ts
const db = new JSLiteDB({
  enableServer: true,
  enableRealtime: true,
  serverPort: 3000
});

// Listen to client events
db.on('client:connected', ({ socketId }) => {
  console.log('Client connected:', socketId);
});

db.on('client:disconnected', ({ socketId, reason }) => {
  console.log('Client disconnected:', socketId, reason);
});
```

### Frontend Integration

**HTML + Socket.io:**
```html
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io('http://localhost:3000');
  
  socket.on('collections:init', (data) => {
    console.log('Available collections:', data.collections);
  });
  
  socket.on('connect', () => {
    console.log('Connected to JSLiteDB server');
  });
</script>
```

**React Example:**
```tsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function App() {
  const [collections, setCollections] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    
    newSocket.on('collections:init', (data) => {
      setCollections(data.collections);
    });
    
    setSocket(newSocket);
    
    return () => newSocket.close();
  }, []);

  return (
    <div>
      <h1>Available Collections:</h1>
      <ul>
        {collections.map(name => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## API Reference Summary

### Collection Operations
- `POST /api/:collection` - Create document
- `GET /api/:collection` - Get all documents  
- `GET /api/:collection/:id` - Get document by ID
- `PUT /api/:collection/:id` - Update document
- `DELETE /api/:collection/:id` - Delete document
- `GET /api/:collection/count` - Get document count

### Database Operations  
- `GET /api/health` - Health check
- `GET /api/stats` - Database statistics
- `POST /api/backup` - Create backup
- `POST /api/restore` - Restore from backup

### Query Parameters
- `?limit=N` - Limit results
- `?skip=N` - Skip results (pagination)
- `?apiKey=KEY` - Authentication (alternative to headers)

### JavaScript SDK
```ts
const db = new JSLiteDB();
const users = db.collection('users');

// Basic operations
await users.insert({ name: 'John', age: 25 });
await users.findById('user123');
await users.update('user123', { age: 26 });
await users.delete('user123');

// Queries
const results = await users.find()
  .where('age', '>', 18)
  .sort('name', 'asc')
  .limit(10)
  .values();
```

## Real-time Sync

### Server Setup

```ts
const db = new JSLiteDB({
  enableServer: true,
  enableRealtime: true,
  serverPort: 3000
});

// Listen to client events
db.on('client:connected', ({ socketId }) => {
  console.log('Client connected:', socketId);
});

db.on('client:disconnected', ({ socketId }) => {
  console.log('Client disconnected:', socketId);
});
```

## License

JSLiteDB is dual-licensed.

### Open Source License (AGPL-3.0)
Free for open source projects and applications that comply with `AGPL-3.0` terms.

### Commercial License
For proprietary applications and commercial use without `AGPL-3.0` restrictions.

**Need a commercial license?**
- ✅ Use in proprietary SaaS products
- ✅ Keep your source code private
- ✅ Priority support included
- 📧 Contact: help@jslitedb.com

See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for details.

## Credits & Attribution

JSLiteDB is a fork of [sehawq.db](https://github.com/sehawq/sehawq.db) by [Omer (sehawq)](https://github.com/sehawq).
Special thanks to the original author for creating the foundation that made this project possible. 🙇‍♂️
