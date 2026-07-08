const config = require('./config');

const randomDelay = () => new Promise(res => 
  setTimeout(res, Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1)) + config.minDelay)
);

const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

module.exports = { randomDelay, log };