import { StorageError } from '../errors/DatabaseError.js';

/**
 * Metadata Manager
 * Tracks and manages database and collection metadata
 */
export class MetadataManager {
    /**
     * @param {string} databaseName - Database name
     */
    constructor(databaseName) {
        this.databaseName = databaseName;
        this.metadata = {
            database: databaseName,
            version: '2.0.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            collections: []
        };
    }

    /**
     * Load metadata from object
     * @param {Object} data - Metadata object
     */
    load(data) {
        if (data.version && data.version.startsWith('1.')) {
            // Migrate from V1 to V2
            this.metadata = this.migrateFromV1(data);
        } else {
            this.metadata = data;
        }
    }

    /**
     * Migrate V1 metadata to V2 format
     * @param {Object} v1Data - V1 metadata
     * @returns {Object} V2 metadata
     */
    migrateFromV1(v1Data) {
        const collections = (v1Data.collections || []).map(name => ({
            name,
            documents: 0,
            indexes: [],
            size: 0,
            averageDocumentSize: 0,
            createdAt: v1Data.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));

        return {
            database: this.databaseName,
            version: '2.0.0',
            createdAt: v1Data.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            collections
        };
    }

    /**
     * Get metadata for export
     * @returns {Object} Metadata object
     */
    export() {
        return {
            ...this.metadata,
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Add or update collection metadata
     * @param {string} collectionName - Collection name
     * @param {Object} stats - Collection statistics
     */
    updateCollection(collectionName, stats = {}) {
        const index = this.metadata.collections.findIndex(c => c.name === collectionName);

        const collectionMeta = {
            name: collectionName,
            documents: stats.documents || 0,
            indexes: stats.indexes || [],
            size: stats.size || 0,
            averageDocumentSize: stats.averageDocumentSize || 0,
            createdAt: stats.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (index === -1) {
            this.metadata.collections.push(collectionMeta);
        } else {
            // Preserve createdAt
            collectionMeta.createdAt = this.metadata.collections[index].createdAt;
            this.metadata.collections[index] = collectionMeta;
        }

        this.metadata.updatedAt = new Date().toISOString();
    }

    /**
     * Remove collection metadata
     * @param {string} collectionName - Collection name
     */
    removeCollection(collectionName) {
        this.metadata.collections = this.metadata.collections.filter(
            c => c.name !== collectionName
        );
        this.metadata.updatedAt = new Date().toISOString();
    }

    /**
     * Get collection metadata
     * @param {string} collectionName - Collection name
     * @returns {Object|null} Collection metadata
     */
    getCollection(collectionName) {
        return this.metadata.collections.find(c => c.name === collectionName) || null;
    }

    /**
     * List all collections
     * @returns {Array<string>} Collection names
     */
    listCollections() {
        return this.metadata.collections.map(c => c.name);
    }

    /**
     * Get database statistics
     * @returns {Object} Database statistics
     */
    getStats() {
        const totalDocuments = this.metadata.collections.reduce(
            (sum, c) => sum + (c.documents || 0),
            0
        );

        const totalSize = this.metadata.collections.reduce(
            (sum, c) => sum + (c.size || 0),
            0
        );

        const totalIndexes = this.metadata.collections.reduce(
            (sum, c) => sum + (c.indexes?.length || 0),
            0
        );

        return {
            database: this.metadata.database,
            version: this.metadata.version,
            collections: this.metadata.collections.length,
            documents: totalDocuments,
            indexes: totalIndexes,
            size: totalSize,
            createdAt: this.metadata.createdAt,
            updatedAt: this.metadata.updatedAt
        };
    }

    /**
     * Update index metadata for a collection
     * @param {string} collectionName - Collection name
     * @param {Array} indexes - Array of index definitions
     */
    updateIndexes(collectionName, indexes) {
        const collection = this.getCollection(collectionName);
        if (collection) {
            this.updateCollection(collectionName, {
                ...collection,
                indexes
            });
        }
    }

    /**
     * Increment document count for a collection
     * @param {string} collectionName - Collection name
     * @param {number} count - Number to add (can be negative)
     */
    incrementDocumentCount(collectionName, count) {
        const collection = this.getCollection(collectionName);
        if (collection) {
            this.updateCollection(collectionName, {
                ...collection,
                documents: Math.max(0, (collection.documents || 0) + count)
            });
        }
    }

    /**
     * Update collection size
     * @param {string} collectionName - Collection name
     * @param {number} size - Size in bytes
     */
    updateSize(collectionName, size) {
        const collection = this.getCollection(collectionName);
        if (collection) {
            const documents = collection.documents || 0;
            this.updateCollection(collectionName, {
                ...collection,
                size,
                averageDocumentSize: documents > 0 ? Math.round(size / documents) : 0
            });
        }
    }
}
