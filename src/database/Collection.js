import { QueryEngine } from '../engine/QueryEngine.js';
import { StorageEngine } from '../engine/StorageEngine.js';
import { Cursor } from '../cursor/Cursor.js';
import { CursorEngine } from '../engine/CursorEngine.js';
import { IndexManager } from '../index/IndexManager.js';
import { HookManager } from '../hooks/HookManager.js';
import { SchemaValidator } from '../schema/SchemaValidator.js';
import { SchemaDefinition } from '../schema/SchemaDefinition.js';
import { generateId } from '../utils/idGenerator.js';
import { deepClone } from '../utils/deepClone.js';
import {
    validateDocument,
    validateDocuments,
    validateFilter,
    validateUpdate
} from '../utils/validator.js';
import {
    DuplicateKeyError,
    ValidationError,
    QueryError,
    SchemaValidationError
} from '../errors/DatabaseError.js';
import { setNestedValue, deleteNestedValue, getNestedValue } from '../query/operators.js';

/**
 * Collection - Represents a collection of documents (V2 Enhanced)
 */
export class Collection {
    /**
     * @param {string} name - Collection name
     * @param {StorageEngine} storageEngine - Storage engine instance
     * @param {Database} database - Database instance
     */
    constructor(name, storageEngine, database) {
        this.name = name;
        this.storageEngine = storageEngine;
        this.database = database;
        this.documents = [];
        this.loaded = false;

        // V2 components
        this.indexManager = null;
        this.hookManager = new HookManager();
        this.schemaValidator = null;

        // Lazy initialization of index manager
        this._indexManagerInitialized = false;
    }

    /**
     * Ensure index manager is initialized
     */
    async ensureIndexManager() {
        if (!this._indexManagerInitialized) {
            this.indexManager = new IndexManager(this.name, this.database.databasePath);
            this._indexManagerInitialized = true;
        }
    }

    /**
     * Set schema for this collection (V2)
     * @param {Object} schema - Schema definition
     */
    setSchema(schema) {
        const schemaDef = new SchemaDefinition(schema);
        this.schemaValidator = new SchemaValidator(schemaDef);

        // Create unique indexes for unique fields
        if (this.database.config.autoIndex) {
            const uniqueFields = this.schemaValidator.getUniqueFields();
            for (const field of uniqueFields) {
                // Defer index creation until collection is loaded
                this.load().then(() => {
                    this.createIndex({ [field]: 1 }, { unique: true }).catch(err => {
                        console.warn(`Failed to create unique index on ${field}:`, err.message);
                    });
                });
            }
        }
    }

    /**
     * Register a pre-hook (V2)
     * @param {string} event - Event name
     * @param {Function} handler - Hook handler
     */
    pre(event, handler) {
        this.hookManager.pre(event, handler);
    }

    /**
     * Register a post-hook (V2)
     * @param {string} event - Event name
     * @param {Function} handler - Hook handler
     */
    post(event, handler) {
        this.hookManager.post(event, handler);
    }

    /**
     * Loads the collection from disk
     */
    async load() {
        if (!this.loaded) {
            const startTime = Date.now();

            // Ensure database is initialized first
            await this.database.ensureInitialized();
            this.documents = await this.storageEngine.readCollection(this.name);

            // Load indexes if enabled
            if (this.database.config.autoIndex) {
                await this.ensureIndexManager();
                await this.indexManager.load();
            }

            this.loaded = true;

            this.database.performanceMonitor.track('read', Date.now() - startTime);
        }
    }

    /**
     * Persists the collection to disk
     */
    async persist() {
        const startTime = Date.now();

        await this.storageEngine.writeCollection(this.name, this.documents);

        // Update metadata
        const size = JSON.stringify(this.documents).length;
        await this.database.updateCollectionMetadata(this.name, {
            documents: this.documents.length,
            size,
            indexes: this.indexManager ? (await this.indexManager.listIndexes()).map(i => i.name) : []
        });

        this.database.performanceMonitor.track('write', Date.now() - startTime);
    }

    /**
     * Create an index (V2)
     * @param {Object} spec - Index specification
     * @param {Object} options - Index options
     * @returns {Promise<string>} Index name
     */
    async createIndex(spec, options = {}) {
        await this.load();
        await this.ensureIndexManager();

        const indexName = await this.indexManager.createIndex(spec, options);

        // Rebuild index with current documents
        const index = this.indexManager.getIndex(indexName);
        for (const doc of this.documents) {
            index.insert(doc);
        }

        await this.indexManager.persistIndex(indexName);

        return indexName;
    }

