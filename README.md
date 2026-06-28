# LocalDB JS

A lightweight embedded database engine for Node.js with a MongoDB-like API. No external database server required.

## 🚀 Features

- **Zero Configuration** - Works out of the box with no setup required
- **Offline First** - All data stored locally in your project
- **MongoDB-like API** - Familiar syntax for MongoDB users
- **Automatic Persistence** - Data automatically saved to disk
- **Query Operators** - Support for `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$and`, `$or`
- **Update Operators** - Support for `$set`, `$unset`, `$inc`, `$push`
- **Type Safety** - Comprehensive validation and error handling
- **Lightweight** - No external dependencies
- **ES Modules** - Modern JavaScript with async/await

## 📦 Installation

```bash
npm install dimond-db
```

## 🎯 Quick Start

```javascript
import { LocalDB } from 'dimond-db';

// Create database instance
const db = new LocalDB({
    database: 'myDatabase'
});

// Get a collection
const users = db.collection('users');

// Insert a document
await users.insertOne({
    name: 'Arif',
    age: 22,
    email: 'arif@example.com'
});

// Find documents
const allUsers = await users.find();
console.log(allUsers);

// Find with query
const adults = await users.find({ age: { $gte: 18 } });
console.log(adults);
```

## 📚 API Reference

### Database

#### Constructor

```javascript
const db = new LocalDB({
    database: 'databaseName',  // required
    path: './database'          // optional, defaults to './database'
});
```

#### Methods

- `db.collection(name)` - Get or create a collection
- `db.listCollections()` - List all collections
- `db.dropDatabase()` - Drop the entire database
- `db.close()` - Close database connection
- `db.stats()` - Get database statistics

### Collection

#### Insert Operations

**insertOne(document)**
```javascript
const result = await users.insertOne({
    name: 'Ali',
    age: 25
});
// Returns: { acknowledged: true, insertedId: 'generated-uuid' }
```

**insertMany(documents)**
```javascript
const result = await users.insertMany([
    { name: 'Sara', age: 28 },
    { name: 'Ahmed', age: 30 }
]);
// Returns: { acknowledged: true, insertedCount: 2, insertedIds: [...] }
```

#### Find Operations

**find(filter)**
```javascript
// Find all
const all = await users.find();

// Find with filter
const adults = await users.find({ age: { $gte: 18 } });

// Find with multiple conditions
const result = await users.find({
    age: { $gte: 18, $lt: 65 },
    status: 'active'
});
```

**findOne(filter)**
```javascript
const user = await users.findOne({ name: 'Arif' });
// Returns: document or null
```

#### Update Operations

**updateOne(filter, update)**
```javascript
await users.updateOne(
    { name: 'Arif' },
    { $set: { age: 23, city: 'Karachi' } }
);
// Returns: { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
```

**updateMany(filter, update)**
```javascript
await users.updateMany(
    { status: 'inactive' },
    { $set: { status: 'active' } }
);
```

#### Delete Operations

**deleteOne(filter)**
```javascript
await users.deleteOne({ name: 'Arif' });
// Returns: { acknowledged: true, deletedCount: 1 }
```

**deleteMany(filter)**
```javascript
await users.deleteMany({ age: { $lt: 18 } });
```

#### Other Operations

**countDocuments(filter)**
```javascript
const count = await users.countDocuments({ age: { $gte: 18 } });
```

**drop()**
```javascript
await users.drop();
```

## 🔍 Query Operators

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equal to | `{ age: { $eq: 25 } }` |
| `$ne` | Not equal to | `{ status: { $ne: 'inactive' } }` |
| `$gt` | Greater than | `{ age: { $gt: 18 } }` |
| `$gte` | Greater than or equal | `{ age: { $gte: 18 } }` |
| `$lt` | Less than | `{ age: { $lt: 65 } }` |
| `$lte` | Less than or equal | `{ age: { $lte: 65 } }` |
| `$in` | In array | `{ status: { $in: ['active', 'pending'] } }` |
| `$nin` | Not in array | `{ status: { $nin: ['banned', 'deleted'] } }` |
| `$exists` | Field exists | `{ email: { $exists: true } }` |

### Logical Operators

**$and**
```javascript
await users.find({
    $and: [
        { age: { $gte: 18 } },
        { age: { $lte: 65 } }
    ]
});
```

**$or**
```javascript
await users.find({
    $or: [
        { status: 'premium' },
        { age: { $gte: 65 } }
    ]
});
```

## 🔧 Update Operators

### $set
Set field values
```javascript
await users.updateOne(
    { name: 'Arif' },
    { $set: { age: 23, city: 'Karachi' } }
);
```

### $unset
Remove fields
```javascript
await users.updateOne(
    { name: 'Arif' },
    { $unset: { tempField: '' } }
);
```

### $inc
Increment numeric values
```javascript
await users.updateOne(
    { name: 'Arif' },
    { $inc: { loginCount: 1 } }
);
```

### $push
Add to array
```javascript
await users.updateOne(
    { name: 'Arif' },
    { $push: { tags: 'developer' } }
);
```

## 📁 Storage Structure

LocalDB automatically creates this structure:

```
your-project/
└── database/
    └── myDatabase/
        ├── metadata.json
        └── collections/
            ├── users.collection
            ├── products.collection
            └── orders.collection
```

Each collection is stored as a JSON file with automatic persistence.

## 🎨 Complete Example

```javascript
import { LocalDB } from 'dimond-db';

const db = new LocalDB({ database: 'shop' });
const products = db.collection('products');

// Insert products
await products.insertMany([
    { name: 'Laptop', price: 999, category: 'electronics', stock: 50 },
    { name: 'Mouse', price: 25, category: 'electronics', stock: 200 },
    { name: 'Desk', price: 300, category: 'furniture', stock: 30 }
]);

// Find expensive products
const expensive = await products.find({
    price: { $gte: 500 }
});

// Update stock
await products.updateOne(
    { name: 'Laptop' },
    { $inc: { stock: -1 } }
);

// Find by category
const electronics = await products.find({
    category: 'electronics',
    stock: { $gt: 0 }
});

// Count products
const totalProducts = await products.countDocuments();

// Get database stats
const stats = await db.stats();
console.log(stats);
```

## 🛡️ Error Handling

LocalDB provides specific error types for better error handling:

```javascript
import { 
    LocalDB,
    DuplicateKeyError,
    ValidationError,
    QueryError,
    StorageError
} from 'dimond-db';

try {
    await users.insertOne({ _id: 'duplicate-id' });
} catch (error) {
    if (error instanceof DuplicateKeyError) {
        console.log('Document with this ID already exists');
    }
}
```

## ⚡ Performance Tips

1. **Batch Inserts** - Use `insertMany()` instead of multiple `insertOne()` calls
2. **Selective Queries** - Use specific filters to reduce memory usage
3. **Regular Cleanup** - Remove old/unused documents periodically
4. **Collection Size** - Keep collections reasonably sized (< 10,000 documents recommended)

## 🔐 Data Validation

LocalDB validates:
- Document structure (must be objects, not arrays or primitives)
- Duplicate `_id` values
- Query syntax
- Update operators
- Collection names

## 📋 Requirements

- Node.js >= 14.0.0
- ES Modules support

## 🗺️ Roadmap

Future versions may include:
- Indexing for faster queries
- Transactions
- Aggregation pipeline
- Schema validation
- Backup/restore utilities
- Replication support

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

**LocalDB JS** - Built with ❤️ for developers who need a simple, embedded database solution.
