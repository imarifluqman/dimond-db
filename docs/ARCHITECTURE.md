# Architecture Guide

Technical architecture documentation for Dimond-DB (LocalDB) Version 2.

## Overview

Dimond-DB is a lightweight embedded database engine built with a layered architecture that separates concerns and provides extensibility for future enhancements.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│                  (User Code / API Consumers)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                      Database API                            │
│              (Database, Collection, Cursor)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
┌──────────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐
│  Collection     │ │   Config   │ │  Session       │
│  Manager        │ │  Manager   │ │  (Transaction) │
└──────┬──────────┘ └────────────┘ └────────┬───────┘
       │                                      │
┌──────┴──────────────────────────────────┬──┴───────┐
│                                         │          │
│  ┌──────────────┐  ┌────────────────┐  │  ┌───────▼──────┐
│  │ Query Engine │  │ Cursor Engine  │  │  │ Transaction  │
│  └──────┬───────┘  └────────┬───────┘  │  │ Manager      │
│         │                   │           │  └──────────────┘
│  ┌──────▼───────┐  ┌────────▼───────┐  │
│  │ Index        │  │ Schema         │  │
│  │ Manager      │  │ Validator      │  │
│  └──────────────┘  └────────────────┘  │
│                                         │
│  ┌──────────────┐  ┌────────────────┐  │
│  │ Hook         │  │ Cache          │  │
│  │ Manager      │  │ Manager        │  │
│  └──────────────┘  └────────────────┘  │
│                                         │
└─────────────────────┬───────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼────┐  ┌─────▼──────┐  ┌──▼────────────┐
│ WAL        │  │ Metadata   │  │ Performance   │
│ Manager    │  │ Manager    │  │ Monitor       │
└───────┬────┘  └────────────┘  └───────────────┘
        │
┌───────▼──────────────────────────────────────────┐
│              Storage Engine                       │
│         (File Operations & Persistence)           │
└───────┬──────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────┐
│              File System                          │
│   (.collection files, indexes, WAL, metadata)    │
└──────────────────────────────────────────────────┘
```

---

## Layer Breakdown

### 1. Application Layer

User-facing API that applications interact with.

**Components:**
- `Database` - Entry point, manages collections
- `Collection` - CRUD operations
- `Cursor` - Lazy query evaluation

**Responsibilities:**
- Provide MongoDB-like API
- Handle user requests
- Coordinate between subsystems

---

### 2. Query Processing Layer

Handles query evaluation and optimization.

**Components:**

#### Query Engine
- Evaluates filters against documents
- Supports comparison operators ($eq, $ne, $gt, $gte, $lt, $lte)
- Supports logical operators ($and, $or)
- Handles dot notation for nested fields

**Location:** `src/engine/QueryEngine.js`

**Key Methods:**
```javascript
QueryEngine.find(documents, filter)
QueryEngine.match(document, filter)
QueryEngine.evaluate(value, operator, operand)
```

---

#### Cursor Engine
- Lazy evaluation of queries
- Coordinates with Index Manager
- Applies sort, skip, limit, projection
- Provides iterator interface

**Location:** `src/cursor/Cursor.js`, `src/engine/CursorEngine.js`

**Execution Pipeline:**
1. Load documents (with index if available)
2. Apply filter
3. Apply sort
4. Apply skip
5. Apply limit
6. Apply projection

---

#### Query Optimizer
- Selects best index for query
- Scores indexes based on match quality
- Falls back to collection scan if no suitable index

**Location:** `src/query/QueryOptimizer.js`

**Selection Algorithm:**
```
For each available index:
  score = 0
  if index covers all filter fields: score += 10
  if index is unique: score += 5
  if index is compound with matching prefix: score += 3
  
Select index with highest score
If no index score > 0: use collection scan
```

---

### 3. Data Integrity Layer

Ensures data consistency and validity.

**Components:**

#### Schema Validator
- Runtime type checking
- Constraint validation
- Default value application

**Location:** `src/schema/SchemaValidator.js`, `src/schema/SchemaDefinition.js`

**Validation Flow:**
```
Document → Type Check → Constraint Check → Default Values → Validated Document
```

**Supported Types:**
- String (with minLength, maxLength, match, enum)
- Number (with min, max, integer)
- Boolean
- Date (with min, max)
- Array (with minLength, maxLength)
- Object

---

#### Hook Manager
- Manages pre/post operation hooks
- Executes hooks in registration order
- Supports async hooks

**Location:** `src/hooks/HookManager.js`

**Hook Execution:**
```
Pre-hooks → Operation → Post-hooks
```

**Events:** insert, update, delete, find

---

### 4. Indexing Layer

Provides fast data access through indexes.

**Components:**

#### Index Manager
- Manages index lifecycle (create, drop, list)
- Coordinates index types
- Enforces unique constraints

**Location:** `src/index/IndexManager.js`

**Index Storage:**
```
database/
  <dbname>/
    indexes/
      <collection>.<field>.idx
      <collection>.<field1>_<field2>.idx
