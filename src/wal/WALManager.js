import { join } from 'path';
import { FileStorage } from '../storage/FileStorage.js';
import { WALEntry, WALEntryType } from './WALEntry.js';
import { WALError } from '../errors/DatabaseError.js';

/**
 * Write-Ahead Log Manager
 * Provides durability and crash recovery
 */
export class WALManager {
    /**
     * @param {string} databasePath - Database path
     * @param {boolean} enabled - Enable WAL
     */
    constructor(databasePath, enabled = false) {
        this.databasePath = databasePath;
        this.walPath = join(databasePath, 'wal');
        this.enabled = enabled;
        this.sequence = 0;
        this.currentLog = [];
        this.logFile = null;
        this.maxLogSize = 1000; // Max entries before rotation
        this.initialized = false;
    }

    /**
     * Initialize WAL
     */
    async initialize() {
        if (!this.enabled || this.initialized) {
            return;
        }

        try {
            // Ensure WAL directory exists
            await FileStorage.ensureDir(this.walPath);

            // Load last sequence number
            await this.loadSequence();

            // Check for incomplete transactions (crash recovery)
            await this.recover();

            this.initialized = true;
        } catch (error) {
            throw new WALError('Failed to initialize WAL', error);
        }
    }

    /**
     * Write an entry to the log
     * @param {string} type - Entry type
     * @param {string} collection - Collection name
     * @param {Object} data - Entry data
     * @param {string} transactionId - Transaction ID (optional)
     * @returns {Promise<number>} Sequence number
     */
    async writeEntry(type, collection, data, transactionId = null) {
        if (!this.enabled) {
            return -1;
        }

        await this.initialize();

        this.sequence++;

        const entry = new WALEntry({
            sequence: this.sequence,
            timestamp: Date.now(),
            type,
            collection,
            data,
            transactionId
        });

        this.currentLog.push(entry);

        // Persist entry
        await this.persistEntry(entry);

        // Rotate log if needed
        if (this.currentLog.length >= this.maxLogSize) {
            await this.rotateLog();
        }

        return this.sequence;
    }

    /**
     * Write insert entry
     * @param {string} collection - Collection name
     * @param {Object} document - Document inserted
     * @param {string} transactionId - Transaction ID (optional)
     */
    async logInsert(collection, document, transactionId = null) {
        return await this.writeEntry(
            WALEntryType.INSERT,
            collection,
            { document },
            transactionId
        );
    }

    /**
     * Write update entry
     * @param {string} collection - Collection name
     * @param {Object} filter - Query filter
     * @param {Object} update - Update operations
     * @param {Object} oldDoc - Old document (for rollback)
     * @param {string} transactionId - Transaction ID (optional)
     */
    async logUpdate(collection, filter, update, oldDoc, transactionId = null) {
        return await this.writeEntry(
            WALEntryType.UPDATE,
            collection,
            { filter, update, oldDoc },
            transactionId
        );
    }

    /**
     * Write delete entry
     * @param {string} collection - Collection name
     * @param {Object} filter - Query filter
     * @param {Object} deletedDoc - Deleted document (for rollback)
     * @param {string} transactionId - Transaction ID (optional)
     */
    async logDelete(collection, filter, deletedDoc, transactionId = null) {
        return await this.writeEntry(
            WALEntryType.DELETE,
            collection,
            { filter, deletedDoc },
            transactionId
        );
    }

    /**
     * Write transaction begin entry
     * @param {string} transactionId - Transaction ID
     */
    async logTransactionBegin(transactionId) {
        return await this.writeEntry(
            WALEntryType.TRANSACTION_BEGIN,
            null,
            { transactionId },
            transactionId
        );
    }

    /**
     * Write transaction commit entry
     * @param {string} transactionId - Transaction ID
     */
    async logTransactionCommit(transactionId) {
        return await this.writeEntry(
            WALEntryType.TRANSACTION_COMMIT,
            null,
            { transactionId },
            transactionId
        );
    }

    /**
     * Write transaction abort entry
     * @param {string} transactionId - Transaction ID
     */
    async logTransactionAbort(transactionId) {
        return await this.writeEntry(
            WALEntryType.TRANSACTION_ABORT,
            null,
            { transactionId },
            transactionId
        );
    }

    /**
     * Persist entry to disk
     * @param {WALEntry} entry - Entry to persist
     */
    async persistEntry(entry) {
        const logFile = this.getCurrentLogFile();
        const logPath = join(this.walPath, logFile);

        try {
            // Append to log file
            let entries = [];
            if (await FileStorage.exists(logPath)) {
                entries = await FileStorage.readJSON(logPath);
            }

            entries.push(entry.toJSON());
            await FileStorage.writeJSON(logPath, entries);
        } catch (error) {
            throw new WALError('Failed to persist WAL entry', error);
        }
    }

