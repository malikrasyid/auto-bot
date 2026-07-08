# auto-bot

Instagram auto-liker bot using Playwright + Node.js (CommonJS).

## Commands

- `npm start` — run the bot (`node src/index.js`)
- `npm run save-auth` — launch headed browser to capture Instagram session cookies to `auth_ig_{1,2}.json`
- `npm run setup` — `npx playwright install --with-deps chromium`

No tests, linter, formatter, or typecheck.

## Architecture

- **Entrypoint**: `src/index.js` — iterates accounts from `src/config.js`, opens Playwright Chromium context per account, processes targets, likes unliked posts
- **Config**: `src/config.js` — accounts array with id, platform, authFile, stateFile, targets, maxLikesPerRun. Global settings: minDelay, maxDelay, scrollDelay, stallLimit, maxScrollTime, delayBetweenAccounts
- **State**: Platform-specific JSON files (`db_instagram.json`, `db_tiktok.json`, etc.) — tracks liked post IDs per account per target + caughtUp status. Saved after each like (not batch at end)
- **Auth**: Playwright `storageState` JSON files (`auth_ig_1.json`, `auth_ig_2.json`, etc.)
- **CI**: `.github/workflows/auto-liker.yml` — two cron schedules: catchup mode (3x daily) and maintenance mode (hourly) + manual trigger with mode input. Commits `db_*.json` + `auth_*.json` back to repo

## Application Flow

The bot processes accounts sequentially. For each account, it iterates through its assigned target users.

### Phase 1: Catch-Up Mode (Historical Posts)

If a target is NOT flagged `caughtUp: true` in the database, the bot enters catch-up mode to process their entire post history from oldest to newest.

1. **Navigate** to target's Instagram profile
2. **Exhaustive Scroll** — scroll down continuously until bottom of profile is reached:
   - Stall detection: if N consecutive scrolls yield no new post elements in DOM, assume bottom reached
   - Safety limit: 5 minutes max scroll time
   - Scroll delay between each scroll: `config.scrollDelay` (1 second)
3. **Reverse Order** — gather all post links from DOM, reverse array so oldest post is index 0
4. **Validate & Like (Bottom to Top)**:
   - Extract postId from href via regex: `/\/(p|reel)\/([^/]+)/`, capture group 2
   - If postId exists in `state[accountId].likedPosts[target]`, skip
   - If unliked: click post to open lightbox, look for `svg[aria-label="Like"]`, click it
   - If `svg[aria-label="Unlike"]` is visible instead (already liked visually but not in DB), skip click, just record
   - Push postId to `state[accountId].likedPosts[target]`
   - Save state to disk immediately after each like
   - Apply randomized delay (minDelay to maxDelay)
5. **Hard Stop at 100** — if bot successfully likes exactly 100 posts during this run, stop processing this target, save state, exit account run
6. **Completion Check** — if bot reaches end of reversed list and liked fewer than 100 (all historical posts liked), set `state[accountId].caughtUp[target] = true` in db

### Phase 2: Maintenance Mode (New Posts Only)

If a target IS flagged `caughtUp: true`, the bot uses fast adaptive scroll.

1. **Navigate** to target's profile
2. **Adaptive Scroll** — scroll max 5 times, checking after each scroll if any unliked post exists in DOM. Stop immediately when unliked found
3. **Like** unliked posts
4. **Stop** at 100 likes or when no more unliked posts found

## State Schema

```json
{
  "ig_account_1": {
    "likedPosts": {
      "batikroebini": ["DSJ93lqEmla", "DSJ9VPIEgQ3"],
      "batik.roebinicatalog": ["ABC123"],
      "pangestubatik": []
    },
    "caughtUp": {
      "batikroebini": false,
      "batik.roebinicatalog": true,
      "pangestubatik": false
    }
  },
  "ig_account_2": {
    "likedPosts": {},
    "caughtUp": {}
  }
}
```

## Config Schema

```js
module.exports = {
  accounts: [
    {
      id: 'ig_account_1',          // unique identifier
      platform: 'instagram',        // future: tiktok, facebook
      authFile: 'auth_ig_1.json',   // playwright storageState file
      stateFile: 'db_instagram.json', // which db file to read/write
      targets: ['batikroebini', 'batik.roebinicatalog', 'pangestubatik'],
      maxLikesPerRun: 100
    }
  ],
  minDelay: 3000,             // 3 seconds
  maxDelay: 11000,            // 11 seconds
  scrollDelay: 1000,          // 1 second between exhaustive scrolls
  stallLimit: 5,              // consecutive scrolls with no new posts = bottom reached
  maxScrollTime: 300000,      // 5 minutes max scroll time
  delayBetweenAccounts: 300000 // 5 minutes between processing different accounts
};
```

## Anti-Ban Rules

- Every human action (reading post, clicking like, scrolling) must use random delay between `minDelay` and `maxDelay`
- Never process multiple accounts simultaneously
- Always check for `aria-label="Like"` before clicking. If `aria-label="Unlike"` visible, do NOT click (prevents accidental unliking)
- State file MUST be written to disk after each successful like, not batched at end
- Close lightbox with `Escape` key after liking each post
- 5 minute delay between switching accounts

## Directory Structure

```
social-auto-liker/
├── src/
│   ├── index.js          # Main entry point — mode logic, account looping, scrolling, liking
│   ├── save-auth.js      # One-time script: manual login → save auth_ig_N.json
│   ├── config.js         # Accounts, targets, limits, delays
│   ├── state.js          # loadState(filename) / saveState(filename, data) — sync file I/O
│   └── utils.js          # randomDelay(), log()
├── .github/workflows/
│   └── auto-liker.yml    # Cron: catchup (3x daily) + maintenance (hourly)
├── db_instagram.json     # Auto-generated state file (git tracked)
├── auth_ig_1.json        # Session cookies (git ignored, never commit)
├── auth_ig_2.json        # Session cookies (git ignored, never commit)
├── .gitignore
└── package.json
```

## Gotchas

- `auth_ig_*.json` files contain live session cookies. They MUST be in `.gitignore`. Do not commit.
- `dotenv` is a listed dependency but is never imported — do not rely on it.
- All source files use no semicolons; match existing style.
- File I/O is synchronous (`readFileSync`/`writeFileSync`).
- Add new accounts by adding entries to `config.js.accounts` (max ~5) and running `npm run save-auth` with the account id argument to create corresponding `auth_ig_N.json`.
- Instagram post URLs use `/p/{postId}` for images and `/reel/{postId}` for reels. Both must be matched. The regex `/\/(p|reel)\/([^/]+)/` captures the ID from either format.
- Playwright Node.js API uses camelCase: `newPage()`, not `new_page()`.
- The existing `.gitbuh/workflows/` directory has a typo — should be `.github/workflows/`.
```

Key things I included that were missing from your draft:
- The **two-phase flow** (Catch-Up vs Maintenance) with full step-by-step logic
- The **100 likes per run** hard stop (changed from 15)
- The **`caughtUp` tracking** in the state schema
- The **platform-specific db files** (`db_instagram.json`)
- **Stall detection** and **5-minute scroll limit** parameters
- The **mode input** for the GitHub Action
- The **save state after each like** rule (not batch)
- The **`.gitbuh/` typo** callout