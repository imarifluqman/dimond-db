/**
 * B-Tree Index Implementation
 * Supports range queries and sorted access
 * Simplified B-Tree for in-memory use
 */
export class BTreeIndex {
    /**
     * @param {IndexDefinition} definition - Index definition
     * @param {number} order - B-Tree order (max children per node)
     */
    constructor(definition, order = 32) {
        this.definition = definition;
        this.order = order;
        this.root = null;
        this.documentKeys = new Map(); // docId -> key (for updates/deletes)
        this._size = 0;
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

        const docId = doc._id;

        // Check unique constraint
        if (this.definition.unique) {
            const existing = this.find(key);
            if (existing.size > 0 && !existing.has(docId)) {
                throw new Error(`Unique constraint violation for key: ${JSON.stringify(key)}`);
            }
        }

        // Initialize root if needed
        if (!this.root) {
            this.root = new BTreeNode(true);
        }

        // Insert into tree
        const entry = { key, docId };
        const result = this._insertEntry(this.root, entry);

        // Handle root split
        if (result.split) {
            const newRoot = new BTreeNode(false);
            newRoot.keys.push(result.median);
            newRoot.children.push(this.root);
            newRoot.children.push(result.newNode);
            this.root = newRoot;
        }

        // Track for updates/deletes
        this.documentKeys.set(docId, key);
        this._size++;
    }

    /**
     * Internal insert method
     * @param {BTreeNode} node - Current node
     * @param {Object} entry - Entry to insert
     * @returns {Object} Result with split info if needed
     */
    _insertEntry(node, entry) {
        if (node.isLeaf) {
            // Find insertion position
            let i = 0;
            while (i < node.keys.length && this.compare(entry.key, node.keys[i].key) > 0) {
                i++;
            }

            // Insert entry
            node.keys.splice(i, 0, entry);

            // Check if split needed
            if (node.keys.length >= this.order) {
                return this._splitNode(node);
            }

            return { split: false };
        } else {
            // Find child to insert into
            let i = 0;
            while (i < node.keys.length && this.compare(entry.key, node.keys[i].key) > 0) {
                i++;
            }

            const result = this._insertEntry(node.children[i], entry);

            // Handle child split
            if (result.split) {
                node.keys.splice(i, 0, result.median);
                node.children.splice(i + 1, 0, result.newNode);

                // Check if this node needs to split
                if (node.keys.length >= this.order) {
                    return this._splitNode(node);
                }
            }

            return { split: false };
        }
    }

    /**
     * Split a node
     * @param {BTreeNode} node - Node to split
     * @returns {Object} Split result
     */
    _splitNode(node) {
        const mid = Math.floor(node.keys.length / 2);
        const median = node.keys[mid];

        const newNode = new BTreeNode(node.isLeaf);
        newNode.keys = node.keys.splice(mid + 1);
        node.keys.splice(mid, 1); // Remove median from original

        if (!node.isLeaf) {
            newNode.children = node.children.splice(mid + 1);
        }

        return { split: true, median, newNode };
    }

    /**
     * Remove document from index
     * @param {string} docId - Document ID
     */
    remove(docId) {
        const key = this.documentKeys.get(docId);
        if (key === undefined) {
            return;
        }

        if (this.root) {
            this._removeEntry(this.root, key, docId);
            this.documentKeys.delete(docId);
            this._size--;
        }
    }

    /**
     * Internal remove method
     * @param {BTreeNode} node - Current node
     * @param {*} key - Key to remove
     * @param {string} docId - Document ID
     */
    _removeEntry(node, key, docId) {
        if (node.isLeaf) {
            // Find and remove entry
            const index = node.keys.findIndex(e =>
                this.compare(e.key, key) === 0 && e.docId === docId
            );
            if (index !== -1) {
                node.keys.splice(index, 1);
            }
        } else {
            // Find child
            let i = 0;
            while (i < node.keys.length && this.compare(key, node.keys[i].key) > 0) {
                i++;
            }
            if (i < node.children.length) {
                this._removeEntry(node.children[i], key, docId);
            }
        }
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
        if (!this.root) {
            return new Set();
        }

        const results = new Set();
        this._findInNode(this.root, key, results);
        return results;
    }

    /**
     * Find entries in a node
     * @param {BTreeNode} node - Node to search
     * @param {*} key - Key to find
     * @param {Set} results - Result set
     */
    _findInNode(node, key, results) {
        if (node.isLeaf) {
            for (const entry of node.keys) {
                if (this.compare(entry.key, key) === 0) {
                    results.add(entry.docId);
                }
            }
        } else {
            let i = 0;
            for (; i < node.keys.length; i++) {
                const cmp = this.compare(key, node.keys[i].key);
                if (cmp <= 0) {
                    this._findInNode(node.children[i], key, results);
                    if (cmp === 0) {
                        results.add(node.keys[i].docId);
                    }
                    return;
                }
            }
            if (i < node.children.length) {
                this._findInNode(node.children[i], key, results);
            }
        }
    }

