# Migration Guide: V1 to V2

Complete guide for migrating from Dimond-DB (LocalDB) Version 1 to Version 2.

## Overview

Version 2 is **fully backward compatible** with Version 1. Your existing V1 code will continue to work without modifications. This guide helps you adopt V2 features incrementally.

## What's New in V2

- 🔍 Advanced Indexing (B-Tree & Hash)
- 📊 Cursor API for lazy evaluation
- ✅ Schema Validation
- 🔗 Hooks/Middleware
- 💾 Transactions with ACID guarantees
- 📝 Write-Ahead Logging (WAL)
- ⚡ LRU Caching
- 🎯 Query Optimizer
- 📦 Backup & Restore
- 📈 Performance Monitoring

## Breaking Changes

**None!** Version 2 maintains full backward compatibility with V1.

All V1 code continues to work:
```javascript
// V1 code still works in V2
const db = new LocalDB({ database: 'myapp' });
const users = db.collection('users');

await users.insertOne({ name: 'John' });
const all = await users.find();
await users.updateOne({ name: 'John' }, { $set: { age: 30 } });
await users.deleteOne({ name: 'John' });
```

## Migration Strategy

### Phase 1: Drop-in Replacement (5 minutes)

Simply upgrade the package version:

```bash
npm install dimond-db@latest
```

Your existing code continues working unchanged.

---

### Phase 2: Enable V2 Features (30 minutes)

Update your database configuration to enable V2 features:

#### Before (V1):
```javascript
const db = new LocalDB({
  database: 'myapp',
  path: './database'
});
```

#### After (V2):
```javascript
const db = new LocalDB({
  database: 'myapp',
  path: './database',
  
  // Enable V2 features
  cache: true,              // Enable caching
  cacheSize: '256MB',       // Configure cache size
  journal: true,            // Enable WAL for durability
  autoIndex: true,          // Auto-create unique indexes
  strictSchema: true,       // Enforce schema validation
  performanceTracking: true // Monitor performance
});
```

**Benefits:**
- ✅ Automatic caching for better performance
- ✅ Crash recovery with WAL
- ✅ Performance metrics

**No code changes required** - just configuration!

---

### Phase 3: Add Indexes (1 hour)

Identify frequently queried fields and create indexes:

#### Before (V1):
```javascript
// Slow: Full collection scan
const user = await users.findOne({ email: 'john@example.com' });
```

#### After (V2):
```javascript
// Create indexes for common queries
await users.createIndex({ email: 1 }, { unique: true });
await users.createIndex({ status: 1 });
await users.createIndex({ city: 1, age: 1 });

// Now queries are 10-50x faster
const user = await users.findOne({ email: 'john@example.com' });
```

**Migration Steps:**

1. Analyze your query patterns
2. Create indexes for frequently used fields
3. Monitor performance improvement

```javascript
// Add at application startup
async function setupIndexes() {
  const users = db.collection('users');
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ username: 1 }, { unique: true });
  
  const posts = db.collection('posts');
  await posts.createIndex({ authorId: 1 });
  await posts.createIndex({ createdAt: -1 });
  
  const products = db.collection('products');
  await products.createIndex({ category: 1, price: 1 });
}

setupIndexes().catch(console.error);
```

---

### Phase 4: Adopt Cursor API (2 hours)

Replace `find()` with cursors for large result sets:

#### Before (V1):
```javascript
// Loads everything into memory
const users = await users.find({ status: 'active' });

// Manual pagination
const page = users.slice(skip, skip + limit);
```

#### After (V2):
```javascript
// Efficient cursor with built-in operations
const users = await users
  .findCursor({ status: 'active' })
  .sort({ createdAt: -1 })
  .skip(20)
  .limit(10)
  .project({ name: 1, email: 1 })
  .toArray();
```

**Migration Pattern:**

