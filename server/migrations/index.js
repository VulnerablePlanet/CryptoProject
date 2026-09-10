/**
 * ============================================================================
 * Migration Runner
 * ============================================================================
 * Minimal, dependency-free migration system for MongoDB.
 *
 * Migrations are applied in numeric-prefix filename order and tracked in the
 * `migrations` collection so each runs exactly once. Never edit an applied
 * migration — instead add a new one.
 *
 * Usage (manual — there is no auto-run on boot yet):
 *   node server/migrations/index.js
 *
 * Each migration file must export:
 *   { name: string, up: async (db) => void }
 */

const path = require('path')
const fs = require('fs')
const mongoose = require('mongoose')
const connectDB = require('../config/db')

const MIGRATIONS_DIR = __dirname
const MIGRATION_COLLECTION = 'migrations'

/**
 * Discover migration files (excluding this runner).
 * @returns {Array<{ file: string, name: string, up: Function }>}
 */
const discoverMigrations = () => {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.js$/.test(file))
    .sort()
    .map((file) => {
      const migration = require(path.join(MIGRATIONS_DIR, file))
      return { file, name: migration.name || file, up: migration.up }
    })
}

/**
 * Run all pending migrations in order.
 */
const run = async () => {
  await connectDB()

  const db = mongoose.connection.db
  const applied = new Set(
    (await db.collection(MIGRATION_COLLECTION).find({}).toArray()).map((m) => m.name)
  )

  const migrations = discoverMigrations()
  const pending = migrations.filter((m) => !applied.has(m.name))

  console.log(`[migrations] ${migrations.length} total, ${pending.length} pending`)

  for (const migration of pending) {
    console.log(`[migrations] applying: ${migration.name}`)
    await migration.up(db)
    await db.collection(MIGRATION_COLLECTION).insertOne({
      name: migration.name,
      file: migration.file,
      appliedAt: new Date()
    })
    console.log(`[migrations] applied: ${migration.name}`)
  }

  console.log('[migrations] done')
}

// Allow running directly: `node server/migrations/index.js`
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[migrations] failed:', error)
      process.exit(1)
    })
}

module.exports = { run, discoverMigrations }