    /**
     * Drop an index (V2)
     * @param {string} indexName - Index name
     */
    async dropIndex(indexName) {
        await this.ensureIndexManager();
        await this.indexManager.dropIndex(indexName);
    }

    /**
     * List all indexes (V2)
     * @returns {Promise<Array>} Array of index definitions
     */
    async listIndexes() {
        await this.ensureIndexManager();
        return await this.indexManager.listIndexes();
    }

    /**
     * Get collection statistics (V2)
     * @returns {Promise<Object>} Collection stats
     */
    async stats() {
        await this.load();

        const size = JSON.stringify(this.documents).length;
        const avgDocSize = this.documents.length > 0 ? Math.round(size / this.documents.length) : 0;

        return {
            collection: this.name,
            documents: this.documents.length,
            size,
            averageDocumentSize: avgDocSize,
            indexes: this.indexManager ? await this.indexManager.listIndexes() : [],
            schema: this.schemaValidator ? 'enabled' : 'disabled'
        };
    }

    /**
     * Find documents with cursor (V2)
     * @param {Object} filter - Query filter
     * @returns {Cursor} Cursor instance
     */
    findCursor(filter = {}) {
        // Note: cursor execution is deferred until methods like toArray() are called
        // We need to ensure collection is loaded before cursor executes
        const self = this;
        const loadPromise = this.load();

        // Create cursor with lazy loading
        const cursor = new Cursor([], filter);

        // Override cursor's execute to load collection first
        const originalExecute = cursor.execute.bind(cursor);
        cursor.execute = async function() {
            await loadPromise;

            // Execute pre-find hooks
            const hookContext = await self.hookManager.executePre('find', { filter });
            const effectiveFilter = hookContext.filter !== undefined ? hookContext.filter : filter;

            // Use index if available
            let results;
            if (self.indexManager && self.indexManager.loaded) {
                const cursorEngine = new CursorEngine(self.documents, effectiveFilter, self.indexManager);
                results = cursorEngine.execute();
            } else {
                results = QueryEngine.find(self.documents, effectiveFilter);
            }

            // Track performance
            self.database.performanceMonitor.track('query', 0, { filter: effectiveFilter });
            self.database.performanceMonitor.trackIndexUsage(
                self.indexManager && self.indexManager.loaded &&
                self.indexManager.findBestIndex(effectiveFilter) !== null
            );

            // Set documents for cursor
            this.documents = results;

            // Execute post-find hooks
            await self.hookManager.executePost('find', { filter: effectiveFilter, results });

            return await originalExecute.call(this);
        };

        return cursor;
    }

    /**
     * Inserts a single document
     * @param {Object} doc - Document to insert
     * @param {Session} session - Transaction session (optional)
     * @returns {Promise<Object>} Result object with insertedId
     */
    async insertOne(doc, session = null) {
        // Handle transactional insert
        if (session && session.isActive()) {
            session.addOperation({
                type: 'insert',
                collection: this.name,
                data: { document: doc }
            });
            return { acknowledged: true, insertedId: doc._id || 'pending' };
        }

        await this.load();

        const startTime = Date.now();

        // Execute pre-insert hooks
        const hookContext = await this.hookManager.executePre('insert', { document: doc });
        const effectiveDoc = hookContext.document !== undefined ? hookContext.document : doc;

        validateDocument(effectiveDoc);

        // Schema validation
        if (this.schemaValidator && this.database.config.strictSchema) {
            this.schemaValidator.validate(effectiveDoc, false);
        }

        const document = deepClone(effectiveDoc);

        // Generate _id if not provided
        if (!document._id) {
            document._id = generateId();
        }

        // Check for duplicate _id
        if (this.documents.some(d => d._id === document._id)) {
            throw new DuplicateKeyError(document._id);
        }

        // Insert into indexes
        if (this.indexManager && this.indexManager.loaded) {
            await this.indexManager.insertDocument(document);
        }

        // WAL logging
        if (this.database.walManager) {
            await this.database.walManager.logInsert(this.name, document);
        }

        this.documents.push(document);
        await this.persist();

        // Invalidate cache
        if (this.database.cacheManager) {
            this.database.cacheManager.invalidateCollection(this.name);
        }

        // Execute post-insert hooks
        await this.hookManager.executePost('insert', { document });

        this.database.performanceMonitor.track('insert', Date.now() - startTime);

        return {
            acknowledged: true,
            insertedId: document._id
        };
    }