```javascript
// V1: find() everywhere
async function getAllUsers() {
  return await users.find({});
}

// V2: Use cursor for flexibility
async function getUsersPage(page, pageSize) {
  return await users
    .findCursor({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();
}

// V2: Iterator for large datasets
async function processAllUsers() {
  const cursor = users.findCursor({});
  
  while (await cursor.hasNext()) {
    const user = await cursor.next();
    await processUser(user);
  }
}
```

---

### Phase 5: Add Schema Validation (3 hours)

Define schemas for data consistency:

#### Before (V1):
```javascript
// No validation - any data accepted
await users.insertOne({
  name: 123,              // Wrong type
  email: 'invalid',       // Invalid format
  age: -5                 // Invalid value
});
// Inserts successfully with bad data
```

#### After (V2):
```javascript
// Define schema
const users = db.createCollection('users', {
  schema: {
    name: { 
      type: String, 
      required: true,
      minLength: 2,
      maxLength: 50
    },
    email: { 
      type: String, 
      required: true,
      unique: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    age: { 
      type: Number,
      min: 0,
      max: 150
    }
  }
});

// Now validation prevents bad data
await users.insertOne({
  name: 123,              // ❌ ValidationError: type mismatch
  email: 'invalid',       // ❌ ValidationError: pattern mismatch
  age: -5                 // ❌ ValidationError: below minimum
});
```

**Migration Steps:**

1. Document your current data structure
2. Add schema incrementally per collection
3. Test with existing data

```javascript
// For existing collections
const users = db.collection('users');

users.setSchema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number, min: 0 }
});
```

---

### Phase 6: Add Hooks (2 hours)

Replace manual timestamps and transformations with hooks:

#### Before (V1):
```javascript
// Manual timestamps everywhere
await users.insertOne({
  name: 'John',
  email: 'john@example.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// Manual normalization
const email = emailInput.toLowerCase().trim();
await users.insertOne({ email });
```

#### After (V2):
```javascript
// Set up hooks once
users.pre('insert', (context) => {
  const now = new Date().toISOString();
  context.document.createdAt = now;
  context.document.updatedAt = now;
  
  if (context.document.email) {
    context.document.email = context.document.email.toLowerCase().trim();
  }
  
  return context;
});

users.pre('update', (context) => {
  if (!context.update.$set) {
    context.update.$set = {};
  }
  context.update.$set.updatedAt = new Date().toISOString();
  return context;
});

// Now just insert - hooks handle the rest
await users.insertOne({
  name: 'John',
  email: 'JOHN@EXAMPLE.COM'
});
// Automatically: timestamps added, email normalized
```

**Common Hook Patterns:**

```javascript
// Timestamps
collection.pre('insert', (ctx) => {
  ctx.document.createdAt = new Date().toISOString();
  return ctx;
});

// Soft delete
collection.pre('find', (ctx) => {
  if (!ctx.filter.deleted) {
    ctx.filter.deleted = { $ne: true };
  }
  return ctx;
});

// Audit logging
collection.post('insert', async (ctx) => {
  await auditLog.insertOne({
    action: 'insert',
    collection: 'users',
    documentId: ctx.document._id,
    timestamp: new Date()
  });
});
```

---

### Phase 7: Use Transactions (4 hours)

Replace manual rollback logic with transactions:

#### Before (V1):
```javascript
// Manual rollback - error-prone
async function transferMoney(fromId, toId, amount) {
  try {
    // Debit
    await accounts.updateOne(
      { _id: fromId },
      { $inc: { balance: -amount } }
    );
    
    // Credit
    await accounts.updateOne(
      { _id: toId },
      { $inc: { balance: amount } }
    );
    
  } catch (error) {
    // Manual rollback
    await accounts.updateOne(
      { _id: fromId },
      { $inc: { balance: amount } }  // Reverse debit
    );
    throw error;
  }
}
```

