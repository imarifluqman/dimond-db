# Cursor API Guide

Complete guide to using the Cursor API in Dimond-DB v2.

## Overview

The Cursor API provides MongoDB-style lazy evaluation of query results. Unlike `find()` which loads all results into memory immediately, cursors allow you to process large result sets efficiently with on-demand loading and transformation.

## Why Use Cursors?

- **Memory Efficiency** - Process large result sets without loading everything into memory
- **Flexible Processing** - Chain operations like sort, limit, skip, project
- **Lazy Evaluation** - Operations only execute when results are consumed
- **Iterative Processing** - Process documents one at a time with `next()`

## Basic Usage

### Creating a Cursor

```javascript
const users = db.collection('users');

// Create cursor with filter
const cursor = users.findCursor({ age: { $gte: 18 } });

// Get all results
const results = await cursor.toArray();
```

### Method Chaining

Cursor methods return the cursor instance, allowing you to chain operations:

```javascript
const results = await users
  .findCursor({ status: 'active' })
  .sort({ age: -1 })
  .skip(20)
  .limit(10)
  .project({ name: 1, email: 1 })
  .toArray();
```

## Cursor Methods

### `sort(spec)`

Sort results by one or more fields.

**Syntax:**
```javascript
cursor.sort({ field1: 1, field2: -1 })
```

- `1` = ascending order
- `-1` = descending order

**Examples:**

```javascript
// Sort by age ascending
cursor.sort({ age: 1 });

// Sort by age descending
cursor.sort({ age: -1 });

// Sort by multiple fields
cursor.sort({ city: 1, age: -1 });

// Full example
const users = await db.collection('users')
  .findCursor({ status: 'active' })
  .sort({ createdAt: -1 })
  .toArray();
```

---

### `limit(count)`

Limit the number of results.

**Examples:**

```javascript
// Get only 10 results
cursor.limit(10);

// Top 5 oldest users
const oldest = await users
  .findCursor({})
  .sort({ age: -1 })
  .limit(5)
  .toArray();
```

---

### `skip(count)`

Skip a number of documents.

**Examples:**

```javascript
// Skip first 20 documents
cursor.skip(20);

// Pagination: page 3, 10 per page
const page = 3;
const perPage = 10;

const results = await users
  .findCursor({})
  .skip((page - 1) * perPage)
  .limit(perPage)
  .toArray();
```

---

### `project(spec)`

Select which fields to include or exclude.

**Syntax:**
```javascript
// Inclusion (only include specified fields)
cursor.project({ field1: 1, field2: 1 })

// Exclusion (exclude specified fields)
cursor.project({ field1: 0, field2: 0 })
```

**Rules:**
- Cannot mix inclusion and exclusion (except `_id`)
- `_id` is always included unless explicitly excluded
- Reduces network/memory usage by selecting only needed fields

**Examples:**

```javascript
// Include only name and email
cursor.project({ name: 1, email: 1 });
// Result: { _id: '...', name: '...', email: '...' }

// Exclude _id
cursor.project({ name: 1, email: 1, _id: 0 });
// Result: { name: '...', email: '...' }

// Exclude sensitive fields
cursor.project({ password: 0, ssn: 0 });
// Result: All fields except password and ssn

// Nested field projection
cursor.project({ 'address.city': 1, 'address.country': 1 });
```

---

### `toArray()`

Execute cursor and return all results as an array.

**Returns:** `Promise<Array<Object>>`

**Examples:**

```javascript
const results = await cursor.toArray();
console.log(results); // Array of documents

// Complete example
const activeUsers = await users
  .findCursor({ status: 'active' })
  .sort({ lastLogin: -1 })
  .limit(100)
  .project({ name: 1, email: 1, lastLogin: 1 })
  .toArray();
```

---

### `next()`

Get the next document from the cursor.

**Returns:** `Promise<Object|null>` - Next document or `null` if no more documents

**Examples:**

```javascript
const cursor = users.findCursor({ status: 'active' });

const firstDoc = await cursor.next();
const secondDoc = await cursor.next();
const thirdDoc = await cursor.next();

// Returns null when no more documents
const noMore = await cursor.next(); // null
```

---

### `hasNext()`

Check if more documents are available.

**Returns:** `Promise<boolean>`

**Examples:**

```javascript
const cursor = users.findCursor({});

while (await cursor.hasNext()) {
  const doc = await cursor.next();
  console.log(doc);
}
```

---

### `forEach(callback)`

Iterate over all documents with a callback.

**Parameters:**
- `callback(doc)` - Function called for each document