    /**
     * Inserts multiple documents
     * @param {Array} docs - Array of documents to insert
     * @param {Session} session - Transaction session (optional)
     * @returns {Promise<Object>} Result object with insertedIds
     */
    async insertMany(docs, session = null) {
        // Handle transactional insert
        if (session && session.isActive()) {
            for (const doc of docs) {
                session.addOperation({
                    type: 'insert',
                    collection: this.name,
                    data: { document: doc }
                });
            }
            return { acknowledged: true, insertedCount: docs.length, insertedIds: [] };
        }

        await this.load();

        validateDocuments(docs);

        const insertedIds = [];
        const documents = docs.map(doc => {
            // Execute pre-insert hooks
            const document = deepClone(doc);

            // Schema validation
            if (this.schemaValidator && this.database.config.strictSchema) {
                this.schemaValidator.validate(document, false);
            }

            // Generate _id if not provided
            if (!document._id) {
                document._id = generateId();
            }

            // Check for duplicate _id within the batch
            if (insertedIds.includes(document._id)) {
                throw new DuplicateKeyError(document._id);
            }

            // Check for duplicate _id in existing documents
            if (this.documents.some(d => d._id === document._id)) {
                throw new DuplicateKeyError(document._id);
            }

            insertedIds.push(document._id);
            return document;
        });

        // Insert into indexes
        if (this.indexManager && this.indexManager.loaded) {
            for (const document of documents) {
                await this.indexManager.insertDocument(document);
            }
        }

        this.documents.push(...documents);
        await this.persist();

        // Invalidate cache
        if (this.database.cacheManager) {
            this.database.cacheManager.invalidateCollection(this.name);
        }

        return {
            acknowledged: true,
            insertedCount: documents.length,
            insertedIds
        };
    }

    /**
     * Finds documents matching a filter
     * @param {Object} filter - Query filter
     * @returns {Promise<Array>} Array of matching documents
     */
    async find(filter = {}) {
        await this.load();

        const startTime = Date.now();

        // Check cache first
        if (this.database.cacheManager) {
            const cached = this.database.cacheManager.getQuery(this.name, filter);
            if (cached !== undefined) {
                this.database.performanceMonitor.trackCacheHit();
                return cached;
            }
            this.database.performanceMonitor.trackCacheMiss();
        }

        validateFilter(filter);

        // Execute pre-find hooks
        const hookContext = await this.hookManager.executePre('find', { filter });
        const effectiveFilter = hookContext.filter || filter;

        // Use index if available
        let results;
        if (this.indexManager && this.indexManager.loaded) {
            const cursorEngine = new CursorEngine(this.documents, effectiveFilter, this.indexManager);
            results = cursorEngine.execute();
            this.database.performanceMonitor.trackIndexUsage(true);
        } else {
            results = QueryEngine.find(this.documents, effectiveFilter);
            this.database.performanceMonitor.trackIndexUsage(false);
        }

        const clonedResults = results.map(doc => deepClone(doc));

        // Cache results
        if (this.database.cacheManager) {
            this.database.cacheManager.setQuery(this.name, filter, clonedResults);
        }

        // Execute post-find hooks
        await this.hookManager.executePost('find', { filter: effectiveFilter, results: clonedResults });

        this.database.performanceMonitor.track('query', Date.now() - startTime, { filter });

        return clonedResults;
    }

    /**
     * Finds the first document matching a filter
     * @param {Object} filter - Query filter
     * @returns {Promise<Object|null>} The first matching document or null
     */
    async findOne(filter = {}) {
        await this.load();

        validateFilter(filter);

        // Execute pre-find hooks
        const hookContext = await this.hookManager.executePre('find', { filter });
        const effectiveFilter = hookContext.filter || filter;

        const result = QueryEngine.findOne(this.documents, effectiveFilter);

        // Execute post-find hooks
        await this.hookManager.executePost('find', { filter: effectiveFilter, results: result ? [result] : [] });

        return result ? deepClone(result) : null;
    }

