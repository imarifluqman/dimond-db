/**
 * Performance Monitor
 * Tracks and reports database performance metrics
 */
export class PerformanceMonitor {
    constructor(enabled = true) {
        this.enabled = enabled;
        this.metrics = {
            reads: 0,
            writes: 0,
            queries: 0,
            inserts: 0,
            updates: 0,
            deletes: 0,
            cacheHits: 0,
            cacheMisses: 0,
            indexHits: 0,
            indexMisses: 0,
            totalReadTime: 0,
            totalWriteTime: 0,
            totalQueryTime: 0,
            slowQueries: []
        };
        this.slowQueryThreshold = 100; // ms
        this.startTime = Date.now();
    }

    /**
     * Set slow query threshold
     * @param {number} threshold - Threshold in milliseconds
     */
    setSlowQueryThreshold(threshold) {
        this.slowQueryThreshold = threshold;
    }

    /**
     * Track an operation
     * @param {string} type - Operation type
     * @param {number} duration - Duration in milliseconds
     * @param {Object} metadata - Additional metadata
     */
    track(type, duration, metadata = {}) {
        if (!this.enabled) return;

        switch (type) {
            case 'read':
                this.metrics.reads++;
                this.metrics.totalReadTime += duration;
                break;
            case 'write':
                this.metrics.writes++;
                this.metrics.totalWriteTime += duration;
                break;
            case 'query':
                this.metrics.queries++;
                this.metrics.totalQueryTime += duration;
                if (duration > this.slowQueryThreshold) {
                    this.trackSlowQuery(duration, metadata);
                }
                break;
            case 'insert':
                this.metrics.inserts++;
                break;
            case 'update':
                this.metrics.updates++;
                break;
            case 'delete':
                this.metrics.deletes++;
                break;
        }
    }

    /**
     * Track a slow query
     * @param {number} duration - Query duration
     * @param {Object} metadata - Query metadata
     */
    trackSlowQuery(duration, metadata) {
        this.metrics.slowQueries.push({
            duration,
            timestamp: new Date().toISOString(),
            ...metadata
        });

        // Keep only last 100 slow queries
        if (this.metrics.slowQueries.length > 100) {
            this.metrics.slowQueries.shift();
        }
    }

    /**
     * Track cache hit
     */
    trackCacheHit() {
        if (!this.enabled) return;
        this.metrics.cacheHits++;
    }

    /**
     * Track cache miss
     */
    trackCacheMiss() {
        if (!this.enabled) return;
        this.metrics.cacheMisses++;
    }

    /**
     * Track index usage
     * @param {boolean} used - Whether index was used
     */
    trackIndexUsage(used) {
        if (!this.enabled) return;
        if (used) {
            this.metrics.indexHits++;
        } else {
            this.metrics.indexMisses++;
        }
    }

    /**
     * Get performance report
     * @returns {Object} Performance metrics
     */
    getReport() {
        const uptime = Date.now() - this.startTime;
        const totalCache = this.metrics.cacheHits + this.metrics.cacheMisses;
        const totalIndex = this.metrics.indexHits + this.metrics.indexMisses;

        return {
            uptime: this.formatDuration(uptime),
            operations: {
                reads: this.metrics.reads,
                writes: this.metrics.writes,
                queries: this.metrics.queries,
                inserts: this.metrics.inserts,
                updates: this.metrics.updates,
                deletes: this.metrics.deletes
            },
            timing: {
                averageRead: this.metrics.reads > 0
                    ? Math.round(this.metrics.totalReadTime / this.metrics.reads)
                    : 0,
                averageWrite: this.metrics.writes > 0
                    ? Math.round(this.metrics.totalWriteTime / this.metrics.writes)
                    : 0,
                averageQuery: this.metrics.queries > 0
                    ? Math.round(this.metrics.totalQueryTime / this.metrics.queries)
                    : 0
            },
            cache: {
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                hitRate: totalCache > 0
                    ? Math.round((this.metrics.cacheHits / totalCache) * 100)
                    : 0
            },
            index: {
                hits: this.metrics.indexHits,
                misses: this.metrics.indexMisses,
                hitRate: totalIndex > 0
                    ? Math.round((this.metrics.indexHits / totalIndex) * 100)
                    : 0
            },
            slowQueries: this.metrics.slowQueries.length
        };
    }

    /**
     * Get detailed report as formatted string
     * @returns {string} Formatted report
     */
    getFormattedReport() {
        const report = this.getReport();

        return `
Database Performance Report
===========================

Uptime: ${report.uptime}

Operations:
  Reads:   ${report.operations.reads}
  Writes:  ${report.operations.writes}
  Queries: ${report.operations.queries}
  Inserts: ${report.operations.inserts}
  Updates: ${report.operations.updates}
  Deletes: ${report.operations.deletes}

Average Timing:
  Read:  ${report.timing.averageRead}ms
  Write: ${report.timing.averageWrite}ms
  Query: ${report.timing.averageQuery}ms

Cache Performance:
  Hits:     ${report.cache.hits}
  Misses:   ${report.cache.misses}
  Hit Rate: ${report.cache.hitRate}%

Index Performance:
  Hits:     ${report.index.hits}
  Misses:   ${report.index.misses}
  Hit Rate: ${report.index.hitRate}%

Slow Queries: ${report.slowQueries}
`.trim();
    }

    /**
     * Format duration in human-readable format
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            reads: 0,
            writes: 0,
            queries: 0,
            inserts: 0,
            updates: 0,
            deletes: 0,
            cacheHits: 0,
            cacheMisses: 0,
            indexHits: 0,
            indexMisses: 0,
            totalReadTime: 0,
            totalWriteTime: 0,
            totalQueryTime: 0,
            slowQueries: []
        };
        this.startTime = Date.now();
    }

    /**
     * Enable performance monitoring
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable performance monitoring
     */
    disable() {
        this.enabled = false;
    }
}
