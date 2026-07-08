const { chromium } = require('playwright');
const readline = require('readline');
const path = require('path');
const config = require('./config');

// Get account ID from command line: npm run save-auth ig_account_1
const accountId = process.argv[2];

if (!accountId) {
  console.error('❌ Please provide an account ID. Example: npm run save-auth ig_account_1');
  process.exit(1);
}

const account = config.accounts.find(acc => acc.id === accountId);

if (!account) {
  console.error(`❌ Account ID "${accountId}" not found in config.js`);
  process.exit(1);
}

(async () => {
  console.log(`🚀 Launching browser to login for: ${accountId}...`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://www.instagram.com/accounts/login/');
  
  console.log('⏳ Please log in to your Instagram account in the browser window.');
  console.log('⏳ Once you are fully logged in and see your feed, come back here and press ENTER.');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  rl.question('Press ENTER to save session and close browser...', async () => {
    rl.close();
    
    const authPath = path.join(__dirname, '..', account.authFile);
    await context.storageState({ path: authPath });
    console.log(`✅ Session saved successfully to ${authPath}`);
    
    await browser.close();
    process.exit(0);
  });
})();