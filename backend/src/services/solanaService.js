const bs58 = require('bs58')
const {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl
} = require('@solana/web3.js')

const fetchImpl = globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || 'devnet'
const connection = new Connection(clusterApiUrl(SOLANA_CLUSTER), 'confirmed')

function createKeypair() {
  const keypair = Keypair.generate()
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey)
  }
}

function decodeSecret(secret) {
  if (!secret) throw new Error('missing_secret')
  return Keypair.fromSecretKey(bs58.decode(secret))
}

async function getBalance(publicKey) {
  if (!publicKey) return 0
  try {
    const key = new PublicKey(publicKey)
    return await connection.getBalance(key)
  } catch (err) {
    console.error('Failed to fetch balance', err)
    throw err
  }
}

async function requestAirdrop(publicKey, solAmount) {
  if (!publicKey) throw new Error('missing_public_key')
  const key = new PublicKey(publicKey)
  const lamports = Math.floor(Number(solAmount) * LAMPORTS_PER_SOL)
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('invalid_airdrop_amount')
  }
  const signature = await connection.requestAirdrop(key, lamports)
  await connection.confirmTransaction(signature, 'confirmed')
  return signature
}

async function transferLamports(secretKey, toPublicKey, lamports) {
  if (!secretKey) throw new Error('missing_secret_key')
  if (!toPublicKey) throw new Error('missing_destination')
  const normalizedLamports = Math.floor(Number(lamports) || 0)
  if (!Number.isFinite(normalizedLamports) || normalizedLamports <= 0) {
    throw new Error('invalid_lamports')
  }
  const from = decodeSecret(secretKey)
  const to = new PublicKey(toPublicKey)
  const tx = new Transaction().add(SystemProgram.transfer({
    fromPubkey: from.publicKey,
    toPubkey: to,
    lamports: normalizedLamports
  }))
  const signature = await sendAndConfirmTransaction(connection, tx, [from])
  return signature
}

let cachedPrice = null
let cachedAt = 0
const PRICE_TTL_MS = 60_000

async function fetchSolPriceUsd() {
  const now = Date.now()
  if (cachedPrice && now - cachedAt < PRICE_TTL_MS) {
    return cachedPrice
  }
  try {
    const res = await fetchImpl('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    if (!res.ok) throw new Error('price_request_failed')
    const data = await res.json()
    const price = Number(data?.solana?.usd)
    if (!Number.isFinite(price) || price <= 0) throw new Error('invalid_price')
    cachedPrice = price
    cachedAt = now
    return price
  } catch (err) {
    console.error('Failed to fetch SOL price', err)
    throw err
  }
}

module.exports = {
  connection,
  createKeypair,
  getBalance,
  requestAirdrop,
  transferLamports,
  fetchSolPriceUsd,
  LAMPORTS_PER_SOL
}
