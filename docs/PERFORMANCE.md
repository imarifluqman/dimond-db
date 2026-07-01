# Performance Guide

Complete guide to optimizing performance in Dimond-DB v2.

## Overview

This guide covers performance optimization techniques, monitoring, and best practices for building high-performance applications with Dimond-DB.

## Performance Monitoring

### Built-in Performance Tracking

Enable performance tracking in your database configuration:

```javascript
const db = new LocalDB({
  database: 'myapp',
  performanceTracking: true
});
```

### Getting Performance Reports

```javascript
const report = db.performance();

console.log(report);
// {
//   operations: {
//     reads: 5200,
//     writes: 2200,
//     queries: 4800,
//     updates: 1800,
//     deletes: 400
//   },
//   timing: {
//     averageRead: 1.2,      // ms
//     averageWrite: 2.5,     // ms
//     averageQuery: 3.8,     // ms
//     averageUpdate: 2.1,    // ms
//     averageDelete: 1.8     // ms
//   },
//   cache: {
//     hits: 4500,
//     misses: 300,
//     size: 42000000,        // bytes
//     hitRate: 93.75         // percentage
//   },
//   indexes: {
//     total: 12,
//     used: 11,
//     usageRate: 91.67       // percentage
//   },
//   storage: {
//     size: '125MB',
//     collections: 8
//   }
// }
```

---

## Optimization Techniques

### 1. Indexing

**Impact:** 10x-50x faster queries

#### Create Indexes on Queried Fields

```javascript
// Slow: Full collection scan
const users = await db.collection('users').find({ email: 'test@example.com' });
// Time: 15ms for 1000 documents

// Fast: Index lookup
await db.collection('users').createIndex({ email: 1 });
const users = await db.collection('users').find({ email: 'test@example.com' });
// Time: 1-2ms for 1000 documents
```

#### Use Compound Indexes

```javascript
// Common query pattern
const results = await users.find({ city: 'NYC', age: { $gte: 18 } });

// Create compound index
await users.createIndex({ city: 1, age: 1 });
// Query now uses index efficiently
```

#### Index Sort Fields

```javascript
// Frequent sorted query
const recent = await posts.findCursor({})
  .sort({ createdAt: -1 })
  .limit(10)
  .toArray();

// Create descending index
await posts.createIndex({ createdAt: -1 });
// Sorting now uses index (no in-memory sort)
```

**Guidelines:**
- Index fields used in `find()` filters
- Index fields used in `sort()`
- Create compound indexes for multi-field queries
- Don't over-index (each index slows writes)

---

### 2. Caching

**Impact:** 100x-1000x faster for repeated queries

#### Enable Cache

```javascript
const db = new LocalDB({
  database: 'myapp',
  cache: true,
  cacheSize: '512MB'  // Adjust based on available RAM
});
```

#### Cache Hit Rate

```javascript
const stats = db.cacheStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);

// Target: > 80% for optimal performance
// < 50% = consider increasing cache size or reviewing query patterns
```

#### Cache-Friendly Queries

```javascript
// Good: Identical queries hit cache
const users1 = await users.find({ status: 'active' });
const users2 = await users.find({ status: 'active' }); // Cache hit

// Bad: Different queries don't hit cache
const users1 = await users.find({ status: 'active' });
const users2 = await users.find({ status: 'inactive' }); // Cache miss
```

#### Manual Cache Management

Cache is automatically invalidated on writes, but you can monitor:

```javascript
const beforeWrites = db.cacheStats().hits;

// Write operation invalidates cache
await users.insertOne({ name: 'John' });

const afterWrites = db.cacheStats().hits;
// Cache was cleared
```

---

### 3. Cursor API for Large Result Sets

**Impact:** Constant memory usage vs. O(n)

#### Bad: Loading Everything

```javascript
// Bad: Loads all 100,000 documents into memory
const allUsers = await users.find({});
// Memory: ~500MB
// Time: 500ms
```

#### Good: Using Cursors

