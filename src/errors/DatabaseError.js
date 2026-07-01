/**
 * Base class for all LocalDB errors
 */
export class DatabaseError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Thrown when a collection is not found
 */
export class CollectionNotFoundError extends DatabaseError {
    constructor(collectionName) {
        super(`Collection "${collectionName}" not found`);
        this.collectionName = collectionName;
    }
}

/**
 * Thrown when attempting to insert a document with a duplicate _id
 */
export class DuplicateKeyError extends DatabaseError {
    constructor(id) {
        super(`Duplicate key error: document with _id "${id}" already exists`);
        this.id = id;
    }
}

/**
 * Thrown when document validation fails
 */
export class ValidationError extends DatabaseError {
    constructor(message) {
        super(`Validation error: ${message}`);
    }
}

/**
 * Thrown when a query is malformed or invalid
 */
export class QueryError extends DatabaseError {
    constructor(message) {
        super(`Query error: ${message}`);
    }
}

/**
 * Thrown when storage operations fail
 */
export class StorageError extends DatabaseError {
    constructor(message, cause) {
        super(`Storage error: ${message}`);
        this.cause = cause;
    }
}

/**
 * Thrown when database operations fail
 */
export class DatabaseOperationError extends DatabaseError {
    constructor(operation, message) {
        super(`Database operation "${operation}" failed: ${message}`);
        this.operation = operation;
    }
}

/**
 * Thrown when index operations fail
 */
export class IndexError extends DatabaseError {
    constructor(message) {
        super(`Index error: ${message}`);
    }
}

/**
 * Thrown when attempting to create an index that already exists
 */
export class IndexExistsError extends IndexError {
    constructor(indexName) {
        super(`Index "${indexName}" already exists`);
        this.indexName = indexName;
    }
}

/**
 * Thrown when an index is not found
 */
export class IndexNotFoundError extends IndexError {
    constructor(indexName) {
        super(`Index "${indexName}" not found`);
        this.indexName = indexName;
    }
}

/**
 * Thrown when transaction operations fail
 */
export class TransactionError extends DatabaseError {
    constructor(message) {
        super(`Transaction error: ${message}`);
    }
}

/**
 * Thrown when a transaction is aborted
 */
export class TransactionAbortError extends TransactionError {
    constructor(reason) {
        super(`Transaction aborted: ${reason}`);
        this.reason = reason;
    }
}

/**
 * Thrown when schema validation fails
 */
export class SchemaValidationError extends DatabaseError {
    constructor(message, errors = []) {
        super(`Schema validation error: ${message}`);
        this.validationErrors = errors;
    }
}

/**
 * Thrown when hook execution fails
 */
export class HookExecutionError extends DatabaseError {
    constructor(hookType, hookName, cause) {
        super(`Hook execution failed: ${hookType}.${hookName}`);
        this.hookType = hookType;
        this.hookName = hookName;
        this.cause = cause;
    }
}

/**
 * Thrown when cache operations fail
 */
export class CacheError extends DatabaseError {
    constructor(message) {
        super(`Cache error: ${message}`);
    }
}

/**
 * Thrown when WAL operations fail
 */
export class WALError extends DatabaseError {
    constructor(message, cause) {
        super(`WAL error: ${message}`);
        this.cause = cause;
    }
}

/**
 * Thrown when backup/restore operations fail
 */
export class BackupError extends DatabaseError {
    constructor(message, cause) {
        super(`Backup error: ${message}`);
        this.cause = cause;
    }
}

/**
 * Thrown when cursor operations fail
 */
export class CursorError extends DatabaseError {
    constructor(message) {
        super(`Cursor error: ${message}`);
    }
}
