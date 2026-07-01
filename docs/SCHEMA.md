# Schema Validation Guide

Complete guide to schema validation in Dimond-DB v2.

## Overview

Schema validation ensures data integrity by validating documents before they're inserted or updated. It provides runtime type checking, required field enforcement, and custom constraints.

**Benefits:**
- ✅ Data consistency across your application
- ✅ Catch errors early before bad data is stored
- ✅ Document your data structure
- ✅ Reduce validation code in your application
- ✅ Automatic unique index creation

## Creating Collections with Schema

### Basic Syntax

```javascript
const collection = db.createCollection(name, { schema });
```

### Example

```javascript
const users = db.createCollection('users', {
  schema: {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    age: { type: Number, min: 0, max: 150 },
    status: { type: String, enum: ['active', 'inactive', 'suspended'] },
    createdAt: { type: Date, default: () => new Date() }
  }
});
```

---

## Field Types

### String

```javascript
{
  name: { type: String }
}
```

**Constraints:**
- `required` (boolean) - Field is required
- `minLength` (number) - Minimum string length
- `maxLength` (number) - Maximum string length
- `match` (RegExp) - Must match regex pattern
- `enum` (array) - Must be one of specified values
- `unique` (boolean) - Must be unique across collection
- `default` (value or function) - Default value

**Examples:**

```javascript
{
  // Required string
  username: { 
    type: String, 
    required: true,
    minLength: 3,
    maxLength: 20
  },
  
  // Email with pattern
  email: { 
    type: String, 
    required: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    unique: true
  },
  
  // Enum
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'deleted'],
    default: 'active'
  },
  
  // Optional with default
  role: { 
    type: String, 
    default: 'user' 
  }
}
```

---

### Number

```javascript
{
  age: { type: Number }
}
```

**Constraints:**
- `required` (boolean) - Field is required
- `min` (number) - Minimum value
- `max` (number) - Maximum value
- `integer` (boolean) - Must be integer (no decimals)
- `default` (value or function) - Default value

**Examples:**

```javascript
{
  // Age with range
  age: { 
    type: Number, 
    required: true,
    min: 0,
    max: 150
  },
  
  // Price with decimals
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  // Count (integer only)
  views: { 
    type: Number, 
    integer: true,
    min: 0,
    default: 0
  },
  
  // Score with range
  rating: { 
    type: Number,
    min: 1,
    max: 5
  }
}
```

---

### Boolean

```javascript
{
  isActive: { type: Boolean }
}
```

**Constraints:**
- `required` (boolean) - Field is required
- `default` (value or function) - Default value

**Examples:**

```javascript
{
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  emailVerified: { 
    type: Boolean, 
    required: true,
    default: false 
  },
  
  isAdmin: { 
    type: Boolean, 
    default: false 
  }
}
```

---

### Date

```javascript
{
  createdAt: { type: Date }
}
```

**Constraints:**
- `required` (boolean) - Field is required
- `min` (Date) - Minimum date
- `max` (Date) - Maximum date
- `default` (value or function) - Default value

**Examples:**

```javascript
{
  // Auto-timestamp
  createdAt: { 
    type: Date, 
    default: () => new Date() 
  },
  
  updatedAt: { 
    type: Date,
    default: () => new Date()
  },
  
  // Birthday with range
  birthDate: { 
    type: Date,
    max: new Date() // Can't be in future
  },
  
  // Expiry date
  expiresAt: { 
    type: Date,
    min: new Date() // Must be in future
  }
}
```

---

### Array

```javascript
{
  tags: { type: Array }
}
```

**Constraints:**
- `required` (boolean) - Field is required
- `minLength` (number) - Minimum array length
- `maxLength` (number) - Maximum array length
- `default` (value or function) - Default value

**Examples:**

```javascript
{
  // Array of tags
  tags: { 
    type: Array,
    default: []
  },
  
  // Array with size limits
  skills: { 
    type: Array,
    minLength: 1,
    maxLength: 10
  },
  
  // Required array
  roles: { 
    type: Array,
    required: true,
    minLength: 1
  }
}
```

