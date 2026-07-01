import { join } from 'path';
import { FileStorage } from '../storage/FileStorage.js';
import { BackupError } from '../errors/DatabaseError.js';

/**
 * Backup Manager
 * Handles database backup and restore operations
 */
export class BackupManager {
    /**
     * @param {Object} database - Database instance
     */
    constructor(database) {
        this.database = database;
    }

    /**
     * Create a full backup
     * @param {string} backupPath - Path to store backup
     * @returns {Promise<Object>} Backup information
     */
    async backup(backupPath) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = join(backupPath, `backup-${timestamp}`);

            // Ensure backup directory exists
            await FileStorage.ensureDir(backupDir);

            const stats = {
                timestamp,
                database: this.database.name,
                collections: 0,
                documents: 0,
                indexes: 0,
                size: 0
            };

            // Backup metadata
            await this.backupMetadata(backupDir);

            // Backup collections
            const collections = await this.database.listCollections();
            for (const collectionName of collections) {
                const collectionStats = await this.backupCollection(collectionName, backupDir);
                stats.collections++;
                stats.documents += collectionStats.documents;
                stats.indexes += collectionStats.indexes;
                stats.size += collectionStats.size;
            }

            // Backup WAL if enabled
            if (this.database.walManager && this.database.walManager.enabled) {
                await this.backupWAL(backupDir);
            }

            // Write backup manifest
            await this.writeManifest(backupDir, stats);

