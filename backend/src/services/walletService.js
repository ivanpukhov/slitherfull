const { Op } = require('sequelize')
const { GameWallet } = require('../models/GameWallet')
const { GamePayout } = require('../models/GamePayout')
const { User } = require('../models/User')
const solana = require('./solanaService')

const CENTS_PER_USD = 100
const INITIAL_AIRDROP_SOL = Number(process.env.INITIAL_AIRDROP_SOL || 1)
const PRICE_CACHE_TTL_MS = Number(process.env.SOL_PRICE_CACHE_TTL_MS || 60_000)
const FALLBACK_SOL_PRICE_USD = Number(process.env.FALLBACK_SOL_PRICE_USD || 0)

let cachedPriceUsd = null
let cachedPriceFetchedAt = 0

function isValidPrice(value) {
  return Number.isFinite(value) && value > 0
}

async function getSolPriceUsd() {
  const now = Date.now()
  if (isValidPrice(cachedPriceUsd) && now - cachedPriceFetchedAt <= PRICE_CACHE_TTL_MS) {
    return cachedPriceUsd
  }
  try {
    const price = await solana.fetchSolPriceUsd()
    if (!isValidPrice(price)) {
      throw new Error('invalid_price')
    }
    cachedPriceUsd = price
    cachedPriceFetchedAt = now
    return price
  } catch (err) {
    if (isValidPrice(cachedPriceUsd)) {
      console.warn('Using cached SOL price after fetch failure', err)
      return cachedPriceUsd
    }
    if (isValidPrice(FALLBACK_SOL_PRICE_USD)) {
      console.warn('Using fallback SOL price from configuration', err)
      cachedPriceUsd = FALLBACK_SOL_PRICE_USD
      cachedPriceFetchedAt = now
      return FALLBACK_SOL_PRICE_USD
    }
    console.error('Failed to resolve SOL price', err)
    throw new Error('price_unavailable')
  }
}

async function convertLamportsToUsd(lamports) {
  const priceUsd = await getSolPriceUsd()
  const solAmount = lamports / solana.LAMPORTS_PER_SOL
  const usd = solAmount * priceUsd
  const usdCents = Math.max(0, Math.round(usd * CENTS_PER_USD))
  return { priceUsd, solAmount, usd, usdCents }
}

async function convertUsdCentsToLamports(amountCents) {
  const normalized = Math.floor(Number(amountCents) || 0)
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error('invalid_amount')
  }
  const priceUsd = await getSolPriceUsd()
  const usd = normalized / CENTS_PER_USD
  const solAmount = usd / priceUsd
  const lamports = Math.floor(solAmount * solana.LAMPORTS_PER_SOL)
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('invalid_amount')
  }
  return { priceUsd, usd, solAmount, lamports, usdCents: normalized }
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
  if (!user) return { units: 0, lamports: 0, usd: null, priceUsd: null }
  if (!user.walletPublicKey) {
    return { units: user.balance || 0, lamports: 0, usd: null, priceUsd: null }
  }
  const lamports = await solana.getBalance(user.walletPublicKey)
  let conversion = null
  try {
    conversion = await convertLamportsToUsd(lamports)
  } catch (err) {
    console.error('Failed to convert lamports to USD', err)
  }
  const units = conversion ? conversion.usdCents : Math.max(0, Math.floor(Number(user.balance) || 0))
  if (user.balance !== units) {
    user.balance = units
    await user.save({ fields: ['balance'] })
  }
  return {
    units,
    lamports,
    usd: conversion ? conversion.usd : null,
    priceUsd: conversion ? conversion.priceUsd : null
  }
}

async function refreshUserBalanceById(userId) {
  if (!userId) return { units: 0, lamports: 0, usd: null, priceUsd: null }
  const user = await User.findByPk(userId)
  if (!user) return { units: 0, lamports: 0, usd: null, priceUsd: null }
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
  const conversion = await convertUsdCentsToLamports(amountUnits)
  const lamports = conversion.lamports
  const current = await solana.getBalance(user.walletPublicKey)
  if (current < lamports) {
    throw new Error('insufficient_funds')
  }
  await solana.transferLamports(user.walletSecretKey, wallet.publicKey, lamports)
  const { units } = await refreshUserBalance(user)
  return { units, priceUsd: conversion.priceUsd }
}