---

### Object

```javascript
{
  address: { type: Object }
}
```

**Constraints:**
- `required` (boolean) - Field is required
- `default` (value or function) - Default value

**Examples:**

```javascript
{
  // Nested object
  address: { 
    type: Object,
    required: true
  },
  
  // Optional metadata
  metadata: { 
    type: Object,
    default: {}
  },
  
  // Settings object
  settings: { 
    type: Object,
    default: () => ({
      theme: 'light',
      notifications: true
    })
  }
}
```

**Note:** Currently, Dimond-DB doesn't validate nested object structure. This is planned for future versions.

---

## Validation Rules

### Required Fields

```javascript
{
  name: { type: String, required: true },
  email: { type: String, required: true }
}
```

**Behavior:**
- Field must exist in document
- Field cannot be `null` or `undefined`
- Empty string `""` is valid (use `minLength` to prevent)

---

### Default Values

```javascript
{
  // Static default
  status: { type: String, default: 'active' },
  
  // Function default (called on each insert)
  createdAt: { type: Date, default: () => new Date() },
  
  // Complex default
  metadata: { 
    type: Object, 
    default: () => ({ views: 0, likes: 0 }) 
  }
}
```

**Behavior:**
- Applied when field is missing (not when `null`)
- Functions are called at insert time
- Use functions for dynamic values (dates, IDs, etc.)

---

### Unique Constraints

```javascript
{
  email: { type: String, unique: true },
  username: { type: String, unique: true }
}
```

**Behavior:**
- Automatically creates unique index (if `autoIndex: true`)
- Throws `DuplicateKeyError` on violation
- Only one `null` value allowed (use `sparse` for multiple)

**Configuration:**

```javascript
const db = new LocalDB({
  database: 'myapp',
  autoIndex: true, // Enable automatic index creation
  strictSchema: true
});
```

---

### Enum Validation

```javascript
{
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'pending', 'deleted'] 
  },
  
  role: { 
    type: String, 
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  }
}
```

**Behavior:**
- Value must be one of the enum values
- Case-sensitive
- Throws `SchemaValidationError` on invalid value

---

### Pattern Matching

```javascript
{
  email: { 
    type: String,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
  },
  
  phone: { 
    type: String,
    match: /^\+?[\d\s-()]+$/ 
  },
  
  zipCode: { 
    type: String,
    match: /^\d{5}(-\d{4})?$/ 
  }
}
```

**Behavior:**
- Tests value against regex
- Only for String type
- Throws `SchemaValidationError` if no match

---

## Complete Examples

### User Schema

```javascript
const users = db.createCollection('users', {
  schema: {
    // Identity
    username: { 
      type: String, 
      required: true,
      unique: true,
      minLength: 3,
      maxLength: 20,
      match: /^[a-zA-Z0-9_]+$/
    },
    
    email: { 
      type: String, 
      required: true,
      unique: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    
    // Profile
    firstName: { 
      type: String, 
      required: true,
      minLength: 2,
      maxLength: 50
    },
    
    lastName: { 
      type: String, 
      required: true,
      minLength: 2,
      maxLength: 50
    },
    
    age: { 
      type: Number,
      min: 13,
      max: 120,
      integer: true
    },
    
    // Status
    status: { 
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
    },
    
    role: { 
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user'
    },
    
    emailVerified: { 
      type: Boolean,
      default: false
    },
    
    // Metadata
    createdAt: { 
      type: Date,
      default: () => new Date()
    },
    
    lastLogin: { 
      type: Date 
    },
    
    tags: { 
      type: Array,
      default: []
    },
    
    settings: { 
      type: Object,
      default: () => ({
        theme: 'light',
        notifications: true
      })
    }
  }
});
```

---

### Product Schema

