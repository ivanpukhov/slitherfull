const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db/sequelize')
const { User } = require('./User')

class GamePayout extends Model {}

GamePayout.init(
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
    amountUnits: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    amountLamports: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    amountSol: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    amountUsd: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    priceUsd: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    txSignature: {
      type: DataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'GamePayout',
    tableName: 'game_payouts',
    indexes: [
      { fields: ['userId'] },
      { fields: ['createdAt'] }
    ]
  }
)

GamePayout.belongsTo(User, { foreignKey: 'userId', as: 'user' })

module.exports = { GamePayout }
