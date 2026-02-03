/**
 * Database migration script to add profile_image and profile_image_local columns
 * Run with: node scripts/migrate-db.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'history.db');

console.log(`Migrating database: ${dbPath}`);

try {
  const db = new Database(dbPath);

  // Check if columns exist
  const tableInfo = db.pragma('table_info(shots)');
  const columnNames = tableInfo.map(col => col.name);

  console.log('\nCurrent columns:', columnNames.join(', '));

  let migrated = false;

  // Add profile_image column if missing
  if (!columnNames.includes('profile_image')) {
    console.log('\n✓ Adding column: profile_image');
    db.exec('ALTER TABLE shots ADD COLUMN profile_image TEXT;');
    migrated = true;
  } else {
    console.log('\n- Column already exists: profile_image');
  }

  // Add profile_image_local column if missing
  if (!columnNames.includes('profile_image_local')) {
    console.log('✓ Adding column: profile_image_local');
    db.exec('ALTER TABLE shots ADD COLUMN profile_image_local TEXT;');
    migrated = true;
  } else {
    console.log('- Column already exists: profile_image_local');
  }

  // Verify final schema
  const updatedTableInfo = db.pragma('table_info(shots)');
  const updatedColumnNames = updatedTableInfo.map(col => col.name);

  console.log('\nUpdated columns:', updatedColumnNames.join(', '));

  db.close();

  if (migrated) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log('\n✅ Database already up to date!');
  }

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}
