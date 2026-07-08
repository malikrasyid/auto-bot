require('dotenv').config()

const { chromium } = require('playwright')
const config = require('./config')
const { loadState, saveState, getMongoClient } = require('./state')
const { randomDelay, log } = require('./utils')

async function processAccount(account, mode) {
  log(`🔄 Starting process for account: ${account.id}`)
  const state = await loadState(account.id)

  if (!state.likedPosts) state.likedPosts = {}
  if (!state.caughtUp) state.caughtUp = {}

  let totalLikedThisRun = 0
  const browser = await chromium.launch({ headless: true })
  
  try {
    const context = await browser.newContext({ storageState: account.authFile })
    const page = await context.newPage()

    for (const target of account.targets) {
      if (totalLikedThisRun >= account.maxLikesPerRun) {
        log(`🛑 Reached max likes limit (${account.maxLikesPerRun}) for ${account.id}.`)
        break
      }

      if (!state.likedPosts[target]) state.likedPosts[target] = []
      if (state.caughtUp[target] === undefined) state.caughtUp[target] = false

      const isCaughtUp = state.caughtUp[target]
      log(`👀 [${account.id}] Checking profile: @${target} (${isCaughtUp ? 'maintenance' : 'catch-up'} mode)`)

      if (mode === 'catchup' && isCaughtUp) {
        log(`⏭️ [${account.id}] Skipping @${target} (caught up, mode=catchup)`)
        continue
      }
      if (mode === 'maintenance' && !isCaughtUp) {
        log(`⏭️ [${account.id}] Skipping @${target} (not caught up, mode=maintenance)`)
        continue
      }

      try {
        await page.goto(`https://www.instagram.com/${target}/`, { waitUntil: 'networkidle' })
        await randomDelay()

        let postLinks = []

        if (isCaughtUp) {
          // === Phase 2: Maintenance Mode — Adaptive Scroll ===
          log(`📜 [${account.id}] Adaptive scrolling for @${target}...`)
          for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 2000)
            await new Promise(res => setTimeout(res, config.scrollDelay))

            const links = await page.locator('a[href*="/p/"], a[href*="/reel/"]').all()
            let found = false
            for (const link of links) {
              const href = await link.getAttribute('href')
              const match = href.match(/\/(p|reel)\/([^/]+)/)
              if (!match) continue
              if (!state.likedPosts[target].includes(match[2])) {
                found = true
                break
              }
            }
            if (found) {
              postLinks = links
              break
            }
          }
        } else {
          // === Phase 1: Catch-Up Mode — Exhaustive Scroll ===
          let previousHeight = 0
          let stallCount = 0
          const scrollStartTime = Date.now()

          log(`📜 [${account.id}] Exhaustive scrolling for @${target}...`)

          while (stallCount < config.stallLimit && (Date.now() - scrollStartTime) < config.maxScrollTime) {
            previousHeight = await page.evaluate(() => document.body.scrollHeight)

            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            await new Promise(res => setTimeout(res, 2000))

            const newHeight = await page.evaluate(() => document.body.scrollHeight)

            if (newHeight > previousHeight) {
              stallCount = 0
            } else {
              stallCount++
            }
          }

          const timeTaken = ((Date.now() - scrollStartTime) / 1000).toFixed(1)
          const postCount = await page.locator('a[href*="/p/"], a[href*="/reel/"]').count()
          log(`📜 [${account.id}] Finished scrolling for @${target}. Loaded ${postCount} posts in ${timeTaken} seconds.`)

          postLinks = await page.locator('a[href*="/p/"], a[href*="/reel/"]').all()
          postLinks = [...postLinks].reverse()
        }

        // Process posts (common like logic for both modes)
        for (const link of postLinks) {
          if (totalLikedThisRun >= account.maxLikesPerRun) break

          const href = await link.getAttribute('href')
          const match = href.match(/\/(p|reel)\/([^/]+)/)
          if (!match) continue
          const postId = match[2]

          if (state.likedPosts[target].includes(postId)) continue

          try {
            await link.click()
            await randomDelay()

            const likeButton = page.locator('svg[aria-label="Like"]').first()
            
            if (await likeButton.isVisible()) {
              await likeButton.click()
              log(`❤️ [${account.id}] Liked: ${postId} (Target: @${target})`)
              totalLikedThisRun++
            } else {
              log(`ℹ️ [${account.id}] Already visually liked: ${postId}`)
            }

            state.likedPosts[target].push(postId)
            await saveState(account.id, state)
            await randomDelay()

            await page.keyboard.press('Escape')
            await randomDelay()

          } catch (err) {
            log(`⚠️ [${account.id}] Error interacting with post ${postId}`)
            try { await page.keyboard.press('Escape'); await randomDelay() } catch(e) {}
          }
        }

        // Completion check: if catch-up mode and all posts processed, mark caughtUp
        if (!isCaughtUp && totalLikedThisRun < account.maxLikesPerRun) {
          state.caughtUp[target] = true
          await saveState(account.id, state)
          log(`✅ [${account.id}] @${target} fully caught up!`)
        }

      } catch (err) {
        log(`❌ [${account.id}] Failed to process @${target}: ${err.message}`)
      }
    }

    await context.storageState({ path: account.authFile })

  } catch (err) {
    log(`❌ Fatal error for account ${account.id}: ${err.message}`)
  } finally {
    await browser.close()
    log(`✅ [${account.id}] Run complete. Liked ${totalLikedThisRun} new posts.`)
  }

  return totalLikedThisRun
}

// MAIN EXECUTION
const args = process.argv.slice(2)
let specificAccountId = null
let cliMode = null

for (const arg of args) {
  if (arg.startsWith('--account=')) {
    specificAccountId = arg.split('=')[1]
  }
  if (arg.startsWith('--mode=')) {
    cliMode = arg.split('=')[1]
  }
}

const mode = (cliMode || process.env.MODE || 'all').toLowerCase()
;(async () => {
  try {
    if (specificAccountId) {
      const account = config.accounts.find(a => a.id === specificAccountId)
      if (!account) {
        log(`❌ Account "${specificAccountId}" not found in config`)
        process.exit(1)
      }
      await processAccount(account, mode)
      log(`🎉 Account ${specificAccountId} processed successfully!`)
    } else {
      for (let i = 0; i < config.accounts.length; i++) {
        const account = config.accounts[i]
        await processAccount(account, mode)

        if (i < config.accounts.length - 1) {
          const waitTime = config.delayBetweenAccounts / 1000
          log(`⏳ Waiting ${waitTime} seconds before starting next account to avoid bans...`)
          await new Promise(res => setTimeout(res, config.delayBetweenAccounts))
        }
      }

      log(`🎉 All accounts processed successfully!`)
    }
  } finally {
    const client = await getMongoClient()
    await client.close()
  }
})()
