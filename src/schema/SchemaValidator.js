import { SchemaDefinition } from './SchemaDefinition.js';
import { SchemaValidationError } from '../errors/DatabaseError.js';

/**
 * Schema Validator
 * Validates documents against schema definitions
 */
export class SchemaValidator {
    /**
     * @param {SchemaDefinition} schemaDefinition - Schema definition
     */
    constructor(schemaDefinition) {
        this.schemaDefinition = schemaDefinition;
    }

    /**
     * Validate a document
     * @param {Object} doc - Document to validate
     * @param {boolean} isUpdate - Whether this is an update operation
     * @throws {SchemaValidationError} If validation fails
     */
    validate(doc, isUpdate = false) {
        const errors = [];

        // Check required fields (only for inserts)
        if (!isUpdate) {
            for (const field of this.schemaDefinition.getFields()) {
                if (this.schemaDefinition.isRequired(field)) {
                    if (!(field in doc) || doc[field] === undefined || doc[field] === null) {
                        errors.push(`Field '${field}' is required`);
                    }
                }
            }
        }

        // Validate present fields
        for (const [field, value] of Object.entries(doc)) {
            if (field === '_id') continue; // Skip _id

            const fieldSchema = this.schemaDefinition.getFieldSchema(field);

            if (!fieldSchema) {
                // Unknown field - allow if schema is not strict
                continue;
            }

            const fieldErrors = this.validateField(field, value, fieldSchema);
            errors.push(...fieldErrors);
        }

        if (errors.length > 0) {
            throw new SchemaValidationError(
                `Document validation failed: ${errors.length} error(s)`,
                errors
            );
        }
    }

    /**
     * Validate a single field
     * @param {string} fieldName - Field name
     * @param {*} value - Field value
     * @param {Object} fieldSchema - Field schema
     * @returns {Array<string>} Validation errors
     */
    validateField(fieldName, value, fieldSchema) {
        const errors = [];

        // Skip validation if value is null/undefined and not required
        if ((value === null || value === undefined) && !fieldSchema.required) {
            return errors;
        }

        // Type validation
        if (fieldSchema.type) {
            const typeError = this.validateType(fieldName, value, fieldSchema.type);
            if (typeError) {
                errors.push(typeError);
                return errors; // Stop further validation if type is wrong
            }
        }

        // Constraint validations
        if (fieldSchema.min !== undefined) {
            if (typeof value === 'number' && value < fieldSchema.min) {
                errors.push(`Field '${fieldName}' must be >= ${fieldSchema.min}`);
            }
        }

        if (fieldSchema.max !== undefined) {
            if (typeof value === 'number' && value > fieldSchema.max) {
                errors.push(`Field '${fieldName}' must be <= ${fieldSchema.max}`);
            }
        }

        if (fieldSchema.minLength !== undefined) {
            if (typeof value === 'string' && value.length < fieldSchema.minLength) {
                errors.push(
                    `Field '${fieldName}' must have at least ${fieldSchema.minLength} characters`
                );
            }
        }

        if (fieldSchema.maxLength !== undefined) {
            if (typeof value === 'string' && value.length > fieldSchema.maxLength) {
                errors.push(
                    `Field '${fieldName}' must have at most ${fieldSchema.maxLength} characters`
                );
            }
        }

        if (fieldSchema.pattern) {
            if (typeof value === 'string' && !fieldSchema.pattern.test(value)) {
                errors.push(`Field '${fieldName}' does not match required pattern`);
            }
        }

        if (fieldSchema.enum) {
            if (!fieldSchema.enum.includes(value)) {
                errors.push(
                    `Field '${fieldName}' must be one of: ${fieldSchema.enum.join(', ')}`
                );
            }
        }

        // Custom validator
        if (fieldSchema.validate) {
            try {
                const result = fieldSchema.validate(value);
                if (result === false) {
                    errors.push(`Field '${fieldName}' failed custom validation`);
                } else if (typeof result === 'string') {
                    errors.push(result);
                }
            } catch (error) {
                errors.push(`Field '${fieldName}' validation error: ${error.message}`);
            }
        }

        return errors;
    }

    /**
     * Validate type
     * @param {string} fieldName - Field name
     * @param {*} value - Value to validate
     * @param {Function} type - Expected type constructor
     * @returns {string|null} Error message or null
     */
    validateType(fieldName, value, type) {
        if (type === String) {
            if (typeof value !== 'string') {
                return `Field '${fieldName}' must be a string`;
            }
        } else if (type === Number) {
            if (typeof value !== 'number' || isNaN(value)) {
                return `Field '${fieldName}' must be a number`;
            }
        } else if (type === Boolean) {
            if (typeof value !== 'boolean') {
                return `Field '${fieldName}' must be a boolean`;
            }
        } else if (type === Date) {
            if (!(value instanceof Date) && typeof value !== 'string') {
                return `Field '${fieldName}' must be a Date or date string`;
            }
            if (typeof value === 'string' && isNaN(Date.parse(value))) {
                return `Field '${fieldName}' must be a valid date string`;
            }
        } else if (type === Object) {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                return `Field '${fieldName}' must be an object`;
            }
        } else if (type === Array) {
            if (!Array.isArray(value)) {
                return `Field '${fieldName}' must be an array`;
            }
        }

        return null;
    }

    /**
     * Validate update operations
     * @param {Object} update - Update operations
     * @throws {SchemaValidationError} If validation fails
     */
    validateUpdate(update) {
        const errors = [];

        // Validate $set
        if (update.$set) {
            for (const [field, value] of Object.entries(update.$set)) {
                const fieldSchema = this.schemaDefinition.getFieldSchema(field);
                if (fieldSchema) {
                    const fieldErrors = this.validateField(field, value, fieldSchema);
                    errors.push(...fieldErrors);
                }
            }
        }

        // Validate $inc
        if (update.$inc) {
            for (const [field, value] of Object.entries(update.$inc)) {
                if (typeof value !== 'number') {
                    errors.push(`$inc value for '${field}' must be a number`);
                }

                const fieldSchema = this.schemaDefinition.getFieldSchema(field);
                if (fieldSchema && fieldSchema.type !== Number) {
                    errors.push(`Cannot use $inc on non-numeric field '${field}'`);
                }
            }
        }

        if (errors.length > 0) {
            throw new SchemaValidationError(
                `Update validation failed: ${errors.length} error(s)`,
                errors
            );
        }
    }

    /**
     * Check uniqueness constraint
     * @param {string} field - Field name
     * @returns {boolean} True if field has unique constraint
     */
    isUnique(field) {
        const fieldSchema = this.schemaDefinition.getFieldSchema(field);
        return fieldSchema ? fieldSchema.unique === true : false;
    }

    /**
     * Get all unique fields
     * @returns {Array<string>} Unique field names
     */
    getUniqueFields() {
        const uniqueFields = [];

        for (const field of this.schemaDefinition.getFields()) {
            if (this.isUnique(field)) {
                uniqueFields.push(field);
            }
        }

        return uniqueFields;
    }
}
