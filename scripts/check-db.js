/**
 * Check database structure
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'history.db');

console.log(`Checking database: ${dbPath}`);

try {
  const db = new Database(dbPath);

  // List all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('\nTables:', tables.map(t => t.name).join(', ') || '(none)');

  // For each table, show structure
  tables.forEach(table => {
    console.log(`\n--- Table: ${table.name} ---`);
    const tableInfo = db.pragma(`table_info(${table.name})`);
    tableInfo.forEach(col => {
      console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
    });

    // Show row count
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    console.log(`  Rows: ${count.count}`);
  });

  db.close();

} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
