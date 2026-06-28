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
