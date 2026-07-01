/**
 * Hash Index Implementation
 * O(1) lookups for equality queries
 */
export class HashIndex {
    /**
     * @param {IndexDefinition} definition - Index definition
     */
    constructor(definition) {
        this.definition = definition;
        this.index = new Map(); // key -> Set of document IDs
        this.documentKeys = new Map(); // docId -> key (for updates/deletes)
    }

    /**
     * Insert document into index
     * @param {Object} doc - Document to index
     */
    insert(doc) {
        const key = this.definition.getKey(doc);

        // Skip if sparse index and key is null/undefined
        if (this.definition.sparse && (key === null || key === undefined)) {
            return;
        }

        const keyStr = this.serializeKey(key);
        const docId = doc._id;

        // Check unique constraint
        if (this.definition.unique && this.index.has(keyStr)) {
            const existingIds = this.index.get(keyStr);
            if (existingIds.size > 0 && !existingIds.has(docId)) {
                throw new Error(`Unique constraint violation for key: ${keyStr}`);
            }
        }

        // Add to index
        if (!this.index.has(keyStr)) {
            this.index.set(keyStr, new Set());
        }
        this.index.get(keyStr).add(docId);

        // Track for updates/deletes
        this.documentKeys.set(docId, keyStr);
    }

    /**
     * Remove document from index
     * @param {string} docId - Document ID
     */
    remove(docId) {
        const keyStr = this.documentKeys.get(docId);
        if (!keyStr) {
            return;
        }

        const ids = this.index.get(keyStr);
        if (ids) {
            ids.delete(docId);
            if (ids.size === 0) {
                this.index.delete(keyStr);
            }
        }

        this.documentKeys.delete(docId);
    }

    /**
     * Update document in index
     * @param {Object} oldDoc - Old document
     * @param {Object} newDoc - New document
     */
    update(oldDoc, newDoc) {
        this.remove(oldDoc._id);
        this.insert(newDoc);
    }

    /**
     * Find document IDs by exact key match
     * @param {*} key - Key to search for
     * @returns {Set<string>} Set of document IDs
     */
    find(key) {
        const keyStr = this.serializeKey(key);
        return this.index.get(keyStr) || new Set();
    }

    /**
     * Find document IDs for multiple keys ($in operator)
     * @param {Array} keys - Array of keys
     * @returns {Set<string>} Set of document IDs
     */
    findIn(keys) {
        const results = new Set();
        for (const key of keys) {
            const ids = this.find(key);
            ids.forEach(id => results.add(id));
        }
        return results;
    }

    /**
     * Check if key exists in index
     * @param {*} key - Key to check
     * @returns {boolean} True if exists
     */
    has(key) {
        const keyStr = this.serializeKey(key);
        return this.index.has(keyStr);
    }

    /**
     * Get all keys in index
     * @returns {Array} Array of keys
     */
    keys() {
        return Array.from(this.index.keys());
    }

    /**
     * Get index size (number of unique keys)
     * @returns {number} Size
     */
    size() {
        return this.index.size;
    }

    /**
     * Clear all index data
     */
    clear() {
        this.index.clear();
        this.documentKeys.clear();
    }

    /**
     * Serialize key to string
     * @param {*} key - Key to serialize
     * @returns {string} Serialized key
     */
    serializeKey(key) {
        if (key === null) return '__null__';
        if (key === undefined) return '__undefined__';
        if (Array.isArray(key)) {
            // Compound key
            return JSON.stringify(key);
        }
        return String(key);
    }

    /**
     * Serialize index to JSON
     * @returns {Object} Serialized index
     */
    toJSON() {
        const data = {
            definition: this.definition.toJSON(),
            entries: []
        };

        for (const [key, ids] of this.index.entries()) {
            data.entries.push({
                key,
                ids: Array.from(ids)
            });
        }

        return data;
    }

    /**
     * Deserialize index from JSON
     * @param {Object} data - Serialized data
     * @param {IndexDefinition} definition - Index definition
     * @returns {HashIndex} Hash index
     */
    static fromJSON(data, definition) {
        const index = new HashIndex(definition);

        for (const entry of data.entries) {
            const ids = new Set(entry.ids);
            index.index.set(entry.key, ids);

            // Rebuild documentKeys map
            for (const id of ids) {
                index.documentKeys.set(id, entry.key);
            }
        }

        return index;
    }
}
