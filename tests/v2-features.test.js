import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { LocalDB } from '../src/index.js';
import { FileStorage } from '../src/storage/FileStorage.js';
import { join } from 'path';

const TEST_DB_PATH = join(process.cwd(), 'test-database-v2');
const TEST_DB_NAME = 'testdb_v2';

describe('LocalDB V2 - Cursor API', () => {
    let db;
    let users;

    before(async () => {
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

        // Insert test data
        await users.insertMany([
            { name: 'Alice', age: 30, city: 'NYC' },
            { name: 'Bob', age: 25, city: 'LA' },
            { name: 'Charlie', age: 35, city: 'NYC' },
            { name: 'Diana', age: 28, city: 'LA' },
            { name: 'Eve', age: 32, city: 'NYC' }
        ]);
    });

    after(async () => {
        await db.dropDatabase();
    });

    describe('Cursor Methods', () => {
        it('should support sort', async () => {
            const results = await users.findCursor({})
                .sort({ age: 1 })
                .toArray();

            assert.strictEqual(results[0].name, 'Bob'); // age 25
            assert.strictEqual(results[4].name, 'Charlie'); // age 35
        });

        it('should support limit', async () => {
            const results = await users.findCursor({})
                .limit(2)
                .toArray();

            assert.strictEqual(results.length, 2);
        });

        it('should support skip', async () => {
            const results = await users.findCursor({})
                .sort({ age: 1 })
                .skip(2)
                .toArray();

            assert.strictEqual(results.length, 3);
            assert.strictEqual(results[0].age, 30); // Skip first 2
        });

        it('should support projection', async () => {
            const results = await users.findCursor({})
                .project({ name: 1, age: 1 })
                .limit(1)
                .toArray();

            assert.ok(results[0].name);
            assert.ok(results[0].age);
            assert.ok(results[0]._id); // Always included
            assert.strictEqual(results[0].city, undefined);
        });

        it('should chain multiple operations', async () => {
            const results = await users.findCursor({ city: 'NYC' })
                .sort({ age: -1 })
                .skip(1)
                .limit(1)
                .project({ name: 1 })
                .toArray();

            assert.strictEqual(results.length, 1);
            assert.ok(results[0].name);
        });

        it('should support next() and hasNext()', async () => {
            const cursor = users.findCursor({}).limit(2);

            assert.strictEqual(await cursor.hasNext(), true);
            const doc1 = await cursor.next();
            assert.ok(doc1);

            assert.strictEqual(await cursor.hasNext(), true);
            const doc2 = await cursor.next();
            assert.ok(doc2);

            assert.strictEqual(await cursor.hasNext(), false);
            const doc3 = await cursor.next();
            assert.strictEqual(doc3, null);
        });

        it('should support forEach', async () => {
            let count = 0;
            const cursor = users.findCursor({}).limit(3);

            await cursor.forEach(doc => {
                assert.ok(doc._id);
                count++;
            });

            assert.strictEqual(count, 3);
        });

        it('should support map', async () => {
            const names = await users.findCursor({})
                .limit(3)
                .map(doc => doc.name);

            assert.strictEqual(names.length, 3);
            assert.ok(names.every(name => typeof name === 'string'));
        });

        it('should support filter', async () => {
            const cursor = users.findCursor({});
            const results = await cursor.filter(doc => doc.age > 30);

            assert.ok(results.length >= 2);
            assert.ok(results.every(doc => doc.age > 30));
        });
    });
});

describe('LocalDB V2 - Indexes', () => {
    let db;
    let products;

    before(async () => {
        db = new LocalDB({
            database: TEST_DB_NAME,
            path: TEST_DB_PATH,
            autoIndex: true
        });

        products = db.collection('products');

        await products.insertMany([
            { name: 'Laptop', price: 999, category: 'electronics' },
            { name: 'Mouse', price: 25, category: 'electronics' },
            { name: 'Desk', price: 300, category: 'furniture' },
            { name: 'Chair', price: 200, category: 'furniture' }
        ]);
    });

    it('should create index', async () => {
        const indexName = await products.createIndex({ price: 1 });
        assert.ok(indexName);
    });

    it('should list indexes', async () => {
        const indexes = await products.listIndexes();
        assert.ok(indexes.length > 0);
    });

    it('should query with index', async () => {
        await products.createIndex({ category: 1 });
        const results = await products.find({ category: 'electronics' });
        assert.strictEqual(results.length, 2);
    });

    it('should enforce unique constraint', async () => {
        await products.createIndex({ name: 1 }, { unique: true });

        await assert.rejects(
            async () => await products.insertOne({ name: 'Laptop', price: 1000 }),
            { name: 'DuplicateKeyError' }
        );
    });

    it('should drop index', async () => {
        const indexName = await products.createIndex({ price: -1 }); // Use different field/direction
        await products.dropIndex(indexName);

        const indexes = await products.listIndexes();
        assert.ok(!indexes.find(i => i.name === indexName));
    });
});

describe('LocalDB V2 - Schema Validation', () => {
    let db;
    let posts;

    before(async () => {
        db = new LocalDB({
            database: TEST_DB_NAME,
            path: TEST_DB_PATH,
            strictSchema: true
        });

        posts = db.createCollection('posts', {
            schema: {
                title: { type: String, required: true, minLength: 3, maxLength: 100 },
                content: { type: String, required: true },
                views: { type: Number, min: 0 },
                published: { type: Boolean }
            }
        });
    });

    it('should validate required fields', async () => {
        await assert.rejects(
            async () => await posts.insertOne({ content: 'Test' }),
            { name: 'SchemaValidationError' }
        );
    });

    it('should validate type', async () => {
        await assert.rejects(
            async () => await posts.insertOne({ title: 123, content: 'Test' }),
            { name: 'SchemaValidationError' }
        );
    });

    it('should validate constraints', async () => {
        await assert.rejects(
            async () => await posts.insertOne({ title: 'ab', content: 'Test' }),
            { name: 'SchemaValidationError' }
        );
    });

    it('should allow valid documents', async () => {
        const result = await posts.insertOne({
            title: 'Valid Post',
            content: 'This is valid content',
            views: 10,
            published: true
        });

        assert.ok(result.insertedId);
    });
});

