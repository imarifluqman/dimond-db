import { LRUCache } from './LRUCache.js';
import { CacheError } from '../errors/DatabaseError.js';

/**
 * Cache Manager
 * Manages document and query result caching with TTL support
 */
export class CacheManager {
    /**
     * @param {Object} options - Cache options
     * @param {boolean} options.enabled - Enable caching
     * @param {number} options.maxSize - Maximum cache size (number of items)
     * @param {number} options.ttl - Time to live in milliseconds (null = no expiry)
     */
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || null;

        // Separate caches for documents and queries
        this.documentCache = new LRUCache(this.maxSize);
        this.queryCache = new LRUCache(Math.floor(this.maxSize / 2));

        // TTL tracking
        this.ttlMap = new Map(); // key -> expiry timestamp

        // Stats
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            invalidations: 0
        };
    }

    /**
     * Generate cache key for document
     * @param {string} collection - Collection name
     * @param {string} id - Document ID
     * @returns {string} Cache key
     */
    static documentKey(collection, id) {
        return `doc:${collection}:${id}`;
    }

    /**
     * Generate cache key for query
     * @param {string} collection - Collection name
     * @param {Object} filter - Query filter
     * @returns {string} Cache key
     */
    static queryKey(collection, filter) {
        const filterStr = JSON.stringify(filter);
        return `query:${collection}:${this.hashCode(filterStr)}`;
    }

    /**
     * Simple hash function for query filters
     * @param {string} str - String to hash
     * @returns {number} Hash code
     */
    static hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    /**
     * Get document from cache
     * @param {string} collection - Collection name
     * @param {string} id - Document ID
     * @returns {Object|undefined} Cached document
     */
    getDocument(collection, id) {
        if (!this.enabled) {
            return undefined;
        }

        const key = CacheManager.documentKey(collection, id);

        // Check TTL
        if (this.isExpired(key)) {
            this.documentCache.delete(key);
            this.ttlMap.delete(key);
            this.stats.misses++;
            return undefined;
        }

        const value = this.documentCache.get(key);

        if (value !== undefined) {
            this.stats.hits++;
        } else {
            this.stats.misses++;
        }

        return value;
    }

    /**
     * Cache a document
     * @param {string} collection - Collection name
     * @param {string} id - Document ID
     * @param {Object} document - Document to cache
     */
    setDocument(collection, id, document) {
        if (!this.enabled) {
            return;
        }

        const key = CacheManager.documentKey(collection, id);
        this.documentCache.set(key, document);

        if (this.ttl) {
            this.ttlMap.set(key, Date.now() + this.ttl);
        }
    }

    /**
     * Get query results from cache
     * @param {string} collection - Collection name
     * @param {Object} filter - Query filter
     * @returns {Array|undefined} Cached results
     */
    getQuery(collection, filter) {
        if (!this.enabled) {
            return undefined;
        }

        const key = CacheManager.queryKey(collection, filter);

        // Check TTL
        if (this.isExpired(key)) {
            this.queryCache.delete(key);
            this.ttlMap.delete(key);
            this.stats.misses++;
            return undefined;
        }

        const value = this.queryCache.get(key);

        if (value !== undefined) {
            this.stats.hits++;
        } else {
            this.stats.misses++;
        }

        return value;
    }

    /**
     * Cache query results
     * @param {string} collection - Collection name
     * @param {Object} filter - Query filter
     * @param {Array} results - Query results
     */
    setQuery(collection, filter, results) {
        if (!this.enabled) {
            return;
        }

        const key = CacheManager.queryKey(collection, filter);
        this.queryCache.set(key, results);

        if (this.ttl) {
            this.ttlMap.set(key, Date.now() + this.ttl);
        }
    }

    /**
     * Invalidate all cache entries for a collection
     * @param {string} collection - Collection name
     */
    invalidateCollection(collection) {
        if (!this.enabled) {
            return;
        }

        const docPrefix = `doc:${collection}:`;
        const queryPrefix = `query:${collection}:`;

        // Invalidate documents
        for (const key of this.documentCache.keys()) {
            if (key.startsWith(docPrefix)) {
                this.documentCache.delete(key);
                this.ttlMap.delete(key);
                this.stats.invalidations++;
            }
        }

        // Invalidate queries
        for (const key of this.queryCache.keys()) {
            if (key.startsWith(queryPrefix)) {
                this.queryCache.delete(key);
                this.ttlMap.delete(key);
                this.stats.invalidations++;
            }
        }
    }

    /**
     * Invalidate a specific document
     * @param {string} collection - Collection name
     * @param {string} id - Document ID
     */
    invalidateDocument(collection, id) {
        if (!this.enabled) {
            return;
        }

        const key = CacheManager.documentKey(collection, id);
        if (this.documentCache.delete(key)) {
            this.ttlMap.delete(key);
            this.stats.invalidations++;
        }

        // Also invalidate all queries for this collection
        this.invalidateCollectionQueries(collection);
    }

    /**
     * Invalidate all query cache for a collection
     * @param {string} collection - Collection name
     */
    invalidateCollectionQueries(collection) {
        if (!this.enabled) {
            return;
        }

        const queryPrefix = `query:${collection}:`;

        for (const key of this.queryCache.keys()) {
            if (key.startsWith(queryPrefix)) {
                this.queryCache.delete(key);
                this.ttlMap.delete(key);
                this.stats.invalidations++;
            }
        }
    }

    /**
     * Check if cache entry is expired
     * @param {string} key - Cache key
     * @returns {boolean} True if expired
     */
    isExpired(key) {
        if (!this.ttl) {
            return false;
        }

        const expiry = this.ttlMap.get(key);
        if (!expiry) {
            return false;
        }

        return Date.now() > expiry;
    }

    /**
     * Clear all caches
     */
    clear() {
        this.documentCache.clear();
        this.queryCache.clear();
        this.ttlMap.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

        return {
            enabled: this.enabled,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: Math.round(hitRate * 100) / 100,
            evictions: this.stats.evictions,
            invalidations: this.stats.invalidations,
            documentCacheSize: this.documentCache.getSize(),
            queryCacheSize: this.queryCache.getSize(),
            maxSize: this.maxSize
        };
    }

    /**
     * Enable caching
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable caching
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            invalidations: 0
        };
    }
}
