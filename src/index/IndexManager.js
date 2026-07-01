import { join } from 'path';
import { FileStorage } from '../storage/FileStorage.js';
import { BTreeIndex } from './BTreeIndex.js';
import { HashIndex } from './HashIndex.js';
import { IndexDefinition, IndexType, IndexQueryMatcher } from './IndexTypes.js';
import { IndexError, IndexExistsError, IndexNotFoundError, DuplicateKeyError } from '../errors/DatabaseError.js';

/**
 * Index Manager
 * Manages all indexes for a collection
 */
export class IndexManager {
    /**
     * @param {string} collectionName - Collection name
     * @param {string} databasePath - Database path
     */
    constructor(collectionName, databasePath) {
        this.collectionName = collectionName;
        this.databasePath = databasePath;
        this.indexPath = join(databasePath, 'indexes', collectionName);
        this.indexes = new Map(); // indexName -> index instance
        this.loaded = false;
    }

    /**
     * Load all indexes from disk
     */
    async load() {
        if (this.loaded) {
            return;
        }

        try {
            // Ensure index directory exists
            await FileStorage.ensureDir(this.indexPath);

            // Load index definitions
            const files = await FileStorage.listFiles(this.indexPath);
            const indexFiles = files.filter(f => f.endsWith('.idx'));

            for (const file of indexFiles) {
                const indexPath = join(this.indexPath, file);
                try {
                    const data = await FileStorage.readJSON(indexPath);
                    const definition = IndexDefinition.fromJSON(data.definition);

                    // Create index instance
                    let index;
                    if (definition.type === IndexType.HASH) {
                        index = HashIndex.fromJSON(data, definition);
                    } else {
                        index = BTreeIndex.fromJSON(data, definition);
                    }

                    this.indexes.set(definition.name, index);
                } catch (error) {
                    console.error(`Failed to load index ${file}:`, error.message);
                    // Continue loading other indexes
                }
            }

            this.loaded = true;
        } catch (error) {
            throw new IndexError(`Failed to load indexes: ${error.message}`);
        }
    }

    /**
     * Create a new index
     * @param {Object} spec - Index specification (e.g., { age: 1 })
     * @param {Object} options - Index options
     * @returns {Promise<string>} Index name
     */
    async createIndex(spec, options = {}) {
        await this.load();

        // Generate index name
        const indexName = options.name || this.generateIndexName(spec);

        // Check if index already exists
        if (this.indexes.has(indexName)) {
            throw new IndexExistsError(indexName);
        }

        // Create index definition
        const definition = new IndexDefinition(indexName, spec, options);

        // Create index instance
        let index;
        if (definition.type === IndexType.HASH) {
            index = new HashIndex(definition);
        } else {
            index = new BTreeIndex(definition);
        }

        // Store index
        this.indexes.set(indexName, index);

        // Persist empty index (will be populated by rebuild)
        await this.persistIndex(indexName);

        return indexName;
    }

    /**
     * Drop an index
     * @param {string} indexName - Index name
     */
    async dropIndex(indexName) {
        await this.load();

        if (!this.indexes.has(indexName)) {
            throw new IndexNotFoundError(indexName);
        }

        // Remove from memory
        this.indexes.delete(indexName);

        // Remove from disk
        const indexPath = join(this.indexPath, `${indexName}.idx`);
        await FileStorage.deleteFile(indexPath);
    }

    /**
     * List all indexes
     * @returns {Array<Object>} Array of index definitions
     */
    async listIndexes() {
        await this.load();

        const indexes = [];
        for (const [name, index] of this.indexes.entries()) {
            indexes.push({
                name,
                spec: index.definition.spec,
                unique: index.definition.unique,
                sparse: index.definition.sparse,
                type: index.definition.type,
                size: index.size()
            });
        }

        return indexes;
    }

    /**
     * Rebuild all indexes from documents
     * @param {Array<Object>} documents - All documents
     */
    async rebuildAll(documents) {
        await this.load();

        for (const [indexName, index] of this.indexes.entries()) {
            try {
                index.clear();

                for (const doc of documents) {
                    try {
                        index.insert(doc);
                    } catch (error) {
                        if (error.message.includes('Unique constraint')) {
                            throw new DuplicateKeyError(
                                `Cannot rebuild index ${indexName}: ${error.message}`
                            );
                        }
                        throw error;
                    }
                }

                await this.persistIndex(indexName);
            } catch (error) {
                throw new IndexError(`Failed to rebuild index ${indexName}: ${error.message}`);
            }
        }
    }

