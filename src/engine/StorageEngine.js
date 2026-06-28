import { join } from 'path';
import { FileStorage } from '../storage/FileStorage.js';
import { StorageError } from '../errors/DatabaseError.js';

/**
 * Storage Engine - Manages collection file operations
 */
export class StorageEngine {
    /**
     * @param {string} databasePath - Root path for the database
     */
    constructor(databasePath) {
        this.databasePath = databasePath;
        this.collectionsPath = join(databasePath, 'collections');
        this.metadataPath = join(databasePath, 'metadata.json');
    }

    /**
     * Initializes the database storage structure
     */
    async initialize() {
        await FileStorage.ensureDir(this.databasePath);
        await FileStorage.ensureDir(this.collectionsPath);

        // Create metadata if it doesn't exist
        if (!(await FileStorage.exists(this.metadataPath))) {
            await this.writeMetadata({
                version: '1.0.0',
                collections: [],
                createdAt: new Date().toISOString()
            });
        }
    }

    /**
     * Gets the file path for a collection
     * @param {string} collectionName - Name of the collection
     * @returns {string} Full path to the collection file
     */
    getCollectionPath(collectionName) {
        return join(this.collectionsPath, `${collectionName}.collection`);
    }

    /**
     * Checks if a collection exists
     * @param {string} collectionName - Name of the collection
     * @returns {Promise<boolean>} True if collection exists
     */
    async collectionExists(collectionName) {
        const collectionPath = this.getCollectionPath(collectionName);
        return await FileStorage.exists(collectionPath);
    }

    /**
     * Reads a collection file
     * @param {string} collectionName - Name of the collection
     * @returns {Promise<Array>} Array of documents
     */
    async readCollection(collectionName) {
        const collectionPath = this.getCollectionPath(collectionName);

        if (!(await FileStorage.exists(collectionPath))) {
            return [];
        }

        try {
            return await FileStorage.readJSON(collectionPath);
        } catch (error) {
            throw new StorageError(
                `Failed to read collection "${collectionName}"`,
                error
            );
        }
    }

    /**
     * Writes documents to a collection file
     * @param {string} collectionName - Name of the collection
     * @param {Array} documents - Array of documents to write
     */
    async writeCollection(collectionName, documents) {
        // Ensure collection exists before writing
        if (!(await this.collectionExists(collectionName))) {
            await this.createCollection(collectionName);
        }

        const collectionPath = this.getCollectionPath(collectionName);

        try {
            await FileStorage.writeJSON(collectionPath, documents);
        } catch (error) {
            throw new StorageError(
                `Failed to write collection "${collectionName}"`,
                error
            );
        }
    }

    /**
     * Creates a new collection
     * @param {string} collectionName - Name of the collection
     */
    async createCollection(collectionName) {
        const collectionPath = this.getCollectionPath(collectionName);

        // Create empty collection file
        await FileStorage.writeJSON(collectionPath, []);

        // Update metadata
        const metadata = await this.readMetadata();
        if (!metadata.collections.includes(collectionName)) {
            metadata.collections.push(collectionName);
            await this.writeMetadata(metadata);
        }
    }

    /**
     * Deletes a collection
     * @param {string} collectionName - Name of the collection
     */
    async deleteCollection(collectionName) {
        const collectionPath = this.getCollectionPath(collectionName);

        // Delete collection file
        await FileStorage.deleteFile(collectionPath);

        // Update metadata
        const metadata = await this.readMetadata();
        metadata.collections = metadata.collections.filter(
            name => name !== collectionName
        );
        await this.writeMetadata(metadata);
    }

    /**
     * Lists all collections
     * @returns {Promise<Array<string>>} Array of collection names
     */
    async listCollections() {
        const files = await FileStorage.listFiles(this.collectionsPath);
        return files
            .filter(file => file.endsWith('.collection'))
            .map(file => file.replace('.collection', ''));
    }

    /**
     * Reads metadata
     * @returns {Promise<Object>} Metadata object
     */
    async readMetadata() {
        try {
            return await FileStorage.readJSON(this.metadataPath);
        } catch (error) {
            // Return default metadata if file doesn't exist or is corrupted
            return {
                version: '1.0.0',
                collections: [],
                createdAt: new Date().toISOString()
            };
        }
    }

    /**
     * Writes metadata
     * @param {Object} metadata - Metadata object to write
     */
    async writeMetadata(metadata) {
        await FileStorage.writeJSON(this.metadataPath, metadata);
    }

    /**
     * Deletes the entire database
     */
    async dropDatabase() {
        await FileStorage.deleteDir(this.databasePath);
    }
}
