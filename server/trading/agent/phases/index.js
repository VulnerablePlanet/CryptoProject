/**
 * ============================================================================
 * PHASES INDEX
 * ============================================================================
 * Re-exports all phase modules for convenient importing.
 */

const research = require('./research')
const analysis = require('./analysis')
const scoring = require('./scoring')
const execution = require('./execution')
const monitoring = require('./monitoring')

module.exports = {
  research,
  analysis,
  scoring,
  execution,
  monitoring
}