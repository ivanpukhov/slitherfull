const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db/sequelize')
const { User } = require('./User')

class FriendRequest extends Model {}

FriendRequest.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    requesterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User.tableName,
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    addresseeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User.tableName,
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'accepted', 'declined']]
      }
    }
  },
  {
    sequelize,
    modelName: 'FriendRequest',
    tableName: 'friend_requests',
    indexes: [
      { unique: true, fields: ['requesterId', 'addresseeId'] },
      { fields: ['addresseeId'] },
      { fields: ['status'] }
    ]
  }
)

FriendRequest.belongsTo(User, { as: 'requester', foreignKey: 'requesterId' })
FriendRequest.belongsTo(User, { as: 'addressee', foreignKey: 'addresseeId' })

module.exports = { FriendRequest }
