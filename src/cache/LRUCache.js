/**
 * LRU (Least Recently Used) Cache Implementation
 * O(1) get and set operations using hash map + doubly linked list
 */
export class LRUCache {
    /**
     * @param {number} capacity - Maximum number of items to cache
     */
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();
        this.head = null; // Most recently used
        this.tail = null; // Least recently used
        this.size = 0;
    }

    /**
     * Node structure for doubly linked list
     */
    static createNode(key, value) {
        return { key, value, prev: null, next: null };
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined
     */
    get(key) {
        const node = this.cache.get(key);
        if (!node) {
            return undefined;
        }

        // Move to head (most recently used)
        this.moveToHead(node);
        return node.value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    set(key, value) {
        const existingNode = this.cache.get(key);

        if (existingNode) {
            // Update existing node
            existingNode.value = value;
            this.moveToHead(existingNode);
        } else {
            // Create new node
            const newNode = LRUCache.createNode(key, value);
            this.cache.set(key, newNode);
            this.addToHead(newNode);
            this.size++;

            // Evict if over capacity
            if (this.size > this.capacity) {
                this.evictTail();
            }
        }
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean} True if key exists
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Delete key from cache
     * @param {string} key - Cache key
     * @returns {boolean} True if key was deleted
     */
    delete(key) {
        const node = this.cache.get(key);
        if (!node) {
            return false;
        }

        this.removeNode(node);
        this.cache.delete(key);
        this.size--;
        return true;
    }

    /**
     * Clear all cached items
     */
    clear() {
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.size = 0;
    }

    /**
     * Get current cache size
     * @returns {number} Number of items in cache
     */
    getSize() {
        return this.size;
    }

    /**
     * Get cache capacity
     * @returns {number} Maximum capacity
     */
    getCapacity() {
        return this.capacity;
    }

    /**
     * Get all keys in cache (most to least recently used)
     * @returns {Array<string>} Array of keys
     */
    keys() {
        const keys = [];
        let current = this.head;
        while (current) {
            keys.push(current.key);
            current = current.next;
        }
        return keys;
    }

    /**
     * Move node to head of list (mark as most recently used)
     * @param {Object} node - Node to move
     */
    moveToHead(node) {
        if (node === this.head) {
            return;
        }

        this.removeNode(node);
        this.addToHead(node);
    }

    /**
     * Add node to head of list
     * @param {Object} node - Node to add
     */
    addToHead(node) {
        node.prev = null;
        node.next = this.head;

        if (this.head) {
            this.head.prev = node;
        }

        this.head = node;

        if (!this.tail) {
            this.tail = node;
        }
    }

    /**
     * Remove node from list
     * @param {Object} node - Node to remove
     */
    removeNode(node) {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }

        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }
    }

    /**
     * Evict least recently used item (tail)
     */
    evictTail() {
        if (!this.tail) {
            return;
        }

        const key = this.tail.key;
        this.removeNode(this.tail);
        this.cache.delete(key);
        this.size--;
    }
}