```

---

#### Index Implementations

**B-Tree Index** (`src/index/BTreeIndex.js`)
- Sorted tree structure
- Efficient for range queries
- Supports both ascending and descending

**Hash Index** (`src/index/HashIndex.js`)
- Hash table structure
- O(1) lookup for exact matches
- Used for unique constraints

---

### 5. Transaction Layer

Provides ACID guarantees.

**Components:**

#### Transaction Manager
- Manages transaction lifecycle
- Coordinates sessions
- Handles commit/abort

**Location:** `src/transaction/TransactionManager.js`

#### Session
- Tracks operations within transaction
- Maintains operation queue
- Executes rollback on abort

**Location:** `src/transaction/Session.js`

**Transaction Flow:**
```
Start Transaction
  → Queue Operations
  → Write to WAL
  → Execute Operations
  → Commit (or Abort & Rollback)
  → Clear WAL
```

---

#### Write-Ahead Log (WAL)
- Durability mechanism
- Records operations before execution
- Enables crash recovery

**Location:** `src/wal/WALManager.js`, `src/wal/WALEntry.js`

**WAL Structure:**
```json
{
  "transactionId": "tx-123",
  "operation": "update",
  "collection": "users",
  "data": {...},
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Recovery Process:**
1. On startup, scan for WAL files
2. For incomplete transactions: rollback
3. For completed transactions: remove WAL
4. Database restored to consistent state

---

### 6. Caching Layer

Improves read performance.

**Components:**

#### Cache Manager
- Manages cache lifecycle
- Handles invalidation on writes
- Tracks hit/miss statistics

**Location:** `src/cache/CacheManager.js`

#### LRU Cache
- Least Recently Used eviction policy
- Configurable size limit
- Thread-safe operations

**Location:** `src/cache/LRUCache.js`

**Cache Key:** `collection:filter_hash`

**Invalidation Strategy:**
- Insert → Clear all cache for collection
- Update → Clear all cache for collection
- Delete → Clear all cache for collection
- Find → Cache result

---

### 7. Storage Layer

Handles persistence to disk.

**Components:**

#### Storage Engine
- Manages collection files
- Coordinates metadata
- Handles backup/restore

**Location:** `src/engine/StorageEngine.js`

**File Structure:**
```
database/
  <dbname>/
    metadata.json
    collections/
      <collection>.collection
    indexes/
      <collection>.<field>.idx
    wal/
      transaction-*.log
```

---

#### File Storage
- Low-level file operations
- Atomic writes (temp + rename)
- Error handling

**Location:** `src/storage/FileStorage.js`

**Atomic Write Process:**
1. Write to `.tmp` file
2. Rename to target file
3. Prevents partial writes on crash

---

#### Metadata Manager
- Tracks database metadata
- Maintains collection list
- Records statistics

**Location:** `src/metadata/MetadataManager.js`

**Metadata Structure:**
```json
{
  "database": "myapp",
  "version": "2.0.0",
  "createdAt": "2024-01-15T10:00:00Z",
  "collections": [
    {
      "name": "users",
      "documents": 1200,
      "indexes": 3,
      "size": "12MB",
      "lastUpdated": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### 8. Monitoring Layer

Tracks performance and diagnostics.

**Components:**

#### Performance Monitor
- Tracks operation counts
- Measures timing
- Monitors cache performance
- Tracks index usage

**Location:** `src/performance/PerformanceMonitor.js`

**Metrics Collected:**
- Operation counts (reads, writes, queries, updates, deletes)
- Timing (average per operation type)
- Cache statistics (hits, misses, hit rate)
- Index statistics (total, used, usage rate)
- Storage size

---

#### Backup Manager
- Creates database snapshots
- Restores from backups
- Validates backup integrity

**Location:** `src/backup/BackupManager.js`

**Backup Structure:**
```
backup/
  myapp_2024-01-15_103000/
    metadata.json
    collections/
    indexes/
```

---

## Data Flow

### Insert Operation

```
1. Application calls insertOne()
2. Collection validates document
3. Hook Manager executes pre-insert hooks
4. Schema Validator validates document
5. If transaction: Write to WAL
6. Generate _id if not provided
7. Check unique constraints (Index Manager)
8. Add to in-memory documents array
9. Storage Engine persists to disk
10. Update indexes
11. Invalidate cache
12. Hook Manager executes post-insert hooks
13. Performance Monitor records metrics
14. Return result to application
```

---

### Find Operation

```
1. Application calls find() or findCursor()
2. Hook Manager executes pre-find hooks
3. Cache Manager checks cache
   → Cache hit: Return cached results
   → Cache miss: Continue
4. Query Optimizer selects best index
5. If index available:
   → Index Manager performs index lookup
   → Filter matching documents
   Else:
   → Full collection scan
6. Query Engine evaluates filter
7. Apply sort, skip, limit (if cursor)
8. Apply projection (if cursor)
9. Cache Manager stores results
10. Hook Manager executes post-find hooks
11. Performance Monitor records metrics
12. Return results to application
```

---

### Update Operation

```
1. Application calls updateOne/updateMany()
2. Hook Manager executes pre-update hooks
3. If transaction: Write to WAL
4. Find matching documents
5. Schema Validator validates updates
6. Apply update operators ($set, $inc, etc.)
7. Update documents in memory
8. Storage Engine persists changes
9. Update affected indexes
10. Cache Manager invalidates cache
11. Hook Manager executes post-update hooks
12. Performance Monitor records metrics
13. Return result to application
```

---

### Transaction Flow

```
1. Application calls startSession()
2. Session created
3. Application calls startTransaction()
4. For each operation:
   a. Validate operation
   b. Write to WAL
   c. Add to operation queue (not executed yet)
5. Application calls commit():
   a. Execute all queued operations
   b. Mark WAL as complete
   c. Remove WAL files
   d. Session ends
   OR
   Application calls abort():
   a. Rollback operations from WAL
   b. Remove WAL files
   c. Session ends
```

---

## Design Principles

### 1. Separation of Concerns

Each layer has a single responsibility:
- **Database/Collection** - API and coordination
- **Query Engine** - Query evaluation
- **Index Manager** - Fast lookups
- **Storage Engine** - Persistence
- **Transaction Manager** - ACID guarantees

---

### 2. Extensibility

New features can be added without modifying core:
- Add new index types (extend IndexManager)
- Add new operators (extend QueryEngine)
- Add new hooks (register with HookManager)
- Add new validation types (extend SchemaValidator)

---

### 3. Performance

Multiple optimization layers:
- **Indexes** - Fast lookups
- **Cache** - Avoid disk reads
- **Cursor** - Lazy evaluation
- **WAL** - Async writes

---

### 4. Reliability

Multiple safety mechanisms:
- **Atomic writes** - No partial writes
- **WAL** - Crash recovery
- **Transactions** - ACID guarantees
- **Schema validation** - Data integrity

---

## Concurrency Model

Dimond-DB v2 uses a **single-threaded** model with async I/O:

- All operations are serialized
- No race conditions
- Transactions provide isolation
- Simple and predictable

**Future (V3):**
- Multi-threaded reads
- Write locks
- MVCC (Multi-Version Concurrency Control)

---

## Memory Management

### Document Storage
- Documents stored in-memory for active collections
- Lazy loading on first access
- Deep cloning on insert/retrieve (prevents external mutation)

### Cache Management
- LRU eviction when size limit reached
- Configurable cache size
- Automatic invalidation on writes

### Index Storage
- Indexes stored in-memory when loaded
- Persisted to disk for durability
- Lazy loading on first use

---

## Error Handling

### Error Hierarchy

```
DatabaseError (base)
├── CollectionNotFoundError
├── DuplicateKeyError
├── ValidationError
├── QueryError
├── StorageError
├── DatabaseOperationError
└── V2 Errors:
    ├── IndexError
    │   ├── IndexExistsError
    │   └── IndexNotFoundError
    ├── TransactionError
    │   └── TransactionAbortError
    ├── SchemaValidationError
    ├── HookExecutionError
    ├── CacheError
    ├── WALError
    ├── BackupError
    └── CursorError
```

**Location:** `src/errors/DatabaseError.js`

---

## Future Architecture (V3 Preview)

Planned enhancements:

### Client-Server Architecture
```
┌──────────────┐
│   Client     │ ←→ Network Protocol ←→ ┌──────────────┐
│  (Browser)   │                        │    Server    │
└──────────────┘                        │   (Node.js)  │
                                        └──────────────┘
                                              ↓
                                        ┌──────────────┐
                                        │  Storage     │
                                        └──────────────┘
```

### Replication
```
┌──────────┐      ┌──────────┐      ┌──────────┐
│ Primary  │ ───→ │ Replica1 │      │ Replica2 │
│  Node    │ ───→ │  Node    │ ←──→ │  Node    │
└──────────┘      └──────────┘      └──────────┘
```

### Sharding
```
┌──────────┐
│  Router  │
└────┬─────┘
     │
  ┌──┴───────┬──────────┐
  │          │          │
┌─▼───┐  ┌──▼───┐  ┌───▼──┐
│Shard│  │Shard │  │Shard │
│  1  │  │  2   │  │  3   │
└─────┘  └──────┘  └──────┘
```

---

## File Organization

```
src/
├── database/
│   ├── Database.js          # Main entry point
│   └── Collection.js        # Collection operations
│
├── engine/
│   ├── QueryEngine.js       # Query evaluation
│   ├── StorageEngine.js     # Storage coordination
│   └── CursorEngine.js      # Cursor execution
│
├── cursor/
│   └── Cursor.js            # Cursor API
│
├── index/
│   ├── IndexManager.js      # Index coordination
│   ├── IndexTypes.js        # Index type definitions
│   ├── BTreeIndex.js        # B-Tree implementation
│   └── HashIndex.js         # Hash implementation
│
├── cache/
│   ├── CacheManager.js      # Cache coordination
│   └── LRUCache.js          # LRU implementation
│
├── schema/
│   ├── SchemaValidator.js   # Validation logic
│   └── SchemaDefinition.js  # Schema structure
│
├── transaction/
│   ├── TransactionManager.js # Transaction coordination
│   └── Session.js           # Session management
│
├── wal/
│   ├── WALManager.js        # WAL coordination
│   └── WALEntry.js          # WAL entry structure
│
├── hooks/
│   └── HookManager.js       # Hook coordination
│
├── backup/
│   └── BackupManager.js     # Backup/restore
│
├── metadata/
│   └── MetadataManager.js   # Metadata tracking
│
├── performance/
│   └── PerformanceMonitor.js # Metrics collection
│
├── query/
│   ├── QueryOptimizer.js    # Query optimization
│   └── operators.js         # Query/update operators
│
├── storage/
│   └── FileStorage.js       # Low-level file ops
│
├── config/
│   └── DatabaseConfig.js    # Configuration
│
├── errors/
│   └── DatabaseError.js     # Error classes
│
├── utils/
│   ├── validator.js         # Input validation
│   ├── idGenerator.js       # UUID generation
│   └── deepClone.js         # Deep cloning
│
└── index.js                 # Public exports
```

---

## Testing Architecture

Tests are organized by feature:

```
tests/
├── localdb.test.js          # V1 functionality
└── v2-features.test.js      # V2 functionality
    ├── Cursor API
    ├── Indexes
    ├── Schema Validation
    ├── Hooks
    ├── Transactions
    ├── Cache
    ├── Performance Monitoring
    └── Backup & Restore
```

**Test Coverage Target:** > 90%

---

## Configuration Architecture

Configuration flows through the system:

```
DatabaseConfig
    ↓
Database
    ↓
├→ CacheManager (if cache: true)
├→ WALManager (if journal: true)
├→ PerformanceMonitor (if performanceTracking: true)
├→ Collection
    ├→ SchemaValidator (if schema defined)
    ├→ IndexManager (if autoIndex: true)
    └→ HookManager
```

---

## Summary

Dimond-DB v2 uses a **layered architecture** with clear separation of concerns:

1. **Application Layer** - User-facing API
2. **Query Processing** - Query evaluation & optimization
3. **Data Integrity** - Schema validation & hooks
4. **Indexing** - Fast data access
5. **Transactions** - ACID guarantees
6. **Caching** - Performance optimization
7. **Storage** - Persistence
8. **Monitoring** - Performance tracking

**Key Design Principles:**
- Modularity
- Extensibility
- Performance
- Reliability

**Ready for V3:**
- Architecture supports client-server
- Can add replication layer
- Can add sharding layer
- Can add distributed transactions

This architecture provides a solid foundation for future enhancements while maintaining simplicity and performance in V2.