    /**
     * Find document IDs in range
     * @param {Object} range - Range specification { $gte, $gt, $lte, $lt }
     * @returns {Set<string>} Set of document IDs
     */
    findRange(range) {
        if (!this.root) {
            return new Set();
        }

        const results = new Set();
        this._findRangeInNode(this.root, range, results);
        return results;
    }

    /**
     * Find range in node
     * @param {BTreeNode} node - Node to search
     * @param {Object} range - Range specification
     * @param {Set} results - Result set
     */
    _findRangeInNode(node, range, results) {
        if (node.isLeaf) {
            for (const entry of node.keys) {
                if (this.inRange(entry.key, range)) {
                    results.add(entry.docId);
                }
            }
        } else {
            for (let i = 0; i < node.keys.length; i++) {
                if (this.inRange(node.keys[i].key, range)) {
                    results.add(node.keys[i].docId);
                }
                if (i < node.children.length) {
                    this._findRangeInNode(node.children[i], range, results);
                }
            }
            if (node.children.length > node.keys.length) {
                this._findRangeInNode(node.children[node.children.length - 1], range, results);
            }
        }
    }

    /**
     * Check if key is in range
     * @param {*} key - Key to check
     * @param {Object} range - Range specification
     * @returns {boolean} True if in range
     */
    inRange(key, range) {
        if (range.$gte !== undefined && this.compare(key, range.$gte) < 0) return false;
        if (range.$gt !== undefined && this.compare(key, range.$gt) <= 0) return false;
        if (range.$lte !== undefined && this.compare(key, range.$lte) > 0) return false;
        if (range.$lt !== undefined && this.compare(key, range.$lt) >= 0) return false;
        return true;
    }

    /**
     * Compare two keys
     * @param {*} a - First key
     * @param {*} b - Second key
     * @returns {number} -1, 0, or 1
     */
    compare(a, b) {
        if (Array.isArray(a) && Array.isArray(b)) {
            // Compound key comparison
            for (let i = 0; i < Math.min(a.length, b.length); i++) {
                const cmp = this.compareScalar(a[i], b[i]);
                if (cmp !== 0) return cmp;
            }
            return a.length - b.length;
        }
        return this.compareScalar(a, b);
    }

    /**
     * Compare scalar values
     * @param {*} a - First value
     * @param {*} b - Second value
     * @returns {number} -1, 0, or 1
     */
    compareScalar(a, b) {
        if (a === b) return 0;
        if (a === null || a === undefined) return -1;
        if (b === null || b === undefined) return 1;
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }

    /**
     * Get index size
     * @returns {number} Number of entries
     */
    size() {
        return this._size;
    }

    /**
     * Clear index
     */
    clear() {
        this.root = null;
        this.documentKeys.clear();
        this._size = 0;
    }

    /**
     * Serialize to JSON
     * @returns {Object} Serialized index
     */
    toJSON() {
        return {
            definition: this.definition.toJSON(),
            entries: this.getAllEntries()
        };
    }

    /**
     * Get all entries in sorted order
     * @returns {Array} Array of entries
     */
    getAllEntries() {
        const entries = [];
        if (this.root) {
            this._collectEntries(this.root, entries);
        }
        return entries;
    }

    /**
     * Collect entries from node
     * @param {BTreeNode} node - Node
     * @param {Array} entries - Entry array
     */
    _collectEntries(node, entries) {
        if (node.isLeaf) {
            entries.push(...node.keys);
        } else {
            for (let i = 0; i < node.keys.length; i++) {
                this._collectEntries(node.children[i], entries);
                entries.push(node.keys[i]);
            }
            if (node.children.length > node.keys.length) {
                this._collectEntries(node.children[node.children.length - 1], entries);
            }
        }
    }

    /**
     * Deserialize from JSON
     * @param {Object} data - Serialized data
     * @param {IndexDefinition} definition - Index definition
     * @returns {BTreeIndex} BTree index
     */
    static fromJSON(data, definition) {
        const index = new BTreeIndex(definition);
        for (const entry of data.entries) {
            index.insert({ _id: entry.docId, ...entry });
            index.documentKeys.set(entry.docId, entry.key);
        }
        return index;
    }
}

/**
 * B-Tree Node
 */
class BTreeNode {
    constructor(isLeaf = true) {
        this.isLeaf = isLeaf;
        this.keys = []; // Array of { key, docId }
        this.children = []; // Array of BTreeNode (empty for leaf)
    }
}