async function recordPayout({ userId, lamports, amountUnits, signature, metadata }) {
  try {
    const solAmount = lamports / solana.LAMPORTS_PER_SOL
    const priceUsd = await getSolPriceUsd().catch(() => null)
    const usdAmount = priceUsd ? solAmount * priceUsd : null
    await GamePayout.create({
      userId,
      amountUnits: amountUnits,
      amountLamports: lamports,
      amountSol: solAmount,
      amountUsd: usdAmount,
      priceUsd: priceUsd ?? null,
      txSignature: signature || null,
      metadata: metadata || null
    })
  } catch (err) {
    console.error('Failed to record payout', err)
  }
}

async function transferGameToUser(userId, amountUnits, options = {}) {
  if (!userId) throw new Error('missing_user_id')
  const user = await User.findByPk(userId)
  if (!user) throw new Error('user_not_found')
  const wallet = await getGameWallet()
  const conversion = await convertUsdCentsToLamports(amountUnits)
  const lamports = conversion.lamports
  const signature = await solana.transferLamports(wallet.secretKey, user.walletPublicKey, lamports)
  const { units } = await refreshUserBalance(user)
  if (options.recordPayout) {
    await recordPayout({
      userId: user.id,
      lamports,
      amountUnits: Math.max(0, Math.floor(amountUnits)),
      signature,
      metadata: options.metadata || null
    })
  }
  return { units, signature, priceUsd: conversion.priceUsd }
}

async function transferUserToAddress(userId, destinationAddress, amountUnits = null) {
  if (!userId) throw new Error('missing_user_id')
  const user = await User.findByPk(userId)
  if (!user) throw new Error('user_not_found')
  if (!solana.isValidPublicKey(destinationAddress)) {
    throw new Error('invalid_destination')
  }
  const currentLamports = await solana.getBalance(user.walletPublicKey)
  if (!Number.isFinite(currentLamports) || currentLamports <= 0) {
    throw new Error('insufficient_funds')
  }
  let lamports = currentLamports
  let usdInfo = null
  if (amountUnits !== null) {
    try {
      const conversion = await convertUsdCentsToLamports(amountUnits)
      lamports = Math.min(currentLamports, conversion.lamports)
      usdInfo = conversion
      if (lamports < conversion.lamports) {
        usdInfo = await convertLamportsToUsd(lamports).catch(() => conversion)
      }
    } catch (err) {
      throw err
    }
  } else {
    usdInfo = await convertLamportsToUsd(lamports).catch(() => null)
  }
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('insufficient_funds')
  }
  const signature = await solana.transferLamports(user.walletSecretKey, destinationAddress, lamports)
  const { units } = await refreshUserBalance(user)
  const sol = lamports / solana.LAMPORTS_PER_SOL
  return {
    lamports,
    sol,
    units,
    signature,
    usd: usdInfo ? usdInfo.usd : null,
    priceUsd: usdInfo ? usdInfo.priceUsd : null
  }
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
  const conversion = await convertUsdCentsToLamports(amountUnits)
  const lamports = conversion.lamports
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
    to: { userId: toUser.id, units: toBalance.units },
    priceUsd: conversion.priceUsd
  }
}

async function getWalletProfile(userId) {
  const user = await User.findByPk(userId)
  if (!user) return null
  const { lamports, units, usd, priceUsd } = await refreshUserBalance(user)
  const sol = lamports / solana.LAMPORTS_PER_SOL
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
  CENTS_PER_USD,
  ensureGameWallet,
  getGameWallet,
  createUserWallet,
  refreshUserBalance,
  refreshUserBalanceById,
  requestInitialAirdrop,
  transferUserToGame,
  transferGameToUser,
  transferUserToAddress,
  transferUserToUser,
  getWalletProfile,
  requestUserAirdrop,
  getAdminOverview
}
