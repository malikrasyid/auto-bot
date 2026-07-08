const fs = require('fs')
const path = require('path')

function loadState(filename) {
  const filePath = path.join(__dirname, '..', filename)
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Error reading state file, starting fresh.', err)
  }
  return {}
}

function saveState(filename, data) {
  const filePath = path.join(__dirname, '..', filename)
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Error saving state file!', err)
  }
}

module.exports = { loadState, saveState }