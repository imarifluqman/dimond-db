# Transactions Guide

Complete guide to using transactions in Dimond-DB v2.

## Overview

Transactions provide ACID guarantees for multi-document operations. They ensure that a series of operations either all succeed or all fail together, maintaining data consistency.

**ACID Properties:**
- **Atomicity** - All operations succeed or all fail
- **Consistency** - Data remains in valid state
- **Isolation** - Concurrent transactions don't interfere
- **Durability** - Committed changes persist (via Write-Ahead Log)

## Why Use Transactions?

Transactions are essential when multiple operations must succeed together:

- **Bank transfers** - Debit one account, credit another
- **Order processing** - Create order, update inventory, charge payment
- **User registration** - Create user, create profile, send welcome email
- **Data migrations** - Multiple related updates
- **Referential integrity** - Maintain relationships between collections

## Basic Usage

### Starting a Transaction

```javascript
const session = db.startSession();
await session.startTransaction();
```

---

### Committing a Transaction

```javascript
await session.commit();
```

Applies all operations permanently.

---

### Aborting a Transaction

```javascript
await session.abort();
```

Rolls back all operations.

---

## Complete Example

```javascript
const accounts = db.collection('accounts');
const transactions = db.collection('transactions');

// Start session
const session = db.startSession();
await session.startTransaction();

try {
  // Debit sender
  await accounts.updateOne(
    { accountId: 'A123' },
    { $inc: { balance: -100 } },
    session
  );
  
  // Credit receiver
  await accounts.updateOne(
    { accountId: 'B456' },
    { $inc: { balance: 100 } },
    session
  );
  
  // Log transaction
  await transactions.insertOne({
    from: 'A123',
    to: 'B456',
    amount: 100,
    timestamp: new Date()
  }, session);
  
  // All succeeded - commit
  await session.commit();
  console.log('Transfer completed successfully');
  
} catch (error) {
  // Something failed - rollback
  await session.abort();
  console.error('Transfer failed, rolled back:', error);
  throw error;
}
```

---

## Transaction Operations

All collection methods support transactions by passing the session as the last parameter:

### Insert Operations

```javascript
await collection.insertOne(document, session);
await collection.insertMany(documents, session);
```

---

### Update Operations

```javascript
await collection.updateOne(filter, update, session);
await collection.updateMany(filter, update, session);
```

---

### Delete Operations

```javascript
await collection.deleteOne(filter, session);
await collection.deleteMany(filter, update, session);
```

---

### Find Operations

```javascript
// Find operations don't typically need transactions
// but they respect transactional state
const results = await collection.find(filter);
```

---

## Transaction Patterns

### Pattern 1: Transfer Between Documents

```javascript
async function transferBalance(fromId, toId, amount) {
  const session = db.startSession();
  await session.startTransaction();
  
  try {
    const accounts = db.collection('accounts');
    
    // Check source balance
    const fromAccount = await accounts.findOne({ _id: fromId });
    if (fromAccount.balance < amount) {
      throw new Error('Insufficient balance');
    }
    
    // Debit source
    await accounts.updateOne(
      { _id: fromId },
      { $inc: { balance: -amount } },
      session
    );
    
    // Credit destination
    await accounts.updateOne(
      { _id: toId },
      { $inc: { balance: amount } },
      session
    );
    
    await session.commit();
    return { success: true };
    
  } catch (error) {
    await session.abort();
    return { success: false, error: error.message };
  }
}
```

---

### Pattern 2: Create Related Documents

```javascript
async function createUserWithProfile(userData, profileData) {
  const session = db.startSession();
  await session.startTransaction();
  
  try {
    const users = db.collection('users');
    const profiles = db.collection('profiles');
    
    // Create user
    const userResult = await users.insertOne(userData, session);
    const userId = userResult.insertedId;
    
    // Create profile with user reference
    await profiles.insertOne({
      ...profileData,
      userId
    }, session);
    
    await session.commit();
    return { success: true, userId };
    
  } catch (error) {
    await session.abort();
    return { success: false, error: error.message };
  }
}
```

---

### Pattern 3: Update Multiple Collections

