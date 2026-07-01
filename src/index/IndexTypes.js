/**
 * Index type constants
 */
export const IndexType = {
    BTREE: 'btree',
    HASH: 'hash'
};

/**
 * Index definition
 */
export class IndexDefinition {
    /**
     * @param {string} name - Index name
     * @param {Object} spec - Index specification (field -> direction)
     * @param {Object} options - Index options
     */
    constructor(name, spec, options = {}) {
        this.name = name;
        this.spec = spec; // e.g., { age: 1, name: -1 }
        this.unique = options.unique || false;
        this.sparse = options.sparse || false;
        this.type = options.type || this.determineType(spec);
        this.fields = Object.keys(spec);
    }

    /**
     * Determine optimal index type based on spec
     * @param {Object} spec - Index specification
     * @returns {string} Index type
     */
    determineType(spec) {
        // Hash index for single field equality
        // BTree for everything else (ranges, compound, sorting)
        const fields = Object.keys(spec);
        return fields.length === 1 ? IndexType.HASH : IndexType.BTREE;
    }

    /**
     * Check if this is a compound index
     * @returns {boolean} True if compound
     */
    isCompound() {
        return this.fields.length > 1;
    }

    /**
     * Get index key from document
     * @param {Object} doc - Document
     * @returns {*} Index key
     */
    getKey(doc) {
        if (this.fields.length === 1) {
            return this.getNestedValue(doc, this.fields[0]);
        } else {
            // Compound key
            return this.fields.map(field => this.getNestedValue(doc, field));
        }
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
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            name: this.name,
            spec: this.spec,
            unique: this.unique,
            sparse: this.sparse,
            type: this.type,
            fields: this.fields
        };
    }

    /**
     * Deserialize from JSON
     * @param {Object} data - JSON data
     * @returns {IndexDefinition} Index definition
     */
    static fromJSON(data) {
        return new IndexDefinition(data.name, data.spec, {
            unique: data.unique,
            sparse: data.sparse,
            type: data.type
        });
    }
}

/**
 * Query matching utilities for indexes
 */
export class IndexQueryMatcher {
    /**
     * Check if query can use an index
     * @param {Object} filter - Query filter
     * @param {IndexDefinition} indexDef - Index definition
     * @returns {Object} Match result with score
     */
    static canUseIndex(filter, indexDef) {
        const queryFields = this.extractQueryFields(filter);
        const indexFields = indexDef.fields;

        // For compound indexes, check prefix matching
        if (indexDef.isCompound()) {
            return this.matchCompoundIndex(queryFields, indexFields);
        }

        // For single field indexes
        const field = indexFields[0];
        if (!queryFields.includes(field)) {
            return { match: false, score: 0 };
        }

        // Check query type
        const fieldQuery = this.getFieldQuery(filter, field);
        const score = this.scoreIndexUse(fieldQuery, indexDef);

        return { match: score > 0, score };
    }

    /**
     * Extract fields used in query
     * @param {Object} filter - Query filter
     * @returns {Array<string>} Field names
     */
    static extractQueryFields(filter) {
        const fields = [];

        for (const key of Object.keys(filter)) {
            if (key === '$and' || key === '$or') {
                // Logical operators
                if (Array.isArray(filter[key])) {
                    filter[key].forEach(subFilter => {
                        fields.push(...this.extractQueryFields(subFilter));
                    });
                }
            } else if (!key.startsWith('$')) {
                fields.push(key);
            }
        }

        return [...new Set(fields)]; // Unique
    }

    /**
     * Get query for a specific field
     * @param {Object} filter - Query filter
     * @param {string} field - Field name
     * @returns {*} Field query
     */
    static getFieldQuery(filter, field) {
        return filter[field];
    }

    /**
     * Score index usefulness for a query
     * @param {*} fieldQuery - Field query
     * @param {IndexDefinition} indexDef - Index definition
     * @returns {number} Score (higher is better)
     */
    static scoreIndexUse(fieldQuery, indexDef) {
        if (fieldQuery === undefined) {
            return 0;
        }

        // Unique index + equality = highest score
        if (indexDef.unique && !this.isOperatorQuery(fieldQuery)) {
            return 100;
        }

        // Equality query
        if (!this.isOperatorQuery(fieldQuery)) {
            return 80;
        }

        // Range queries (good for BTree)
        if (indexDef.type === IndexType.BTREE && this.isRangeQuery(fieldQuery)) {
            return 60;
        }

        // $in operator
        if (fieldQuery.$in) {
            return 50;
        }

        // Other operators
        return 30;
    }

    /**
     * Check if field query uses operators
     * @param {*} fieldQuery - Field query
     * @returns {boolean} True if uses operators
     */
    static isOperatorQuery(fieldQuery) {
        return typeof fieldQuery === 'object' &&
            fieldQuery !== null &&
            !Array.isArray(fieldQuery) &&
            Object.keys(fieldQuery).some(k => k.startsWith('$'));
    }

    /**
     * Check if query is a range query
     * @param {*} fieldQuery - Field query
     * @returns {boolean} True if range query
     */
    static isRangeQuery(fieldQuery) {
        if (!this.isOperatorQuery(fieldQuery)) {
            return false;
        }
        const rangeOps = ['$gt', '$gte', '$lt', '$lte'];
        return Object.keys(fieldQuery).some(k => rangeOps.includes(k));
    }

    /**
     * Match compound index against query fields
     * @param {Array<string>} queryFields - Query fields
     * @param {Array<string>} indexFields - Index fields
     * @returns {Object} Match result
     */
    static matchCompoundIndex(queryFields, indexFields) {
        // Compound indexes can be used if query matches a prefix
        let matchCount = 0;

        for (let i = 0; i < indexFields.length; i++) {
            if (queryFields.includes(indexFields[i])) {
                matchCount++;
            } else {
                break; // Prefix must be continuous
            }
        }

        if (matchCount === 0) {
            return { match: false, score: 0 };
        }

        // Score based on how many fields matched
        const score = 70 + (matchCount * 10);
        return { match: true, score };
    }
}
