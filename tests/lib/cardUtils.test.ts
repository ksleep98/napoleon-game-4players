import { createDeck } from '@/lib/constants'
import type { Player } from '@/types/game'
import { dealCards, shuffleDeck } from '@/utils/cardUtils'

describe('Card Utils', () => {
  describe('shuffleDeck', () => {
    it('should return array with same length', () => {
      const deck = createDeck()
      const shuffled = shuffleDeck([...deck])
      expect(shuffled).toHaveLength(deck.length)
    })

    it('should contain all original cards by ID', () => {
      const deck = createDeck()
      const shuffled = shuffleDeck([...deck])
      const originalIds = deck.map((card) => card.id).sort()
      const shuffledIds = shuffled.map((card) => card.id).sort()
      expect(shuffledIds).toEqual(originalIds)
    })
  })

  describe('dealCards', () => {
    it('should deal 12 cards to each of 4 players', () => {
      const players: Player[] = [
        {
          id: 'p1',
          name: 'Player 1',
          hand: [],
          isNapoleon: false,
          isAdjutant: false,
          position: 1,
        },
        {
          id: 'p2',
          name: 'Player 2',
          hand: [],
          isNapoleon: false,
          isAdjutant: false,
          position: 2,
        },
        {
          id: 'p3',
          name: 'Player 3',
          hand: [],
          isNapoleon: false,
          isAdjutant: false,
          position: 3,
        },
        {
          id: 'p4',
          name: 'Player 4',
          hand: [],
          isNapoleon: false,
          isAdjutant: false,
          position: 4,
        },
      ]

      const result = dealCards(players)

      expect(result.players).toHaveLength(4)
      result.players.forEach((player) => {
        expect(player.hand).toHaveLength(12) // 52枚 - 4枚隠し = 48枚 ÷ 4人 = 12枚
      })
      expect(result.hiddenCards).toHaveLength(4)

      // 全カードが配布されていることを確認
      const totalCards =
        result.players.reduce((sum, player) => sum + player.hand.length, 0) +
        result.hiddenCards.length
      expect(totalCards).toBe(52)
    })
  })
})