    /**
     * Insert document into all indexes
     * @param {Object} doc - Document
     */
    async insertDocument(doc) {
        if (!this.loaded) {
            return;
        }

        for (const [indexName, index] of this.indexes.entries()) {
            try {
                index.insert(doc);
            } catch (error) {
                // Rollback inserts
                for (const [prevName, prevIndex] of this.indexes.entries()) {
                    if (prevName === indexName) break;
                    prevIndex.remove(doc._id);
                }
                throw new DuplicateKeyError(
                    `Index ${indexName}: ${error.message}`
                );
            }
        }
    }

    /**
     * Update document in all indexes
     * @param {Object} oldDoc - Old document
     * @param {Object} newDoc - New document
     */
    async updateDocument(oldDoc, newDoc) {
        if (!this.loaded) {
            return;
        }

        for (const [indexName, index] of this.indexes.entries()) {
            try {
                index.update(oldDoc, newDoc);
            } catch (error) {
                // Rollback updates
                for (const [prevName, prevIndex] of this.indexes.entries()) {
                    if (prevName === indexName) break;
                    prevIndex.update(newDoc, oldDoc);
                }
                throw new DuplicateKeyError(
                    `Index ${indexName}: ${error.message}`
                );
            }
        }
    }

    /**
     * Remove document from all indexes
     * @param {Object} doc - Document
     */
    async removeDocument(doc) {
        if (!this.loaded) {
            return;
        }

        for (const index of this.indexes.values()) {
            index.remove(doc._id);
        }
    }

    /**
     * Find best index for a query
     * @param {Object} filter - Query filter
     * @returns {Object|null} Best index and match info
     */
    findBestIndex(filter) {
        if (!this.loaded || this.indexes.size === 0) {
            return null;
        }

        let bestMatch = null;
        let bestScore = 0;

        for (const [name, index] of this.indexes.entries()) {
            const match = IndexQueryMatcher.canUseIndex(filter, index.definition);

            if (match.match && match.score > bestScore) {
                bestMatch = { name, index, score: match.score };
                bestScore = match.score;
            }
        }

        return bestMatch;
    }

    /**
     * Execute query using an index
     * @param {Object} index - Index instance
     * @param {Object} filter - Query filter
     * @returns {Set<string>} Set of document IDs
     */
    executeIndexQuery(index, filter) {
        const field = index.definition.fields[0];
        const fieldQuery = filter[field];

        // Exact match
        if (!this.isOperatorQuery(fieldQuery)) {
            return index.find(fieldQuery);
        }

        // $in operator
        if (fieldQuery.$in) {
            return index.findIn ? index.findIn(fieldQuery.$in) : new Set();
        }

        // Range query (BTree only)
        if (index instanceof BTreeIndex && this.isRangeQuery(fieldQuery)) {
            return index.findRange(fieldQuery);
        }

        // Fallback to full scan
        return null;
    }

    /**
     * Check if field query uses operators
     * @param {*} fieldQuery - Field query
     * @returns {boolean} True if uses operators
     */
    isOperatorQuery(fieldQuery) {
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
    isRangeQuery(fieldQuery) {
        if (!this.isOperatorQuery(fieldQuery)) {
            return false;
        }
        const rangeOps = ['$gt', '$gte', '$lt', '$lte'];
        return Object.keys(fieldQuery).some(k => rangeOps.includes(k));
    }

    /**
     * Persist an index to disk
     * @param {string} indexName - Index name
     */
    async persistIndex(indexName) {
        const index = this.indexes.get(indexName);
        if (!index) {
            return;
        }

        const indexPath = join(this.indexPath, `${indexName}.idx`);
        const data = index.toJSON();

        await FileStorage.writeJSON(indexPath, data);
    }

    /**
     * Persist all indexes to disk
     */
    async persistAll() {
        if (!this.loaded) {
            return;
        }

        for (const indexName of this.indexes.keys()) {
            await this.persistIndex(indexName);
        }
    }

    /**
     * Generate index name from spec
     * @param {Object} spec - Index specification
     * @returns {string} Index name
     */
    generateIndexName(spec) {
        const parts = [];
        for (const [field, direction] of Object.entries(spec)) {
            parts.push(`${field}_${direction}`);
        }
        return parts.join('_');
    }

    /**
     * Get index by name
     * @param {string} indexName - Index name
     * @returns {Object|null} Index instance
     */
    getIndex(indexName) {
        return this.indexes.get(indexName) || null;
    }

    /**
     * Check if index exists
     * @param {string} indexName - Index name
     * @returns {boolean} True if exists
     */
    hasIndex(indexName) {
        return this.indexes.has(indexName);
    }

    /**
     * Get index count
     * @returns {number} Number of indexes
     */
    getIndexCount() {
        return this.indexes.size;
    }
}