```javascript
const products = db.createCollection('products', {
  schema: {
    // Identity
    sku: { 
      type: String, 
      required: true,
      unique: true,
      match: /^[A-Z0-9-]+$/
    },
    
    name: { 
      type: String, 
      required: true,
      minLength: 3,
      maxLength: 200
    },
    
    description: { 
      type: String,
      maxLength: 2000
    },
    
    // Classification
    category: { 
      type: String,
      required: true,
      enum: ['electronics', 'clothing', 'food', 'books', 'other']
    },
    
    tags: { 
      type: Array,
      default: []
    },
    
    // Pricing
    price: { 
      type: Number,
      required: true,
      min: 0
    },
    
    currency: { 
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP']
    },
    
    // Inventory
    stock: { 
      type: Number,
      required: true,
      min: 0,
      integer: true,
      default: 0
    },
    
    inStock: { 
      type: Boolean,
      default: true
    },
    
    // Status
    status: { 
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },
    
    // Timestamps
    createdAt: { 
      type: Date,
      default: () => new Date()
    },
    
    updatedAt: { 
      type: Date,
      default: () => new Date()
    }
  }
});
```

---

### Blog Post Schema

```javascript
const posts = db.createCollection('posts', {
  schema: {
    title: { 
      type: String, 
      required: true,
      minLength: 5,
      maxLength: 200
    },
    
    slug: { 
      type: String,
      required: true,
      unique: true,
      match: /^[a-z0-9-]+$/
    },
    
    content: { 
      type: String,
      required: true,
      minLength: 10
    },
    
    excerpt: { 
      type: String,
      maxLength: 500
    },
    
    authorId: { 
      type: String,
      required: true
    },
    
    status: { 
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },
    
    published: { 
      type: Boolean,
      default: false
    },
    
    publishedAt: { 
      type: Date
    },
    
    tags: { 
      type: Array,
      maxLength: 10,
      default: []
    },
    
    views: { 
      type: Number,
      min: 0,
      integer: true,
      default: 0
    },
    
    likes: { 
      type: Number,
      min: 0,
      integer: true,
      default: 0
    },
    
    createdAt: { 
      type: Date,
      default: () => new Date()
    },
    
    updatedAt: { 
      type: Date,
      default: () => new Date()
    }
  }
});
```

---

## Using Schema Collections

### Insert Operations

```javascript
// Valid document
await users.insertOne({
  username: 'john_doe',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  age: 30
});
// ✅ Success - all required fields present, types correct

// Invalid: missing required field
await users.insertOne({
  username: 'jane_doe',
  email: 'jane@example.com'
  // ❌ Missing firstName, lastName
});
// Throws: SchemaValidationError

// Invalid: wrong type
await users.insertOne({
  username: 'bob',
  email: 'bob@example.com',
  firstName: 'Bob',
  lastName: 'Smith',
  age: '30' // ❌ String instead of Number
});
// Throws: SchemaValidationError

// Invalid: constraint violation
await users.insertOne({
  username: 'ab', // ❌ Too short (minLength: 3)
  email: 'invalid-email', // ❌ Doesn't match pattern
  firstName: 'Alice',
  lastName: 'Johnson',
  age: 200 // ❌ Exceeds max (150)
});
// Throws: SchemaValidationError
```

---

### Update Operations

Schema validation also applies to updates:

```javascript
// Valid update
await users.updateOne(
  { username: 'john_doe' },
  { $set: { age: 31, lastLogin: new Date() } }
);
// ✅ Success

// Invalid: wrong type
await users.updateOne(
  { username: 'john_doe' },
  { $set: { age: '31' } } // ❌ String instead of Number
);
// Throws: SchemaValidationError

// Invalid: constraint violation
await users.updateOne(
  { username: 'john_doe' },
  { $set: { status: 'banned' } } // ❌ Not in enum
);
// Throws: SchemaValidationError
```

---

## Setting Schema on Existing Collections

```javascript
const users = db.collection('users');

users.setSchema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number, min: 0 }
});

// Now all inserts/updates will be validated
```

**Note:** Setting schema doesn't validate existing documents. Only new inserts and updates are validated.

---

## Error Handling

```javascript
import { SchemaValidationError } from 'dimond-db';

try {
  await users.insertOne({
    username: 'test',
    email: 'invalid'
  });
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.error('Validation failed:', error.message);
    // "email: Value does not match required pattern"
  }
}
```