```javascript
async function processOrder(order) {
  const session = db.startSession();
  await session.startTransaction();
  
  try {
    const orders = db.collection('orders');
    const inventory = db.collection('inventory');
    const customers = db.collection('customers');
    
    // Create order
    const orderResult = await orders.insertOne(order, session);
    
    // Update inventory
    for (const item of order.items) {
      await inventory.updateOne(
        { productId: item.productId },
        { $inc: { stock: -item.quantity } },
        session
      );
    }
    
    // Update customer order count
    await customers.updateOne(
      { _id: order.customerId },
      { $inc: { orderCount: 1 } },
      session
    );
    
    await session.commit();
    return { success: true, orderId: orderResult.insertedId };
    
  } catch (error) {
    await session.abort();
    return { success: false, error: error.message };
  }
}
```

---

### Pattern 4: Conditional Operations

```javascript
async function reserveProduct(userId, productId, quantity) {
  const session = db.startSession();
  await session.startTransaction();
  
  try {
    const inventory = db.collection('inventory');
    const reservations = db.collection('reservations');
    
    // Check availability
    const product = await inventory.findOne({ _id: productId });
    
    if (product.available < quantity) {
      throw new Error('Not enough stock available');
    }
    
    // Reserve inventory
    await inventory.updateOne(
      { _id: productId },
      { 
        $inc: { 
          available: -quantity,
          reserved: quantity
        }
      },
      session
    );
    
    // Create reservation
    await reservations.insertOne({
      userId,
      productId,
      quantity,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    }, session);
    
    await session.commit();
    return { success: true };
    
  } catch (error) {
    await session.abort();
    return { success: false, error: error.message };
  }
}
```

---

### Pattern 5: Batch Updates with Validation

```javascript
async function bulkUpdatePrices(updates) {
  const session = db.startSession();
  await session.startTransaction();
  
  try {
    const products = db.collection('products');
    const priceHistory = db.collection('price_history');
    
    for (const update of updates) {
      // Get current price
      const product = await products.findOne({ _id: update.productId });
      
      // Validate price change
      if (update.newPrice < 0) {
        throw new Error(`Invalid price for ${update.productId}`);
      }
      
      // Update product price
      await products.updateOne(
        { _id: update.productId },
        { $set: { price: update.newPrice } },
        session
      );
      
      // Log price change
      await priceHistory.insertOne({
        productId: update.productId,
        oldPrice: product.price,
        newPrice: update.newPrice,
        timestamp: new Date()
      }, session);
    }
    
    await session.commit();
    return { success: true, updated: updates.length };
    
  } catch (error) {
    await session.abort();
    return { success: false, error: error.message };
  }
}
```

---

## Error Handling

### Try-Catch Pattern

Always use try-catch with transactions:

```javascript
const session = db.startSession();
await session.startTransaction();

try {
  // Operations
  await collection.updateOne({...}, {...}, session);
  await session.commit();
} catch (error) {
  await session.abort();
  throw error;
}
```

---

### Validation Errors

```javascript
try {
  await session.startTransaction();
  
  const result = await accounts.updateOne(
    { _id: 'account-1' },
    { $inc: { balance: -amount } },
    session
  );
  
  if (result.modifiedCount === 0) {
    throw new Error('Account not found');
  }
  
  await session.commit();
} catch (error) {
  await session.abort();
  
  if (error.name === 'ValidationError') {
    console.error('Validation failed:', error.message);
  } else {
    console.error('Transaction failed:', error.message);
  }
}
```

---

### Rollback on Business Logic Failures

```javascript
const session = db.startSession();
await session.startTransaction();

try {
  const account = await accounts.findOne({ _id: accountId });
  
  // Business logic check
  if (account.balance < withdrawAmount) {
    throw new Error('Insufficient funds');
  }
  
  if (account.status === 'frozen') {
    throw new Error('Account is frozen');
  }
  
  // All checks passed - proceed
  await accounts.updateOne(
    { _id: accountId },
    { $inc: { balance: -withdrawAmount } },
    session
  );
  
  await session.commit();
  
} catch (error) {
  await session.abort();
  throw error; // Propagate to caller
}
```

---

## Write-Ahead Logging (WAL)

