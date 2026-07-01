# Hooks & Middleware Guide

Complete guide to using hooks and middleware in Dimond-DB v2.

## Overview

Hooks (also called middleware) allow you to execute custom logic before or after database operations. They're perfect for:

- Adding timestamps automatically
- Logging operations
- Data transformation
- Authorization checks
- Sending notifications
- Cache invalidation
- Audit trails

## Hook Types

Dimond-DB supports **pre** and **post** hooks for the following events:

- `insert` - Before/after document insertion
- `update` - Before/after document updates
- `delete` - Before/after document deletion
- `find` - Before/after find operations

## Basic Usage

### Pre Hooks

Execute **before** the operation.

```javascript
collection.pre('insert', (context) => {
  // Modify context here
  return context;
});
```

**Context Object:**
- Contains operation-specific data
- Can be modified to change operation behavior
- Must be returned from the handler

---

### Post Hooks

Execute **after** the operation.

```javascript
collection.post('insert', (context) => {
  // React to the operation
  // Return value is ignored
});
```

**Context Object:**
- Contains operation results
- Read-only (modifications don't affect stored data)
- Can be used for logging, notifications, etc.

---

## Insert Hooks

### Pre-Insert

Modify documents before insertion.

**Context:**
- `document` - The document being inserted
- `documents` - Array of documents (for insertMany)

**Example:**

```javascript
const users = db.collection('users');

users.pre('insert', (context) => {
  // Add timestamps
  context.document.createdAt = new Date().toISOString();
  context.document.updatedAt = new Date().toISOString();
  
  // Add default values
  if (!context.document.status) {
    context.document.status = 'active';
  }
  
  // Transform data
  if (context.document.email) {
    context.document.email = context.document.email.toLowerCase();
  }
  
  return context;
});

// Now all inserts get timestamps automatically
await users.insertOne({
  name: 'John Doe',
  email: 'JOHN@EXAMPLE.COM'
});
// Stored as: { name: 'John Doe', email: 'john@example.com', createdAt: '...', updatedAt: '...', status: 'active' }
```

---

### Post-Insert

React after insertion completes.

**Context:**
- `document` - The inserted document (with _id)
- `documents` - Array of inserted documents
- `result` - Insert operation result

**Example:**

```javascript
users.post('insert', (context) => {
  console.log(`New user created: ${context.document._id}`);
  
  // Send welcome email (async)
  sendWelcomeEmail(context.document.email);
  
  // Log to analytics
  analytics.track('user_created', {
    userId: context.document._id,
    timestamp: new Date()
  });
});
```

---

## Update Hooks

### Pre-Update

Modify update operations before execution.

**Context:**
- `filter` - Query filter
- `update` - Update operations
- `options` - Update options

**Example:**

```javascript
users.pre('update', (context) => {
  // Always update the updatedAt timestamp
  if (!context.update.$set) {
    context.update.$set = {};
  }
  context.update.$set.updatedAt = new Date().toISOString();
  
  // Transform email to lowercase
  if (context.update.$set && context.update.$set.email) {
    context.update.$set.email = context.update.$set.email.toLowerCase();
  }
  
  return context;
});

await users.updateOne(
  { _id: 'user-123' },
  { $set: { name: 'Jane Doe' } }
);
// updatedAt is automatically added
```

---

### Post-Update

React after update completes.

**Context:**
- `filter` - Query filter
- `update` - Update operations
- `matchedCount` - Number of documents matched
- `modifiedCount` - Number of documents modified

**Example:**

```javascript
users.post('update', (context) => {
  if (context.modifiedCount > 0) {
    console.log(`Updated ${context.modifiedCount} documents`);
    
    // Invalidate cache
    cache.invalidate('users');
    
    // Send notification
    if (context.update.$set && context.update.$set.status === 'suspended') {
      notifyAdmin(`User account suspended`);
    }
  }
});
```

---

## Delete Hooks

### Pre-Delete

Execute before deletion.

**Context:**
- `filter` - Query filter

**Example:**

```javascript
users.pre('delete', (context) => {
  console.log(`Attempting to delete documents matching:`, context.filter);
  
  // Could prevent deletion based on conditions
  // (though this would require throwing an error)
  
  return context;
});
```

---

### Post-Delete

React after deletion completes.

**Context:**
- `filter` - Query filter
- `deletedCount` - Number of documents deleted

**Example:**

```javascript
users.post('delete', (context) => {
  if (context.deletedCount > 0) {
    console.log(`Deleted ${context.deletedCount} documents`);
    
    // Clean up related data
    posts.deleteMany({ userId: { $in: deletedUserIds } });
    
    // Log audit trail
    auditLog.record({
      action: 'user_deleted',
      count: context.deletedCount,
      timestamp: new Date()
    });
  }
});
```

---

## Find Hooks

### Pre-Find

Modify queries before execution.

**Context:**
- `filter` - Query filter

**Example:**

```javascript
users.pre('find', (context) => {
  // Add default filter: only return active users
  if (!context.filter.status) {
    context.filter.status = 'active';
  }
  
  // Soft delete: exclude deleted documents
  if (!context.filter.deleted) {
    context.filter.deleted = { $ne: true };
  }
  
  return context;
});

// Now find() automatically filters active users
const users = await users.find({}); // Only active users
```

---

### Post-Find

Transform results after query execution.

**Context:**
- `filter` - Query filter
- `results` - Array of found documents

**Example:**

```javascript
users.post('find', (context) => {
  console.log(`Found ${context.results.length} documents`);
  
  // Log search analytics
  analytics.track('users_searched', {
    filter: context.filter,
    resultCount: context.results.length
  });
});
```

**Note:** Post-find hooks receive results but cannot modify them. The hook runs after documents are returned to the caller.

---

## Multiple Hooks

You can register multiple hooks for the same event. They execute in registration order.

```javascript
// First hook
users.pre('insert', (context) => {
  context.document.createdAt = new Date().toISOString();
  return context;
});

// Second hook
users.pre('insert', (context) => {
  context.document.version = 1;
  return context;
});

// Third hook
users.pre('insert', (context) => {
  if (context.document.email) {
    context.document.email = context.document.email.toLowerCase();
  }
  return context;
});

// All three hooks execute in order
await users.insertOne({ name: 'John', email: 'JOHN@EXAMPLE.COM' });
```

---

## Async Hooks

Hooks can be async functions.

```javascript
users.pre('insert', async (context) => {
  // Check if email exists in external service
  const exists = await externalAPI.checkEmail(context.document.email);
  
  if (exists) {
    throw new Error('Email already registered in external system');
  }
  
  // Fetch additional data
  const profile = await externalAPI.getUserProfile(context.document.email);
  context.document.externalProfile = profile;
  
  return context;
});

users.post('insert', async (context) => {
  // Send to external service
  await externalAPI.createUser(context.document);
  
  // Send email
  await emailService.sendWelcome(context.document.email);
});
```

---

## Common Patterns

### Automatic Timestamps

```javascript
collection.pre('insert', (context) => {
  const now = new Date().toISOString();
  context.document.createdAt = now;
  context.document.updatedAt = now;
  return context;
});

collection.pre('update', (context) => {
  if (!context.update.$set) {
    context.update.$set = {};
  }
  context.update.$set.updatedAt = new Date().toISOString();
  return context;
});
```

---

### Soft Delete

```javascript
// Override delete to just mark as deleted
users.pre('delete', (context) => {
  // Prevent actual deletion
  throw new Error('Direct deletion not allowed');
});

// Create custom soft delete method
users.softDelete = async function(filter) {
  return await this.updateMany(
    filter,
    { $set: { deleted: true, deletedAt: new Date().toISOString() } }
  );
};

// Filter deleted documents in queries
users.pre('find', (context) => {
  if (!context.filter.deleted) {
    context.filter.deleted = { $ne: true };
  }
  return context;
});
```

---

### Data Transformation

```javascript
users.pre('insert', (context) => {
  // Normalize email
  if (context.document.email) {
    context.document.email = context.document.email.toLowerCase().trim();
  }
  
  // Normalize phone
  if (context.document.phone) {
    context.document.phone = context.document.phone.replace(/\D/g, '');
  }
  
  // Hash password
  if (context.document.password) {
    context.document.password = hashPassword(context.document.password);
  }
  
  return context;
});
```

---

### Authorization

```javascript
// Check permissions before deletion
users.pre('delete', (context) => {
  const currentUser = getCurrentUser();
  
  if (!currentUser.isAdmin) {
    throw new Error('Only admins can delete users');
  }
  
  return context;
});

// Check permissions before update
users.pre('update', (context) => {
  const currentUser = getCurrentUser();
  
  // Prevent non-admins from changing role
  if (context.update.$set && context.update.$set.role && !currentUser.isAdmin) {
    throw new Error('Only admins can change user roles');
  }
  
  return context;
});
```

---

### Audit Trail

```javascript
const auditLog = db.collection('audit_log');

// Log all operations
users.post('insert', async (context) => {
  await auditLog.insertOne({
    collection: 'users',
    operation: 'insert',
    documentId: context.document._id,
    timestamp: new Date().toISOString(),
    user: getCurrentUser()
  });
});

users.post('update', async (context) => {
  await auditLog.insertOne({
    collection: 'users',
    operation: 'update',
    filter: context.filter,
    update: context.update,
    modifiedCount: context.modifiedCount,
    timestamp: new Date().toISOString(),
    user: getCurrentUser()
  });
});

users.post('delete', async (context) => {
  await auditLog.insertOne({
    collection: 'users',
    operation: 'delete',
    filter: context.filter,
    deletedCount: context.deletedCount,
    timestamp: new Date().toISOString(),
    user: getCurrentUser()
  });
});
```

---

### Cache Invalidation

```javascript
const cache = new Map();

// Cache find results
users.post('find', (context) => {
  const key = JSON.stringify(context.filter);
  cache.set(key, context.results);
});

// Invalidate cache on writes
users.post('insert', () => {
  cache.clear();
});

users.post('update', () => {
  cache.clear();
});

users.post('delete', () => {
  cache.clear();
});
```

---

### Validation

```javascript
users.pre('insert', (context) => {
  // Custom business logic validation
  if (context.document.age < 18) {
    throw new Error('Users must be 18 or older');
  }
  
  if (context.document.email && !context.document.emailVerified) {
    context.document.emailVerified = false;
  }
  
  return context;
});

users.pre('update', (context) => {
  // Prevent certain fields from being updated
  if (context.update.$set && context.update.$set.createdAt) {
    delete context.update.$set.createdAt;
  }
  
  return context;
});
```

---

### Cascading Deletes

```javascript
const users = db.collection('users');
const posts = db.collection('posts');
const comments = db.collection('comments');

users.post('delete', async (context) => {
  // Get deleted user IDs (would need to query first in real implementation)
  const deletedUsers = await users.find(context.filter);
  const userIds = deletedUsers.map(u => u._id);
  
  // Delete related posts
  await posts.deleteMany({ userId: { $in: userIds } });
  
  // Delete related comments
  await comments.deleteMany({ userId: { $in: userIds } });
  
  console.log(`Cascade deleted posts and comments for ${userIds.length} users`);
});
```

---

### Notifications

```javascript
users.post('insert', async (context) => {
  // Send welcome email
  await sendEmail({
    to: context.document.email,
    subject: 'Welcome!',
    body: `Welcome ${context.document.name}!`
  });
  
  // Notify admins
  await notifyAdmins(`New user registered: ${context.document.email}`);
});

users.post('update', async (context) => {
  // Notify user of profile changes
  if (context.modifiedCount > 0) {
    const user = await users.findOne(context.filter);
    await sendEmail({
      to: user.email,
      subject: 'Profile Updated',
      body: 'Your profile has been updated.'
    });
  }
});
```

---

## Error Handling

Errors thrown in hooks prevent the operation:

```javascript
users.pre('insert', (context) => {
  if (context.document.age < 18) {
    throw new Error('Must be 18 or older');
  }
  return context;
});

try {
  await users.insertOne({ name: 'John', age: 16 });
} catch (error) {
  console.error(error.message); // "Must be 18 or older"
}
// Document was NOT inserted
```

**Pre-hooks:** Throwing an error aborts the operation

**Post-hooks:** Errors are logged but don't affect the completed operation

```javascript
users.post('insert', async (context) => {
  try {
    await sendWelcomeEmail(context.document.email);
  } catch (error) {
    // Log error but don't fail the insert
    console.error('Failed to send welcome email:', error);
  }
});
```

---

## Hook Execution Order

1. **Pre-hooks** execute in registration order
2. **Database operation** executes
3. **Post-hooks** execute in registration order

```javascript
users.pre('insert', (ctx) => {
  console.log('Pre-hook 1');
  return ctx;
});

users.pre('insert', (ctx) => {
  console.log('Pre-hook 2');
  return ctx;
});

users.post('insert', (ctx) => {
  console.log('Post-hook 1');
});

users.post('insert', (ctx) => {
  console.log('Post-hook 2');
});

await users.insertOne({ name: 'John' });

// Output:
// Pre-hook 1
// Pre-hook 2
// Post-hook 1
// Post-hook 2
```

---

## Hooks with Transactions

Hooks work with transactions:

```javascript
users.pre('update', (context) => {
  context.update.$set.updatedAt = new Date().toISOString();
  return context;
});

const session = db.startSession();
await session.startTransaction();

try {
  // Hooks still execute
  await users.updateOne(
    { _id: 'user-1' },
    { $set: { status: 'suspended' } },
    session
  );
  
  await session.commit();
} catch (error) {
  await session.abort();
}
```

---

## Best Practices

### 1. ✅ Keep Hooks Simple

```javascript
// Good: Simple, focused hook
users.pre('insert', (context) => {
  context.document.createdAt = new Date().toISOString();
  return context;
});

// Bad: Too much logic in one hook
users.pre('insert', async (context) => {
  // Multiple API calls, complex transformations, etc.
  // This should be broken into separate hooks or moved to application logic
});
```

---

### 2. ✅ Handle Async Errors

```javascript
users.post('insert', async (context) => {
  try {
    await externalService.notify(context.document);
  } catch (error) {
    console.error('External service notification failed:', error);
    // Don't throw - insert already succeeded
  }
});
```

---

### 3. ✅ Use Pre-hooks for Transformation

```javascript
// Pre-hooks: Modify data before operation
users.pre('insert', (context) => {
  context.document.email = context.document.email.toLowerCase();
  return context;
});
```

---

### 4. ✅ Use Post-hooks for Side Effects

```javascript
// Post-hooks: Side effects after operation
users.post('insert', async (context) => {
  await sendEmail(context.document.email);
  await analytics.track('user_created');
});
```

---

### 5. ✅ Return Context in Pre-hooks

```javascript
// Always return context
users.pre('insert', (context) => {
  context.document.processed = true;
  return context; // ✅ Return context
});

// Don't forget to return
users.pre('insert', (context) => {
  context.document.processed = true;
  // ❌ Missing return
});
```

---

### 6. ❌ Don't Modify Results in Post-hooks

```javascript
// Post-hooks can't modify stored data
users.post('insert', (context) => {
  context.document.extraField = 'value'; // ❌ Won't affect stored document
});
```

---

### 7. ✅ Use Hooks for Cross-cutting Concerns

Perfect for:
- ✅ Logging
- ✅ Timestamps
- ✅ Audit trails
- ✅ Cache invalidation
- ✅ Notifications

Not ideal for:
- ❌ Complex business logic (put in application layer)
- ❌ Heavy computations (consider async jobs)
- ❌ Multiple database queries (can cause N+1 issues)

---

## Debugging Hooks

```javascript
// Add logging to see hook execution
users.pre('insert', (context) => {
  console.log('[PRE-INSERT]', context.document);
  return context;
});

users.post('insert', (context) => {
  console.log('[POST-INSERT]', context.document);
});

// Disable hooks temporarily for testing
// (no built-in way - would need to remove and re-add)
```

---

## Summary

Hooks provide powerful lifecycle integration:

✅ **Pre-hooks** - Transform data before operations
✅ **Post-hooks** - React to completed operations
✅ **Async support** - Use async/await for external calls
✅ **Multiple hooks** - Chain multiple handlers
✅ **Error handling** - Control operation flow

**Common Use Cases:**
- Automatic timestamps
- Data normalization
- Authorization checks
- Audit logging
- Cache invalidation
- Notifications
- Cascade operations

**Quick Reference:**

```javascript
// Pre-hooks (modify before)
collection.pre('insert', (context) => {
  // Modify context.document
  return context;
});

collection.pre('update', (context) => {
  // Modify context.update
  return context;
});

collection.pre('delete', (context) => {
  // Check context.filter
  return context;
});

collection.pre('find', (context) => {
  // Modify context.filter
  return context;
});

// Post-hooks (react after)
collection.post('insert', (context) => {
  // Access context.document
});

collection.post('update', (context) => {
  // Access context.modifiedCount
});

collection.post('delete', (context) => {
  // Access context.deletedCount
});

collection.post('find', (context) => {
  // Access context.results
});
```

Hooks are a powerful feature for clean separation of concerns in your application!
