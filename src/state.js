const { MongoClient } = require('mongodb')

let client = null
let db = null
const DB_NAME = 'auto_liker'
const COLLECTION_NAME = 'states'

async function getMongoClient() {
  if (!client) {
    const uri = process.env.MONGO_URI
    if (!uri) {
      throw new Error('MONGO_URI environment variable is not set')
    }
    client = new MongoClient(uri)
    await client.connect()
    db = client.db(DB_NAME)
  }
  return client
}

async function getStateCollection() {
  await getMongoClient()
  return db.collection(COLLECTION_NAME)
}

async function loadState(accountId) {
  try {
    const collection = await getStateCollection()
    const doc = await collection.findOne({ _id: accountId })
    if (doc) {
      return {
        likedPosts: doc.likedPosts || {},
        caughtUp: doc.caughtUp || {}
      }
    }
  } catch (err) {
    console.error('Error loading state from MongoDB:', err)
  }
  return { likedPosts: {}, caughtUp: {} }
}

async function saveState(accountId, stateData) {
  try {
    const collection = await getStateCollection()
    await collection.updateOne(
      { _id: accountId },
      { $set: { likedPosts: stateData.likedPosts, caughtUp: stateData.caughtUp } },
      { upsert: true }
    )
  } catch (err) {
    console.error('Error saving state to MongoDB:', err)
  }
}

module.exports = { loadState, saveState, getMongoClient }