Transactions use Write-Ahead Logging for durability.

### How WAL Works

1. **Operation starts** - Write to WAL file first
2. **Execute operation** - Modify collection
3. **Commit** - Mark WAL entry as complete, remove log
4. **Abort** - Read WAL, undo operations, remove log

### Crash Recovery

If the database crashes mid-transaction:

1. On restart, WAL files are checked
2. Incomplete transactions are rolled back
3. Database is restored to consistent state

### Configuration

```javascript
const db = new LocalDB({
  database: 'myapp',
  journal: true // Enable WAL (recommended for transactions)
});
```

---

## Transaction Isolation

Dimond-DB provides **serializable isolation** (highest level):

- Transactions execute as if they ran one after another
- No dirty reads
- No phantom reads
- No write conflicts

**Example:**

```javascript
// Transaction 1
const session1 = db.startSession();
await session1.startTransaction();
await accounts.updateOne({ _id: 'A' }, { $inc: { balance: 100 } }, session1);
// Not yet committed

// Transaction 2 (concurrent)
const session2 = db.startSession();
await session2.startTransaction();
const account = await accounts.findOne({ _id: 'A' });
// Sees state BEFORE transaction 1

await session1.commit(); // Now visible
```

---

## Performance Considerations

### Transaction Overhead

Transactions add overhead:
- WAL file writes
- Memory for operation queue
- Lock management

**Cost:** ~10-30% slower than non-transactional operations

---

### When to Use Transactions

✅ **Use transactions for:**
- Multi-document operations that must succeed together
- Operations requiring atomicity
- Critical business logic (money, inventory, etc.)

❌ **Don't use transactions for:**
- Single document operations (already atomic)
- Read-only operations
- Independent operations that can fail separately
- High-throughput write operations

---

### Batch Size

Large transactions consume memory:

```javascript
// Bad: Huge transaction
await session.startTransaction();
for (let i = 0; i < 100000; i++) {
  await collection.insertOne({...}, session);
}
await session.commit();

// Good: Batch transactions
for (let batch = 0; batch < 1000; batch++) {
  const session = db.startSession();
  await session.startTransaction();
  
  for (let i = 0; i < 100; i++) {
    await collection.insertOne({...}, session);
  }
  
  await session.commit();
}
```

---

## Best Practices

### 1. ✅ Keep Transactions Short

```javascript
// Good: Quick transaction
await session.startTransaction();
await accounts.updateOne({...}, {...}, session);
await session.commit();

// Bad: Long-running transaction
await session.startTransaction();
await slowExternalAPICall(); // ❌ Don't do this
await accounts.updateOne({...}, {...}, session);
await session.commit();
```

---

### 2. ✅ Always Use Try-Catch

```javascript
// ✅ Always wrap in try-catch
try {
  await session.startTransaction();
  // operations
  await session.commit();
} catch (error) {
  await session.abort();
  throw error;
}
```

---

### 3. ✅ Validate Before Transaction

```javascript
// Good: Validate first
const account = await accounts.findOne({ _id: accountId });
if (account.balance < amount) {
  throw new Error('Insufficient funds');
}

// Then execute transaction
await session.startTransaction();
await accounts.updateOne({...}, {...}, session);
await session.commit();
```

---

### 4. ✅ Use Specific Error Messages

```javascript
try {
  await session.startTransaction();
  // operations
  await session.commit();
} catch (error) {
  await session.abort();
  
  if (error.message.includes('balance')) {
    throw new Error('Insufficient funds for transfer');
  } else if (error.name === 'ValidationError') {
    throw new Error('Invalid account data');
  } else {
    throw new Error('Transaction failed: ' + error.message);
  }
}
```

---

### 5. ✅ Order Operations Logically

```javascript
// Good: Check, then modify
await session.startTransaction();
const account = await accounts.findOne({ _id: accountId });
if (account) {
  await accounts.updateOne({...}, {...}, session);
}
await session.commit();
```

---

### 6. ❌ Don't Nest Transactions

```javascript
// ❌ Bad: Nested transactions not supported
await session1.startTransaction();
  await session2.startTransaction(); // Error!
  await session2.commit();
await session1.commit();

// ✅ Good: Sequential transactions
await session.startTransaction();
// operations
await session.commit();

await session2.startTransaction();
// operations
await session2.commit();
```