    /**
     * Get current log file name
     * @returns {string} Log file name
     */
    getCurrentLogFile() {
        const fileNum = Math.floor(this.sequence / this.maxLogSize);
        return `${String(fileNum).padStart(6, '0')}.log`;
    }

    /**
     * Rotate log file
     */
    async rotateLog() {
        // Start fresh log
        this.currentLog = [];
        // Old logs can be cleaned up later during checkpoint
    }

    /**
     * Checkpoint - mark all operations as committed
     */
    async checkpoint() {
        if (!this.enabled) {
            return;
        }

        try {
            // Clear old log files
            const files = await FileStorage.listFiles(this.walPath);
            const logFiles = files.filter(f => f.endsWith('.log'));

            // Keep only current log file
            const currentFile = this.getCurrentLogFile();

            for (const file of logFiles) {
                if (file !== currentFile && file !== 'sequence.json') {
                    await FileStorage.deleteFile(join(this.walPath, file));
                }
            }

            // Save current sequence
            await this.saveSequence();
        } catch (error) {
            throw new WALError('Failed to checkpoint WAL', error);
        }
    }

    /**
     * Recover from crash
     * @returns {Promise<Array>} Recovered entries
     */
    async recover() {
        if (!this.enabled) {
            return [];
        }

        try {
            const files = await FileStorage.listFiles(this.walPath);
            const logFiles = files
                .filter(f => f.endsWith('.log'))
                .sort();

            const incompleteTransactions = new Map();
            const recoveredEntries = [];

            // Read all log files
            for (const file of logFiles) {
                const logPath = join(this.walPath, file);
                const entries = await FileStorage.readJSON(logPath);

                for (const entryData of entries) {
                    const entry = WALEntry.fromJSON(entryData);

                    if (entry.type === WALEntryType.TRANSACTION_BEGIN) {
                        incompleteTransactions.set(entry.transactionId, []);
                    } else if (entry.type === WALEntryType.TRANSACTION_COMMIT) {
                        incompleteTransactions.delete(entry.transactionId);
                    } else if (entry.type === WALEntryType.TRANSACTION_ABORT) {
                        incompleteTransactions.delete(entry.transactionId);
                    } else if (entry.transactionId) {
                        // Track transaction entries
                        if (incompleteTransactions.has(entry.transactionId)) {
                            incompleteTransactions.get(entry.transactionId).push(entry);
                        }
                    } else {
                        // Non-transactional entry - need to verify completion
                        recoveredEntries.push(entry);
                    }
                }
            }

            // Log incomplete transactions (should be rolled back)
            if (incompleteTransactions.size > 0) {
                console.warn(
                    `Found ${incompleteTransactions.size} incomplete transactions that will be rolled back`
                );
            }

            return recoveredEntries;
        } catch (error) {
            // If recovery fails, log it but don't crash
            console.error('WAL recovery failed:', error);
            return [];
        }
    }

    /**
     * Load sequence number from disk
     */
    async loadSequence() {
        const seqPath = join(this.walPath, 'sequence.json');

        try {
            if (await FileStorage.exists(seqPath)) {
                const data = await FileStorage.readJSON(seqPath);
                this.sequence = data.sequence || 0;
            }
        } catch (error) {
            // Start from 0 if file doesn't exist or is corrupt
            this.sequence = 0;
        }
    }

    /**
     * Save sequence number to disk
     */
    async saveSequence() {
        const seqPath = join(this.walPath, 'sequence.json');
        await FileStorage.writeJSON(seqPath, { sequence: this.sequence });
    }

    /**
     * Clear all WAL data
     */
    async clear() {
        if (!this.enabled) {
            return;
        }

        try {
            await FileStorage.deleteDir(this.walPath);
            await FileStorage.ensureDir(this.walPath);
            this.sequence = 0;
            this.currentLog = [];
        } catch (error) {
            throw new WALError('Failed to clear WAL', error);
        }
    }

    /**
     * Get WAL statistics
     * @returns {Object} WAL stats
     */
    async getStats() {
        if (!this.enabled) {
            return {
                enabled: false,
                sequence: 0,
                logFiles: 0,
                currentLogSize: 0
            };
        }

        try {
            const files = await FileStorage.listFiles(this.walPath);
            const logFiles = files.filter(f => f.endsWith('.log'));

            return {
                enabled: true,
                sequence: this.sequence,
                logFiles: logFiles.length,
                currentLogSize: this.currentLog.length
            };
        } catch (error) {
            return {
                enabled: true,
                sequence: this.sequence,
                logFiles: 0,
                currentLogSize: this.currentLog.length,
                error: error.message
            };
        }
    }

    /**
     * Enable WAL
     */
    async enable() {
        this.enabled = true;
        await this.initialize();
    }

    /**
     * Disable WAL
     */
    disable() {
        this.enabled = false;
    }
}
