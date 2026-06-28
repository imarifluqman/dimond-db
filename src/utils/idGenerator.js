import { randomBytes } from 'crypto';

/**
 * Generates a UUID v4 compliant unique identifier
 * @returns {string} A UUID string
 */
export function generateId() {
    const bytes = randomBytes(16);

    // Set version (4) and variant bits according to RFC 4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

    const hex = bytes.toString('hex');

    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}

/**
 * Validates if a string is a valid UUID format
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid UUID format
 */
export function isValidId(id) {
    if (typeof id !== 'string') return false;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}
