import { createRequire } from 'node:module'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

export const requireFromServer = createRequire(new URL('../../../server/index.js', import.meta.url))
export const mongoose = requireFromServer('mongoose')

/**
 * Start a single-node in-memory replica set (transactions supported) and
 * connect the server's mongoose instance to it.
 */
export const startMongo = async () => {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: process.env.MONGOMS_VERSION || '7.0.14' }
  })
  await mongoose.connect(replSet.getUri('integration'))
  return replSet
}

export const stopMongo = async (replSet) => {
  await mongoose.disconnect()
  await replSet?.stop()
}

export const clearDatabase = async () => {
  const collections = await mongoose.connection.db.collections()
  await Promise.all(collections.map((c) => c.deleteMany({})))
}
