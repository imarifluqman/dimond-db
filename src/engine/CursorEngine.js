import { QueryEngine } from './QueryEngine.js';

/**
 * Cursor Engine
 * Manages cursor creation and execution
 */
export class CursorEngine {
    /**
     * @param {Array} documents - Source documents
     * @param {Object} filter - Query filter
     * @param {Object} indexManager - Index manager instance
     */
    constructor(documents, filter, indexManager = null) {
        this.documents = documents;
        this.filter = filter;
        this.indexManager = indexManager;
    }

    /**
     * Execute query and return matching documents
     * @returns {Array} Matching documents
     */
    execute() {
        // Try to use index
        if (this.indexManager) {
            const indexResult = this.tryIndexQuery();
            if (indexResult) {
                return indexResult;
            }
        }

        // Fall back to full collection scan
        return QueryEngine.find(this.documents, this.filter);
    }

    /**
     * Try to execute query using an index
     * @returns {Array|null} Results or null if index not usable
     */
    tryIndexQuery() {
        const bestIndex = this.indexManager.findBestIndex(this.filter);

        if (!bestIndex) {
            return null;
        }

        // Get document IDs from index
        const docIds = this.indexManager.executeIndexQuery(bestIndex.index, this.filter);

        if (!docIds || docIds.size === 0) {
            return [];
        }

        // Build document ID map for O(1) lookup
        const idSet = new Set(docIds);

        // Filter documents by ID and apply remaining filter conditions
        const indexedDocs = this.documents.filter(doc => idSet.has(doc._id));

        // Apply full filter to ensure all conditions are met
        // (index might only cover part of the query)
        return QueryEngine.find(indexedDocs, this.filter);
    }

    /**
     * Get execution plan
     * @returns {Object} Execution plan
     */
    getExecutionPlan() {
        if (!this.indexManager) {
            return {
                type: 'COLLECTION_SCAN',
                filter: this.filter,
                estimatedDocuments: this.documents.length
            };
        }

        const bestIndex = this.indexManager.findBestIndex(this.filter);

        if (!bestIndex) {
            return {
                type: 'COLLECTION_SCAN',
                filter: this.filter,
                estimatedDocuments: this.documents.length,
                reason: 'No suitable index found'
            };
        }

        return {
            type: 'INDEX_SCAN',
            indexName: bestIndex.name,
            indexType: bestIndex.index.definition.type,
            score: bestIndex.score,
            filter: this.filter,
            estimatedDocuments: 'unknown'
        };
    }
}
