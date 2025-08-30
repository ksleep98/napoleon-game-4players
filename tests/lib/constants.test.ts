import {
  CARD_VALUES,
  createDeck,
  createGameDeck,
  GAME_CONFIG,
  RANKS,
  SUITS,
} from '@/lib/constants'

describe('Constants', () => {
  describe('createDeck', () => {
    it('should create 52 cards (no Jokers)', () => {
      const deck = createDeck()
      expect(deck).toHaveLength(52)
    })

    it('should have 4 suits with 13 cards each', () => {
      const deck = createDeck()

      SUITS.forEach((suit) => {
        const suitCards = deck.filter((card) => card.suit === suit)
        expect(suitCards).toHaveLength(13)
      })
    })

    it('should have all ranks for each suit', () => {
      const deck = createDeck()

      SUITS.forEach((suit) => {
        RANKS.forEach((rank) => {
          const card = deck.find((c) => c.suit === suit && c.rank === rank)
          expect(card).toBeDefined()
          expect(card?.value).toBe(CARD_VALUES[rank])
          expect(card?.id).toBe(`${suit}-${rank}`)
        })
      })
    })
  })

  describe('createGameDeck', () => {
    it('should create 48 cards (excluding 2s)', () => {
      const gameDeck = createGameDeck()
      expect(gameDeck).toHaveLength(48)
    })

    it('should not contain any 2s', () => {
      const gameDeck = createGameDeck()
      const twos = gameDeck.filter((card) => card.rank === '2')
      expect(twos).toHaveLength(0)
    })

    it('should contain all other ranks', () => {
      const gameDeck = createGameDeck()
      const ranksExcluding2s = RANKS.filter((rank) => rank !== '2')

      SUITS.forEach((suit) => {
        ranksExcluding2s.forEach((rank) => {
          const card = gameDeck.find((c) => c.suit === suit && c.rank === rank)
          expect(card).toBeDefined()
        })
      })
    })
  })

  describe('GAME_CONFIG', () => {
    it('should have correct configuration values', () => {
      expect(GAME_CONFIG.PLAYERS_COUNT).toBe(4)
      expect(GAME_CONFIG.CARDS_PER_PLAYER).toBe(12)
      expect(GAME_CONFIG.TOTAL_CARDS_USED).toBe(52)
      expect(GAME_CONFIG.HIDDEN_CARDS).toBe(4)
      expect(GAME_CONFIG.TARGET_FACE_CARDS).toBe(13)
    })

    it('should have mathematically correct card distribution', () => {
      const totalDistributed =
        GAME_CONFIG.PLAYERS_COUNT * GAME_CONFIG.CARDS_PER_PLAYER
      const totalWithHidden = totalDistributed + GAME_CONFIG.HIDDEN_CARDS
      expect(totalWithHidden).toBe(GAME_CONFIG.TOTAL_CARDS_USED)
    })
  })

  describe('CARD_VALUES', () => {
    it('should have Ace as highest value', () => {
      expect(CARD_VALUES.A).toBe(14)
      expect(CARD_VALUES.A).toBeGreaterThan(CARD_VALUES.K)
    })

    it('should have 2 as lowest value', () => {
      expect(CARD_VALUES['2']).toBe(2)
      expect(CARD_VALUES['2']).toBeLessThan(CARD_VALUES['3'])
    })

    it('should have all ranks with correct values', () => {
      expect(CARD_VALUES.K).toBe(13)
      expect(CARD_VALUES.Q).toBe(12)
      expect(CARD_VALUES.J).toBe(11)
      expect(CARD_VALUES['10']).toBe(10)
    })
  })
})
