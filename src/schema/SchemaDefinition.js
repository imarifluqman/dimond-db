/**
 * Schema Definition
 * Defines and compiles schema rules
 */
export class SchemaDefinition {
    /**
     * @param {Object} schema - Schema specification
     */
    constructor(schema) {
        this.schema = schema;
        this.compiled = this.compile(schema);
    }

    /**
     * Compile schema for efficient validation
     * @param {Object} schema - Schema specification
     * @returns {Object} Compiled schema
     */
    compile(schema) {
        const compiled = {};

        for (const [field, rules] of Object.entries(schema)) {
            if (typeof rules === 'function') {
                // Simple type: String, Number, Boolean, Date, Object, Array
                compiled[field] = { type: rules, required: false };
            } else if (typeof rules === 'object' && rules !== null) {
                // Complex rules
                compiled[field] = { ...rules };
            } else {
                throw new Error(`Invalid schema definition for field: ${field}`);
            }
        }

        return compiled;
    }

    /**
     * Get field schema
     * @param {string} field - Field name
     * @returns {Object|null} Field schema
     */
    getFieldSchema(field) {
        return this.compiled[field] || null;
    }

    /**
     * Get all fields
     * @returns {Array<string>} Field names
     */
    getFields() {
        return Object.keys(this.compiled);
    }

    /**
     * Check if field is required
     * @param {string} field - Field name
     * @returns {boolean} True if required
     */
    isRequired(field) {
        const fieldSchema = this.getFieldSchema(field);
        return fieldSchema ? fieldSchema.required === true : false;
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            schema: this.schema
        };
    }

    /**
     * Deserialize from JSON
     * @param {Object} data - JSON data
     * @returns {SchemaDefinition} Schema definition
     */
    static fromJSON(data) {
        return new SchemaDefinition(data.schema);
    }
}
