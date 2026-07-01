# Indexing Guide

Complete guide to using indexes in Dimond-DB v2.

## Overview

Indexes dramatically improve query performance by creating data structures that allow fast lookups. Without indexes, queries require scanning every document (full collection scan). With indexes, queries can jump directly to matching documents.

**Performance Impact:**
- **Without Index:** 15ms to find 1 document in 1000
- **With Index:** 1-2ms to find 1 document in 1000
- **10x-50x faster** for filtered queries

## Index Types

Dimond-DB v2 supports several index types:

### 1. Single Field Index

Index on one field.

```javascript
await users.createIndex({ email: 1 });
await users.createIndex({ age: -1 });
```

**Direction:**
- `1` = ascending order
- `-1` = descending order

Direction matters for:
- Sorted queries (must match index direction for optimal performance)
- Range queries

---

### 2. Compound Index

Index on multiple fields.

```javascript
await users.createIndex({ city: 1, age: -1 });
await products.createIndex({ category: 1, price: 1, name: 1 });
```

**Field Order Matters:**

The index `{ city: 1, age: -1 }` supports queries on:
- ✅ `{ city: 'NYC' }`
- ✅ `{ city: 'NYC', age: { $gte: 18 } }`
- ❌ `{ age: { $gte: 18 } }` (inefficient - doesn't use index)

**Left-Prefix Rule:** Compound indexes can be used for queries on any left prefix of indexed fields.

---

### 3. Unique Index

Enforces uniqueness constraint.

```javascript
await users.createIndex({ email: 1 }, { unique: true });
await users.createIndex({ username: 1 }, { unique: true });
```

**Behavior:**
- Prevents duplicate values
- Throws `DuplicateKeyError` on violation
- `null` values are considered unique (only one `null` allowed unless sparse)

---

### 4. Sparse Index

Skips documents without the indexed field.

```javascript
await users.createIndex({ phone: 1 }, { sparse: true });
```

**Use Cases:**
- Optional fields (not all documents have the field)
- Reduces index size
- Combined with unique: allows multiple `null` values

```javascript
await users.createIndex({ phone: 1 }, { unique: true, sparse: true });
// Multiple users can have no phone (null)
// But users with phone must have unique values
```

---

## Creating Indexes

### Basic Syntax

```javascript
await collection.createIndex(keys, options);
```

**Parameters:**
- `keys` (object) - Field(s) to index with direction
- `options` (object, optional)
  - `unique` (boolean) - Enforce uniqueness
  - `sparse` (boolean) - Skip null values
  - `name` (string) - Custom index name

**Returns:** Index name (string)

### Examples

```javascript
const users = db.collection('users');

// Single field
const idx1 = await users.createIndex({ email: 1 });
console.log(idx1); // "email_1"

// With options
await users.createIndex({ email: 1 }, { unique: true });

// Compound index
await users.createIndex({ city: 1, age: -1 });

// Custom name
await users.createIndex({ username: 1 }, { 
  unique: true, 
  name: 'unique_username_idx' 
});

// Sparse unique index
await users.createIndex({ phone: 1 }, { 
  unique: true, 
  sparse: true 
});
```

---

## Listing Indexes

```javascript
const indexes = await users.listIndexes();

console.log(indexes);
// [
//   { 
//     name: 'email_1', 
//     keys: { email: 1 }, 
//     unique: true,
//     sparse: false
//   },
//   { 
//     name: 'city_1_age_-1', 
//     keys: { city: 1, age: -1 },
//     unique: false,
//     sparse: false
//   }
// ]
```

---

## Dropping Indexes

```javascript
// Drop by name
await users.dropIndex('email_1');

// Drop by field spec (generated name)
await users.dropIndex('city_1_age_-1');
```

**Note:** You cannot drop the `_id` index (if it existed).

---

## Index Usage

### Automatic Selection

The query optimizer automatically selects the best index:

```javascript
// Create indexes
await users.createIndex({ city: 1 });
await users.createIndex({ age: 1 });
await users.createIndex({ city: 1, age: 1 });

// This query will use { city: 1, age: 1 } (best match)
const results = await users.find({ 
  city: 'NYC', 
  age: { $gte: 18 } 
});

// This query will use { city: 1 }
const results = await users.find({ city: 'NYC' });

// This query will use { age: 1 }
const results = await users.find({ age: { $gte: 18 } });
```

### Which Queries Use Indexes?

**✅ Index is used:**
- Equality: `{ email: 'test@example.com' }`
- Comparison: `{ age: { $gte: 18 } }`
- Range: `{ price: { $gte: 10, $lte: 100 } }`
- In: `{ status: { $in: ['active', 'pending'] } }`
- Sorted queries matching index direction

**❌ Index is NOT used:**
- `$ne` (not equal)
- `$nin` (not in)
- `$exists` (field exists check)
- Negation operators

---

## Query Optimization

### Index Selection Rules

The optimizer scores indexes based on:

1. **Exact field match** - Index has all query fields
2. **Prefix match** - Query uses left prefix of compound index
3. **Uniqueness** - Unique indexes are preferred (faster lookups)
4. **Field count** - Fewer fields = more specific = better

**Example:**

```javascript
// Indexes:
// 1. { city: 1 }
// 2. { city: 1, age: 1 }
// 3. { city: 1, age: 1, status: 1 }

// Query: { city: 'NYC', age: { $gte: 18 } }
// Selected: #2 (exact match)

// Query: { city: 'NYC' }
// Selected: #1 (exact match, fewer fields)

// Query: { city: 'NYC', age: 25, status: 'active' }
// Selected: #3 (exact match)
```

---

## Index Strategies

### 1. Index Frequently Queried Fields

```javascript
// If you often query by email
await users.createIndex({ email: 1 });

// If you filter by status
await posts.createIndex({ status: 1 });
```

---

### 2. Index Foreign Keys

```javascript
// For lookups and joins
await orders.createIndex({ userId: 1 });
await comments.createIndex({ postId: 1 });
```

---

### 3. Compound Indexes for Multiple Fields

```javascript
// If you query both city AND age together
await users.createIndex({ city: 1, age: 1 });

// Supports:
// - { city: 'NYC' }
// - { city: 'NYC', age: 25 }
// Does NOT efficiently support:
// - { age: 25 }
```

---

### 4. Sort Optimization

Create indexes matching your sort order:

```javascript
// Frequent query: sorted by createdAt descending
await posts.createIndex({ createdAt: -1 });

const recent = await posts
  .findCursor({})
  .sort({ createdAt: -1 })
  .limit(10)
  .toArray();
```

---

### 5. Covered Queries

When projection only includes indexed fields, query can be answered entirely from index:

```javascript
await users.createIndex({ email: 1, status: 1 });

// Covered query - very fast
const results = await users
  .findCursor({ status: 'active' })
  .project({ email: 1, status: 1, _id: 0 })
  .toArray();
```

---

## Performance Considerations

### Index Benefits

✅ **Faster reads** for indexed queries
✅ **Unique constraints** prevent duplicates
✅ **Sorted results** without in-memory sorting

### Index Costs

❌ **Slower writes** (must update indexes)
❌ **Storage overhead** (indexes consume disk space)
❌ **Memory usage** (indexes cached in RAM)

**Rule of Thumb:** Create indexes for fields you query frequently. Don't over-index.

---

## Best Practices

### 1. ✅ Index Selective Fields

```javascript
// Good: High cardinality (many unique values)
await users.createIndex({ email: 1 });
await users.createIndex({ userId: 1 });

// Bad: Low cardinality (few unique values)
await users.createIndex({ gender: 1 }); // Only 2-3 values
await users.createIndex({ isActive: 1 }); // Boolean (2 values)
```

**Why?** Low-cardinality indexes don't narrow down results much.

---

### 2. ✅ Use Compound Indexes Wisely

```javascript
// If you query both together
await products.createIndex({ category: 1, price: 1 });

// This single compound index replaces:
// - Single index on category
// - Use left-prefix rule
```

---

### 3. ✅ Index Direction Matters for Sorts

```javascript
// Ascending index
await posts.createIndex({ createdAt: 1 });

// Fast (matches index)
.sort({ createdAt: 1 })

// Slower (reverse of index)
.sort({ createdAt: -1 })

// Solution: Create descending index if you sort descending
await posts.createIndex({ createdAt: -1 });
```

---

### 4. ✅ Use Unique Indexes for Constraints

```javascript
// Enforce uniqueness at database level
await users.createIndex({ email: 1 }, { unique: true });
await users.createIndex({ username: 1 }, { unique: true });
```

Better than application-level checks (prevents race conditions).

---

### 5. ✅ Use Sparse Indexes for Optional Fields

```javascript
// Field is optional but should be unique when present
await users.createIndex({ phone: 1 }, { 
  unique: true, 
  sparse: true 
});

// Allows:
// - Multiple users with no phone
// - Each phone number used once
```

---

### 6. ❌ Don't Create Too Many Indexes

```javascript
// Bad: Over-indexing
await users.createIndex({ email: 1 });
await users.createIndex({ username: 1 });
await users.createIndex({ firstName: 1 });
await users.createIndex({ lastName: 1 });
await users.createIndex({ city: 1 });
await users.createIndex({ age: 1 });
await users.createIndex({ status: 1 });
// 7 indexes = slow writes!

// Good: Index what you actually query
await users.createIndex({ email: 1 }, { unique: true });
await users.createIndex({ username: 1 }, { unique: true });
await users.createIndex({ city: 1, age: 1 });
// 3 indexes = balanced
```

---

### 7. ✅ Monitor Index Usage

```javascript
const report = db.performance();
console.log(`Index usage: ${report.indexes.usageRate}%`);

// If low usage rate, you might have unused indexes
```

---

## Common Patterns

### User Authentication

```javascript
// Email-based login
await users.createIndex({ email: 1 }, { unique: true });

// Username-based login
await users.createIndex({ username: 1 }, { unique: true });

// Session management
await sessions.createIndex({ token: 1 }, { unique: true });
await sessions.createIndex({ userId: 1 });
```

---

### E-commerce

```javascript
// Product catalog
await products.createIndex({ category: 1, price: 1 });
await products.createIndex({ sku: 1 }, { unique: true });

// Orders
await orders.createIndex({ userId: 1 });
await orders.createIndex({ status: 1, createdAt: -1 });

// Inventory
await inventory.createIndex({ productId: 1 }, { unique: true });
```

---

### Social Media

```javascript
// Posts
await posts.createIndex({ userId: 1, createdAt: -1 });
await posts.createIndex({ status: 1 });

// Comments
await comments.createIndex({ postId: 1, createdAt: 1 });

// Followers
await followers.createIndex({ userId: 1 });
await followers.createIndex({ followerId: 1 });
```

---

### Time-series Data

```javascript
// Sorted by time for range queries
await events.createIndex({ timestamp: -1 });
await events.createIndex({ userId: 1, timestamp: -1 });
```

---

## Troubleshooting

### Query is Slow

1. **Check if index exists:**
   ```javascript
   const indexes = await collection.listIndexes();
   console.log(indexes);
   ```

2. **Create index on filtered fields:**
   ```javascript
   await collection.createIndex({ fieldName: 1 });
   ```

3. **Use compound index for multiple fields:**
   ```javascript
   await collection.createIndex({ field1: 1, field2: 1 });
   ```

---

### Duplicate Key Error

```javascript
try {
  await users.insertOne({ email: 'test@example.com' });
} catch (error) {
  if (error.name === 'DuplicateKeyError') {
    console.log('Email already exists');
  }
}
```

**Solutions:**
- Use different value
- Update existing document instead
- Remove unique constraint if duplicates are valid

---

### Index Not Being Used

**Possible reasons:**

1. **Query doesn't match index:**
   ```javascript
   // Index: { city: 1, age: 1 }
   // Query: { age: 25 } // ❌ Doesn't use index (not left-prefix)
   ```

2. **Using negation operators:**
   ```javascript
   { status: { $ne: 'deleted' } } // ❌ Doesn't use index
   ```

3. **Result set is large:**
   - Full scan might be faster than index for large result sets

---

## Advanced Topics

### Index Selectivity

**Selectivity** = uniqueness of values

- **High selectivity** (good): email, userId, orderId
- **Low selectivity** (bad): gender, boolean fields

**Formula:**
```
Selectivity = unique values / total documents
```

High selectivity (> 0.9) = very effective index
Low selectivity (< 0.1) = less effective index

---

### Index Size

Indexes consume memory and disk space:

```javascript
const stats = await collection.stats();
console.log(`Collection size: ${stats.size}`);
console.log(`Index count: ${stats.indexes}`);

// Rough estimate: 1 index ≈ 10-30% of collection size
```

---

### Write Performance Impact

Each index adds overhead to write operations:

- 1 index: ~10-20% slower writes
- 3 indexes: ~30-50% slower writes
- 5+ indexes: ~50-100% slower writes

**Balance:** Index query performance vs write performance

---

## Schema Integration

Indexes work automatically with schema validation:

```javascript
const users = db.createCollection('users', {
  schema: {
    email: { type: String, unique: true },
    username: { type: String, unique: true }
  }
});

// Automatically creates unique indexes (if autoIndex: true)
```

---

## Future Index Types (V3 Roadmap)

Planned for future versions:

- **Text Indexes** - Full-text search
- **TTL Indexes** - Auto-delete expired documents
- **Geospatial Indexes** - Location-based queries
- **Partial Indexes** - Index subset of documents
- **Hash Indexes** - Fast equality lookups

---

## Summary

**Key Takeaways:**

1. ✅ **Create indexes** on frequently queried fields
2. ✅ **Use unique indexes** for constraints
3. ✅ **Use compound indexes** for multi-field queries
4. ✅ **Match index direction** to sort direction
5. ✅ **Monitor index usage** with performance reports
6. ❌ **Don't over-index** - each index has cost
7. ❌ **Don't index low-cardinality** fields

**Quick Reference:**

```javascript
// Create
await collection.createIndex({ field: 1 });
await collection.createIndex({ field: 1 }, { unique: true });
await collection.createIndex({ field1: 1, field2: -1 });

// List
const indexes = await collection.listIndexes();

// Drop
await collection.dropIndex('indexName');

// Monitor
const report = db.performance();
console.log(report.indexes);
```

Indexes are a powerful tool for optimizing query performance in Dimond-DB v2. Use them wisely!
