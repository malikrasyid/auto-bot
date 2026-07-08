# 🤖 Social Auto-Liker: Design Document

## 1. Project Overview
A state-driven, Node.js + Playwright automation bot that logs into social media accounts (starting with Instagram) and automatically likes posts from a specific list of target users. The bot runs headlessly, simulates human behavior with randomized delays, and uses a local JSON file as a database to remember its progress.

## 2. Core Architecture
*   **Language:** Node.js
*   **Browser Automation:** Playwright (Chromium)
*   **State Management:** Platform-specific JSON files (`db_instagram.json`, `db_tiktok.json`, etc.)
*   **Authentication:** Platform/Account-specific cookie files (`auth_ig_1.json`, etc.) saved via manual browser sessions.
*   **Execution:** Sequential (processes one account completely before moving to the next).

## 3. Application Flow (Per Account Run)

The bot processes accounts sequentially. For each account, it iterates through its assigned target users. 

### Phase 1: Catch-Up Mode (Historical Posts)
If a target user is not flagged as `caughtUp` in the database, the bot enters this mode to process their entire post history.

1.  **Navigate:** Go to the target user's Instagram profile.
2.  **Exhaustive Scroll:** Scroll down continuously until the very bottom of the profile is reached (defined by a "stall count" where X number of scrolls yield no new post elements, or a 5-minute maximum time limit).
3.  **Reverse Order:** Once all posts are loaded in the DOM, gather all post links and reverse the array (so the oldest post is at index 0, newest is at the end).
4.  **Validate & Like (Bottom to Top):**
    *   Iterate through the reversed list.
    *   **Validation Check:** If the `postId` is already in the `db.json` under this account/target, skip it.
    *   If it is *not* in the DB, click the post to open it.
    *   Look for `svg[aria-label="Like"]`. If found, click it.
    *   Look for `svg[aria-label="Unlike"]`. If found (already visually liked but not in DB), do nothing.
    *   Add the `postId` to the `db.json` array for this account/target.
    *   Apply randomized delay (3-11 seconds).
5.  **Hard Stop at Limit:** If the bot successfully likes exactly **100 posts** during this run, it immediately stops processing this target, saves the state, and exits the account run.
6.  **Completion Check:** If the bot reaches the end of the reversed list and has liked fewer than 100 posts (meaning it has liked all historical posts up to the present day), it flags this target as `caughtUp: true` in `db.json` and moves to the next target.

### Phase 2: Maintenance Mode (New Posts Only)
If a target user is flagged as `caughtUp: true` in the database, the bot uses a fast, adaptive scroll.

1.  **Navigate:** Go to the target user's profile.
2.  **Adaptive Scroll:** Scroll down a maximum of 5 times.
3.  **Find Unliked:** Check currently loaded posts. If an unliked post is found, stop scrolling immediately.
4.  **Like:** Process the unliked posts (newest to oldest is fine here, or reverse, whichever).
5.  **Stop:** Stop if 100 likes are reached, or if no more unliked posts are found.

## 4. State Schema (`db_instagram.json`)

The database tracks progress per account, per target.

```json
{
  "ig_account_1": {
    "likedPosts": {
      "target_user_1": ["PostID1", "PostID2", "..."],
      "target_user_2": ["PostID1", "..."]
    },
    "caughtUp": {
      "target_user_1": false,
      "target_user_2": true
    }
  },
  "ig_account_2": {
    "likedPosts": {},
    "caughtUp": {}
  }
}
```

## 5. Configuration Schema (`config.js`)

```javascript
module.exports = {
  accounts: [
    {
      id: 'ig_account_1',
      platform: 'instagram',
      authFile: 'auth_ig_1.json',
      stateFile: 'db_instagram.json',
      targets: ['target1', 'target2'],
      maxLikesPerRun: 100
    }
  ],
  minDelay: 3000,           // 3 seconds
  maxDelay: 11000,          // 11 seconds
  scrollDelay: 1000,        // 1 second between exhaustive scrolls
  stallLimit: 5,            // Number of scrolls with no new elements before assuming we hit the bottom
  maxScrollTime: 300000,    // 5 minutes max scroll time safety limit
  delayBetweenAccounts: 300000 // 5 minutes wait between processing different accounts
};
```

## 6. Anti-Ban Rules for AI Agent
*   **Randomized Delays:** Every human action (reading a post, clicking a like button, scrolling) must use a random delay between `minDelay` and `maxDelay`.
*   **Sequential Only:** Never process multiple accounts simultaneously from the same execution context.
*   **Visual Verification:** Always check for `aria-label="Like"` before clicking. If `aria-label="Unlike"` is present, do not click (prevents accidental unliking).
*   **State Persistence:** The `db.json` file MUST be written to disk immediately after every successful like action, not just at the end of the run. If the bot crashes on post 99, it must remember the 98 it already liked.

## 7. Directory Structure

```text
social-auto-liker/
├── src/
│   ├── index.js          # Main entry point (handles mode logic, account looping)
│   ├── save-auth.js      # One-time script to manually login and save auth.json
│   ├── config.js         # Targets, limits, and delay settings
│   ├── state.js          # Read/Write logic for db.json
│   └── utils.js          # Random delay & logging helpers
├── .github/workflows/    # Future GitHub Actions YAML files
├── db_instagram.json     # Auto-generated state file (Git tracked)
├── auth_ig_1.json        # Sensitive session cookies (Git ignored)
├── .gitignore
└── package.json
```
