const { Op } = require('sequelize')
const { sequelize } = require('../db/sequelize')
const { User } = require('../models/User')
const { FriendRequest } = require('../models/FriendRequest')
const { Friendship } = require('../models/Friendship')

function toPublicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname
  }
}

async function getOverview(userId) {
  if (!userId) {
    return { friends: [], outgoing: [], incoming: [] }
  }

  const [friends, outgoing, incoming] = await Promise.all([
    Friendship.findAll({
      where: { userId },
      include: [{ model: User, as: 'friend', attributes: ['id', 'nickname', 'email'] }],
      order: [['createdAt', 'DESC']]
    }),
    FriendRequest.findAll({
      where: { requesterId: userId, status: 'pending' },
      include: [{ model: User, as: 'addressee', attributes: ['id', 'nickname', 'email'] }],
      order: [['createdAt', 'DESC']]
    }),
    FriendRequest.findAll({
      where: { addresseeId: userId, status: 'pending' },
      include: [{ model: User, as: 'requester', attributes: ['id', 'nickname', 'email'] }],
      order: [['createdAt', 'DESC']]
    })
  ])

  return {
    friends: friends.map((entry) => ({
      id: entry.id,
      since: entry.createdAt,
      user: toPublicUser(entry.friend)
    })),
    outgoing: outgoing.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      user: toPublicUser(entry.addressee)
    })),
    incoming: incoming.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      user: toPublicUser(entry.requester)
    }))
  }
}

async function searchUsers(query, requesterId, limit = 8) {
  const trimmed = typeof query === 'string' ? query.trim() : ''
  if (!trimmed || !requesterId) {
    return []
  }

  const candidates = await User.findAll({
    where: {
      id: { [Op.ne]: requesterId },
      [Op.or]: [
        { nickname: { [Op.like]: `%${trimmed}%` } },
        { email: { [Op.like]: `%${trimmed.toLowerCase()}%` } }
      ]
    },
    attributes: ['id', 'nickname', 'email'],
    limit,
    order: [['nickname', 'ASC']]
  })

  const targetIds = candidates.map((user) => user.id)
  if (targetIds.length === 0) {
    return []
  }

  const [friendships, requests] = await Promise.all([
    Friendship.findAll({ where: { userId: requesterId, friendId: { [Op.in]: targetIds } } }),
    FriendRequest.findAll({
      where: {
        status: 'pending',
        [Op.or]: [
          { requesterId, addresseeId: { [Op.in]: targetIds } },
          { requesterId: { [Op.in]: targetIds }, addresseeId: requesterId }
        ]
      }
    })
  ])

  const friendshipSet = new Map(friendships.map((entry) => [entry.friendId, entry]))
  const requestMap = new Map()
  requests.forEach((entry) => {
    const key = entry.requesterId === requesterId ? entry.addresseeId : entry.requesterId
    requestMap.set(key, entry)
  })

  return candidates.map((user) => {
    const friendship = friendshipSet.get(user.id)
    if (friendship) {
      return { ...toPublicUser(user), status: 'friends', requestId: null }
    }
    const request = requestMap.get(user.id)
    if (request) {
      const status = request.requesterId === requesterId ? 'outgoing' : 'incoming'
      return { ...toPublicUser(user), status, requestId: request.id }
    }
    return { ...toPublicUser(user), status: 'none', requestId: null }
  })
}

async function ensureFriendship(userId, friendId, transaction) {
  if (!userId || !friendId) return
  await Friendship.findOrCreate({
    where: { userId, friendId },
    defaults: { userId, friendId },
    transaction
  })
}

async function sendRequest(requesterId, targetId) {
  if (!requesterId || !targetId) {
    return { ok: false, error: 'invalid_payload' }
  }
  if (requesterId === targetId) {
    return { ok: false, error: 'cannot_friend_self' }
  }
  const target = await User.findByPk(targetId)
  if (!target) {
    return { ok: false, error: 'user_not_found' }
  }
  const existingFriendship = await Friendship.findOne({ where: { userId: requesterId, friendId: targetId } })
  if (existingFriendship) {
    return { ok: false, error: 'already_friends' }
  }
  const incoming = await FriendRequest.findOne({
    where: { requesterId: targetId, addresseeId: requesterId, status: 'pending' }
  })
  if (incoming) {
    await acceptRequest(incoming.id, requesterId)
    return { ok: true, accepted: true }
  }

  const [request] = await FriendRequest.findOrCreate({
    where: { requesterId, addresseeId: targetId },
    defaults: { requesterId, addresseeId: targetId, status: 'pending' }
  })

  if (request.status !== 'pending') {
    request.status = 'pending'
    await request.save()
  }

  return { ok: true, request }
}

async function acceptRequest(requestId, userId) {
  if (!requestId || !userId) {
    return { ok: false, error: 'invalid_payload' }
  }
  const request = await FriendRequest.findOne({
    where: { id: requestId, addresseeId: userId, status: 'pending' },
    include: [{ model: User, as: 'requester', attributes: ['id', 'nickname', 'email'] }]
  })
  if (!request) {
    return { ok: false, error: 'request_not_found' }
  }

  await sequelize.transaction(async (transaction) => {
    request.status = 'accepted'
    await request.save({ transaction })
    await ensureFriendship(request.addresseeId, request.requesterId, transaction)
    await ensureFriendship(request.requesterId, request.addresseeId, transaction)
  })

  return { ok: true, user: toPublicUser(request.requester) }
}

module.exports = {
  getOverview,
  searchUsers,
  sendRequest,
  acceptRequest
}
