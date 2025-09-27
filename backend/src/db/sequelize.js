const path = require('path')
const fs = require('fs')
const { Sequelize } = require('sequelize')

const storagePath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../../data/slither.sqlite')

const storageDir = path.dirname(storagePath)
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true })
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storagePath,
  logging: false
})

module.exports = { sequelize }
