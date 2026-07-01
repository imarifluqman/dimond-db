# API Reference

Complete API reference for Dimond-DB (LocalDB) Version 2.

## Table of Contents

- [Database](#database)
- [Collection](#collection)
- [Cursor](#cursor)
- [Session](#session)
- [Configuration](#configuration)
- [Error Types](#error-types)

---

## Database

### Constructor

```javascript
new LocalDB(config)
```

Creates a new database instance.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `config.database` | string | Yes | - | Database name |
| `config.path` | string | No | `'./database'` | Storage directory path |
| `config.cache` | boolean | No | `false` | Enable caching |
| `config.cacheSize` | string | No | `'256MB'` | Cache size (e.g., '10MB', '1GB') |
| `config.journal` | boolean | No | `false` | Enable Write-Ahead Logging |
| `config.autoIndex` | boolean | No | `false` | Auto-create indexes for unique fields |
| `config.strictSchema` | boolean | No | `false` | Enforce schema validation |
| `config.performanceTracking` | boolean | No | `false` | Track performance metrics |

**Example:**

```javascript
import { LocalDB } from 'dimond-db';

const db = new LocalDB({
  database: 'myapp',
  path: './data',
  cache: true,
  cacheSize: '512MB',
  journal: true,
  performanceTracking: true
});
```

### Methods

#### `collection(name)`

Get or create a collection.

**Parameters:**
- `name` (string) - Collection name

**Returns:** `Collection` instance

**Example:**

```javascript
const users = db.collection('users');
```

---

#### `createCollection(name, options)`

Create a collection with schema (V2).

**Parameters:**
- `name` (string) - Collection name
- `options` (object) - Options
  - `schema` (object) - Schema definition

**Returns:** `Collection` instance

**Example:**

```javascript
const posts = db.createCollection('posts', {
  schema: {
    title: { type: String, required: true, minLength: 3 },
    content: { type: String, required: true },
    views: { type: Number, min: 0, default: 0 }
  }
});
```

---

#### `listCollections()`

List all collections in the database.

**Returns:** `Promise<Array<string>>` - Array of collection names

**Example:**

```javascript
const collections = await db.listCollections();
console.log(collections); // ['users', 'posts', 'products']
```

---

#### `dropDatabase()`

Drop the entire database (deletes all collections and data).

**Returns:** `Promise<void>`

**Example:**

```javascript
await db.dropDatabase();
```

---

#### `stats()`

Get database statistics.

**Returns:** `Promise<Object>` with:
- `database` (string) - Database name
- `collections` (number) - Number of collections
- `totalDocuments` (number) - Total documents across all collections
- `size` (string) - Database size

**Example:**

```javascript
const stats = await db.stats();
console.log(stats);
// {
//   database: 'myapp',
//   collections: 3,
//   totalDocuments: 1500,
//   size: '2.5MB'
// }
```

---

#### `startSession()` (V2)

Start a new transaction session.

**Returns:** `Session` instance

**Example:**

```javascript
const session = db.startSession();
```

---

#### `backup(path)` (V2)

Create a full database backup.

**Parameters:**
- `path` (string) - Backup destination directory

**Returns:** `Promise<Object>` with:
- `acknowledged` (boolean)
- `backupPath` (string)
- `stats` (object)

**Example:**

```javascript
const result = await db.backup('./backups');
console.log(`Backup created at: ${result.backupPath}`);
```

---

#### `restore(backupPath)` (V2)

Restore database from backup.

**Parameters:**
- `backupPath` (string) - Path to backup directory

**Returns:** `Promise<Object>` with:
- `acknowledged` (boolean)
- `stats` (object)

**Example:**

```javascript
await db.restore('./backups/myapp_2024-01-15_120000');
```

---

#### `performance()` (V2)

Get performance metrics.

**Returns:** `Object` with:
- `operations` - Operation counts
- `timing` - Average timing metrics
- `cache` - Cache statistics
- `indexes` - Index usage statistics
- `storage` - Storage information

**Example:**

```javascript
const report = db.performance();
console.log(`
  Reads: ${report.operations.reads}
  Writes: ${report.operations.writes}
  Cache Hit Rate: ${report.cache.hitRate}%
  Average Query: ${report.timing.averageQuery}ms
`);
```

---

#### `cacheStats()` (V2)

Get cache statistics.

**Returns:** `Object` with:
- `hits` (number)
- `misses` (number)
- `size` (number)
- `hitRate` (number)

**Example:**

```javascript
const stats = db.cacheStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);
```

---

#### `close()`

Close database connection.

**Returns:** `Promise<void>`

**Example:**

```javascript
await db.close();
```

---

## Collection

### Insert Operations

#### `insertOne(document, session?)`

Insert a single document.

**Parameters:**
- `document` (object) - Document to insert
- `session` (Session, optional) - Transaction session (V2)

**Returns:** `Promise<Object>` with:
- `acknowledged` (boolean)
- `insertedId` (string)

**Example:**

```javascript
const result = await users.insertOne({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

console.log(result.insertedId); // UUID
```

---

#### `insertMany(documents, session?)`

Insert multiple documents.

**Parameters:**
- `documents` (array) - Array of documents
- `session` (Session, optional) - Transaction session (V2)

**Returns:** `Promise<Object>` with:
- `acknowledged` (boolean)
- `insertedCount` (number)
- `insertedIds` (array)

**Example:**

```javascript
const result = await users.insertMany([
  { name: 'Alice', age: 25 },
  { name: 'Bob', age: 30 },
  { name: 'Charlie', age: 35 }
]);

console.log(`Inserted ${result.insertedCount} documents`);
```

---

### Find Operations

#### `find(filter?)`

Find documents matching filter.

**Parameters:**
- `filter` (object, optional) - Query filter (default: `{}`)

**Returns:** `Promise<Array<Object>>` - Array of documents

**Example:**

```javascript
// Find all
const all = await users.find();

// Find with filter
const adults = await users.find({ age: { $gte: 18 } });

// Complex query
const results = await users.find({
  $and: [
    { age: { $gte: 18 } },
    { status: 'active' }
  ]
});
```

---

#### `findOne(filter?)`

Find the first document matching filter.

**Parameters:**
- `filter` (object, optional) - Query filter

**Returns:** `Promise<Object|null>` - Document or null

**Example:**

```javascript
const user = await users.findOne({ email: 'john@example.com' });

if (user) {
  console.log(user.name);
} else {
  console.log('User not found');
}
```

---

#### `findCursor(filter?)` (V2)

Create a cursor for lazy query evaluation.

**Parameters:**
- `filter` (object, optional) - Query filter

**Returns:** `Cursor` instance

**Example:**

```javascript
const cursor = users.findCursor({ age: { $gte: 18 } })
  .sort({ age: -1 })
  .limit(10)
  .project({ name: 1, email: 1 });

const results = await cursor.toArray();
```

See [Cursor API](#cursor) for more details.

---

### Update Operations

#### `updateOne(filter, update, session?)`

Update the first matching document.

**Parameters:**
- `filter` (object) - Query filter
- `update` (object) - Update operations
- `session` (Session, optional) - Transaction session (V2)

**Returns:** `Promise<Object>` with:
- `acknowledged` (boolean)
- `matchedCount` (number)
- `modifiedCount` (number)

**Example:**

```javascript
await users.updateOne(
  { email: 'john@example.com' },
  { 
    $set: { age: 31, city: 'NYC' },
    $inc: { loginCount: 1 }
  }
);
```

---

#### `updateMany(filter, update, session?)`

Update all matching documents.

**Parameters:**
- `filter` (object) - Query filter
- `update` (object) - Update operations
- `session` (Session, optional) - Transaction session (V2)

**Returns:** `Promise<Object>` with:
- `acknowledged` (boolean)
- `matchedCount` (number)
- `modifiedCount` (number)

**Example:**

```javascript
await users.updateMany(
  { status: 'inactive' },
  { $set: { status: 'archived' } }
);
```

---

### Delete Operations

#### `deleteOne(filter, session?)`

Delete the first matching document.

**Parameters:**
- `filter` (object) - Query filter
- `session` (Session, optional) - Transaction session (V2)

**Returns:** `Promise<Object>` with:
- `acknowledged` (boolean)
- `deletedCount` (number)

**Example:**

```javascript
await users.deleteOne({ email: 'john@example.com' });
```

---

#### `deleteMany(filter, session?)`

Delete all matching documents.

**Parameters:**
- `filter` (object) - Query filter
- `session` (Session, optional) - Transaction session (V2)

**Returns:** `Promise<Object>` with:
- `acknowledged` (boolean)
- `deletedCount` (number)

**Example:**

```javascript
await users.deleteMany({ status: 'deleted' });
```

---

### Count Operations

#### `countDocuments(filter?)`

Count documents matching filter.

**Parameters:**
- `filter` (object, optional) - Query filter

**Returns:** `Promise<number>` - Document count

**Example:**

```javascript
const total = await users.countDocuments();
const adults = await users.countDocuments({ age: { $gte: 18 } });
```

---

### Index Operations (V2)

#### `createIndex(keys, options?)`

Create an index.

**Parameters:**
- `keys` (object) - Index fields (1 for ascending, -1 for descending)
- `options` (object, optional)
  - `unique` (boolean) - Enforce uniqueness
  - `sparse` (boolean) - Sparse index (skip null values)
  - `name` (string) - Custom index name

**Returns:** `Promise<string>` - Index name

**Example:**

```javascript
// Single field index
await users.createIndex({ email: 1 }, { unique: true });

// Compound index
await users.createIndex({ city: 1, age: -1 });

// Custom name
await users.createIndex({ username: 1 }, { 
  unique: true, 
  name: 'username_unique_idx' 
});
```

---

#### `listIndexes()`

List all indexes on the collection.

**Returns:** `Promise<Array<Object>>` - Array of index objects

**Example:**

```javascript
const indexes = await users.listIndexes();
console.log(indexes);
// [
//   { name: 'email_1', keys: { email: 1 }, unique: true },
//   { name: 'age_1', keys: { age: 1 }, unique: false }
// ]
```

---

#### `dropIndex(indexName)`

Drop an index.

**Parameters:**
- `indexName` (string) - Index name

**Returns:** `Promise<void>`

**Example:**

```javascript
await users.dropIndex('email_1');
```

---

### Schema Operations (V2)

#### `setSchema(schema)`

Set schema for the collection.

**Parameters:**
- `schema` (object) - Schema definition

**Example:**

```javascript
users.setSchema({
  name: { type: String, required: true, minLength: 2 },
  email: { type: String, required: true, unique: true },
  age: { type: Number, min: 0, max: 150 },
  status: { type: String, enum: ['active', 'inactive'] }
});
```

---

### Hook Operations (V2)

#### `pre(event, handler)`

Register a pre-hook.

**Parameters:**
- `event` (string) - Event name ('insert', 'update', 'delete', 'find')
- `handler` (function) - Hook handler

**Example:**

```javascript
users.pre('insert', (context) => {
  context.document.createdAt = new Date().toISOString();
  return context;
});
```

---

#### `post(event, handler)`

Register a post-hook.

**Parameters:**
- `event` (string) - Event name
- `handler` (function) - Hook handler

**Example:**

```javascript
users.post('update', (context) => {
  console.log(`Updated ${context.modifiedCount} documents`);
});
```

---

### Other Operations

#### `drop()`

Drop the collection.

**Returns:** `Promise<void>`

**Example:**

```javascript
await users.drop();
```

---

#### `stats()` (V2)

Get collection statistics.

**Returns:** `Promise<Object>` with:
- `documents` (number)
- `indexes` (number)
- `size` (string)
- `averageDocumentSize` (string)

**Example:**

```javascript
const stats = await users.stats();
console.log(stats);
```

---

## Cursor

Cursor API for lazy query evaluation (V2).

### Methods

#### `sort(spec)`

Sort results.

**Parameters:**
- `spec` (object) - Sort specification (1 for ascending, -1 for descending)

**Returns:** `Cursor` (for chaining)

**Example:**

```javascript
cursor.sort({ age: -1, name: 1 });
```

---

#### `limit(count)`

Limit number of results.

**Parameters:**
- `count` (number) - Maximum documents

**Returns:** `Cursor` (for chaining)

**Example:**

```javascript
cursor.limit(10);
```

---

#### `skip(count)`

Skip documents.

**Parameters:**
- `count` (number) - Number to skip

**Returns:** `Cursor` (for chaining)

**Example:**

```javascript
cursor.skip(20);
```

---

#### `project(spec)`

Project fields.

**Parameters:**
- `spec` (object) - Projection (1 to include, 0 to exclude)

**Returns:** `Cursor` (for chaining)

**Example:**

```javascript
cursor.project({ name: 1, email: 1, _id: 0 });
```

---

#### `toArray()`

Get all results as array.

**Returns:** `Promise<Array<Object>>`

**Example:**

```javascript
const results = await cursor.toArray();
```

---

#### `next()`

Get next document.

**Returns:** `Promise<Object|null>`

**Example:**

```javascript
const doc = await cursor.next();
```

---

#### `hasNext()`

Check if more documents available.

**Returns:** `Promise<boolean>`

**Example:**

```javascript
while (await cursor.hasNext()) {
  const doc = await cursor.next();
  console.log(doc);
}
```

---

#### `forEach(callback)`

Iterate over documents.

**Parameters:**
- `callback` (function) - Callback function

**Returns:** `Promise<void>`

**Example:**

```javascript
await cursor.forEach(doc => {
  console.log(doc.name);
});
```

---

#### `map(mapper)`

Map documents.

**Parameters:**
- `mapper` (function) - Mapper function

**Returns:** `Promise<Array>`

**Example:**

```javascript
const names = await cursor.map(doc => doc.name);
```

---

#### `filter(predicate)`

Filter documents.

**Parameters:**
- `predicate` (function) - Filter predicate

**Returns:** `Promise<Array>`

**Example:**

```javascript
const filtered = await cursor.filter(doc => doc.age > 30);
```

---

## Session

Transaction session (V2).

### Methods

#### `startTransaction()`

Start a transaction.

**Returns:** `Promise<void>`

**Example:**

```javascript
const session = db.startSession();
await session.startTransaction();
```

---

#### `commit()`

Commit the transaction.

**Returns:** `Promise<void>`

**Example:**

```javascript
await session.commit();
```

---

#### `abort()`

Abort (rollback) the transaction.

**Returns:** `Promise<void>`

**Example:**

```javascript
await session.abort();
```

---

## Configuration

### DatabaseConfig

Configuration object for LocalDB.

```javascript
{
  database: string,              // Required: Database name
  path: string,                  // Optional: Storage path (default: './database')
  cache: boolean,                // Optional: Enable caching (default: false)
  cacheSize: string,             // Optional: Cache size (default: '256MB')
  journal: boolean,              // Optional: Enable WAL (default: false)
  autoIndex: boolean,            // Optional: Auto-create indexes (default: false)
  strictSchema: boolean,         // Optional: Enforce schema (default: false)
  performanceTracking: boolean   // Optional: Track metrics (default: false)
}
```

---

## Error Types

### V1 Errors

- `DatabaseError` - Base error class
- `CollectionNotFoundError` - Collection doesn't exist
- `DuplicateKeyError` - Duplicate _id or unique constraint violation
- `ValidationError` - Document validation failed
- `QueryError` - Invalid query syntax
- `StorageError` - File system error
- `DatabaseOperationError` - General operation error

### V2 Errors

- `IndexError` - Index operation error
- `IndexExistsError` - Index already exists
- `IndexNotFoundError` - Index not found
- `TransactionError` - Transaction error
- `TransactionAbortError` - Transaction aborted
- `SchemaValidationError` - Schema validation failed
- `HookExecutionError` - Hook execution failed
- `CacheError` - Cache operation error
- `WALError` - Write-Ahead Log error
- `BackupError` - Backup/restore error
- `CursorError` - Cursor operation error

**Example:**

```javascript
import { 
  DuplicateKeyError, 
  SchemaValidationError,
  TransactionError 
} from 'dimond-db';

try {
  await users.insertOne({ email: 'duplicate@example.com' });
} catch (error) {
  if (error instanceof DuplicateKeyError) {
    console.log('Duplicate key');
  } else if (error instanceof SchemaValidationError) {
    console.log('Invalid data:', error.message);
  }
}
```