---

### 7. ❌ Don't Hold Sessions Long-Term

```javascript
// ❌ Bad: Session held too long
const session = db.startSession();
await session.startTransaction();
await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
await session.commit();

// ✅ Good: Quick transactions
const session = db.startSession();
await session.startTransaction();
await accounts.updateOne({...}, {...}, session);
await session.commit();
```

---

## Real-World Examples

### E-commerce Checkout

```javascript
async function processCheckout(cart, payment) {
  const session = db.startSession();
  await session.startTransaction();
  
  try {
    const orders = db.collection('orders');
    const inventory = db.collection('inventory');
    const customers = db.collection('customers');
    
    // Verify stock for all items
    for (const item of cart.items) {
      const product = await inventory.findOne({ _id: item.productId });
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
    }
    
    // Create order
    const order = await orders.insertOne({
      customerId: cart.customerId,
      items: cart.items,
      total: cart.total,
      status: 'pending',
      createdAt: new Date()
    }, session);
    
    // Deduct inventory
    for (const item of cart.items) {
      await inventory.updateOne(
        { _id: item.productId },
        { $inc: { stock: -item.quantity } },
        session
      );
    }
    
    // Update customer
    await customers.updateOne(
      { _id: cart.customerId },
      { 
        $inc: { totalOrders: 1 },
        $set: { lastOrderAt: new Date() }
      },
      session
    );
    
    await session.commit();
    return { success: true, orderId: order.insertedId };
    
  } catch (error) {
    await session.abort();
    return { success: false, error: error.message };
  }
}
```

---

### User Registration with Profile

```javascript
async function registerUser(userData) {
  const session = db.startSession();
  await session.startTransaction();
  
  try {
    const users = db.collection('users');
    const profiles = db.collection('profiles');
    const settings = db.collection('settings');
    
    // Check if email exists
    const existing = await users.findOne({ email: userData.email });
    if (existing) {
      throw new Error('Email already registered');
    }
    
    // Create user
    const user = await users.insertOne({
      email: userData.email,
      password: hashPassword(userData.password),
      createdAt: new Date()
    }, session);
    
    // Create profile
    await profiles.insertOne({
      userId: user.insertedId,
      name: userData.name,
      bio: '',
      avatar: null
    }, session);
    
    // Create default settings
    await settings.insertOne({
      userId: user.insertedId,
      theme: 'light',
      notifications: true,
      language: 'en'
    }, session);
    
    await session.commit();
    return { success: true, userId: user.insertedId };
    
  } catch (error) {
    await session.abort();
    return { success: false, error: error.message };
  }
}
```

---

## Troubleshooting

### Transaction Takes Too Long

**Problem:** Transaction times out or slows down

**Solutions:**
- Break into smaller transactions
- Move non-critical operations outside transaction
- Validate before starting transaction
- Use batch processing

---

### Transaction Fails Unexpectedly

**Problem:** Random transaction failures

**Solutions:**
- Check WAL is enabled (`journal: true`)
- Verify disk space available
- Check for concurrent operations
- Add better error logging

---

### Rollback Doesn't Work

**Problem:** Data not rolled back after abort

**Solutions:**
- Ensure `await session.abort()` is called
- Check WAL files exist and are writable
- Verify session is passed to all operations

---

## Summary

Transactions provide ACID guarantees for multi-document operations:

✅ **Atomicity** - All or nothing
✅ **Consistency** - Valid state maintained
✅ **Isolation** - No interference between transactions
✅ **Durability** - Changes persist (via WAL)

**Key Points:**
- Use for operations that must succeed together
- Always use try-catch
- Keep transactions short
- Enable WAL for durability
- Validate before transacting

**Quick Reference:**

```javascript
const session = db.startSession();
await session.startTransaction();

try {
  await collection.insertOne(doc, session);
  await collection.updateOne(filter, update, session);
  await collection.deleteOne(filter, session);
  
  await session.commit();
} catch (error) {
  await session.abort();
  throw error;
}
```

Transactions are essential for maintaining data integrity in complex operations!
