import { Session } from './Session.js';
import { TransactionError, TransactionAbortError } from '../errors/DatabaseError.js';

/**
 * Transaction Manager
 * Manages ACID transactions
 */
export class TransactionManager {
    /**
     * @param {Object} database - Database instance
     * @param {Object} walManager - WAL manager instance
     */
    constructor(database, walManager = null) {
        this.database = database;
        this.walManager = walManager;
        this.activeSessions = new Map();
    }

    /**
     * Start a new session
     * @returns {Session} New session
     */
    startSession() {
        const session = new Session(this);
        this.activeSessions.set(session.id, session);
        return session;
    }

    /**
     * End a session
     * @param {string} sessionId - Session ID
     */
    endSession(sessionId) {
        this.activeSessions.delete(sessionId);
    }

    /**
     * Execute transaction operations
     * @param {Array} operations - Operations to execute
     */
    async executeOperations(operations) {
        // Collect all collections involved
        const collectionsUsed = new Set();
        const originalStates = new Map();

        try {
            // Phase 1: Capture original states
            for (const operation of operations) {
                collectionsUsed.add(operation.collection);
            }

            for (const collectionName of collectionsUsed) {
                const collection = this.database.collection(collectionName);
                await collection.load();

                // Save snapshot
                originalStates.set(collectionName, {
                    documents: JSON.parse(JSON.stringify(collection.documents))
                });
            }

            // Phase 2: Execute operations
            for (const operation of operations) {
                await this.executeOperation(operation);
            }

            // Phase 3: Persist all changes
            for (const collectionName of collectionsUsed) {
                const collection = this.database.collection(collectionName);
                await collection.persist();

                // Update indexes if they exist
                if (collection.indexManager && collection.indexManager.loaded) {
                    await collection.indexManager.persistAll();
                }
            }

        } catch (error) {
            // Rollback: restore original states
            for (const [collectionName, state] of originalStates.entries()) {
                const collection = this.database.collection(collectionName);
                collection.documents = state.documents;
                await collection.persist();

                // Rebuild indexes
                if (collection.indexManager && collection.indexManager.loaded) {
                    await collection.indexManager.rebuildAll(collection.documents);
                }
            }

            throw new TransactionAbortError(`Transaction failed: ${error.message}`);
        }
    }

    /**
     * Execute a single operation
     * @param {Object} operation - Operation to execute
     */
    async executeOperation(operation) {
        const collection = this.database.collection(operation.collection);

        switch (operation.type) {
            case 'insert':
                await this.executeInsert(collection, operation.data);
                break;

            case 'update':
                await this.executeUpdate(collection, operation.data);
                break;

            case 'delete':
                await this.executeDelete(collection, operation.data);
                break;

            default:
                throw new TransactionError(`Unknown operation type: ${operation.type}`);
        }
    }

    /**
     * Execute insert operation
     * @param {Object} collection - Collection instance
     * @param {Object} data - Operation data
     */
    async executeInsert(collection, data) {
        const { document } = data;

        // Use collection's internal insert logic but skip persist
        const { validateDocument } = await import('../utils/validator.js');
        const { deepClone } = await import('../utils/deepClone.js');
        const { generateId } = await import('../utils/idGenerator.js');

        validateDocument(document);

        const doc = deepClone(document);

        if (!doc._id) {
            doc._id = generateId();
        }

        // Check for duplicate _id
        if (collection.documents.some(d => d._id === doc._id)) {
            throw new Error(`Duplicate key error: document with _id "${doc._id}" already exists`);
        }

        // Insert into indexes
        if (collection.indexManager && collection.indexManager.loaded) {
            await collection.indexManager.insertDocument(doc);
        }

        collection.documents.push(doc);
    }

    /**
     * Execute update operation
     * @param {Object} collection - Collection instance
     * @param {Object} data - Operation data
     */
    async executeUpdate(collection, data) {
        const { filter, update } = data;
        const { QueryEngine } = await import('../engine/QueryEngine.js');

        const docIndex = collection.documents.findIndex(doc =>
            QueryEngine.match(doc, filter)
        );

        if (docIndex === -1) {
            return; // No match, no-op
        }

        const oldDoc = { ...collection.documents[docIndex] };

        // Apply update
        collection.applyUpdate(collection.documents[docIndex], update);

        // Update indexes
        if (collection.indexManager && collection.indexManager.loaded) {
            await collection.indexManager.updateDocument(oldDoc, collection.documents[docIndex]);
        }
    }

    /**
     * Execute delete operation
     * @param {Object} collection - Collection instance
     * @param {Object} data - Operation data
     */
    async executeDelete(collection, data) {
        const { filter } = data;
        const { QueryEngine } = await import('../engine/QueryEngine.js');

        const docIndex = collection.documents.findIndex(doc =>
            QueryEngine.match(doc, filter)
        );

        if (docIndex === -1) {
            return; // No match, no-op
        }

        const doc = collection.documents[docIndex];

        // Remove from indexes
        if (collection.indexManager && collection.indexManager.loaded) {
            await collection.indexManager.removeDocument(doc);
        }

        collection.documents.splice(docIndex, 1);
    }

    /**
     * Get active session count
     * @returns {number} Number of active sessions
     */
    getActiveSessionCount() {
        return this.activeSessions.size;
    }

    /**
     * Get all active sessions
     * @returns {Array} Session information
     */
    getActiveSessions() {
        const sessions = [];
        for (const session of this.activeSessions.values()) {
            sessions.push(session.getInfo());
        }
        return sessions;
    }

    /**
     * Abort all active transactions
     */
    async abortAll() {
        for (const session of this.activeSessions.values()) {
            if (session.isActive()) {
                await session.abort();
            }
        }
    }
}
