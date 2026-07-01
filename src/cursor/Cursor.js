import { CursorError } from '../errors/DatabaseError.js';
import { deepClone } from '../utils/deepClone.js';

/**
 * Cursor
 * Lazy evaluation of query results with MongoDB-like API
 */
export class Cursor {
    /**
     * @param {Array} documents - Source documents
     * @param {Object} filter - Query filter
     */
    constructor(documents, filter = {}) {
        this.documents = documents;
        this.queryFilter = filter;
        this.sortSpec = null;
        this.skipCount = 0;
        this.limitCount = null;
        this.projection = null;
        this.position = 0;
        this.executed = false;
        this.results = null;
    }

    /**
     * Sort results
     * @param {Object} spec - Sort specification (e.g., { age: -1, name: 1 })
     * @returns {Cursor} This cursor (for chaining)
     */
    sort(spec) {
        if (this.executed) {
            throw new CursorError('Cannot modify cursor after execution');
        }

        if (typeof spec !== 'object' || spec === null) {
            throw new CursorError('Sort spec must be an object');
        }

        this.sortSpec = spec;
        return this;
    }

    /**
     * Skip documents
     * @param {number} count - Number of documents to skip
     * @returns {Cursor} This cursor (for chaining)
     */
    skip(count) {
        if (this.executed) {
            throw new CursorError('Cannot modify cursor after execution');
        }

        if (typeof count !== 'number' || count < 0) {
            throw new CursorError('Skip count must be a non-negative number');
        }

        this.skipCount = count;
        return this;
    }

    /**
     * Limit results
     * @param {number} count - Maximum number of documents
     * @returns {Cursor} This cursor (for chaining)
     */
    limit(count) {
        if (this.executed) {
            throw new CursorError('Cannot modify cursor after execution');
        }

        if (typeof count !== 'number' || count < 0) {
            throw new CursorError('Limit count must be a non-negative number');
        }

        this.limitCount = count;
        return this;
    }

    /**
     * Project fields
     * @param {Object} spec - Projection specification (e.g., { name: 1, age: 1 })
     * @returns {Cursor} This cursor (for chaining)
     */
    project(spec) {
        if (this.executed) {
            throw new CursorError('Cannot modify cursor after execution');
        }

        if (typeof spec !== 'object' || spec === null) {
            throw new CursorError('Projection spec must be an object');
        }

        this.projection = spec;
        return this;
    }

    /**
     * Execute cursor and get all results
     * @returns {Promise<Array>} Array of documents
     */
    async toArray() {
        if (!this.executed) {
            await this.execute();
        }

        return deepClone(this.results);
    }

    /**
     * Execute cursor pipeline
     */
    async execute() {
        if (this.executed) {
            return;
        }

        let results = this.documents;

        // Apply sort
        if (this.sortSpec) {
            results = this.applySort(results, this.sortSpec);
        }

        // Apply skip
        if (this.skipCount > 0) {
            results = results.slice(this.skipCount);
        }

        // Apply limit
        if (this.limitCount !== null) {
            results = results.slice(0, this.limitCount);
        }

        // Apply projection
        if (this.projection) {
            results = results.map(doc => this.applyProjection(doc, this.projection));
        }

        this.results = results;
        this.executed = true;
    }

    /**
     * Apply sort to documents
     * @param {Array} docs - Documents
     * @param {Object} spec - Sort specification
     * @returns {Array} Sorted documents
     */
    applySort(docs, spec) {
        const fields = Object.keys(spec);

        return [...docs].sort((a, b) => {
            for (const field of fields) {
                const direction = spec[field]; // 1 for asc, -1 for desc
                const aVal = this.getNestedValue(a, field);
                const bVal = this.getNestedValue(b, field);

                const cmp = this.compare(aVal, bVal);

                if (cmp !== 0) {
                    return direction === 1 ? cmp : -cmp;
                }
            }
            return 0;
        });
    }