```javascript
// Good: Process one document at a time
const cursor = users.findCursor({});

while (await cursor.hasNext()) {
  const user = await cursor.next();
  await processUser(user);
}
// Memory: Constant (~1MB)
// Time: Same, but memory-efficient
```

#### Pagination with Cursors

```javascript
// Efficient pagination
async function getPage(page, pageSize) {
  return await users
    .findCursor({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();
}
```

---

### 4. Projection

**Impact:** 50-80% less data transfer

#### Select Only Needed Fields

```javascript
// Bad: Retrieve all fields
const users = await users.find({ status: 'active' });
// Transfers: name, email, password, bio, settings, etc.

// Good: Project only needed fields
const users = await users
  .findCursor({ status: 'active' })
  .project({ name: 1, email: 1 })
  .toArray();
// Transfers: Only name and email
// 5x smaller payload
```

#### Exclude Large Fields

```javascript
// Exclude large binary or text fields
const posts = await posts
  .findCursor({})
  .project({ content: 0, images: 0 })
  .toArray();
```

---

### 5. Batch Operations

**Impact:** 10x-50x faster than individual operations

#### Batch Inserts

```javascript
// Bad: Individual inserts
for (const user of users) {
  await users.insertOne(user);
}
// Time: 100ms × 1000 = 100 seconds

// Good: Batch insert
await users.insertMany(users);
// Time: 2 seconds
```

#### Batch Updates

```javascript
// Bad: Individual updates
for (const user of users) {
  await users.updateOne(
    { _id: user._id },
    { $set: { status: 'active' } }
  );
}

// Good: Bulk update with filter
await users.updateMany(
  { _id: { $in: userIds } },
  { $set: { status: 'active' } }
);
```

---

### 6. Query Optimization

#### Use Specific Filters

```javascript
// Bad: Broad filter
const users = await users.find({});
// Scans: All documents

// Good: Specific filter
const users = await users.find({ 
  status: 'active',
  age: { $gte: 18 }
});
// Scans: Only matching documents
```

#### Avoid Negation Operators

```javascript
// Bad: Doesn't use indexes
const users = await users.find({ status: { $ne: 'deleted' } });

// Good: Use positive filter
const users = await users.find({ 
  status: { $in: ['active', 'inactive', 'pending'] } 
});
```

#### Limit Results Early

```javascript
// Good: Limit before expensive operations
const users = await users
  .findCursor({})
  .sort({ score: -1 })
  .limit(10)  // Only sort top 10
  .project({ name: 1, score: 1 })
  .toArray();
```

---

### 7. Write-Ahead Logging

**Impact:** Durability with minimal overhead

#### Enable WAL for Transactions

```javascript
const db = new LocalDB({
  database: 'myapp',
  journal: true  // Enable WAL
});
```

**Cost:** ~5-10% write overhead for crash recovery

**Benefit:** Automatic recovery from crashes

---

### 8. Schema Validation

**Impact:** Catch errors early, prevent bad data

```javascript
// Enable strict schema
const db = new LocalDB({
  database: 'myapp',
  strictSchema: true,
  autoIndex: true  // Auto-create unique indexes
});

const users = db.createCollection('users', {
  schema: {
    email: { type: String, unique: true },
    age: { type: Number, min: 0 }
  }
});
```

**Benefit:** 
- Prevents invalid data
- Reduces application validation code
- Automatic unique indexes

---

## Performance Best Practices

### 1. ✅ Index Frequently Queried Fields

```javascript
// Analyze query patterns
const report = db.performance();
console.log(`Index usage: ${report.indexes.usageRate}%`);

// Create indexes for common queries
await users.createIndex({ email: 1 });
await posts.createIndex({ authorId: 1, createdAt: -1 });
```

---

### 2. ✅ Use Appropriate Data Types

```javascript
// Good: Correct types
{
  age: 30,                    // Number
  active: true,               // Boolean
  createdAt: new Date()       // Date
}

// Bad: String for everything
{
  age: "30",                  // String (can't use numeric operators)
  active: "true",             // String (can't use boolean logic)
  createdAt: "2024-01-15"     // String (can't use date operators)
}
```

---

### 3. ✅ Limit Document Size

**Recommended:** < 1MB per document

