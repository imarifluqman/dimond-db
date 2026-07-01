import { generateId } from '../utils/idGenerator.js';

/**
 * Session
 * Represents a database session for transactions
 */
export class Session {
    /**
     * @param {TransactionManager} transactionManager - Transaction manager
     */
    constructor(transactionManager) {
        this.id = generateId();
        this.transactionManager = transactionManager;
        this.inTransaction = false;
        this.transactionId = null;
        this.operations = [];
        this.startTime = null;
        this.aborted = false;
        this.committed = false;
    }

    /**
     * Start a transaction
     */
    async startTransaction() {
        if (this.inTransaction) {
            throw new Error('Transaction already started');
        }

        if (this.aborted) {
            throw new Error('Session has been aborted');
        }

        if (this.committed) {
            throw new Error('Session has been committed');
        }

        this.transactionId = generateId();
        this.inTransaction = true;
        this.startTime = Date.now();
        this.operations = [];

        // Log transaction begin
        if (this.transactionManager.walManager) {
            await this.transactionManager.walManager.logTransactionBegin(this.transactionId);
        }
    }

    /**
     * Add operation to transaction
     * @param {Object} operation - Operation to add
     */
    addOperation(operation) {
        if (!this.inTransaction) {
            throw new Error('No active transaction');
        }

        this.operations.push({
            ...operation,
            timestamp: Date.now()
        });
    }

    /**
     * Commit transaction
     */
    async commit() {
        if (!this.inTransaction) {
            throw new Error('No active transaction');
        }

        if (this.aborted) {
            throw new Error('Transaction has been aborted');
        }

        try {
            // Execute all operations
            await this.transactionManager.executeOperations(this.operations);

            // Log transaction commit
            if (this.transactionManager.walManager) {
                await this.transactionManager.walManager.logTransactionCommit(this.transactionId);
            }

            this.committed = true;
            this.inTransaction = false;

            return {
                acknowledged: true,
                transactionId: this.transactionId,
                operationCount: this.operations.length,
                duration: Date.now() - this.startTime
            };
        } catch (error) {
            // Auto-abort on error
            await this.abort();
            throw error;
        }
    }

    /**
     * Abort transaction
     */
    async abort() {
        if (!this.inTransaction && !this.aborted) {
            throw new Error('No active transaction');
        }

        // Log transaction abort
        if (this.transactionManager.walManager && !this.aborted) {
            await this.transactionManager.walManager.logTransactionAbort(this.transactionId);
        }

        this.aborted = true;
        this.inTransaction = false;
        this.operations = [];

        return {
            acknowledged: true,
            transactionId: this.transactionId,
            aborted: true
        };
    }

    /**
     * Check if transaction is active
     * @returns {boolean} True if active
     */
    isActive() {
        return this.inTransaction;
    }

    /**
     * Get session info
     * @returns {Object} Session information
     */
    getInfo() {
        return {
            id: this.id,
            transactionId: this.transactionId,
            inTransaction: this.inTransaction,
            operationCount: this.operations.length,
            aborted: this.aborted,
            committed: this.committed,
            startTime: this.startTime,
            duration: this.startTime ? Date.now() - this.startTime : 0
        };
    }
}
