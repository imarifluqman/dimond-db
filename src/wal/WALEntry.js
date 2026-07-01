/**
 * WAL Entry
 * Represents a single write-ahead log entry
 */
export class WALEntry {
    /**
     * @param {Object} options - Entry options
     */
    constructor(options) {
        this.sequence = options.sequence;
        this.timestamp = options.timestamp || Date.now();
        this.type = options.type; // 'insert', 'update', 'delete'
        this.collection = options.collection;
        this.data = options.data;
        this.transactionId = options.transactionId || null;
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            sequence: this.sequence,
            timestamp: this.timestamp,
            type: this.type,
            collection: this.collection,
            data: this.data,
            transactionId: this.transactionId
        };
    }

    /**
     * Deserialize from JSON
     * @param {Object} data - JSON data
     * @returns {WALEntry} WAL entry
     */
    static fromJSON(data) {
        return new WALEntry(data);
    }
}

/**
 * WAL Entry Types
 */
export const WALEntryType = {
    INSERT: 'insert',
    UPDATE: 'update',
    DELETE: 'delete',
    TRANSACTION_BEGIN: 'transaction_begin',
    TRANSACTION_COMMIT: 'transaction_commit',
    TRANSACTION_ABORT: 'transaction_abort'
};