#### After (V2):
```javascript
// Automatic rollback with transactions
async function transferMoney(fromId, toId, amount) {
  const session = db.startSession();
  await session.startTransaction();
  
  try {
    await accounts.updateOne(
      { _id: fromId },
      { $inc: { balance: -amount } },
      session
    );
    
    await accounts.updateOne(
      { _id: toId },
      { $inc: { balance: amount } },
      session
    );
    
    await session.commit();
    
  } catch (error) {
    await session.abort();  // Automatic rollback
    throw error;
  }
}
```

**Identify Transaction Candidates:**

Look for operations that must succeed together:
- Money transfers
- Order processing
- User registration with profile
- Inventory updates with order creation

---

## Feature Comparison

| Feature | V1 | V2 |
|---------|----|----|
| **Basic CRUD** | ✅ | ✅ |
| **Query Operators** | ✅ | ✅ |
| **Update Operators** | ✅ | ✅ |
| **Indexes** | ❌ | ✅ |
| **Cursor API** | ❌ | ✅ |
| **Schema Validation** | ❌ | ✅ |
| **Hooks** | ❌ | ✅ |
| **Transactions** | ❌ | ✅ |
| **WAL** | ❌ | ✅ |
| **Caching** | ❌ | ✅ |
| **Query Optimizer** | ❌ | ✅ |
| **Backup/Restore** | ❌ | ✅ |
| **Performance Monitoring** | ❌ | ✅ |

---

## Migration Checklist

### Immediate (Day 1)
- [ ] Upgrade package to V2
- [ ] Test existing functionality
- [ ] Enable caching
- [ ] Enable WAL (journal)
- [ ] Enable performance tracking

### Week 1
- [ ] Identify frequently queried fields
- [ ] Create indexes
- [ ] Measure performance improvements
- [ ] Enable auto-indexing

### Week 2
- [ ] Replace find() with cursors for large datasets
- [ ] Implement pagination with cursors
- [ ] Add projection to reduce data transfer

### Week 3
- [ ] Define schemas for main collections
- [ ] Enable schema validation
- [ ] Test with existing data

### Week 4
- [ ] Add timestamp hooks
- [ ] Add data normalization hooks
- [ ] Add audit logging hooks

### Month 2
- [ ] Identify operations needing transactions
- [ ] Implement transaction support
- [ ] Test rollback scenarios

### Month 3
- [ ] Set up backup schedules
- [ ] Monitor performance metrics
- [ ] Optimize based on reports

---

## Code Examples

### Complete Before/After Example

#### V1 Application:

```javascript
import { LocalDB } from 'dimond-db';

const db = new LocalDB({ database: 'myapp' });
const users = db.collection('users');

// Insert with manual timestamps
async function createUser(userData) {
  const user = {
    ...userData,
    email: userData.email.toLowerCase(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return await users.insertOne(user);
}

// Find all (loads everything)
async function getAllUsers() {
  return await users.find({});
}

// Pagination (manual)
async function getUsersPage(page, pageSize) {
  const all = await users.find({});
  const start = (page - 1) * pageSize;
  return all.slice(start, start + pageSize);
}

// Manual transaction
async function transferMoney(fromId, toId, amount) {
  const accounts = db.collection('accounts');
  
  await accounts.updateOne(
    { _id: fromId },
    { $inc: { balance: -amount } }
  );
  
  await accounts.updateOne(
    { _id: toId },
    { $inc: { balance: amount } }
  );
}
```

#### V2 Application:

