# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dimond-DB (LocalDB) is a lightweight embedded database engine for Node.js with a MongoDB-like API. All data is persisted locally as JSON files without requiring an external database server.

**Key characteristics:**
- ES Modules only (`"type": "module"` in package.json)
- Node.js >= 14.0.0 required
- Zero external dependencies
- MongoDB-compatible query syntax

## Development Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a single test file
node --test tests/localdb.test.js

# Run demo application
npm run demo

# Pre-publish checks (runs tests)
npm run prepublishOnly
```

## Architecture

The codebase follows a layered architecture with clear separation of concerns:

```
Database (entry point, manages collections)
    ↓
Collection (CRUD operations, document management)
    ↓
StorageEngine (file operations, metadata management)
    ↓
FileStorage (low-level fs operations)

QueryEngine (stateless, handles query matching - used by Collection)
```

### Core Components

**Database (`src/database/Database.js`)**
- Entry point for all database operations
- Manages collection instances (cached in a Map)
- Handles database-level operations (stats, drop, list collections)
- Lazy initialization pattern: `initialize()` called automatically on first operation

**Collection (`src/database/Collection.js`)**
- Represents a collection of documents
- Lazy loads documents from disk on first access (`load()` method)
- Implements MongoDB-like CRUD API (insertOne, find, updateOne, deleteOne, etc.)
- Applies update operators ($set, $unset, $inc, $push)
- Automatically persists changes to disk after mutations

**StorageEngine (`src/engine/StorageEngine.js`)**
- Manages collection files (`.collection` extension) and metadata
- Storage structure: `<rootPath>/<database>/collections/<collection>.collection`
- Maintains metadata.json with database version and collection list
- Collection files are JSON arrays of documents

**QueryEngine (`src/engine/QueryEngine.js`)**
- Stateless class with static methods
- Evaluates query filters against documents
- Supports comparison operators ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists)
- Supports logical operators ($and, $or)
- Handles dot notation for nested field access

**FileStorage (`src/storage/FileStorage.js`)**
- Low-level file system abstraction
- **Atomic writes**: writes to `.tmp` file then renames (prevents corruption)
- All methods are static
- Error handling wraps fs errors in StorageError

### Key Design Patterns

1. **Lazy Loading**: Collections are loaded from disk only when first accessed and cached in memory. The `loaded` flag prevents redundant disk reads.

2. **Automatic Persistence**: Every mutation operation (insert, update, delete) automatically calls `persist()` to save changes to disk.

3. **Deep Cloning**: Documents are deep-cloned on insertion and retrieval to prevent external mutations from affecting stored data.

4. **Atomic Writes**: FileStorage uses write-to-temp-then-rename pattern to prevent partial writes/corruption.

5. **Validation Layer**: `src/utils/validator.js` validates documents, filters, updates, and collection names before processing.

## Storage Structure

```
database/
└── <database-name>/
    ├── metadata.json          # Database metadata (version, collection list, createdAt)
    └── collections/
        ├── users.collection   # JSON array of user documents
        ├── products.collection
        └── orders.collection
```

Each `.collection` file is a JSON array of document objects. Metadata is kept in sync when collections are created/dropped.

## Query Engine Behavior

- **Empty filter**: `{}` or no filter matches all documents
- **Field matching**: Direct equality or operator-based comparison
- **Dot notation**: Supports nested field queries (e.g., `{"user.email": "test@example.com"}`)
- **Multiple operators**: Can combine operators on same field (e.g., `{age: {$gte: 18, $lt: 65}}`)
- **Logical operators**: $and and $or take arrays of condition objects

## Update Operators

All updates MUST use operators (direct replacement is not supported):
- `$set`: Set field values (creates if missing, supports dot notation)
- `$unset`: Remove fields (supports dot notation)
- `$inc`: Increment numeric values (initializes to increment value if field missing)
- `$push`: Add to arrays (creates array with single element if field missing)

## Testing

Tests use Node.js built-in test runner (`node:test`):
- Test files in `tests/` directory
- Uses `describe()` and `it()` for structure
- `before()` and `after()` hooks for setup/cleanup
- Test database created at `test-database/testdb` and cleaned up after

## Error Handling

Custom error hierarchy in `src/errors/DatabaseError.js`:
- `DatabaseError` (base)
- `CollectionNotFoundError`
- `DuplicateKeyError` (duplicate _id)
- `ValidationError` (invalid documents, queries, updates)
- `QueryError` (invalid operators or query syntax)
- `StorageError` (file system errors)
- `DatabaseOperationError`

All errors are exported from main index.js for user error handling.

## Important Constraints

- Documents must be objects (not arrays or primitives)
- Collection names validated (no empty strings, special characters restrictions)
- _id field is auto-generated (UUID v4) if not provided
- _id must be unique within a collection
- Update operations require at least one update operator
- Query operators must start with `$`