            return {
                acknowledged: true,
                backupPath: backupDir,
                timestamp,
                stats
            };
        } catch (error) {
            throw new BackupError(`Backup failed: ${error.message}`, error);
        }
    }

    /**
     * Backup metadata
     * @param {string} backupDir - Backup directory
     */
    async backupMetadata(backupDir) {
        const sourcePath = join(this.database.databasePath, 'metadata.json');
        const destPath = join(backupDir, 'metadata.json');

        if (await FileStorage.exists(sourcePath)) {
            const metadata = await FileStorage.readJSON(sourcePath);
            await FileStorage.writeJSON(destPath, metadata);
        }
    }

    /**
     * Backup a collection
     * @param {string} collectionName - Collection name
     * @param {string} backupDir - Backup directory
     * @returns {Promise<Object>} Collection stats
     */
    async backupCollection(collectionName, backupDir) {
        const collectionsDir = join(backupDir, 'collections');
        await FileStorage.ensureDir(collectionsDir);

        const collection = this.database.collection(collectionName);
        await collection.load();

        // Backup collection data
        const collectionFile = join(collectionsDir, `${collectionName}.collection`);
        await FileStorage.writeJSON(collectionFile, collection.documents);

        const stats = {
            documents: collection.documents.length,
            indexes: 0,
            size: JSON.stringify(collection.documents).length
        };

        // Backup indexes if they exist
        if (collection.indexManager && collection.indexManager.loaded) {
            const indexStats = await this.backupIndexes(collectionName, backupDir);
            stats.indexes = indexStats.count;
        }

        return stats;
    }

    /**
     * Backup indexes for a collection
     * @param {string} collectionName - Collection name
     * @param {string} backupDir - Backup directory
     * @returns {Promise<Object>} Index stats
     */
    async backupIndexes(collectionName, backupDir) {
        const indexesDir = join(backupDir, 'indexes', collectionName);
        await FileStorage.ensureDir(indexesDir);

        const sourceIndexDir = join(this.database.databasePath, 'indexes', collectionName);

        let count = 0;

        if (await FileStorage.exists(sourceIndexDir)) {
            const files = await FileStorage.listFiles(sourceIndexDir);
            const indexFiles = files.filter(f => f.endsWith('.idx'));

            for (const file of indexFiles) {
                const sourcePath = join(sourceIndexDir, file);
                const destPath = join(indexesDir, file);

                const indexData = await FileStorage.readJSON(sourcePath);
                await FileStorage.writeJSON(destPath, indexData);
                count++;
            }
        }

        return { count };
    }

    /**
     * Backup WAL
     * @param {string} backupDir - Backup directory
     */
    async backupWAL(backupDir) {
        const walDir = join(backupDir, 'wal');
        await FileStorage.ensureDir(walDir);

        const sourceWALDir = join(this.database.databasePath, 'wal');

        if (await FileStorage.exists(sourceWALDir)) {
            const files = await FileStorage.listFiles(sourceWALDir);

            for (const file of files) {
                const sourcePath = join(sourceWALDir, file);
                const destPath = join(walDir, file);

                const data = await FileStorage.readJSON(sourcePath);
                await FileStorage.writeJSON(destPath, data);
            }
        }
    }

    /**
     * Write backup manifest
     * @param {string} backupDir - Backup directory
     * @param {Object} stats - Backup statistics
     */
    async writeManifest(backupDir, stats) {
        const manifest = {
            version: '2.0.0',
            database: this.database.name,
            timestamp: stats.timestamp,
            stats,
            source: {
                path: this.database.databasePath,
                version: '2.0.0'
            }
        };

        await FileStorage.writeJSON(join(backupDir, 'manifest.json'), manifest);
    }

    /**
     * Restore from backup
     * @param {string} backupPath - Path to backup directory
     * @returns {Promise<Object>} Restore information
     */
    async restore(backupPath) {
        try {
            // Read manifest
            const manifestPath = join(backupPath, 'manifest.json');
            if (!(await FileStorage.exists(manifestPath))) {
                throw new BackupError('Invalid backup: manifest.json not found');
            }

            const manifest = await FileStorage.readJSON(manifestPath);

            // Validate backup version
            if (!manifest.version || !manifest.version.startsWith('2.')) {
                throw new BackupError('Incompatible backup version');
            }

            // Clear existing database
            await this.database.dropDatabase();
            await this.database.initialize();

            const stats = {
                collections: 0,
                documents: 0,
                indexes: 0
            };

            // Restore metadata
            await this.restoreMetadata(backupPath);

            // Restore collections
            const collectionsDir = join(backupPath, 'collections');
            if (await FileStorage.exists(collectionsDir)) {
                const files = await FileStorage.listFiles(collectionsDir);
                const collectionFiles = files.filter(f => f.endsWith('.collection'));

                for (const file of collectionFiles) {
                    const collectionName = file.replace('.collection', '');
                    const collectionStats = await this.restoreCollection(collectionName, backupPath);
                    stats.collections++;
                    stats.documents += collectionStats.documents;
                    stats.indexes += collectionStats.indexes;
                }
            }

            // Restore WAL if exists
            const walDir = join(backupPath, 'wal');
            if (await FileStorage.exists(walDir)) {
                await this.restoreWAL(backupPath);
            }

            return {
                acknowledged: true,
                backupTimestamp: manifest.timestamp,
                stats
            };
        } catch (error) {
            throw new BackupError(`Restore failed: ${error.message}`, error);
        }
    }

    /**
     * Restore metadata
     * @param {string} backupPath - Backup path
     */
    async restoreMetadata(backupPath) {
        const sourcePath = join(backupPath, 'metadata.json');
        const destPath = join(this.database.databasePath, 'metadata.json');

        if (await FileStorage.exists(sourcePath)) {
            const metadata = await FileStorage.readJSON(sourcePath);
            await FileStorage.writeJSON(destPath, metadata);
        }
    }

    /**
     * Restore a collection
     * @param {string} collectionName - Collection name
     * @param {string} backupPath - Backup path
     * @returns {Promise<Object>} Restore stats
     */
    async restoreCollection(collectionName, backupPath) {
        const sourceFile = join(backupPath, 'collections', `${collectionName}.collection`);
        const documents = await FileStorage.readJSON(sourceFile);

        const collection = this.database.collection(collectionName);
        await collection.load();

        collection.documents = documents;
        await collection.persist();

        const stats = {
            documents: documents.length,
            indexes: 0
        };

        // Restore indexes
        const sourceIndexDir = join(backupPath, 'indexes', collectionName);
        if (await FileStorage.exists(sourceIndexDir)) {
            const indexStats = await this.restoreIndexes(collectionName, backupPath);
            stats.indexes = indexStats.count;

            // Rebuild indexes with restored data
            if (collection.indexManager) {
                await collection.indexManager.load();
                await collection.indexManager.rebuildAll(documents);
            }
        }

        return stats;
    }

    /**
     * Restore indexes
     * @param {string} collectionName - Collection name
     * @param {string} backupPath - Backup path
     * @returns {Promise<Object>} Index stats
     */
    async restoreIndexes(collectionName, backupPath) {
        const sourceIndexDir = join(backupPath, 'indexes', collectionName);
        const destIndexDir = join(this.database.databasePath, 'indexes', collectionName);

        await FileStorage.ensureDir(destIndexDir);

        const files = await FileStorage.listFiles(sourceIndexDir);
        const indexFiles = files.filter(f => f.endsWith('.idx'));

        for (const file of indexFiles) {
            const sourcePath = join(sourceIndexDir, file);
            const destPath = join(destIndexDir, file);

            const indexData = await FileStorage.readJSON(sourcePath);
            await FileStorage.writeJSON(destPath, indexData);
        }

        return { count: indexFiles.length };
    }

    /**
     * Restore WAL
     * @param {string} backupPath - Backup path
     */
    async restoreWAL(backupPath) {
        const sourceWALDir = join(backupPath, 'wal');
        const destWALDir = join(this.database.databasePath, 'wal');

        await FileStorage.ensureDir(destWALDir);

        const files = await FileStorage.listFiles(sourceWALDir);

        for (const file of files) {
            const sourcePath = join(sourceWALDir, file);
            const destPath = join(destWALDir, file);

            const data = await FileStorage.readJSON(sourcePath);
            await FileStorage.writeJSON(destPath, data);
        }
    }

    /**
     * List available backups
     * @param {string} backupPath - Backup root path
     * @returns {Promise<Array>} List of backups
     */
    async listBackups(backupPath) {
        try {
            if (!(await FileStorage.exists(backupPath))) {
                return [];
            }

            const files = await FileStorage.listFiles(backupPath);
            const backups = [];

            for (const dir of files) {
                const manifestPath = join(backupPath, dir, 'manifest.json');
                if (await FileStorage.exists(manifestPath)) {
                    const manifest = await FileStorage.readJSON(manifestPath);
                    backups.push({
                        name: dir,
                        path: join(backupPath, dir),
                        timestamp: manifest.timestamp,
                        database: manifest.database,
                        stats: manifest.stats
                    });
                }
            }

            // Sort by timestamp (newest first)
            backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            return backups;
        } catch (error) {
            throw new BackupError(`Failed to list backups: ${error.message}`, error);
        }
    }
}
