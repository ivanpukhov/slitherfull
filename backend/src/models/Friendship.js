const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db/sequelize')
const { User } = require('./User')

class Friendship extends Model {}

Friendship.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User.tableName,
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    friendId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User.tableName,
        key: 'id'
      },
      onDelete: 'CASCADE'
    }
  },
  {
    sequelize,
    modelName: 'Friendship',
    tableName: 'friendships',
    indexes: [{ unique: true, fields: ['userId', 'friendId'] }]
  }
)

Friendship.belongsTo(User, { as: 'user', foreignKey: 'userId' })
Friendship.belongsTo(User, { as: 'friend', foreignKey: 'friendId' })

module.exports = { Friendship }
