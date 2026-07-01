# Dimond-DB (LocalDB) v2.0

A high-performance embedded database engine for Node.js with a MongoDB-like API. No external database server required.

## 🚀 What's New in Version 2

- **🔍 Advanced Indexing** - B-Tree and Hash indexes for faster queries
- **📊 Cursor API** - MongoDB-style lazy cursors with chaining
- **✅ Schema Validation** - Type checking and constraints
- **🔗 Hooks/Middleware** - Pre/post operation lifecycle events
- **💾 Transactions** - ACID transactions with rollback support
- **📝 Write-Ahead Logging (WAL)** - Crash recovery and durability
- **⚡ Smart Caching** - LRU cache with automatic invalidation
- **🎯 Query Optimizer** - Automatic index selection
- **📦 Backup & Restore** - Full database backup capabilities
- **📈 Performance Monitoring** - Built-in operation tracking

## 📦 Installation

```bash
npm install dimond-db
```

## 🎯 Quick Start

```javascript
import { LocalDB } from "dimond-db";

// Create database instance
const db = new LocalDB({
  database: "myDatabase",
  cache: true,              // Enable caching (V2)
  journal: true,            // Enable WAL (V2)
  performanceTracking: true // Track metrics (V2)
});

// Get a collection
const users = db.collection("users");

// Create indexes for faster queries (V2)
await users.createIndex({ email: 1 }, { unique: true });
await users.createIndex({ age: 1 });

// Insert a document
await users.insertOne({
  name: "Arif",
  age: 22,
  email: "arif@example.com",
});

// Use cursor API for advanced queries (V2)
const adults = await users.findCursor({ age: { $gte: 18 } })
  .sort({ age: -1 })
  .limit(10)
  .project({ name: 1, email: 1 })
  .toArray();

console.log(adults);
```

## 🌟 Key Features

