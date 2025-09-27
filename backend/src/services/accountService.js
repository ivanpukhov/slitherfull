const { User } = require('../models/User')

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

module.exports = {
  getUserById,
  updateBalance
}
