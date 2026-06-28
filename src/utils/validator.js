import { ValidationError } from '../errors/DatabaseError.js';

/**
 * Validates a document before insertion or update
 * @param {*} doc - The document to validate
 * @throws {ValidationError} If validation fails
 */
export function validateDocument(doc) {
    if (doc === null || doc === undefined) {
        throw new ValidationError('Document cannot be null or undefined');
    }

    if (typeof doc !== 'object') {
        throw new ValidationError('Document must be an object');
    }

    if (Array.isArray(doc)) {
        throw new ValidationError('Document cannot be an array');
    }
}

/**
 * Validates an array of documents
 * @param {Array} docs - The documents to validate
 * @throws {ValidationError} If validation fails
 */
export function validateDocuments(docs) {
    if (!Array.isArray(docs)) {
        throw new ValidationError('Documents must be an array');
    }

    if (docs.length === 0) {
        throw new ValidationError('Documents array cannot be empty');
    }

    docs.forEach((doc, index) => {
        try {
            validateDocument(doc);
        } catch (error) {
            throw new ValidationError(`Document at index ${index}: ${error.message}`);
        }
    });
}

/**
 * Validates a query filter object
 * @param {Object} filter - The filter to validate
 * @throws {ValidationError} If validation fails
 */
export function validateFilter(filter) {
    if (filter === null || filter === undefined) {
        return; // Empty filter is valid (matches all)
    }

    if (typeof filter !== 'object') {
        throw new ValidationError('Filter must be an object');
    }

    if (Array.isArray(filter)) {
        throw new ValidationError('Filter cannot be an array');
    }
}

/**
 * Validates an update operation object
 * @param {Object} update - The update operation to validate
 * @throws {ValidationError} If validation fails
 */
export function validateUpdate(update) {
    if (update === null || update === undefined) {
        throw new ValidationError('Update cannot be null or undefined');
    }

    if (typeof update !== 'object') {
        throw new ValidationError('Update must be an object');
    }

    if (Array.isArray(update)) {
        throw new ValidationError('Update cannot be an array');
    }

    if (Object.keys(update).length === 0) {
        throw new ValidationError('Update cannot be empty');
    }

    // Check if all top-level keys are valid operators
    const validOperators = ['$set', '$unset', '$inc', '$push'];
    const keys = Object.keys(update);

    const hasOperators = keys.some(key => key.startsWith('$'));
    const hasNonOperators = keys.some(key => !key.startsWith('$'));

    if (hasOperators && hasNonOperators) {
        throw new ValidationError('Update cannot mix operators and direct field assignments');
    }

    if (hasOperators) {
        const invalidOperators = keys.filter(key => !validOperators.includes(key));
        if (invalidOperators.length > 0) {
            throw new ValidationError(`Invalid update operators: ${invalidOperators.join(', ')}`);
        }
    }
}

/**
 * Validates a collection name
 * @param {string} name - The collection name to validate
 * @throws {ValidationError} If validation fails
 */
export function validateCollectionName(name) {
    if (typeof name !== 'string') {
        throw new ValidationError('Collection name must be a string');
    }

    if (name.length === 0) {
        throw new ValidationError('Collection name cannot be empty');
    }

    if (name.length > 64) {
        throw new ValidationError('Collection name cannot exceed 64 characters');
    }

    // Check for invalid characters
    const invalidChars = /[\\/:*?"<>|]/;
    if (invalidChars.test(name)) {
        throw new ValidationError('Collection name contains invalid characters');
    }

    // Prevent reserved names
    if (name.startsWith('system.')) {
        throw new ValidationError('Collection name cannot start with "system."');
    }
}
