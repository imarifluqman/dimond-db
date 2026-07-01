import { HookExecutionError } from '../errors/DatabaseError.js';

/**
 * Hook Manager
 * Manages lifecycle hooks for collection operations
 */
export class HookManager {
    constructor() {
        this.hooks = {
            pre: {
                insert: [],
                update: [],
                delete: [],
                find: []
            },
            post: {
                insert: [],
                update: [],
                delete: [],
                find: []
            }
        };
    }

    /**
     * Register a pre-hook
     * @param {string} event - Event name (insert, update, delete, find)
     * @param {Function} handler - Hook handler function
     */
    pre(event, handler) {
        if (!this.hooks.pre[event]) {
            throw new HookExecutionError('pre', event, new Error('Invalid event'));
        }

        if (typeof handler !== 'function') {
            throw new HookExecutionError('pre', event, new Error('Handler must be a function'));
        }

        this.hooks.pre[event].push(handler);
    }

    /**
     * Register a post-hook
     * @param {string} event - Event name (insert, update, delete, find)
     * @param {Function} handler - Hook handler function
     */
    post(event, handler) {
        if (!this.hooks.post[event]) {
            throw new HookExecutionError('post', event, new Error('Invalid event'));
        }

        if (typeof handler !== 'function') {
            throw new HookExecutionError('post', event, new Error('Handler must be a function'));
        }

        this.hooks.post[event].push(handler);
    }

    /**
     * Execute pre-hooks
     * @param {string} event - Event name
     * @param {Object} context - Hook context
     * @returns {Promise<Object>} Modified context
     */
    async executePre(event, context) {
        if (!this.hooks.pre[event]) {
            return context;
        }

        let currentContext = context;

        for (const handler of this.hooks.pre[event]) {
            try {
                const result = await handler(currentContext);
                // If handler returns something, use it as new context
                if (result !== undefined) {
                    currentContext = result;
                }
            } catch (error) {
                throw new HookExecutionError('pre', event, error);
            }
        }

        return currentContext;
    }

    /**
     * Execute post-hooks
     * @param {string} event - Event name
     * @param {Object} context - Hook context
     * @returns {Promise<Object>} Modified context
     */
    async executePost(event, context) {
        if (!this.hooks.post[event]) {
            return context;
        }

        let currentContext = context;

        for (const handler of this.hooks.post[event]) {
            try {
                const result = await handler(currentContext);
                // If handler returns something, use it as new context
                if (result !== undefined) {
                    currentContext = result;
                }
            } catch (error) {
                throw new HookExecutionError('post', event, error);
            }
        }

        return currentContext;
    }

    /**
     * Remove a hook
     * @param {string} type - Hook type (pre or post)
     * @param {string} event - Event name
     * @param {Function} handler - Handler to remove
     * @returns {boolean} True if removed
     */
    remove(type, event, handler) {
        if (!this.hooks[type] || !this.hooks[type][event]) {
            return false;
        }

        const index = this.hooks[type][event].indexOf(handler);
        if (index !== -1) {
            this.hooks[type][event].splice(index, 1);
            return true;
        }

        return false;
    }

    /**
     * Clear all hooks for an event
     * @param {string} event - Event name
     */
    clearEvent(event) {
        if (this.hooks.pre[event]) {
            this.hooks.pre[event] = [];
        }
        if (this.hooks.post[event]) {
            this.hooks.post[event] = [];
        }
    }

    /**
     * Clear all hooks
     */
    clearAll() {
        for (const event of Object.keys(this.hooks.pre)) {
            this.hooks.pre[event] = [];
        }
        for (const event of Object.keys(this.hooks.post)) {
            this.hooks.post[event] = [];
        }
    }

    /**
     * Get hook count
     * @param {string} type - Hook type (pre or post)
     * @param {string} event - Event name
     * @returns {number} Hook count
     */
    getCount(type, event) {
        if (!this.hooks[type] || !this.hooks[type][event]) {
            return 0;
        }
        return this.hooks[type][event].length;
    }

    /**
     * Get all hooks
     * @returns {Object} All hooks
     */
    getAll() {
        return {
            pre: {
                insert: this.hooks.pre.insert.length,
                update: this.hooks.pre.update.length,
                delete: this.hooks.pre.delete.length,
                find: this.hooks.pre.find.length
            },
            post: {
                insert: this.hooks.post.insert.length,
                update: this.hooks.post.update.length,
                delete: this.hooks.post.delete.length,
                find: this.hooks.post.find.length
            }
        };
    }
}
