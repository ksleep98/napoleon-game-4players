/**
 * サーバー側暗号化ユーティリティ
 * Node.js crypto モジュールを使用したAES-256暗号化
 * httpOnlyクッキーのセッションデータ保護用
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'

// 暗号化キー（環境変数から取得、32バイト必須）
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'napoleon-game-secure-key-2024-32bytes!!'

// キーを32バイトに正規化（AES-256要件）
const NORMALIZED_KEY = createHash('sha256').update(ENCRYPTION_KEY).digest()

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16 // AES block size

/**
 * データをAES-256で暗号化
 * @param data 暗号化する文字列
 * @returns 暗号化された文字列（Base64エンコード）
 */
export function encryptData(data: string): string {
  try {
    // ランダムなIV（Initialization Vector）を生成
    const iv = randomBytes(IV_LENGTH)

    // 暗号化
    const cipher = createCipheriv(ALGORITHM, NORMALIZED_KEY, iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // IV + 暗号化データを結合してBase64エンコード
    const combined = `${iv.toString('hex')}:${encrypted}`
    return Buffer.from(combined).toString('base64')
  } catch (error) {
    console.error('[Encryption] Failed to encrypt data:', error)
    throw new Error('Encryption failed')
  }
}

/**
 * AES-256で暗号化されたデータを復号化
 * @param encryptedData 暗号化された文字列（Base64エンコード）
 * @returns 復号化された文字列
 */
export function decryptData(encryptedData: string): string {
  try {
    // Base64デコード
    const combined = Buffer.from(encryptedData, 'base64').toString('utf8')
    const parts = combined.split(':')

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]

    // 復号化
    const decipher = createDecipheriv(ALGORITHM, NORMALIZED_KEY, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('[Encryption] Failed to decrypt data:', error)
    throw new Error('Decryption failed')
  }
}

/**
 * セッショントークンを生成（SHA256ハッシュ）
 * @param playerId プレイヤーID
 * @returns セッショントークン（64文字のHEX文字列）
 */
export function generateSessionToken(playerId: string): string {
  const timestamp = Date.now().toString()
  const randomValue = randomBytes(16).toString('hex')
  const data = `${playerId}-${timestamp}-${randomValue}`

  return createHash('sha256').update(data).digest('hex')
}

/**
 * データのハッシュ値を生成（SHA256）
 * @param data ハッシュ化する文字列
 * @returns SHA256ハッシュ（64文字のHEX文字列）
 */
export function hashData(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}