### Version 1 Features
- ✅ Zero Configuration
- ✅ Offline First
- ✅ MongoDB-like API
- ✅ Automatic Persistence
- ✅ Query Operators (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$and`, `$or`)
- ✅ Update Operators (`$set`, `$unset`, `$inc`, `$push`)
- ✅ Type Safety
- ✅ Zero Dependencies
- ✅ ES Modules

### Version 2 Features
- ✅ **Indexing System** - Single field, compound, unique, sparse indexes
- ✅ **Cursor API** - Lazy evaluation with `sort()`, `limit()`, `skip()`, `project()`
- ✅ **Schema Validation** - Runtime type checking and constraints
- ✅ **Hooks** - Pre/post hooks for all operations
- ✅ **Transactions** - Session-based ACID transactions
- ✅ **Write-Ahead Log** - Durability and crash recovery
- ✅ **Caching** - LRU cache with smart invalidation
- ✅ **Query Optimizer** - Automatic best index selection
- ✅ **Backup/Restore** - Full database backup
- ✅ **Performance Monitoring** - Real-time metrics

## 📚 Documentation

- [API Reference](./docs/API.md)
- [Cursor API Guide](./docs/CURSOR.md)
- [Indexing Guide](./docs/INDEXES.md)
- [Schema Validation](./docs/SCHEMA.md)
- [Hooks & Middleware](./docs/HOOKS.md)
- [Transactions](./docs/TRANSACTIONS.md)
- [Performance Guide](./docs/PERFORMANCE.md)
- [Migration from V1](./docs/MIGRATION.md)
- [Architecture](./docs/ARCHITECTURE.md)

## 🚀 Quick Examples

### Cursor API

```javascript
const users = db.collection("users");

// Chain operations
const results = await users
  .findCursor({ city: "NYC" })
  .sort({ age: -1 })
  .skip(10)
  .limit(5)
  .project({ name: 1, email: 1 })
  .toArray();

// Iterate with cursor
const cursor = users.findCursor({ status: "active" });
while (await cursor.hasNext()) {
  const doc = await cursor.next();
  console.log(doc);
}
```

### Indexes

```javascript
// Create indexes
await users.createIndex({ email: 1 }, { unique: true });
await users.createIndex({ age: -1 });
await users.createIndex({ city: 1, age: 1 }); // Compound

// List indexes
const indexes = await users.listIndexes();

// Drop index
await users.dropIndex("email_1");
```

### Schema Validation

```javascript
const posts = db.createCollection("posts", {
  schema: {
    title: { 
      type: String, 
      required: true, 
      minLength: 3, 
      maxLength: 100 
    },
    content: { type: String, required: true },
    views: { type: Number, min: 0, default: 0 },
    published: { type: Boolean, default: false },
    tags: { type: Array }
  }
});

// This will validate on insert
await posts.insertOne({
  title: "My Post",
  content: "Post content...",
  views: 0,
  published: true
});
```

### Hooks

```javascript
// Pre-insert hook
users.pre("insert", (context) => {
  context.document.createdAt = new Date().toISOString();
  context.document.updatedAt = new Date().toISOString();
  return context;
});

// Post-update hook
users.post("update", (context) => {
  console.log(`Updated ${context.modifiedCount} documents`);
});

await users.insertOne({ name: "John" });
// Document automatically gets createdAt and updatedAt
```

### Transactions

```javascript
const session = db.startSession();
await session.startTransaction();

try {
  await accounts.updateOne(
    { name: "Alice" }, 
    { $inc: { balance: -100 } }, 
    session
  );
  
  await accounts.updateOne(
    { name: "Bob" }, 
    { $inc: { balance: 100 } }, 
    session
  );
  
  await session.commit();
} catch (error) {
  await session.abort();
  throw error;
}
```

### Backup & Restore

```javascript
// Create backup
const result = await db.backup("./backups");
console.log(`Backup created at: ${result.backupPath}`);

// Restore from backup
await db.restore("./backups/myDatabase_2024-01-15_120000");
```

### Performance Monitoring

```javascript
const report = db.performance();
console.log(`
  Reads: ${report.operations.reads}
  Writes: ${report.operations.writes}
  Cache Hit Rate: ${report.cache.hitRate}%
  Index Usage: ${report.indexes.usageRate}%
  Average Query Time: ${report.timing.averageQuery}ms
`);
```

## 🔍 Query Operators

### Comparison Operators

| Operator  | Description           | Example                                       |
| --------- | --------------------- | --------------------------------------------- |
| `$eq`     | Equal to              | `{ age: { $eq: 25 } }`                        |
| `$ne`     | Not equal to          | `{ status: { $ne: 'inactive' } }`             |
| `$gt`     | Greater than          | `{ age: { $gt: 18 } }`                        |
| `$gte`    | Greater than or equal | `{ age: { $gte: 18 } }`                       |
| `$lt`     | Less than             | `{ age: { $lt: 65 } }`                        |
| `$lte`    | Less than or equal    | `{ age: { $lte: 65 } }`                       |
| `$in`     | In array              | `{ status: { $in: ['active', 'pending'] } }`  |
| `$nin`    | Not in array          | `{ status: { $nin: ['banned', 'deleted'] } }` |
| `$exists` | Field exists          | `{ email: { $exists: true } }`                |

### Logical Operators

```javascript
// $and
await users.find({
  $and: [{ age: { $gte: 18 } }, { age: { $lte: 65 } }],
});

// $or
await users.find({
  $or: [{ status: "premium" }, { age: { $gte: 65 } }],
});
```

## 🔧 Update Operators

| Operator | Description          | Example                                          |
| -------- | -------------------- | ------------------------------------------------ |
| `$set`   | Set field values     | `{ $set: { age: 23, city: "NYC" } }`            |
| `$unset` | Remove fields        | `{ $unset: { tempField: "" } }`                 |
| `$inc`   | Increment value      | `{ $inc: { views: 1 } }`                        |
| `$push`  | Add to array         | `{ $push: { tags: "javascript" } }`             |

## 📁 Storage Structure

```
your-project/
└── database/
    └── myDatabase/
        ├── metadata.json
        ├── collections/
        │   ├── users.collection
        │   └── products.collection
        ├── indexes/           (V2)
        │   ├── users.email.idx
        │   └── users.age.idx
        └── wal/               (V2)
            └── transaction-*.log
```

## ⚙️ Configuration

```javascript
const db = new LocalDB({
  // Required
  database: "myDatabase",
  
  // Optional
  path: "./database",              // Storage path
  cache: true,                     // Enable caching
  cacheSize: "256MB",              // Cache size
  journal: true,                   // Enable WAL
  autoIndex: true,                 // Auto-create indexes for unique fields
  strictSchema: true,              // Enforce schema validation
  performanceTracking: true,       // Track metrics
});
```

## 🛡️ Error Handling

```javascript
import {
  LocalDB,
  // V1 Errors
  DuplicateKeyError,
  ValidationError,
  QueryError,
  StorageError,
  // V2 Errors
  IndexError,
  TransactionError,
  SchemaValidationError,
  HookExecutionError,
  CacheError,
  WALError,
  BackupError,
  CursorError
} from "dimond-db";

try {
  await users.insertOne({ email: "duplicate@example.com" });
} catch (error) {
  if (error instanceof DuplicateKeyError) {
    console.log("Duplicate key violation");
  } else if (error instanceof SchemaValidationError) {
    console.log("Schema validation failed:", error.message);
  }
}
```

## ⚡ Performance Tips

1. **Use Indexes** - Create indexes on frequently queried fields
2. **Use Cursors** - For large result sets, use cursors instead of `find()`
3. **Enable Caching** - Cache frequently accessed data
4. **Batch Operations** - Use `insertMany()` instead of multiple `insertOne()`
5. **Use Projection** - Only retrieve fields you need
6. **Monitor Performance** - Use `db.performance()` to identify bottlenecks
7. **Use Transactions Wisely** - Only for operations requiring atomicity
8. **Regular Cleanup** - Remove old documents and unused indexes

## 📊 Benchmarks

Typical performance on modern hardware (M1 Mac):

| Operation              | Without Index | With Index | With Cache |
| ---------------------- | ------------- | ---------- | ---------- |
| Insert (1 doc)         | ~1ms          | ~1.5ms     | ~1ms       |
| Find (1000 docs)       | ~15ms         | ~2ms       | ~0.1ms     |
| Update (1 doc)         | ~2ms          | ~1ms       | ~1ms       |
| Delete (1 doc)         | ~2ms          | ~1ms       | ~1ms       |
| Count (10000 docs)     | ~20ms         | ~1ms       | ~0.1ms     |

## 📋 Requirements

- Node.js >= 14.0.0
- ES Modules support

## 🗺️ Roadmap (Version 3)

- Client-Server Architecture
- Network Protocol
- Authentication & Authorization
- Replication
- Sharding
- Clustering
- Distributed Transactions
- Real-time Change Streams
- Aggregation Pipeline
- Full-Text Search
- Geospatial Queries

## 🔄 Migration from V1

Version 2 is **fully backward compatible** with Version 1. Existing code will continue to work without modifications. See [Migration Guide](./docs/MIGRATION.md) for details on adopting V2 features.

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

**Dimond-DB (LocalDB)** - Built with ❤️ for developers who need a powerful, embedded database solution.
