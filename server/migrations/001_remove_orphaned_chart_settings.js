/**
 * 001 — Remove orphaned chart settings.
 *
 * The frontend no longer persists chart position (the save/restore feature was
 * removed), but the User schema still stored `settings.chartSettings` with
 * `predictions` and `fibonacci` position state. This migration removes that
 * leftover subdocument so the schema matches the current feature set.
 */

module.exports = {
  name: 'remove-orphaned-chart-settings',
  async up(db) {
    const result = await db
      .collection('users')
      .updateMany(
        { 'settings.chartSettings': { $exists: true } },
        { $unset: { 'settings.chartSettings': '' } }
      )

    console.log(
      `[migration 001] removed chartSettings from ${result.modifiedCount} user(s)`
    )
  }
}