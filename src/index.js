import { Database } from './database/Database.js';

// Export the main Database class as LocalDB
export { Database as LocalDB };

// Export V1 error classes for backward compatibility
export {
    DatabaseError,
    CollectionNotFoundError,
    DuplicateKeyError,
    ValidationError,
    QueryError,
    StorageError,
    DatabaseOperationError
} from './errors/DatabaseError.js';

// Export V2 error classes
export {
    IndexError,
    IndexExistsError,
    IndexNotFoundError,
    TransactionError,
    TransactionAbortError,
    SchemaValidationError,
    HookExecutionError,
    CacheError,
    WALError,
    BackupError,
    CursorError
} from './errors/DatabaseError.js';

// Export V2 components for advanced usage
export { Cursor } from './cursor/Cursor.js';
export { IndexType } from './index/IndexTypes.js';
export { DatabaseConfig } from './config/DatabaseConfig.js';

// Default export
export default Database;
