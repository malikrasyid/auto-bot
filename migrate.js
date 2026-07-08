require('dotenv').config()
const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')

async function migrate() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    console.error('❌ MONGO_URI not found in .env file!')
    process.exit(1)
  }

  const filePath = path.join(__dirname, 'db_instagram.json')
  if (!fs.existsSync(filePath)) {
    console.error('❌ db_instagram.json not found. Nothing to migrate.')
    process.exit(1)
  }

  const localData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  
  // If the file is empty or just {}, exit
  if (Object.keys(localData).length === 0) {
    console.log('✅ db_instagram.json is already empty. No migration needed.')
    process.exit(0)
  }

  const client = new MongoClient(uri)

  try {
    console.log('⏳ Connecting to MongoDB Atlas...')
    await client.connect()
    console.log('✅ Connected!')

    const db = client.db('auto_liker')
    const collection = db.collection('states')

    let migratedCount = 0

    // The local JSON is structured as: { "ig_account_1": { likedPosts: {...}, caughtUp: {...} } }
    for (const [accountId, accountData] of Object.entries(localData)) {
      console.log(`📦 Migrating account: ${accountId}...`)
      
      // We use updateOne with upsert: true so it creates the document if it doesn't exist,
      // or updates it if it's already there.
      await collection.updateOne(
        { _id: accountId },
        { $set: { likedPosts: accountData.likedPosts || {}, caughtUp: accountData.caughtUp || {} } },
        { upsert: true }
      )
      migratedCount++
    }

    console.log(`🎉 Migration complete! Migrated ${migratedCount} accounts to MongoDB Atlas.`)

  } catch (err) {
    console.error('❌ Migration failed:', err.message)
  } finally {
    await client.close()
    process.exit(0)
  }
}

migrate()