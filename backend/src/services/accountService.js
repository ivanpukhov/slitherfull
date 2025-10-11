const { User } = require('../models/User')

function normalizeNickname(nickname) {
  return typeof nickname === 'string' ? nickname.trim() : ''
}

async function getUserById(id) {
  if (!id) return null
  const user = await User.findByPk(id)
  return user || null
}

async function updateBalance(id, balance) {
  if (!id) return null
  await User.update({ balance }, { where: { id } })
  return getUserById(id)
}

async function updateNickname(id, nickname) {
  if (!id) throw new Error('missing_user_id')
  const normalized = normalizeNickname(nickname)
  if (!normalized || normalized.length < 3 || normalized.length > 16) {
    throw new Error('invalid_nickname')
  }
  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
    throw new Error('invalid_nickname')
  }
  const existing = await User.findOne({ where: { nickname: normalized } })
  if (existing && existing.id !== id) {
    throw new Error('nickname_taken')
  }
  await User.update({ nickname: normalized }, { where: { id } })
  const user = await User.findByPk(id)
  return user || null
}

module.exports = {
  getUserById,
  updateBalance,
  updateNickname
}
