const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db/sequelize')

class GameWallet extends Model {}

GameWallet.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'game'
    },
    publicKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    secretKey: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'GameWallet',
    tableName: 'game_wallets'
  }
)

module.exports = { GameWallet }