**Error Messages:**

- `Field 'name' is required`
- `Field 'age' must be of type Number`
- `Field 'age' must be at least 0`
- `Field 'age' must be at most 150`
- `Field 'username' must be at least 3 characters`
- `Field 'email' does not match required pattern`
- `Field 'status' must be one of: active, inactive, deleted`
- `Duplicate value for unique field 'email'`

---

## Configuration

### Strict Mode

```javascript
const db = new LocalDB({
  database: 'myapp',
  strictSchema: true // Enforce schema strictly
});
```

**With `strictSchema: true`:**
- Unknown fields are rejected
- All schema rules strictly enforced

**With `strictSchema: false`:**
- Unknown fields are allowed
- Only defined fields are validated

---

### Auto-Index

```javascript
const db = new LocalDB({
  database: 'myapp',
  autoIndex: true // Auto-create indexes for unique fields
});
```

When enabled, unique fields automatically get indexes created.

---

## Best Practices

### 1. ✅ Define Schema Early

```javascript
// Good: Define schema when creating collection
const users = db.createCollection('users', { schema: {...} });

// Okay: Set schema on existing collection
const users = db.collection('users');
users.setSchema({...});
```

---

### 2. ✅ Use Descriptive Constraints

```javascript
// Good: Clear constraints
{
  age: { 
    type: Number,
    min: 18,
    max: 120,
    integer: true
  }
}

// Bad: No constraints
{
  age: { type: Number }
}
```

---

### 3. ✅ Use Enums for Fixed Values

```javascript
// Good: Enum prevents typos
{
  status: { 
    type: String,
    enum: ['active', 'inactive', 'deleted']
  }
}

// Bad: No validation
{
  status: { type: String }
}
```

---

### 4. ✅ Set Sensible Defaults

```javascript
{
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: () => new Date() },
  views: { type: Number, default: 0 }
}
```

---

### 5. ✅ Use Unique Constraints

```javascript
{
  email: { type: String, unique: true },
  username: { type: String, unique: true }
}
```

Better than application-level uniqueness checks.

---

### 6. ✅ Validate Formats with Regex

```javascript
{
  email: { 
    type: String,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
  },
  
  phone: { 
    type: String,
    match: /^\+?[\d\s-()]+$/ 
  }
}
```

---

## Limitations

Current limitations (to be addressed in future versions):

1. **No nested object validation** - Object fields aren't recursively validated
2. **No custom validators** - Can't add custom validation functions
3. **No cross-field validation** - Can't validate one field based on another
4. **No conditional validation** - Can't make validation conditional
5. **No array item validation** - Array items aren't type-checked

---

## Future Enhancements (V3 Roadmap)

Planned features:

- Nested object schema validation
- Custom validator functions
- Cross-field validation
- Conditional validation rules
- Array item type validation
- Schema migrations
- Schema versioning

---

## Summary

Schema validation provides:

✅ **Type safety** - Enforce field types
✅ **Data integrity** - Required fields, constraints
✅ **Consistency** - Same structure across documents
✅ **Early error detection** - Catch bad data before storage
✅ **Documentation** - Schema documents your data model

**Quick Reference:**

```javascript
const collection = db.createCollection('name', {
  schema: {
    stringField: { 
      type: String, 
      required: true,
      minLength: 3,
      maxLength: 100,
      match: /pattern/,
      enum: ['val1', 'val2'],
      unique: true,
      default: 'value'
    },
    numberField: { 
      type: Number,
      min: 0,
      max: 100,
      integer: true,
      default: 0
    },
    boolField: { 
      type: Boolean,
      default: false
    },
    dateField: { 
      type: Date,
      default: () => new Date()
    },
    arrayField: { 
      type: Array,
      minLength: 1,
      maxLength: 10,
      default: []
    },
    objectField: { 
      type: Object,
      default: {}
    }
  }
});
```

Schema validation is a key feature for building reliable applications with Dimond-DB v2!
