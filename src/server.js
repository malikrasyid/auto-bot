require('dotenv').config()

const express = require('express')
const { MongoClient } = require('mongodb')

const app = express()
const PORT = process.env.PORT || 3000
const DB_NAME = 'auto_liker'
const COLLECTION_NAME = 'states'

let client = null
let db = null

async function connectDB() {
  if (!client) {
    const uri = process.env.MONGO_URI
    if (!uri) {
      throw new Error('MONGO_URI environment variable is not set')
    }
    client = new MongoClient(uri)
    await client.connect()
    db = client.db(DB_NAME)
    console.log('Connected to MongoDB')
  }
  return db
}

app.set('view engine', 'ejs')
app.set('views', require('path').join(__dirname, '..', 'views'))

app.get('/', async (req, res) => {
  try {
    const database = await connectDB()
    const collection = database.collection(COLLECTION_NAME)
    const accounts = await collection.find({}).toArray()
    res.render('dashboard', { accounts })
  } catch (err) {
    console.error('Dashboard error:', err)
    res.status(500).send('Internal Server Error')
  }
})

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`)
})

process.on('SIGINT', async () => {
  if (client) await client.close()
  process.exit(0)
})