```javascript
// Bad: Huge document
{
  _id: '...',
  images: [/* 10MB of base64 images */],
  logs: [/* 5MB of logs */]
}

// Good: Reference external storage
{
  _id: '...',
  imageUrls: ['s3://...', 's3://...'],
  logFile: '/path/to/log.txt'
}
```

---

### 4. ✅ Clean Up Old Data

```javascript
// Periodic cleanup
async function cleanupOldData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  await logs.deleteMany({
    createdAt: { $lt: thirtyDaysAgo }
  });
}

// Run daily
setInterval(cleanupOldData, 24 * 60 * 60 * 1000);
```

---

### 5. ✅ Use Transactions Wisely

```javascript
// Good: Short transaction
const session = db.startSession();
await session.startTransaction();
await accounts.updateOne({...}, {...}, session);
await session.commit();

// Bad: Long transaction
const session = db.startSession();
await session.startTransaction();
await slowExternalAPI();  // ❌ Don't do this
await accounts.updateOne({...}, {...}, session);
await session.commit();
```

---

### 6. ✅ Monitor Performance

```javascript
// Regular monitoring
setInterval(() => {
  const report = db.performance();
  
  if (report.cache.hitRate < 80) {
    console.warn('Low cache hit rate');
  }
  
  if (report.indexes.usageRate < 70) {
    console.warn('Low index usage');
  }
  
  if (report.timing.averageQuery > 10) {
    console.warn('Slow queries detected');
  }
}, 60000); // Every minute
```

---

## Common Performance Issues

### Issue 1: Slow Queries

**Symptoms:**
- High average query time (> 10ms)
- Users report slow loading

**Solutions:**

1. **Check if indexes exist:**
   ```javascript
   const indexes = await collection.listIndexes();
   console.log(indexes);
   ```

2. **Create missing indexes:**
   ```javascript
   await collection.createIndex({ fieldName: 1 });
   ```

3. **Use projection:**
   ```javascript
   await collection.findCursor({})
     .project({ name: 1, email: 1 })
     .toArray();
   ```

---

### Issue 2: High Memory Usage

**Symptoms:**
- Memory usage grows over time
- Out of memory errors

**Solutions:**

1. **Use cursors instead of find():**
   ```javascript
   // Replace this
   const all = await collection.find({});
   
   // With this
   const cursor = collection.findCursor({});
   while (await cursor.hasNext()) {
     const doc = await cursor.next();
     await process(doc);
   }
   ```

2. **Reduce cache size:**
   ```javascript
   const db = new LocalDB({
     database: 'myapp',
     cacheSize: '128MB'  // Reduce from default 256MB
   });
   ```

3. **Use projection:**
   ```javascript
   await collection.findCursor({})
     .project({ largeField: 0 })
     .toArray();
   ```

---

### Issue 3: Slow Writes

**Symptoms:**
- High average write time (> 5ms)
- Insert/update operations slow

**Solutions:**

1. **Check index count:**
   ```javascript
   const indexes = await collection.listIndexes();
   console.log(`${indexes.length} indexes`);
   // Too many indexes (> 5) slow writes
   ```

2. **Remove unused indexes:**
   ```javascript
   await collection.dropIndex('unused_index');
   ```

3. **Use batch operations:**
   ```javascript
   await collection.insertMany(documents);
   ```

---

### Issue 4: Low Cache Hit Rate

**Symptoms:**
- Cache hit rate < 70%
- Queries not benefiting from cache

**Solutions:**

1. **Increase cache size:**
   ```javascript
   const db = new LocalDB({
     database: 'myapp',
     cacheSize: '512MB'  // Increase
   });
   ```

2. **Review query patterns:**
   - Are queries highly varied?
   - Consider standardizing query filters

3. **Reduce write frequency:**
   - Writes invalidate cache
   - Batch writes together

---

## Benchmarking

### Simple Benchmark Script

