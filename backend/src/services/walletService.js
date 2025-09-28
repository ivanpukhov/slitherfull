const { Op } = require('sequelize')
const { GameWallet } = require('../models/GameWallet')
const { User } = require('../models/User')
const solana = require('./solanaService')

const LAMPORTS_PER_UNIT = Number(process.env.LAMPORTS_PER_UNIT || 1_000_000)
const INITIAL_AIRDROP_SOL = Number(process.env.INITIAL_AIRDROP_SOL || 1)

function unitsToLamports(units) {
  return Math.max(0, Math.floor(Number(units) * LAMPORTS_PER_UNIT))
}

function lamportsToUnits(lamports) {
  return Math.max(0, Math.floor(Number(lamports) / LAMPORTS_PER_UNIT))
}

async function ensureGameWallet() {
  let wallet = await GameWallet.findByPk(1)
  if (wallet) return wallet
  const kp = solana.createKeypair()
  wallet = await GameWallet.create({
    id: 1,
    label: 'game',
    publicKey: kp.publicKey,
    secretKey: kp.secretKey
  })
  return wallet
}

async function getGameWallet() {
  const wallet = await ensureGameWallet()
  return wallet
}

async function createUserWallet() {
  const kp = solana.createKeypair()
  return kp
}

async function refreshUserBalance(user) {
  if (!user) return { units: 0, lamports: 0 }
  if (!user.walletPublicKey) {
    return { units: user.balance || 0, lamports: 0 }
  }
  const lamports = await solana.getBalance(user.walletPublicKey)
  const units = lamportsToUnits(lamports)
  if (user.balance !== units) {
    user.balance = units
    await user.save({ fields: ['balance'] })
  }
  return { units, lamports }
}

async function refreshUserBalanceById(userId) {
  if (!userId) return { units: 0, lamports: 0 }
  const user = await User.findByPk(userId)
  if (!user) return { units: 0, lamports: 0 }
  return refreshUserBalance(user)
}

async function requestInitialAirdrop(user) {
  if (!user || INITIAL_AIRDROP_SOL <= 0) return null
  try {
    await solana.requestAirdrop(user.walletPublicKey, INITIAL_AIRDROP_SOL)
    return refreshUserBalance(user)
  } catch (err) {
    console.error('Failed to perform initial airdrop', err)
    return null
  }
}

async function transferUserToGame(userId, amountUnits) {
  if (!userId) throw new Error('missing_user_id')
  const user = await User.findByPk(userId)
  if (!user) throw new Error('user_not_found')
  const wallet = await getGameWallet()
  const lamports = unitsToLamports(amountUnits)
  if (lamports <= 0) throw new Error('invalid_amount')
  const current = await solana.getBalance(user.walletPublicKey)
  if (current < lamports) {
    throw new Error('insufficient_funds')
  }
  await solana.transferLamports(user.walletSecretKey, wallet.publicKey, lamports)
  const { units } = await refreshUserBalance(user)
  return { units }
}

async function transferGameToUser(userId, amountUnits) {
  if (!userId) throw new Error('missing_user_id')
  const user = await User.findByPk(userId)
  if (!user) throw new Error('user_not_found')
  const wallet = await getGameWallet()
  const lamports = unitsToLamports(amountUnits)
  if (lamports <= 0) throw new Error('invalid_amount')
  await solana.transferLamports(wallet.secretKey, user.walletPublicKey, lamports)
  const { units } = await refreshUserBalance(user)
  return { units }
}

async function transferUserToUser(fromUserId, toUserId, amountUnits) {
  if (!fromUserId) throw new Error('missing_source_user_id')
  if (!toUserId) throw new Error('missing_destination_user_id')
  if (Number(fromUserId) === Number(toUserId)) {
    throw new Error('same_user_transfer')
  }
  const [fromUser, toUser] = await Promise.all([
    User.findByPk(fromUserId),
    User.findByPk(toUserId)
  ])
  if (!fromUser) throw new Error('source_user_not_found')
  if (!toUser) throw new Error('destination_user_not_found')
  const lamports = unitsToLamports(amountUnits)
  if (lamports <= 0) throw new Error('invalid_amount')
  const current = await solana.getBalance(fromUser.walletPublicKey)
  if (current < lamports) {
    throw new Error('insufficient_funds')
  }
  await solana.transferLamports(fromUser.walletSecretKey, toUser.walletPublicKey, lamports)
  const [fromBalance, toBalance] = await Promise.all([
    refreshUserBalance(fromUser),
    refreshUserBalance(toUser)
  ])
  return {
    from: { userId: fromUser.id, units: fromBalance.units },
    to: { userId: toUser.id, units: toBalance.units }
  }
}

async function getWalletProfile(userId) {
  const user = await User.findByPk(userId)
  if (!user) return null
  const { lamports, units } = await refreshUserBalance(user)
  const priceUsd = await solana.fetchSolPriceUsd().catch(() => null)
  const sol = lamports / solana.LAMPORTS_PER_SOL
  const usd = priceUsd ? sol * priceUsd : null
  return {
    walletAddress: user.walletPublicKey,
    lamports,
    sol,
    usd,
    usdRate: priceUsd,
    units,
    inGameBalance: user.balance
  }
}

async function requestUserAirdrop(userId, solAmount) {
  const user = await User.findByPk(userId)
  if (!user) throw new Error('user_not_found')
  const normalized = Math.min(Math.max(Number(solAmount) || 0, 0.1), 5)
  if (normalized <= 0) throw new Error('invalid_amount')
  await solana.requestAirdrop(user.walletPublicKey, normalized)
  return refreshUserBalance(user)
}

async function getAdminOverview() {
  const [wallet, users] = await Promise.all([
    getGameWallet(),
    User.findAll({
      order: [['id', 'ASC']],
      where: {
        walletPublicKey: { [Op.ne]: null }
      }
    })
  ])
  const balances = await Promise.all(
    users.map(async (user) => {
      const lamports = await solana.getBalance(user.walletPublicKey).catch(() => 0)
      return {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        walletAddress: user.walletPublicKey,
        walletLamports: lamports,
        walletSol: lamports / solana.LAMPORTS_PER_SOL,
        inGameBalance: user.balance
      }
    })
  )
  const gameLamports = await solana.getBalance(wallet.publicKey).catch(() => 0)
  return {
    users: balances,
    gameWallet: {
      walletAddress: wallet.publicKey,
      walletLamports: gameLamports,
      walletSol: gameLamports / solana.LAMPORTS_PER_SOL
    }
  }
}

module.exports = {
  LAMPORTS_PER_UNIT,
  unitsToLamports,
  lamportsToUnits,
  ensureGameWallet,
  getGameWallet,
  createUserWallet,
  refreshUserBalance,
  refreshUserBalanceById,
  requestInitialAirdrop,
  transferUserToGame,
  transferGameToUser,
  transferUserToUser,
  getWalletProfile,
  requestUserAirdrop,
  getAdminOverview
}
