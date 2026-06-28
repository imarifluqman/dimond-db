import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { StorageError } from '../errors/DatabaseError.js';

/**
 * File Storage - Handles all file system operations
 */
export class FileStorage {
    /**
     * Reads a JSON file and returns parsed content
     * @param {string} filePath - Path to the file
     * @returns {Promise<*>} Parsed JSON content
     */
    static async readJSON(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new StorageError(`File not found: ${filePath}`, error);
            }
            if (error instanceof SyntaxError) {
                throw new StorageError(`Invalid JSON in file: ${filePath}`, error);
            }
            throw new StorageError(`Failed to read file: ${filePath}`, error);
        }
    }

    /**
     * Writes data to a JSON file
     * @param {string} filePath - Path to the file
     * @param {*} data - Data to write
     */
    static async writeJSON(filePath, data) {
        try {
            // Ensure parent directory exists
            const parentDir = dirname(filePath);
            await this.ensureDir(parentDir);

            const content = JSON.stringify(data, null, 2);

            // Atomic write: write to temp file then rename
            const tempPath = `${filePath}.tmp`;
            await fs.writeFile(tempPath, content, 'utf-8');
            await fs.rename(tempPath, filePath);
        } catch (error) {
            throw new StorageError(`Failed to write file: ${filePath}`, error);
        }
    }

    /**
     * Checks if a file exists
     * @param {string} filePath - Path to check
     * @returns {Promise<boolean>} True if file exists
     */
    static async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Creates a directory and all parent directories if they don't exist
     * @param {string} dirPath - Directory path to create
     */
    static async ensureDir(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            throw new StorageError(`Failed to create directory: ${dirPath}`, error);
        }
    }

    /**
     * Deletes a file
     * @param {string} filePath - Path to the file
     */
    static async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw new StorageError(`Failed to delete file: ${filePath}`, error);
            }
        }
    }

    /**
     * Lists all files in a directory
     * @param {string} dirPath - Directory path
     * @returns {Promise<string[]>} Array of file names
     */
    static async listFiles(dirPath) {
        try {
            return await fs.readdir(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw new StorageError(`Failed to list directory: ${dirPath}`, error);
        }
    }

    /**
     * Deletes a directory and all its contents
     * @param {string} dirPath - Directory path
     */
    static async deleteDir(dirPath) {
        try {
            await fs.rm(dirPath, { recursive: true, force: true });
        } catch (error) {
            throw new StorageError(`Failed to delete directory: ${dirPath}`, error);
        }
    }

    /**
     * Gets file stats
     * @param {string} filePath - Path to the file
     * @returns {Promise<Object>} File stats
     */
    static async getStats(filePath) {
        try {
            return await fs.stat(filePath);
        } catch (error) {
            throw new StorageError(`Failed to get file stats: ${filePath}`, error);
        }
    }
}