**Examples:**

```javascript
// Simple iteration
await cursor.forEach(doc => {
  console.log(doc.name);
});

// Async processing
await cursor.forEach(async doc => {
  await processUser(doc);
});

// With counter
let count = 0;
await cursor.forEach(doc => {
  count++;
  console.log(`Processing ${count}: ${doc.name}`);
});
```

---

### `map(mapper)`

Transform documents with a mapper function.

**Parameters:**
- `mapper(doc)` - Function to transform each document

**Returns:** `Promise<Array>` - Array of transformed values

**Examples:**

```javascript
// Extract field
const names = await cursor.map(doc => doc.name);
// ['Alice', 'Bob', 'Charlie']

// Transform documents
const simplified = await cursor.map(doc => ({
  id: doc._id,
  fullName: `${doc.firstName} ${doc.lastName}`,
  email: doc.email
}));

// Async transformation
const enriched = await cursor.map(async doc => {
  const profile = await fetchProfile(doc._id);
  return { ...doc, profile };
});
```

---

### `filter(predicate)`

Filter documents with a predicate function.

**Parameters:**
- `predicate(doc)` - Function returning boolean

**Returns:** `Promise<Array>` - Array of filtered documents

**Examples:**

```javascript
// Simple filter
const adults = await cursor.filter(doc => doc.age >= 18);

// Complex filter
const eligible = await cursor.filter(doc => {
  return doc.age >= 18 && 
         doc.status === 'active' && 
         doc.verified === true;
});

// Async predicate
const verified = await cursor.filter(async doc => {
  return await checkVerification(doc._id);
});
```

---

### `count()`

Count documents matched by cursor.

**Returns:** `Promise<number>`

**Examples:**

```javascript
const cursor = users.findCursor({ status: 'active' });
const count = await cursor.count();
console.log(`${count} active users`);
```

---

### `rewind()`

Reset cursor position to beginning.

**Examples:**

```javascript
const cursor = users.findCursor({}).limit(10);

// First iteration
await cursor.forEach(doc => console.log(doc.name));

// Reset and iterate again
cursor.rewind();
await cursor.forEach(doc => console.log(doc.name));
```

---

### `clone()`

Create a copy of the cursor.

**Returns:** `Cursor` - Cloned cursor

**Examples:**

```javascript
const cursor1 = users.findCursor({ status: 'active' }).sort({ age: 1 });
const cursor2 = cursor1.clone();

// Both cursors are independent
const young = await cursor1.limit(10).toArray();
const old = await cursor2.skip(100).limit(10).toArray();
```

---

## Common Patterns

### Pagination

```javascript
async function getPage(page, pageSize) {
  return await users
    .findCursor({ status: 'active' })
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .project({ name: 1, email: 1, createdAt: 1 })
    .toArray();
}

const page1 = await getPage(1, 20);
const page2 = await getPage(2, 20);
```

---

### Processing Large Datasets

```javascript
// Process 10,000 users without loading all into memory
const cursor = users.findCursor({});

let processed = 0;
while (await cursor.hasNext()) {
  const user = await cursor.next();
  await processUser(user);
  processed++;
  
  if (processed % 100 === 0) {
    console.log(`Processed ${processed} users`);
  }
}
```

---

### Batched Processing

```javascript
async function processBatch(cursor, batchSize) {
  const batch = [];
  
  for (let i = 0; i < batchSize; i++) {
    if (!await cursor.hasNext()) break;
    batch.push(await cursor.next());
  }
  
  return batch;
}

const cursor = users.findCursor({ status: 'pending' });

while (await cursor.hasNext()) {
  const batch = await processBatch(cursor, 100);
  await processBatchOfUsers(batch);
}
```

---

### Stream-like Processing

```javascript
// Transform and filter in one pass
const results = await users
  .findCursor({ status: 'active' })
  .map(doc => ({
    ...doc,
    fullName: `${doc.firstName} ${doc.lastName}`
  }))
  .then(docs => docs.filter(doc => doc.age >= 18));
```

---

### Finding Top N

```javascript
// Top 10 most active users
const topUsers = await users
  .findCursor({})
  .sort({ activityScore: -1 })
  .limit(10)
  .project({ name: 1, activityScore: 1 })
  .toArray();
```

---

### Distinct Values

```javascript
// Get unique cities
const cities = await users
  .findCursor({})
  .map(doc => doc.city);

const uniqueCities = [...new Set(cities)];
```

---

## Performance Tips