describe('LocalDB V2 - Hooks', () => {
    let db;
    let articles;

    before(async () => {
        db = new LocalDB({
            database: TEST_DB_NAME,
            path: TEST_DB_PATH
        });

        articles = db.collection('articles');
    });

    it('should execute pre-insert hook', async () => {
        let hookCalled = false;

        articles.pre('insert', (context) => {
            hookCalled = true;
            context.document.createdAt = new Date().toISOString();
            return context;
        });

        const result = await articles.insertOne({ title: 'Test Article' });
        const doc = await articles.findOne({ _id: result.insertedId });

        assert.strictEqual(hookCalled, true);
        assert.ok(doc.createdAt);
    });

    it('should execute post-insert hook', async () => {
        let hookCalled = false;

        articles.post('insert', (context) => {
            hookCalled = true;
        });

        await articles.insertOne({ title: 'Another Article' });

        assert.strictEqual(hookCalled, true);
    });
});

describe('LocalDB V2 - Transactions', () => {
    let db;
    let accounts;

    before(async () => {
        db = new LocalDB({
            database: TEST_DB_NAME,
            path: TEST_DB_PATH,
            journal: true
        });

        accounts = db.collection('accounts');

        await accounts.insertMany([
            { name: 'Alice', balance: 1000 },
            { name: 'Bob', balance: 500 }
        ]);
    });

    it('should commit transaction', async () => {
        const session = db.startSession();
        await session.startTransaction();

        await accounts.updateOne({ name: 'Alice' }, { $inc: { balance: -100 } }, session);
        await accounts.updateOne({ name: 'Bob' }, { $inc: { balance: 100 } }, session);

        await session.commit();

        const alice = await accounts.findOne({ name: 'Alice' });
        const bob = await accounts.findOne({ name: 'Bob' });

        assert.strictEqual(alice.balance, 900);
        assert.strictEqual(bob.balance, 600);
    });

    it('should abort transaction', async () => {
        const session = db.startSession();
        await session.startTransaction();

        await accounts.updateOne({ name: 'Alice' }, { $inc: { balance: -100 } }, session);
        await accounts.updateOne({ name: 'Bob' }, { $inc: { balance: 100 } }, session);

        await session.abort();

        const alice = await accounts.findOne({ name: 'Alice' });
        const bob = await accounts.findOne({ name: 'Bob' });

        // Balances should remain unchanged
        assert.strictEqual(alice.balance, 900);
        assert.strictEqual(bob.balance, 600);
    });
});

describe('LocalDB V2 - Cache', () => {
    let db;
    let items;

    before(async () => {
        db = new LocalDB({
            database: TEST_DB_NAME,
            path: TEST_DB_PATH,
            cache: true,
            cacheSize: '10MB'
        });

        items = db.collection('items');

        await items.insertMany([
            { name: 'Item1', value: 100 },
            { name: 'Item2', value: 200 }
        ]);
    });

    it('should cache query results', async () => {
        // First query - cache miss
        await items.find({ value: { $gte: 100 } });

        // Second query - cache hit
        await items.find({ value: { $gte: 100 } });

        const stats = db.cacheStats();
        assert.ok(stats.hits > 0);
    });

    it('should invalidate cache on write', async () => {
        await items.find({ name: 'Item1' });

        await items.updateOne({ name: 'Item1' }, { $set: { value: 150 } });

        // Cache should be invalidated
        const result = await items.findOne({ name: 'Item1' });
        assert.strictEqual(result.value, 150);
    });
});

describe('LocalDB V2 - Performance Monitoring', () => {
    let db;

    before(async () => {
        db = new LocalDB({
            database: TEST_DB_NAME,
            path: TEST_DB_PATH,
            performanceTracking: true
        });

        const test = db.collection('test');
        await test.insertOne({ data: 'test' });
        await test.find({});
    });

    it('should track operations', () => {
        const report = db.performance();

        assert.ok(report.operations.reads > 0);
        assert.ok(report.operations.writes > 0);
    });

    it('should calculate averages', () => {
        const report = db.performance();

        assert.ok(typeof report.timing.averageRead === 'number');
        assert.ok(typeof report.timing.averageWrite === 'number');
    });
});

describe('LocalDB V2 - Backup & Restore', () => {
    let db;

    before(async () => {
        db = new LocalDB({
            database: TEST_DB_NAME,
            path: TEST_DB_PATH
        });

        const backups = db.collection('backups');
        await backups.insertMany([
            { data: 'backup1' },
            { data: 'backup2' }
        ]);
    });

    it('should create backup', async () => {
        const result = await db.backup(join(TEST_DB_PATH, 'backups'));

        assert.ok(result.acknowledged);
        assert.ok(result.backupPath);
        assert.ok(result.stats.collections > 0);
    });

    it('should restore backup', async () => {
        const backupResult = await db.backup(join(TEST_DB_PATH, 'backups'));

        // Clear database
        await db.dropDatabase();

        // Restore
        const restoreResult = await db.restore(backupResult.backupPath);

        assert.ok(restoreResult.acknowledged);
        assert.ok(restoreResult.stats.collections > 0);
    });
});