    /**
     * Updates a single document
     * @param {Object} filter - Query filter
     * @param {Object} update - Update operations
     * @param {Session} session - Transaction session (optional)
     * @returns {Promise<Object>} Result object with matchedCount and modifiedCount
     */
    async updateOne(filter = {}, update, session = null) {
        // Handle transactional update
        if (session && session.isActive()) {
            session.addOperation({
                type: 'update',
                collection: this.name,
                data: { filter, update }
            });
            return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
        }

        await this.load();

        validateFilter(filter);
        validateUpdate(update);

        // Schema validation for update
        if (this.schemaValidator && this.database.config.strictSchema) {
            this.schemaValidator.validateUpdate(update);
        }

        // Execute pre-update hooks
        const hookContext = await this.hookManager.executePre('update', { filter, update });
        const effectiveFilter = hookContext.filter !== undefined ? hookContext.filter : filter;
        const effectiveUpdate = hookContext.update !== undefined ? hookContext.update : update;

        const docIndex = this.documents.findIndex(doc =>
            QueryEngine.match(doc, effectiveFilter)
        );

        if (docIndex === -1) {
            return {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0
            };
        }

        const originalDoc = JSON.stringify(this.documents[docIndex]);
        const oldDoc = { ...this.documents[docIndex] };

        this.applyUpdate(this.documents[docIndex], effectiveUpdate);
        const modified = JSON.stringify(this.documents[docIndex]) !== originalDoc;

        // Update indexes
        if (modified && this.indexManager && this.indexManager.loaded) {
            await this.indexManager.updateDocument(oldDoc, this.documents[docIndex]);
        }

        await this.persist();

        // Invalidate cache
        if (this.database.cacheManager) {
            this.database.cacheManager.invalidateCollection(this.name);
        }

        // Execute post-update hooks
        await this.hookManager.executePost('update', {
            filter: effectiveFilter,
            update: effectiveUpdate,
            document: this.documents[docIndex]
        });

        return {
            acknowledged: true,
            matchedCount: 1,
            modifiedCount: modified ? 1 : 0
        };
    }

    /**
     * Updates multiple documents
     * @param {Object} filter - Query filter
     * @param {Object} update - Update operations
     * @param {Session} session - Transaction session (optional)
     * @returns {Promise<Object>} Result object with matchedCount and modifiedCount
     */
    async updateMany(filter = {}, update, session = null) {
        await this.load();

        validateFilter(filter);
        validateUpdate(update);

        // Schema validation for update
        if (this.schemaValidator && this.database.config.strictSchema) {
            this.schemaValidator.validateUpdate(update);
        }

        const matchingIndices = this.documents
            .map((doc, index) => QueryEngine.match(doc, filter) ? index : -1)
            .filter(index => index !== -1);

        let modifiedCount = 0;

        for (const index of matchingIndices) {
            const originalDoc = JSON.stringify(this.documents[index]);
            const oldDoc = { ...this.documents[index] };

            this.applyUpdate(this.documents[index], update);

            if (JSON.stringify(this.documents[index]) !== originalDoc) {
                modifiedCount++;

                // Update indexes
                if (this.indexManager && this.indexManager.loaded) {
                    await this.indexManager.updateDocument(oldDoc, this.documents[index]);
                }
            }
        }

        await this.persist();

        // Invalidate cache
        if (this.database.cacheManager) {
            this.database.cacheManager.invalidateCollection(this.name);
        }

        return {
            acknowledged: true,
            matchedCount: matchingIndices.length,
            modifiedCount
        };
    }

    /**
     * Applies update operations to a document
     * @param {Object} document - The document to update
     * @param {Object} update - Update operations
     */
    applyUpdate(document, update) {
        const operators = Object.keys(update);

        // If no operators, it's a direct replacement (not recommended, but supported)
        if (!operators.some(key => key.startsWith('$'))) {
            throw new ValidationError('Update must use update operators ($set, $unset, etc.)');
        }

        for (const [operator, fields] of Object.entries(update)) {
            switch (operator) {
                case '$set':
                    this.applySet(document, fields);
                    break;
                case '$unset':
                    this.applyUnset(document, fields);
                    break;
                case '$inc':
                    this.applyInc(document, fields);
                    break;
                case '$push':
                    this.applyPush(document, fields);
                    break;
                default:
                    throw new QueryError(`Unknown update operator: ${operator}`);
            }
        }
    }

    /**
     * Applies $set operator
     * @param {Object} document - The document to update
     * @param {Object} fields - Fields to set
     */
    applySet(document, fields) {
        for (const [path, value] of Object.entries(fields)) {
            setNestedValue(document, path, deepClone(value));
        }
    }

    /**
     * Applies $unset operator
     * @param {Object} document - The document to update
     * @param {Object} fields - Fields to unset
     */
    applyUnset(document, fields) {
        for (const path of Object.keys(fields)) {
            deleteNestedValue(document, path);
        }
    }

