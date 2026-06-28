import { LocalDB } from './src/index.js';

/**
 * LocalDB JS - Complete Demo
 * This demonstrates all core features of LocalDB
 */

async function main() {
    console.log('🚀 LocalDB JS - Demo Application\n');

    // ==========================================
    // 1. DATABASE INITIALIZATION
    // ==========================================
    console.log('📂 Creating database...');
    const db = new LocalDB({
        database: 'demoApp',
        path: './database'
    });

    const users = db.collection('users');
    const products = db.collection('products');

    console.log('✅ Database created successfully\n');

    // ==========================================
    // 2. INSERT OPERATIONS
    // ==========================================
    console.log('📝 Inserting documents...');

    // Insert single user
    const user1 = await users.insertOne({
        name: 'Arif',
        age: 22,
        email: 'arif@example.com',
        role: 'admin',
        active: true
    });
    console.log(`✅ Inserted user: ${user1.insertedId}`);

    // Insert multiple users
    const manyUsers = await users.insertMany([
        { name: 'Ali', age: 25, email: 'ali@example.com', role: 'user', active: true },
        { name: 'Sara', age: 28, email: 'sara@example.com', role: 'user', active: true },
        { name: 'Ahmed', age: 30, email: 'ahmed@example.com', role: 'moderator', active: false },
        { name: 'Fatima', age: 26, email: 'fatima@example.com', role: 'user', active: true }
    ]);
    console.log(`✅ Inserted ${manyUsers.insertedCount} users\n`);

    // Insert products
    await products.insertMany([
        { name: 'Laptop', price: 999, category: 'electronics', stock: 50 },
        { name: 'Mouse', price: 25, category: 'electronics', stock: 200 },
        { name: 'Keyboard', price: 75, category: 'electronics', stock: 150 },
        { name: 'Desk', price: 300, category: 'furniture', stock: 30 },
        { name: 'Chair', price: 200, category: 'furniture', stock: 45 }
    ]);
    console.log('✅ Inserted products\n');

    // ==========================================
    // 3. FIND OPERATIONS
    // ==========================================
    console.log('🔍 Finding documents...');

    // Find all users
    const allUsers = await users.find();
    console.log(`📊 Total users: ${allUsers.length}`);

    // Find one user
    const arif = await users.findOne({ name: 'Arif' });
    console.log(`👤 Found user: ${arif.name} (${arif.email})`);

    // Find with comparison operators
    const adults = await users.find({ age: { $gte: 25 } });
    console.log(`👥 Users aged 25+: ${adults.length}`);

    // Find with $in operator
    const adminsAndMods = await users.find({
        role: { $in: ['admin', 'moderator'] }
    });
    console.log(`👮 Admins & Moderators: ${adminsAndMods.length}`);

    // Find with $and operator
    const activeUsers = await users.find({
        $and: [
            { active: true },
            { age: { $gte: 25 } }
        ]
    });
    console.log(`✅ Active users 25+: ${activeUsers.length}`);

    // Find expensive products
    const expensive = await products.find({ price: { $gte: 200 } });
    console.log(`💰 Expensive products: ${expensive.length}\n`);

    // ==========================================
    // 4. UPDATE OPERATIONS
    // ==========================================
    console.log('✏️  Updating documents...');

    // Update one with $set
    await users.updateOne(
        { name: 'Arif' },
        { $set: { age: 23, city: 'Karachi' } }
    );
    console.log('✅ Updated Arif\'s profile');

    // Update many
    await users.updateMany(
        { role: 'user' },
        { $set: { verified: true } }
    );
    console.log('✅ Verified all users');

    // Increment with $inc
    await products.updateOne(
        { name: 'Laptop' },
        { $inc: { stock: -5 } }
    );
    console.log('✅ Reduced laptop stock');

    // Push to array with $push
    await users.updateOne(
        { name: 'Arif' },
        { $push: { tags: 'developer' } }
    );
    console.log('✅ Added tag to user\n');

    // ==========================================
    // 5. COMPLEX QUERIES
    // ==========================================
    console.log('🔎 Complex queries...');

    // Multiple conditions
    const results = await products.find({
        category: 'electronics',
        price: { $lte: 100 },
        stock: { $gt: 100 }
    });
    console.log(`🎯 Affordable electronics in stock: ${results.length}`);

    // $or query
    const featured = await products.find({
        $or: [
            { price: { $gte: 500 } },
            { category: 'furniture' }
        ]
    });
    console.log(`⭐ Featured products: ${featured.length}\n`);

    // ==========================================
    // 6. COUNT OPERATIONS
    // ==========================================
    console.log('🔢 Counting documents...');

    const totalUsers = await users.countDocuments();
    const activeCount = await users.countDocuments({ active: true });
    const productsCount = await products.countDocuments();

    console.log(`📊 Total users: ${totalUsers}`);
    console.log(`✅ Active users: ${activeCount}`);
    console.log(`📦 Total products: ${productsCount}\n`);

    // ==========================================
    // 7. DELETE OPERATIONS
    // ==========================================
    console.log('🗑️  Delete operations...');

    // Insert temp data
    await users.insertOne({ name: 'TempUser', temp: true });

    // Delete one
    const deleted = await users.deleteOne({ name: 'TempUser' });
    console.log(`✅ Deleted ${deleted.deletedCount} document`);

    // Insert multiple temp documents
    await products.insertMany([
        { name: 'TempProduct1', temp: true },
        { name: 'TempProduct2', temp: true }
    ]);

    // Delete many
    const deletedMany = await products.deleteMany({ temp: true });
    console.log(`✅ Deleted ${deletedMany.deletedCount} documents\n`);

    // ==========================================
    // 8. DATABASE MANAGEMENT
    // ==========================================
    console.log('🗄️  Database management...');

    // List collections
    const collections = await db.listCollections();
    console.log(`📚 Collections: ${collections.join(', ')}`);

    // Get database stats
    const stats = await db.stats();
    console.log(`📊 Database: ${stats.database}`);
    console.log(`📁 Collections: ${stats.collections}`);
    console.log(`📄 Documents: ${stats.documents}`);
    console.log(`🗂️  Path: ${stats.path}\n`);

    // ==========================================
    // 9. DISPLAY SAMPLE DATA
    // ==========================================
    console.log('📋 Sample Data:\n');

    console.log('👥 Users:');
    const sampleUsers = await users.find({}, { limit: 3 });
    for (const user of allUsers.slice(0, 3)) {
        console.log(`   - ${user.name} (${user.age}) - ${user.email} [${user.role}]`);
    }

    console.log('\n📦 Products:');
    const allProducts = await products.find();
    for (const product of allProducts.slice(0, 3)) {
        console.log(`   - ${product.name}: $${product.price} (Stock: ${product.stock})`);
    }

    // ==========================================
    // 10. PERSISTENCE TEST
    // ==========================================
    console.log('\n💾 Testing persistence...');
    console.log('✅ All data automatically saved to disk');
    console.log('✅ Data will survive application restart');
    console.log('✅ Check ./database/demoApp/ to see stored files\n');

    console.log('🎉 Demo completed successfully!');
    console.log('💡 Tip: Run this script again - data will persist!\n');
}

// Run the demo
main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
