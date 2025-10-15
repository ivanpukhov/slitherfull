const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db/sequelize')

class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nickname: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    balance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    walletPublicKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    walletSecretKey: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    indexes: [
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['nickname'] }
    ]
  }
)

module.exports = { User }
