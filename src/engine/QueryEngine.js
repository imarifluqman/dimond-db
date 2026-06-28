import { QueryError } from '../errors/DatabaseError.js';
import { OPERATORS, isOperator, getNestedValue } from '../query/operators.js';

/**
 * Query Engine - Handles query parsing and document matching
 */
export class QueryEngine {
    /**
     * Matches a document against a query filter
     * @param {Object} document - The document to match
     * @param {Object} filter - The query filter
     * @returns {boolean} True if the document matches the filter
     */
    static match(document, filter = {}) {
        // Empty filter matches all documents
        if (!filter || Object.keys(filter).length === 0) {
            return true;
        }

        return this.matchConditions(document, filter);
    }

    /**
     * Matches a document against multiple conditions
     * @param {Object} document - The document to match
     * @param {Object} conditions - The conditions to match
     * @returns {boolean} True if all conditions match
     */
    static matchConditions(document, conditions) {
        for (const [key, value] of Object.entries(conditions)) {
            // Handle logical operators
            if (key === '$and') {
                if (!this.handleAnd(document, value)) {
                    return false;
                }
            } else if (key === '$or') {
                if (!this.handleOr(document, value)) {
                    return false;
                }
            } else {
                // Handle field conditions
                if (!this.matchField(document, key, value)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Matches a document field against a query value
     * @param {Object} document - The document to match
     * @param {string} field - The field name (supports dot notation)
     * @param {*} queryValue - The value or operator object to match against
     * @returns {boolean} True if the field matches
     */
    static matchField(document, field, queryValue) {
        const fieldValue = getNestedValue(document, field);

        // If queryValue is an operator object
        if (typeof queryValue === 'object' && queryValue !== null && !Array.isArray(queryValue)) {
            const operators = Object.keys(queryValue);

            // Check if any key is an operator
            const hasOperators = operators.some(key => isOperator(key));

            if (hasOperators) {
                // Match against all operators
                for (const [op, opValue] of Object.entries(queryValue)) {
                    if (isOperator(op)) {
                        const operatorFn = OPERATORS[op];
                        if (!operatorFn(fieldValue, opValue)) {
                            return false;
                        }
                    } else if (op.startsWith('$')) {
                        throw new QueryError(`Unknown operator: ${op}`);
                    }
                }
                return true;
            }
        }

        // Direct equality comparison
        return this.deepEquals(fieldValue, queryValue);
    }

    /**
     * Handles $and logical operator
     * @param {Object} document - The document to match
     * @param {Array} conditions - Array of condition objects
     * @returns {boolean} True if all conditions match
     */
    static handleAnd(document, conditions) {
        if (!Array.isArray(conditions)) {
            throw new QueryError('$and operator requires an array');
        }

        return conditions.every(condition => this.matchConditions(document, condition));
    }

    /**
     * Handles $or logical operator
     * @param {Object} document - The document to match
     * @param {Array} conditions - Array of condition objects
     * @returns {boolean} True if any condition matches
     */
    static handleOr(document, conditions) {
        if (!Array.isArray(conditions)) {
            throw new QueryError('$or operator requires an array');
        }

        return conditions.some(condition => this.matchConditions(document, condition));
    }

    /**
     * Deep equality comparison
     * @param {*} a - First value
     * @param {*} b - Second value
     * @returns {boolean} True if values are deeply equal
     */
    static deepEquals(a, b) {
        if (a === b) return true;

        if (a === null || b === null) return false;
        if (a === undefined || b === undefined) return false;

        if (typeof a !== typeof b) return false;

        if (typeof a !== 'object') return false;

        if (Array.isArray(a) !== Array.isArray(b)) return false;

        if (Array.isArray(a)) {
            if (a.length !== b.length) return false;
            return a.every((item, index) => this.deepEquals(item, b[index]));
        }

        const keysA = Object.keys(a);
        const keysB = Object.keys(b);

        if (keysA.length !== keysB.length) return false;

        return keysA.every(key => this.deepEquals(a[key], b[key]));
    }

    /**
     * Finds all documents matching a filter
     * @param {Array} documents - The documents to search
     * @param {Object} filter - The query filter
     * @returns {Array} Matching documents
     */
    static find(documents, filter = {}) {
        return documents.filter(doc => this.match(doc, filter));
    }

    /**
     * Finds the first document matching a filter
     * @param {Array} documents - The documents to search
     * @param {Object} filter - The query filter
     * @returns {Object|null} The first matching document or null
     */
    static findOne(documents, filter = {}) {
        return documents.find(doc => this.match(doc, filter)) || null;
    }
}
