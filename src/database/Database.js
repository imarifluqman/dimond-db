import { join } from 'path';
import { StorageEngine } from '../engine/StorageEngine.js';
import { Collection } from './Collection.js';
import { validateCollectionName } from '../utils/validator.js';
import { DatabaseOperationError } from '../errors/DatabaseError.js';
import { DatabaseConfig } from '../config/DatabaseConfig.js';
import { CacheManager } from '../cache/CacheManager.js';
import { WALManager } from '../wal/WALManager.js';
import { TransactionManager } from '../transaction/TransactionManager.js';
import { MetadataManager } from '../metadata/MetadataManager.js';
import { PerformanceMonitor } from '../performance/PerformanceMonitor.js';
import { BackupManager } from '../backup/BackupManager.js';

/**
 * Database - Main database class (V2)
 * Enhanced with caching, indexes, transactions, and more
 */
export class Database {
    /**
     * @param {Object} options - Database options
     * @param {string} options.database - Database name (required)
     * @param {string} [options.path] - Root path for database storage
     * @param {boolean} [options.cache] - Enable caching
     * @param {string|number} [options.cacheSize] - Cache size
     * @param {number} [options.cacheTTL] - Cache TTL in ms
     * @param {boolean} [options.journal] - Enable WAL
     * @param {boolean} [options.performanceTracking] - Enable performance monitoring
     * ... (see DatabaseConfig for all options)
     */
    constructor(options = {}) {
        // Parse and validate configuration
        this.config = DatabaseConfig.parse(options);

        this.name = this.config.database;
        this.rootPath = this.config.path;
        this.databasePath = join(this.rootPath, this.name);

        // Core components
        this.storageEngine = new StorageEngine(this.databasePath);
        this.collections = new Map();
        this.initialized = false;

        // V2 components
        this.metadataManager = new MetadataManager(this.name);
        this.performanceMonitor = new PerformanceMonitor(this.config.performanceTracking);

        // Initialize cache if enabled
        this.cacheManager = null;
        if (this.config.cache) {
            this.cacheManager = new CacheManager({
                enabled: true,
                maxSize: Math.floor(this.config.cacheSize / 1024), // Rough estimation
                ttl: this.config.cacheTTL
            });
        }

        // Initialize WAL if enabled
        this.walManager = null;
        if (this.config.journal) {
            this.walManager = new WALManager(this.databasePath, true);
        }

        // Initialize transaction manager
        this.transactionManager = new TransactionManager(this, this.walManager);

        // Initialize backup manager
        this.backupManager = new BackupManager(this);
    }

    /**
     * Initializes the database
     */
    async initialize() {
        if (!this.initialized) {
            const startTime = Date.now();

            await this.storageEngine.initialize();

            // Load metadata
            const metadata = await this.storageEngine.readMetadata();
            this.metadataManager.load(metadata);

            // Initialize WAL and perform recovery if needed
            if (this.walManager) {
                await this.walManager.initialize();
            }

            this.initialized = true;

            this.performanceMonitor.track('read', Date.now() - startTime);
        }
    }

    /**
     * Gets or creates a collection
     * @param {string} name - Collection name
     * @returns {Collection} Collection instance
     */
    collection(name) {
        validateCollectionName(name);

        // Return cached collection if exists
        if (this.collections.has(name)) {
            return this.collections.get(name);
        }

        // Create new collection instance
        const collection = new Collection(name, this.storageEngine, this);
        this.collections.set(name, collection);

        return collection;
    }

    /**
     * Create a collection with schema (V2)
     * @param {string} name - Collection name
     * @param {Object} options - Collection options
     * @param {Object} options.schema - Schema definition
     * @returns {Collection} Collection instance
     */
    createCollection(name, options = {}) {
        const collection = this.collection(name);

        if (options.schema) {
            collection.setSchema(options.schema);
        }

        return collection;
    }

    /**
     * Ensures the database is initialized
     * @returns {Promise<void>}
     */
    async ensureInitialized() {
        await this.initialize();
    }

    /**
     * Lists all collections in the database
     * @returns {Promise<Array<string>>} Array of collection names
     */
    async listCollections() {
        await this.initialize();
        return await this.storageEngine.listCollections();
    }

    /**
     * Drops the entire database
     */
    async dropDatabase() {
        await this.storageEngine.dropDatabase();
        this.collections.clear();

        // Clear cache
        if (this.cacheManager) {
            this.cacheManager.clear();
        }

        // Clear WAL
        if (this.walManager) {
            await this.walManager.clear();
        }

        this.initialized = false;
    }

    /**
     * Closes the database connection (clears cache)
     */
    async close() {
        // Persist metadata
        if (this.initialized) {
            const metadata = this.metadataManager.export();
            await this.storageEngine.writeMetadata(metadata);
        }

        // Checkpoint WAL
        if (this.walManager) {
            await this.walManager.checkpoint();
        }

        // Clear cache
        if (this.cacheManager) {
            this.cacheManager.clear();
        }

        this.collections.clear();
        this.initialized = false;
    }

    /**
     * Gets database statistics (V2 enhanced)
     * @returns {Promise<Object>} Database statistics
     */
    async stats() {
        await this.initialize();
        return this.metadataManager.getStats();
    }

    /**
     * Start a new transaction session (V2)
     * @returns {Session} New session
     */
    startSession() {
        return this.transactionManager.startSession();
    }

    /**
     * Backup database (V2)
     * @param {string} path - Backup path
     * @returns {Promise<Object>} Backup result
     */
    async backup(path) {
        await this.initialize();
        return await this.backupManager.backup(path);
    }

    /**
     * Restore database (V2)
     * @param {string} path - Backup path
     * @returns {Promise<Object>} Restore result
     */
    async restore(path) {
        return await this.backupManager.restore(path);
    }

    /**
     * Get performance metrics (V2)
     * @returns {Object} Performance report
     */
    performance() {
        return this.performanceMonitor.getReport();
    }

    /**
     * Get formatted performance report (V2)
     * @returns {string} Formatted report
     */
    performanceReport() {
        return this.performanceMonitor.getFormattedReport();
    }

    /**
     * Get cache statistics (V2)
     * @returns {Object|null} Cache stats or null if disabled
     */
    cacheStats() {
        return this.cacheManager ? this.cacheManager.getStats() : null;
    }

    /**
     * Get WAL statistics (V2)
     * @returns {Promise<Object>} WAL stats
     */
    async walStats() {
        return this.walManager ? await this.walManager.getStats() : { enabled: false };
    }

    /**
     * Update metadata for a collection
     * @param {string} collectionName - Collection name
     * @param {Object} stats - Collection stats
     */
    async updateCollectionMetadata(collectionName, stats) {
        this.metadataManager.updateCollection(collectionName, stats);

        // Persist metadata
        const metadata = this.metadataManager.export();
        await this.storageEngine.writeMetadata(metadata);
    }
}