```javascript
async function benchmark() {
  const db = new LocalDB({
    database: 'benchmark',
    cache: true,
    performanceTracking: true
  });
  
  const collection = db.collection('test');
  
  // Insert benchmark
  console.time('Insert 1000 documents');
  const docs = Array.from({ length: 1000 }, (_, i) => ({
    name: `User ${i}`,
    email: `user${i}@example.com`,
    age: Math.floor(Math.random() * 50) + 18
  }));
  await collection.insertMany(docs);
  console.timeEnd('Insert 1000 documents');
  
  // Query benchmark (no index)
  console.time('Query without index');
  await collection.find({ age: { $gte: 30 } });
  console.timeEnd('Query without index');
  
  // Create index
  await collection.createIndex({ age: 1 });
  
  // Query benchmark (with index)
  console.time('Query with index');
  await collection.find({ age: { $gte: 30 } });
  console.timeEnd('Query with index');
  
  // Update benchmark
  console.time('Update 100 documents');
  await collection.updateMany(
    { age: { $lt: 25 } },
    { $set: { status: 'young' } }
  );
  console.timeEnd('Update 100 documents');
  
  // Delete benchmark
  console.time('Delete 50 documents');
  await collection.deleteMany({ age: { $gte: 65 } });
  console.timeEnd('Delete 50 documents');
  
  // Report
  const report = db.performance();
  console.log('\nPerformance Report:');
  console.log(`Average Query: ${report.timing.averageQuery}ms`);
  console.log(`Cache Hit Rate: ${report.cache.hitRate}%`);
  console.log(`Index Usage: ${report.indexes.usageRate}%`);
  
  await db.dropDatabase();
}

benchmark();
```

---

## Performance Targets

### Typical Performance (M1 Mac, 1000 documents)

| Operation | Without Index | With Index | With Cache |
|-----------|--------------|------------|------------|
| Insert (1 doc) | ~1ms | ~1.5ms | ~1ms |
| Find (all) | ~5ms | ~5ms | ~0.1ms |
| Find (filter) | ~15ms | ~2ms | ~0.1ms |
| Update (1 doc) | ~2ms | ~1ms | ~1ms |
| Delete (1 doc) | ~2ms | ~1ms | ~1ms |
| Count | ~10ms | ~1ms | ~0.1ms |

### Scale Performance (10,000 documents)

| Operation | Without Index | With Index |
|-----------|--------------|------------|
| Find (filter) | ~150ms | ~3ms |
| Count | ~100ms | ~2ms |
| Sort | ~200ms | ~5ms |

---

## Configuration Tuning

### Development

```javascript
const db = new LocalDB({
  database: 'myapp_dev',
  cache: false,             // Disable for fresh data
  journal: false,           // Disable for speed
  performanceTracking: true // Enable for profiling
});
```

### Production

```javascript
const db = new LocalDB({
  database: 'myapp',
  cache: true,
  cacheSize: '512MB',       // Tune based on available RAM
  journal: true,            // Enable for durability
  autoIndex: true,          // Auto-create unique indexes
  performanceTracking: true // Monitor in production
});
```

### High-Performance

```javascript
const db = new LocalDB({
  database: 'myapp',
  cache: true,
  cacheSize: '1GB',         // Large cache
  journal: false,           // Sacrifice durability for speed
  autoIndex: true,
  performanceTracking: false // Disable overhead
});
```

---

## Summary

**Key Performance Factors:**

1. **Indexing** - 10x-50x faster queries
2. **Caching** - 100x-1000x faster repeated queries
3. **Cursors** - Constant memory usage
4. **Projection** - 50-80% less data transfer
5. **Batching** - 10x-50x faster bulk operations

**Quick Wins:**
- ✅ Create indexes on frequently queried fields
- ✅ Enable caching
- ✅ Use cursors for large result sets
- ✅ Use projection to select only needed fields
- ✅ Batch insert/update operations

**Monitoring:**
```javascript
const report = db.performance();

// Target metrics:
// - Cache hit rate: > 80%
// - Index usage rate: > 70%
// - Average query: < 10ms
// - Average write: < 5ms
```

**Profile → Optimize → Monitor → Repeat**

Performance optimization is an iterative process. Start by measuring, identify bottlenecks, apply optimizations, and measure again!
