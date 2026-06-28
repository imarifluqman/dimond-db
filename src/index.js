import { Database } from './database/Database.js';

// Export the main Database class as LocalDB
export { Database as LocalDB };

// Export error classes for advanced error handling
export {
    DatabaseError,
    CollectionNotFoundError,
    DuplicateKeyError,
    ValidationError,
    QueryError,
    StorageError,
    DatabaseOperationError
} from './errors/DatabaseError.js';

// Default export
export default Database;