```javascript
import { LocalDB } from 'dimond-db';

const db = new LocalDB({
  database: 'myapp',
  cache: true,
  journal: true,
  autoIndex: true,
  performanceTracking: true
});

// Define schema
const users = db.createCollection('users', {
  schema: {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    age: { type: Number, min: 0 }
  }
});

// Set up hooks (automatic timestamps)
users.pre('insert', (ctx) => {
  const now = new Date().toISOString();
  ctx.document.createdAt = now;
  ctx.document.updatedAt = now;
  ctx.document.email = ctx.document.email.toLowerCase();
  return ctx;
});

// Create indexes
await users.createIndex({ email: 1 }, { unique: true });
await users.createIndex({ createdAt: -1 });

// Insert (hooks handle timestamps and normalization)
async function createUser(userData) {
  return await users.insertOne(userData);
}

// Efficient cursor-based queries
async function getAllUsers() {
  return await users
    .findCursor({})
    .project({ name: 1, email: 1 })
    .toArray();
}

// Built-in pagination
async function getUsersPage(page, pageSize) {
  return await users
    .findCursor({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();
}

// Transaction with automatic rollback
async function transferMoney(fromId, toId, amount) {
  const session = db.startSession();
  await session.startTransaction();
  
  try {
    const accounts = db.collection('accounts');
    
    await accounts.updateOne(
      { _id: fromId },
      { $inc: { balance: -amount } },
      session
    );
    
    await accounts.updateOne(
      { _id: toId },
      { $inc: { balance: amount } },
      session
    );
    
    await session.commit();
  } catch (error) {
    await session.abort();
    throw error;
  }
}

// Monitor performance
setInterval(() => {
  const report = db.performance();
  console.log(`Cache hit rate: ${report.cache.hitRate}%`);
  console.log(`Average query: ${report.timing.averageQuery}ms`);
}, 60000);
```

---

## Performance Improvements

After migration to V2 with all features enabled:

| Metric | V1 | V2 | Improvement |
|--------|----|----|-------------|
| Query (1000 docs) | 15ms | 1-2ms | **10x faster** |
| Repeated queries | 15ms | 0.1ms | **150x faster** |
| Pagination | Manual | Built-in | **Easier** |
| Memory (large result) | O(n) | O(1) | **Constant** |
| Data integrity | Manual | Automatic | **Reliable** |
| Crash recovery | ❌ | ✅ | **Durable** |

---

## Troubleshooting

### Issue: Existing unique values conflict

**Problem:** Creating unique index fails due to duplicate values

**Solution:**
```javascript
// Clean up duplicates first
const emails = await users.find({});
const seen = new Set();
const duplicates = [];

for (const user of emails) {
  if (seen.has(user.email)) {
    duplicates.push(user._id);
  } else {
    seen.add(user.email);
  }
}

// Remove duplicates
await users.deleteMany({ _id: { $in: duplicates } });

// Now create index
await users.createIndex({ email: 1 }, { unique: true });
```

---

### Issue: Schema validation fails on existing data

**Problem:** Existing documents don't match new schema

**Solution:**
```javascript
// Validate and fix existing data
const allUsers = await users.find({});

for (const user of allUsers) {
  const updates = {};
  
  // Fix type mismatches
  if (typeof user.age === 'string') {
    updates.age = parseInt(user.age);
  }
  
  // Add missing required fields
  if (!user.email) {
    updates.email = `user${user._id}@example.com`;
  }
  
  if (Object.keys(updates).length > 0) {
    await users.updateOne(
      { _id: user._id },
      { $set: updates }
    );
  }
}

// Now set schema
users.setSchema({...});
```

---

## Summary

**Migration Steps:**

1. ✅ **Day 1:** Upgrade package, enable caching & WAL
2. ✅ **Week 1:** Create indexes
3. ✅ **Week 2:** Adopt cursor API
4. ✅ **Week 3:** Add schema validation
5. ✅ **Week 4:** Implement hooks
6. ✅ **Month 2:** Use transactions
7. ✅ **Month 3:** Monitor & optimize

**Key Benefits:**

- 🚀 10-150x faster queries
- 💾 Automatic crash recovery
- ✅ Data validation
- 🔒 Transaction support
- 📊 Performance monitoring

**Remember:** V2 is fully backward compatible. Migrate at your own pace!

For questions or issues, see the full documentation or open an issue on GitHub.
