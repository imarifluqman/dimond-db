# Changelog

All notable changes to Dimond-DB (LocalDB) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-07-01

### Added

#### Core Features
- **Advanced Indexing System**
  - B-Tree indexes for sorted data access
  - Hash indexes for fast exact-match lookups
  - Single field, compound, unique, and sparse indexes
  - Automatic query optimizer for index selection
  - Index persistence and recovery

- **Cursor API**
  - Lazy evaluation for memory-efficient queries
  - `sort()`, `limit()`, `skip()`, `project()` operations
  - Iterator methods: `next()`, `hasNext()`, `forEach()`, `map()`, `filter()`
  - Method chaining support
  - Efficient pagination

- **Schema Validation**
  - Runtime type checking (String, Number, Boolean, Date, Array, Object)
  - Field constraints (required, min, max, minLength, maxLength, enum, unique)
  - Default values (static and function-based)
  - Pattern matching with regex
  - Automatic unique index creation

- **Hooks & Middleware**
  - Pre/post hooks for insert, update, delete, find operations
  - Multiple hooks per event
  - Async hook support
  - Hook execution order guarantees

- **ACID Transactions**
  - Session-based transaction management
  - Commit and abort operations
  - Automatic rollback on failure
  - Serializable isolation level
  - Multi-collection transaction support

- **Write-Ahead Logging (WAL)**
  - Crash recovery mechanism
  - Durability guarantees
  - Automatic recovery on startup
  - Transaction persistence

- **Caching System**
  - LRU (Least Recently Used) cache implementation
  - Configurable cache size
  - Automatic cache invalidation on writes
  - Cache hit/miss tracking
  - Significant performance improvements (100x-1000x for repeated queries)

- **Query Optimizer**
  - Automatic best index selection
  - Query scoring algorithm
  - Index usage tracking
  - Fallback to collection scan

- **Backup & Restore**
  - Full database backup
  - Point-in-time snapshots
  - Restore functionality
  - Backup validation

- **Performance Monitoring**
  - Operation tracking (reads, writes, queries, updates, deletes)
  - Timing metrics (average per operation)
  - Cache statistics (hit rate, size)
  - Index usage statistics
  - Storage size tracking

#### Configuration
- `DatabaseConfig` class for centralized configuration
- New config options: `cache`, `cacheSize`, `journal`, `autoIndex`, `strictSchema`, `performanceTracking`

#### Documentation
- Complete API reference (`docs/API.md`)
- Cursor API guide (`docs/CURSOR.md`)
- Indexing guide (`docs/INDEXES.md`)
- Schema validation guide (`docs/SCHEMA.md`)
- Hooks & middleware guide (`docs/HOOKS.md`)
- Transactions guide (`docs/TRANSACTIONS.md`)
- Performance optimization guide (`docs/PERFORMANCE.md`)
- Migration guide from V1 to V2 (`docs/MIGRATION.md`)
- Architecture documentation (`docs/ARCHITECTURE.md`)

#### Testing
- 58 comprehensive tests covering all V2 features
- Test suite for cursor API
- Test suite for indexing
- Test suite for schema validation
- Test suite for hooks
- Test suite for transactions
- Test suite for caching
- Test suite for performance monitoring
- Test suite for backup & restore

### Changed
- Updated package description to highlight V2 features
- Enhanced README with V2 feature overview
- Added V2 keywords to package.json
- Include `docs/` directory in published npm package

### Performance
- **10-50x faster** queries with indexes
- **100-1000x faster** repeated queries with caching
- Constant memory usage with cursor API (vs O(n) with find)
- 50-80% less data transfer with projection

### Backward Compatibility
- **100% backward compatible** with Version 1
- All V1 code continues to work without modifications
- V2 features are opt-in
- Incremental adoption strategy supported

## [1.0.0] - 2024-01-15

### Added
- Initial release
- MongoDB-like API
- Basic CRUD operations (insertOne, insertMany, find, findOne, updateOne, updateMany, deleteOne, deleteMany)
- Query operators ($eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $and, $or)
- Update operators ($set, $unset, $inc, $push)
- Automatic _id generation
- Document validation
- Collection management
- Metadata tracking
- JSON file-based storage
- Deep cloning for data integrity
- Comprehensive error handling
- Zero external dependencies
- ES Modules support

[2.0.0]: https://github.com/imarifluqman/dimond-db/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/imarifluqman/dimond-db/releases/tag/v1.0.0