    /**
     * Apply projection to document
     * @param {Object} doc - Document
     * @param {Object} spec - Projection specification
     * @returns {Object} Projected document
     */
    applyProjection(doc, spec) {
        const isInclusion = Object.values(spec).some(v => v === 1 || v === true);
        const isExclusion = Object.values(spec).some(v => v === 0 || v === false);

        if (isInclusion && isExclusion) {
            throw new CursorError('Cannot mix inclusion and exclusion in projection');
        }

        const result = {};

        if (isInclusion) {
            // Inclusion projection
            for (const [field, include] of Object.entries(spec)) {
                if (include) {
                    const value = this.getNestedValue(doc, field);
                    if (value !== undefined) {
                        this.setNestedValue(result, field, value);
                    }
                }
            }

            // Always include _id unless explicitly excluded
            if (spec._id !== 0 && spec._id !== false) {
                result._id = doc._id;
            }
        } else {
            // Exclusion projection
            Object.assign(result, deepClone(doc));

            for (const [field, exclude] of Object.entries(spec)) {
                if (!exclude) {
                    this.deleteNestedValue(result, field);
                }
            }
        }

        return result;
    }

    /**
     * Get next document
     * @returns {Promise<Object|null>} Next document or null
     */
    async next() {
        if (!this.executed) {
            await this.execute();
        }

        if (this.position >= this.results.length) {
            return null;
        }

        return deepClone(this.results[this.position++]);
    }

    /**
     * Check if there are more documents
     * @returns {Promise<boolean>} True if more documents available
     */
    async hasNext() {
        if (!this.executed) {
            await this.execute();
        }

        return this.position < this.results.length;
    }

    /**
     * Iterate over all documents with callback
     * @param {Function} callback - Callback function
     */
    async forEach(callback) {
        if (!this.executed) {
            await this.execute();
        }

        for (const doc of this.results) {
            await callback(deepClone(doc));
        }
    }

    /**
     * Map documents
     * @param {Function} mapper - Mapper function
     * @returns {Promise<Array>} Mapped results
     */
    async map(mapper) {
        if (!this.executed) {
            await this.execute();
        }

        const mapped = [];
        for (const doc of this.results) {
            mapped.push(await mapper(deepClone(doc)));
        }
        return mapped;
    }

    /**
     * Filter documents
     * @param {Function} predicate - Filter predicate
     * @returns {Promise<Array>} Filtered results
     */
    async filter(predicate) {
        if (!this.executed) {
            await this.execute();
        }

        const filtered = [];
        for (const doc of this.results) {
            if (await predicate(deepClone(doc))) {
                filtered.push(deepClone(doc));
            }
        }
        return filtered;
    }

    /**
     * Count documents
     * @returns {Promise<number>} Document count
     */
    async count() {
        if (!this.executed) {
            await this.execute();
        }

        return this.results.length;
    }

    /**
     * Get nested value using dot notation
     * @param {Object} obj - Object
     * @param {string} path - Dot-notation path
     * @returns {*} Value
     */
    getNestedValue(obj, path) {
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
     * Set nested value using dot notation
     * @param {Object} obj - Object
     * @param {string} path - Dot-notation path
     * @param {*} value - Value to set
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();

        let current = obj;
        for (const key of keys) {
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }

        current[lastKey] = deepClone(value);
    }

    /**
     * Delete nested value using dot notation
     * @param {Object} obj - Object
     * @param {string} path - Dot-notation path
     */
    deleteNestedValue(obj, path) {
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

    /**
     * Compare two values
     * @param {*} a - First value
     * @param {*} b - Second value
     * @returns {number} -1, 0, or 1
     */
    compare(a, b) {
        if (a === b) return 0;
        if (a === null || a === undefined) return -1;
        if (b === null || b === undefined) return 1;
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }

    /**
     * Reset cursor position
     */
    rewind() {
        this.position = 0;
    }

    /**
     * Clone cursor
     * @returns {Cursor} Cloned cursor
     */
    clone() {
        const cloned = new Cursor(this.documents, this.queryFilter);
        cloned.sortSpec = this.sortSpec;
        cloned.skipCount = this.skipCount;
        cloned.limitCount = this.limitCount;
        cloned.projection = this.projection;
        return cloned;
    }
}
