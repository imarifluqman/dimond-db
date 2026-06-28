import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { LocalDB } from '../src/index.js';
import { FileStorage } from '../src/storage/FileStorage.js';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'test-database');
const TEST_DB_NAME = 'testdb';

describe('LocalDB - Basic Operations', () => {
    let db;
    let users;

    before(async () => {
        // Clean up any existing test database
        try {
            await FileStorage.deleteDir(TEST_DB_PATH);
        } catch (error) {
            // Ignore if doesn't exist
        }

        db = new LocalDB({
            database: TEST_DB_NAME,
            path: TEST_DB_PATH
        });

        users = db.collection('users');
    });

    after(async () => {
        // Clean up test database
        await db.dropDatabase();
    });

    describe('Database Initialization', () => {
        it('should create database structure', async () => {
            await db.initialize();
            const exists = await FileStorage.exists(join(TEST_DB_PATH, TEST_DB_NAME));
            assert.strictEqual(exists, true);
        });

        it('should create metadata file', async () => {
            const metadataPath = join(TEST_DB_PATH, TEST_DB_NAME, 'metadata.json');
            const exists = await FileStorage.exists(metadataPath);
            assert.strictEqual(exists, true);
        });
    });

    describe('Insert Operations', () => {
        it('should insert a single document', async () => {
            const result = await users.insertOne({
                name: 'Arif',
                age: 22,
                email: 'arif@example.com'
            });

            assert.strictEqual(result.acknowledged, true);
            assert.ok(result.insertedId);
        });

        it('should auto-generate _id if not provided', async () => {
            const result = await users.insertOne({ name: 'Ali' });
            const doc = await users.findOne({ name: 'Ali' });

            assert.ok(doc._id);
            assert.strictEqual(doc.name, 'Ali');
        });

        it('should insert multiple documents', async () => {
            const result = await users.insertMany([
                { name: 'Sara', age: 25 },
                { name: 'Ahmed', age: 30 },
                { name: 'Fatima', age: 28 }
            ]);

            assert.strictEqual(result.acknowledged, true);
            assert.strictEqual(result.insertedCount, 3);
            assert.strictEqual(result.insertedIds.length, 3);
        });

        it('should throw error for duplicate _id', async () => {
            const doc = { _id: 'duplicate-id', name: 'Test' };
            await users.insertOne(doc);

            await assert.rejects(
                async () => await users.insertOne(doc),
                { name: 'DuplicateKeyError' }
            );
        });

        it('should throw error for invalid document', async () => {
            await assert.rejects(
                async () => await users.insertOne(null),
                { name: 'ValidationError' }
            );

            await assert.rejects(
                async () => await users.insertOne([]),
                { name: 'ValidationError' }
            );
        });
    });

    describe('Find Operations', () => {
        it('should find all documents', async () => {
            const allUsers = await users.find();
            assert.ok(allUsers.length > 0);
        });

        it('should find documents by exact match', async () => {
            const result = await users.find({ name: 'Arif' });
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'Arif');
        });

        it('should find one document', async () => {
            const result = await users.findOne({ name: 'Sara' });
            assert.ok(result);
            assert.strictEqual(result.name, 'Sara');
        });

        it('should return null if no match', async () => {
            const result = await users.findOne({ name: 'NonExistent' });
            assert.strictEqual(result, null);
        });

        it('should find with $gt operator', async () => {
            const result = await users.find({ age: { $gt: 25 } });
            assert.ok(result.every(user => user.age > 25));
        });

        it('should find with $lt operator', async () => {
            const result = await users.find({ age: { $lt: 25 } });
            assert.ok(result.every(user => user.age < 25));
        });

        it('should find with $in operator', async () => {
            const result = await users.find({ name: { $in: ['Arif', 'Sara'] } });
            assert.strictEqual(result.length, 2);
        });

        it('should find with $and operator', async () => {
            const result = await users.find({
                $and: [
                    { age: { $gte: 25 } },
                    { age: { $lte: 30 } }
                ]
            });
            assert.ok(result.every(user => user.age >= 25 && user.age <= 30));
        });

        it('should find with $or operator', async () => {
            const result = await users.find({
                $or: [
                    { name: 'Arif' },
                    { age: 30 }
                ]
            });
            assert.ok(result.length >= 1);
        });
    });

    describe('Update Operations', () => {
        it('should update one document with $set', async () => {
            const result = await users.updateOne(
                { name: 'Arif' },
                { $set: { age: 23 } }
            );

            assert.strictEqual(result.acknowledged, true);
            assert.strictEqual(result.matchedCount, 1);
            assert.strictEqual(result.modifiedCount, 1);

            const updated = await users.findOne({ name: 'Arif' });
            assert.strictEqual(updated.age, 23);
        });

        it('should update many documents', async () => {
            await users.insertMany([
                { name: 'User1', status: 'inactive' },
                { name: 'User2', status: 'inactive' }
            ]);

            const result = await users.updateMany(
                { status: 'inactive' },
                { $set: { status: 'active' } }
            );

            assert.strictEqual(result.matchedCount, 2);
            assert.strictEqual(result.modifiedCount, 2);
        });

        it('should increment with $inc', async () => {
            await users.insertOne({ name: 'Counter', count: 5 });

            await users.updateOne(
                { name: 'Counter' },
                { $inc: { count: 3 } }
            );

            const updated = await users.findOne({ name: 'Counter' });
            assert.strictEqual(updated.count, 8);
        });

        it('should unset fields with $unset', async () => {
            await users.updateOne(
                { name: 'Arif' },
                { $unset: { email: '' } }
            );

            const updated = await users.findOne({ name: 'Arif' });
            assert.strictEqual(updated.email, undefined);
        });

        it('should push to array with $push', async () => {
            await users.insertOne({ name: 'ArrayTest', tags: ['tag1'] });

            await users.updateOne(
                { name: 'ArrayTest' },
                { $push: { tags: 'tag2' } }
            );

            const updated = await users.findOne({ name: 'ArrayTest' });
            assert.deepStrictEqual(updated.tags, ['tag1', 'tag2']);
        });
    });

    describe('Delete Operations', () => {
        it('should delete one document', async () => {
            await users.insertOne({ name: 'ToDelete', temp: true });

            const result = await users.deleteOne({ name: 'ToDelete' });
            assert.strictEqual(result.acknowledged, true);
            assert.strictEqual(result.deletedCount, 1);

            const deleted = await users.findOne({ name: 'ToDelete' });
            assert.strictEqual(deleted, null);
        });

        it('should delete many documents', async () => {
            await users.insertMany([
                { temp: true, value: 1 },
                { temp: true, value: 2 },
                { temp: true, value: 3 }
            ]);

            const result = await users.deleteMany({ temp: true });
            assert.ok(result.deletedCount >= 3);
        });

        it('should return 0 if no match', async () => {
            const result = await users.deleteOne({ name: 'NonExistent' });
            assert.strictEqual(result.deletedCount, 0);
        });
    });

    describe('Count Operations', () => {
        it('should count all documents', async () => {
            const count = await users.countDocuments();
            assert.ok(count >= 0);
        });

        it('should count with filter', async () => {
            const count = await users.countDocuments({ name: 'Arif' });
            assert.strictEqual(count, 1);
        });
    });

    describe('Collection Management', () => {
        it('should list all collections', async () => {
            db.collection('products');
            await db.collection('products').insertOne({ name: 'Product1' });

            const collections = await db.listCollections();
            assert.ok(collections.includes('users'));
            assert.ok(collections.includes('products'));
        });

        it('should drop a collection', async () => {
            const temp = db.collection('temp');
            await temp.insertOne({ data: 'test' });

            await temp.drop();

            const collections = await db.listCollections();
            assert.ok(!collections.includes('temp'));
        });

        it('should get database stats', async () => {
            const stats = await db.stats();
            assert.ok(stats.database);
            assert.ok(stats.collections >= 0);
            assert.ok(stats.documents >= 0);
        });
    });

    describe('Persistence', () => {
        it('should persist data across database instances', async () => {
            const testData = { name: 'PersistTest', value: 12345 };
            await users.insertOne(testData);

            // Create new database instance
            const db2 = new LocalDB({
                database: TEST_DB_NAME,
                path: TEST_DB_PATH
            });

            const users2 = db2.collection('users');
            const found = await users2.findOne({ name: 'PersistTest' });

            assert.ok(found);
            assert.strictEqual(found.value, 12345);
        });
    });
});