    /**
     * Applies $inc operator
     * @param {Object} document - The document to update
     * @param {Object} fields - Fields to increment
     */
    applyInc(document, fields) {
        for (const [path, value] of Object.entries(fields)) {
            if (typeof value !== 'number') {
                throw new ValidationError('$inc operator requires numeric value');
            }

            const currentValue = getNestedValue(document, path);

            if (currentValue === undefined) {
                setNestedValue(document, path, value);
            } else if (typeof currentValue !== 'number') {
                throw new ValidationError('$inc can only be applied to numeric fields');
            } else {
                setNestedValue(document, path, currentValue + value);
            }
        }
    }

    /**
     * Applies $push operator
     * @param {Object} document - The document to update
     * @param {Object} fields - Fields to push to
     */
    applyPush(document, fields) {
        for (const [path, value] of Object.entries(fields)) {
            const currentValue = getNestedValue(document, path);

            if (currentValue === undefined) {
                setNestedValue(document, path, [deepClone(value)]);
            } else if (!Array.isArray(currentValue)) {
                throw new ValidationError('$push can only be applied to array fields');
            } else {
                currentValue.push(deepClone(value));
            }
        }
    }

    /**
     * Deletes a single document
     * @param {Object} filter - Query filter
     * @param {Session} session - Transaction session (optional)
     * @returns {Promise<Object>} Result object with deletedCount
     */
    async deleteOne(filter = {}, session = null) {
        // Handle transactional delete
        if (session && session.isActive()) {
            session.addOperation({
                type: 'delete',
                collection: this.name,
                data: { filter }
            });
            return { acknowledged: true, deletedCount: 1 };
        }

        await this.load();

        validateFilter(filter);

        // Execute pre-delete hooks
        const hookContext = await this.hookManager.executePre('delete', { filter });
        const effectiveFilter = hookContext.filter !== undefined ? hookContext.filter : filter;

        const docIndex = this.documents.findIndex(doc =>
            QueryEngine.match(doc, effectiveFilter)
        );

        if (docIndex === -1) {
            return {
                acknowledged: true,
                deletedCount: 0
            };
        }

        const deletedDoc = this.documents[docIndex];

        // Remove from indexes
        if (this.indexManager && this.indexManager.loaded) {
            await this.indexManager.removeDocument(deletedDoc);
        }

        this.documents.splice(docIndex, 1);
        await this.persist();

        // Invalidate cache
        if (this.database.cacheManager) {
            this.database.cacheManager.invalidateCollection(this.name);
        }

        // Execute post-delete hooks
        await this.hookManager.executePost('delete', { filter: effectiveFilter, document: deletedDoc });

        return {
            acknowledged: true,
            deletedCount: 1
        };
    }

    /**
     * Deletes multiple documents
     * @param {Object} filter - Query filter
     * @param {Session} session - Transaction session (optional)
     * @returns {Promise<Object>} Result object with deletedCount
     */
    async deleteMany(filter = {}, session = null) {
        await this.load();

        validateFilter(filter);

        const initialCount = this.documents.length;

        // Remove from indexes first
        if (this.indexManager && this.indexManager.loaded) {
            const toDelete = this.documents.filter(doc => QueryEngine.match(doc, filter));
            for (const doc of toDelete) {
                await this.indexManager.removeDocument(doc);
            }
        }

        this.documents = this.documents.filter(doc =>
            !QueryEngine.match(doc, filter)
        );

        const deletedCount = initialCount - this.documents.length;

        await this.persist();

        // Invalidate cache
        if (this.database.cacheManager) {
            this.database.cacheManager.invalidateCollection(this.name);
        }

        return {
            acknowledged: true,
            deletedCount
        };
    }

    /**
     * Counts documents matching a filter
     * @param {Object} filter - Query filter
     * @returns {Promise<number>} Count of matching documents
     */
    async countDocuments(filter = {}) {
        await this.load();

        validateFilter(filter);

        return QueryEngine.find(this.documents, filter).length;
    }

    /**
     * Drops the collection
     */
    async drop() {
        // Drop indexes
        if (this.indexManager && this.indexManager.loaded) {
            const indexes = await this.indexManager.listIndexes();
            for (const index of indexes) {
                await this.indexManager.dropIndex(index.name);
            }
        }

        await this.storageEngine.deleteCollection(this.name);
        this.documents = [];
        this.loaded = false;

        // Invalidate cache
        if (this.database.cacheManager) {
            this.database.cacheManager.invalidateCollection(this.name);
        }

        // Remove from metadata
        this.database.metadataManager.removeCollection(this.name);
    }
}