1. **Use Projection** - Only select fields you need
   ```javascript
   // Bad: Loads all fields
   cursor.toArray();
   
   // Good: Only loads needed fields
   cursor.project({ name: 1, email: 1 }).toArray();
   ```

2. **Use Indexes** - Create indexes on sorted/filtered fields
   ```javascript
   await users.createIndex({ age: 1 });
   
   // This query will use the index
   const cursor = users.findCursor({ age: { $gte: 18 } }).sort({ age: 1 });
   ```

3. **Limit Early** - Apply limit before expensive operations
   ```javascript
   // Good: Limit before projection
   cursor.limit(10).project({ name: 1, email: 1 });
   ```

4. **Use `next()` for Large Datasets** - Don't load everything with `toArray()`
   ```javascript
   // Bad for large datasets
   const all = await cursor.toArray();
   
   // Good for large datasets
   while (await cursor.hasNext()) {
     const doc = await cursor.next();
     await process(doc);
   }
   ```

5. **Chain Operations** - Build efficient query pipelines
   ```javascript
   const results = await users
     .findCursor({ status: 'active' })
     .sort({ age: -1 })
     .skip(20)
     .limit(10)
     .project({ name: 1, email: 1 })
     .toArray();
   ```

---

## Cursor vs find()

| Operation | Cursor | find() |
|-----------|--------|--------|
| Memory usage | Low (lazy) | High (loads all) |
| Large datasets | ✅ Efficient | ❌ Can cause OOM |
| Sorting | ✅ Yes | ❌ No |
| Limiting | ✅ Yes | ❌ No |
| Skipping | ✅ Yes | ❌ No |
| Projection | ✅ Yes | ❌ No |
| Iteration | ✅ next()/forEach() | ❌ Array methods |
| Simple queries | ❌ Overhead | ✅ Simple |

**Use `findCursor()` when:**
- Working with large result sets
- Need sorting, limiting, or skipping
- Need projection to reduce data transfer
- Processing documents one at a time
- Building complex query pipelines

**Use `find()` when:**
- Small result sets (< 100 documents)
- Need simple array of all results
- No sorting/limiting/projection needed
- Simpler code is preferred

---

## Advanced Examples

### Complex Aggregation-like Query

```javascript
// Get average age by city for users over 18
const cursor = users.findCursor({ age: { $gte: 18 } });

const results = await cursor.toArray();
const byCity = {};

for (const user of results) {
  if (!byCity[user.city]) {
    byCity[user.city] = { sum: 0, count: 0 };
  }
  byCity[user.city].sum += user.age;
  byCity[user.city].count++;
}

const averages = Object.entries(byCity).map(([city, data]) => ({
  city,
  averageAge: data.sum / data.count
}));
```

---

### Cursor with Transaction

```javascript
const session = db.startSession();
await session.startTransaction();

try {
  const cursor = users.findCursor({ balance: { $lt: 0 } });
  
  while (await cursor.hasNext()) {
    const user = await cursor.next();
    await users.updateOne(
      { _id: user._id },
      { $set: { status: 'suspended' } },
      session
    );
  }
  
  await session.commit();
} catch (error) {
  await session.abort();
  throw error;
}
```

---

## Best Practices

1. ✅ **Always consume cursors** - Don't create cursors and not use them
2. ✅ **Project early** - Reduce data transfer with projection
3. ✅ **Use appropriate method** - `next()` for iteration, `toArray()` for small sets
4. ✅ **Add indexes** - Index fields used in filters and sorts
5. ✅ **Handle errors** - Wrap cursor operations in try-catch
6. ❌ **Don't mix methods** - After calling `toArray()`, don't use `next()`
7. ❌ **Don't modify during iteration** - Don't update documents while iterating

---

## Error Handling

```javascript
import { CursorError } from 'dimond-db';

try {
  const cursor = users.findCursor({ age: { $gte: 18 } });
  
  // This will throw - cannot modify after execution
  const results = await cursor.toArray();
  cursor.sort({ age: 1 }); // ❌ CursorError
  
} catch (error) {
  if (error instanceof CursorError) {
    console.error('Cursor error:', error.message);
  }
}
```

---

## Summary

The Cursor API provides powerful tools for efficiently querying and processing data:

- Use **method chaining** for readable query pipelines
- Use **`next()`** for memory-efficient iteration of large datasets
- Use **projection** to reduce memory and improve performance
- Use **indexes** to speed up filtered and sorted queries
- Use **`toArray()`** for small result sets that fit in memory

The Cursor API is a key feature of Dimond-DB v2 that brings MongoDB-like query capabilities to your embedded database.
