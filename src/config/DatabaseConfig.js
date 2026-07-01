import { ValidationError } from '../errors/DatabaseError.js';

/**
 * Database Configuration Manager
 * Handles validation and defaults for database configuration
 */
export class DatabaseConfig {
    /**
     * Default configuration values
     */
    static DEFAULTS = {
        // V1 compatibility
        database: null,
        path: './database',

        // Cache configuration
        cache: false,
        cacheSize: '256MB',
        cacheTTL: null, // null = no TTL

        // Index configuration
        autoIndex: true,

        // Schema configuration
        strictSchema: false,

        // Transaction/WAL configuration
        journal: false,
        journalMode: 'write-ahead', // 'write-ahead' or 'none'

        // Backup configuration
        autoBackup: false,
        backupInterval: '24h',
        backupPath: './backups',

        // Performance configuration
        performanceTracking: true,
        slowQueryThreshold: 100, // ms

        // Storage configuration
        compression: false,
        prettyPrint: false // for JSON files
    };

    /**
     * Parse configuration and merge with defaults
     * @param {Object} config - User configuration
     * @returns {Object} Validated configuration
     */
    static parse(config = {}) {
        // Validate required fields
        if (!config.database) {
            throw new ValidationError('Database name is required');
        }

        // Merge with defaults
        const merged = { ...this.DEFAULTS, ...config };

        // Validate and normalize values
        return {
            database: this.validateDatabaseName(merged.database),
            path: merged.path,
            cache: this.validateBoolean(merged.cache, 'cache'),
            cacheSize: this.parseCacheSize(merged.cacheSize),
            cacheTTL: this.parseDuration(merged.cacheTTL),
            autoIndex: this.validateBoolean(merged.autoIndex, 'autoIndex'),
            strictSchema: this.validateBoolean(merged.strictSchema, 'strictSchema'),
            journal: this.validateBoolean(merged.journal, 'journal'),
            journalMode: this.validateJournalMode(merged.journalMode),
            autoBackup: this.validateBoolean(merged.autoBackup, 'autoBackup'),
            backupInterval: this.parseDuration(merged.backupInterval),
            backupPath: merged.backupPath,
            performanceTracking: this.validateBoolean(merged.performanceTracking, 'performanceTracking'),
            slowQueryThreshold: this.validateNumber(merged.slowQueryThreshold, 'slowQueryThreshold', 0),
            compression: this.validateBoolean(merged.compression, 'compression'),
            prettyPrint: this.validateBoolean(merged.prettyPrint, 'prettyPrint')
        };
    }

    /**
     * Validate database name
     * @param {string} name - Database name
     * @returns {string} Validated name
     */
    static validateDatabaseName(name) {
        if (typeof name !== 'string' || name.length === 0) {
            throw new ValidationError('Database name must be a non-empty string');
        }
        return name;
    }

    /**
     * Validate boolean value
     * @param {*} value - Value to validate
     * @param {string} field - Field name
     * @returns {boolean} Boolean value
     */
    static validateBoolean(value, field) {
        if (typeof value !== 'boolean') {
            throw new ValidationError(`${field} must be a boolean`);
        }
        return value;
    }

    /**
     * Validate number value
     * @param {*} value - Value to validate
     * @param {string} field - Field name
     * @param {number} min - Minimum value
     * @returns {number} Number value
     */
    static validateNumber(value, field, min = -Infinity) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new ValidationError(`${field} must be a number`);
        }
        if (value < min) {
            throw new ValidationError(`${field} must be >= ${min}`);
        }
        return value;
    }

    /**
     * Parse cache size string to bytes
     * @param {string|number} size - Size string (e.g., '256MB') or number
     * @returns {number} Size in bytes
     */
    static parseCacheSize(size) {
        if (typeof size === 'number') {
            return size;
        }

        if (typeof size !== 'string') {
            throw new ValidationError('Cache size must be a string or number');
        }

        const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
        if (!match) {
            throw new ValidationError('Invalid cache size format (e.g., "256MB", "1GB")');
        }

        const value = parseFloat(match[1]);
        const unit = (match[2] || 'B').toUpperCase();

        const multipliers = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024
        };

        return value * multipliers[unit];
    }

    /**
     * Parse duration string to milliseconds
     * @param {string|number|null} duration - Duration string (e.g., '24h') or number or null
     * @returns {number|null} Duration in milliseconds or null
     */
    static parseDuration(duration) {
        if (duration === null || duration === undefined) {
            return null;
        }

        if (typeof duration === 'number') {
            return duration;
        }

        if (typeof duration !== 'string') {
            throw new ValidationError('Duration must be a string or number');
        }

        const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
        if (!match) {
            throw new ValidationError('Invalid duration format (e.g., "24h", "30m")');
        }

        const value = parseFloat(match[1]);
        const unit = (match[2] || 'ms').toLowerCase();

        const multipliers = {
            ms: 1,
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        };

        return value * multipliers[unit];
    }

    /**
     * Validate journal mode
     * @param {string} mode - Journal mode
     * @returns {string} Validated mode
     */
    static validateJournalMode(mode) {
        const validModes = ['write-ahead', 'none'];
        if (!validModes.includes(mode)) {
            throw new ValidationError(`Invalid journal mode. Must be one of: ${validModes.join(', ')}`);
        }
        return mode;
    }
}
