import { QueryError } from '../errors/DatabaseError.js';

/**
 * Comparison operators for querying documents
 */

/**
 * Equality comparison ($eq)
 * @param {*} fieldValue - The field value from the document
 * @param {*} queryValue - The value to compare against
 * @returns {boolean} True if values are equal
 */
export function $eq(fieldValue, queryValue) {
    return fieldValue === queryValue;
}

/**
 * Inequality comparison ($ne)
 * @param {*} fieldValue - The field value from the document
 * @param {*} queryValue - The value to compare against
 * @returns {boolean} True if values are not equal
 */
export function $ne(fieldValue, queryValue) {
    return fieldValue !== queryValue;
}

/**
 * Greater than comparison ($gt)
 * @param {*} fieldValue - The field value from the document
 * @param {*} queryValue - The value to compare against
 * @returns {boolean} True if field value is greater than query value
 */
export function $gt(fieldValue, queryValue) {
    return fieldValue > queryValue;
}

/**
 * Greater than or equal comparison ($gte)
 * @param {*} fieldValue - The field value from the document
 * @param {*} queryValue - The value to compare against
 * @returns {boolean} True if field value is greater than or equal to query value
 */
export function $gte(fieldValue, queryValue) {
    return fieldValue >= queryValue;
}

/**
 * Less than comparison ($lt)
 * @param {*} fieldValue - The field value from the document
 * @param {*} queryValue - The value to compare against
 * @returns {boolean} True if field value is less than query value
 */
export function $lt(fieldValue, queryValue) {
    return fieldValue < queryValue;
}

/**
 * Less than or equal comparison ($lte)
 * @param {*} fieldValue - The field value from the document
 * @param {*} queryValue - The value to compare against
 * @returns {boolean} True if field value is less than or equal to query value
 */
export function $lte(fieldValue, queryValue) {
    return fieldValue <= queryValue;
}

/**
 * In array comparison ($in)
 * @param {*} fieldValue - The field value from the document
 * @param {Array} queryValue - The array of values to check against
 * @returns {boolean} True if field value is in the array
 */
export function $in(fieldValue, queryValue) {
    if (!Array.isArray(queryValue)) {
        throw new QueryError('$in operator requires an array');
    }
    return queryValue.includes(fieldValue);
}

/**
 * Not in array comparison ($nin)
 * @param {*} fieldValue - The field value from the document
 * @param {Array} queryValue - The array of values to check against
 * @returns {boolean} True if field value is not in the array
 */
export function $nin(fieldValue, queryValue) {
    if (!Array.isArray(queryValue)) {
        throw new QueryError('$nin operator requires an array');
    }
    return !queryValue.includes(fieldValue);
}

/**
 * Field exists check ($exists)
 * @param {*} fieldValue - The field value from the document
 * @param {boolean} queryValue - Whether the field should exist
 * @returns {boolean} True if existence matches expectation
 */
export function $exists(fieldValue, queryValue) {
    const exists = fieldValue !== undefined;
    return queryValue ? exists : !exists;
}

/**
 * Map of operator names to their functions
 */
export const OPERATORS = {
    $eq,
    $ne,
    $gt,
    $gte,
    $lt,
    $lte,
    $in,
    $nin,
    $exists
};

/**
 * Checks if a key is a query operator
 * @param {string} key - The key to check
 * @returns {boolean} True if the key is an operator
 */
export function isOperator(key) {
    return key.startsWith('$') && key in OPERATORS;
}

/**
 * Gets the nested value from an object using dot notation
 * @param {Object} obj - The object to get the value from
 * @param {string} path - The dot-notation path (e.g., 'user.address.city')
 * @returns {*} The value at the path, or undefined if not found
 */
export function getNestedValue(obj, path) {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
        if (value === null || value === undefined) {
            return undefined;
        }
        value = value[key];
    }

    return value;
}

/**
 * Sets a nested value in an object using dot notation
 * @param {Object} obj - The object to set the value in
 * @param {string} path - The dot-notation path
 * @param {*} value - The value to set
 */
export function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();

    let current = obj;
    for (const key of keys) {
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }

    current[lastKey] = value;
}

/**
 * Deletes a nested value from an object using dot notation
 * @param {Object} obj - The object to delete the value from
 * @param {string} path - The dot-notation path
 */
export function deleteNestedValue(obj, path) {
    const keys = path.split('.');
    const lastKey = keys.pop();

    let current = obj;
    for (const key of keys) {
        if (!(key in current)) {
            return;
        }
        current = current[key];
    }

    delete current[lastKey];
}
