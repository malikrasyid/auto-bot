module.exports = {
  accounts: [
    {
      id: 'ig_account_1',
      platform: 'instagram',
      authFile: 'auth_ig_1.json',
      targets: ['batikroebini', 'batik.roebinicatalog', 'pangestubatik'],
      maxLikesPerRun: 100
    },
    {
      id: 'ig_account_2',
      platform: 'instagram',
      authFile: 'auth_ig_2.json',
      targets: ['batikroebini', 'batik.roebinicatalog', 'pangestubatik'],
      maxLikesPerRun: 100
    }
  ],
  minDelay: 3000,
  maxDelay: 11000,
  scrollDelay: 1000,
  stallLimit: 5,
  maxScrollTime: 300000,
  delayBetweenAccounts: 300000
}