const { Op, fn, col } = require('sequelize')
const { GamePayout } = require('../models/GamePayout')
const { User } = require('../models/User')
const solana = require('./solanaService')

function normalizeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

async function getAllTimeLeaderboard(limit = 20, priceUsdOverride = null) {
  const rows = await GamePayout.findAll({
    attributes: [
      'userId',
      [fn('COALESCE', fn('SUM', col('GamePayout.amountUsd')), 0), 'totalUsd'],
      [fn('COALESCE', fn('SUM', col('GamePayout.amountSol')), 0), 'totalSol'],
      [fn('COALESCE', fn('SUM', col('GamePayout.amountUnits')), 0), 'totalUnits'],
      [fn('COUNT', col('GamePayout.id')), 'payoutCount']
    ],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['nickname'] // ⚡️ только никнейм (id не нужен, он уже есть)
      }
    ],
    group: ['GamePayout.userId', 'user.id', 'user.nickname'],
    order: [[fn('COALESCE', fn('SUM', col('GamePayout.amountUsd')), 0), 'DESC']],
    limit
  })

  const priceUsd = priceUsdOverride

  return rows.map((row) => {
    const plain = row.get({ plain: true }) // превращаем в объект
    const totalSol = normalizeNumber(plain.totalSol)
    const recordedUsd = normalizeNumber(plain.totalUsd)
    const displayUsd = priceUsd ? totalSol * priceUsd : recordedUsd

    return {
      userId: plain.userId,
      nickname: plain.user?.nickname || 'Игрок',
      totalSol,
      totalUsd: displayUsd,
      recordedUsd,
      totalUnits: normalizeNumber(plain.totalUnits),
      payoutCount: normalizeNumber(plain.payoutCount, 0)
    }
  })
}

async function getWinningsLeaderboard() {
  const priceUsd = await solana.fetchSolPriceUsd().catch(() => null)
  return {
    entries: await getAllTimeLeaderboard(20, priceUsd),
    priceUsd,
    generatedAt: new Date().toISOString()
  }
}

function buildDateSeries(days) {
  const series = []
  const end = new Date()
  end.setHours(12, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    series.push({ date: key, sol: 0, usd: 0, units: 0, count: 0 })
  }
  return series
}

async function getUserPayoutHistory(userId, days = 30) {
  if (!userId) return null
  const priceUsd = await solana.fetchSolPriceUsd().catch(() => null)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const payouts = await GamePayout.findAll({
    where: {
      userId,
      createdAt: { [Op.gte]: since }
    },
    order: [['createdAt', 'ASC']]
  })
  const series = buildDateSeries(days)
  const seriesIndex = new Map(series.map((entry, index) => [entry.date, index]))
  let totalSol = 0
  let totalUsd = 0
  let totalUnits = 0
  let totalCount = 0
  payouts.forEach((payout) => {
    const plain = payout.get({ plain: true })
    const day = new Date(plain.createdAt)
    const key = day.toISOString().slice(0, 10)
    const idx = seriesIndex.get(key)
    const solAmount = normalizeNumber(plain.amountSol)
    const usdAmount = normalizeNumber(plain.amountUsd)
    const displayUsd = priceUsd ? solAmount * priceUsd : usdAmount
    if (idx !== undefined) {
      series[idx].sol += solAmount
      series[idx].usd += displayUsd
      series[idx].units += normalizeNumber(plain.amountUnits)
      series[idx].count += 1
    }
    totalSol += solAmount
    totalUsd += displayUsd
    totalUnits += normalizeNumber(plain.amountUnits)
    totalCount += 1
  })
  return {
    priceUsd,
    generatedAt: new Date().toISOString(),
    totals: {
      sol: totalSol,
      usd: totalUsd,
      units: totalUnits,
      count: totalCount
    },
    series
  }
}

module.exports = {
  getWinningsLeaderboard,
  getUserPayoutHistory
}
