/**
 * 暗号化ユーティリティのユニットテスト
 */

import {
  decryptData,
  encryptData,
  generateSessionToken,
  hashData,
} from '@/utils/encryption'

describe('Encryption Utilities', () => {
  describe('encryptData and decryptData', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalData = 'Hello, Napoleon Game!'
      const encrypted = encryptData(originalData)
      const decrypted = decryptData(encrypted)

      expect(decrypted).toBe(originalData)
    })

    it('should encrypt same data differently each time (due to random IV)', () => {
      const data = 'Test data'
      const encrypted1 = encryptData(data)
      const encrypted2 = encryptData(data)

      // 暗号化結果は毎回異なる（ランダムIV使用）
      expect(encrypted1).not.toBe(encrypted2)

      // しかし、復号化すると同じデータになる
      expect(decryptData(encrypted1)).toBe(data)
      expect(decryptData(encrypted2)).toBe(data)
    })

    it('should handle JSON data correctly', () => {
      const jsonData = JSON.stringify({
        playerId: 'test-123',
        playerName: 'TestPlayer',
        timestamp: Date.now(),
      })

      const encrypted = encryptData(jsonData)
      const decrypted = decryptData(encrypted)
      const parsed = JSON.parse(decrypted)

      expect(parsed.playerId).toBe('test-123')
      expect(parsed.playerName).toBe('TestPlayer')
    })

    it('should throw error when decrypting invalid data', () => {
      expect(() => {
        decryptData('invalid-encrypted-data')
      }).toThrow()
    })

    it('should handle empty string', () => {
      const encrypted = encryptData('')
      const decrypted = decryptData(encrypted)

      expect(decrypted).toBe('')
    })

    it('should handle long text', () => {
      const longText = 'A'.repeat(10000)
      const encrypted = encryptData(longText)
      const decrypted = decryptData(encrypted)

      expect(decrypted).toBe(longText)
    })
  })

  describe('generateSessionToken', () => {
    it('should generate a valid session token', () => {
      const playerId = 'player-123'
      const token = generateSessionToken(playerId)

      // SHA256は64文字のHEX文字列
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should generate different tokens for same player', () => {
      const playerId = 'player-123'
      const token1 = generateSessionToken(playerId)
      const token2 = generateSessionToken(playerId)

      // ランダム値とタイムスタンプにより、毎回異なるトークンが生成される
      expect(token1).not.toBe(token2)
    })

    it('should generate different tokens for different players', () => {
      const token1 = generateSessionToken('player-1')
      const token2 = generateSessionToken('player-2')

      expect(token1).not.toBe(token2)
    })
  })

  describe('hashData', () => {
    it('should generate consistent hash for same data', () => {
      const data = 'test-data'
      const hash1 = hashData(data)
      const hash2 = hashData(data)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should generate different hashes for different data', () => {
      const hash1 = hashData('data-1')
      const hash2 = hashData('data-2')

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty string', () => {
      const hash = hashData('')

      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })
  })
})
