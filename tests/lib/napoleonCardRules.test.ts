import {
  checkHuntingJackRule,
  checkSame2Rule,
  checkYoromekiRule,
  determineWinnerWithSpecialRules,
  getCardStrength,
  getCounterSuit,
  isCounterJack,
  isHeartQueen,
  isMighty,
  isTrump,
  isTrumpJack,
} from '@/lib/napoleonCardRules'
import type { Card, PlayedCard, Rank, Suit, Trick } from '@/types/game'

describe('Napoleon Card Rules', () => {
  const createCard = (id: string, suit: Suit, rank: Rank): Card => ({
    id,
    suit,
    rank,
    value: getCardValue(rank),
  })

  const createPlayedCard = (
    card: Card,
    playerId: string,
    order: number
  ): PlayedCard => ({
    card,
    playerId,
    order,
  })

  function getCardValue(rank: string): number {
    const values: Record<string, number> = {
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '8': 8,
      '9': 9,
      '10': 10,
      J: 11,
      Q: 12,
      K: 13,
      A: 14,
    }
    return values[rank] || 0
  }

  describe('Helper Functions', () => {
    it('should identify counter suits correctly', () => {
      expect(getCounterSuit('spades')).toBe('clubs')
      expect(getCounterSuit('clubs')).toBe('spades')
      expect(getCounterSuit('hearts')).toBe('diamonds')
      expect(getCounterSuit('diamonds')).toBe('hearts')
    })

    it('should identify mighty (♠A) correctly', () => {
      const mighty = createCard('spades-A', 'spades', 'A')
      const notMighty = createCard('hearts-A', 'hearts', 'A')

      expect(isMighty(mighty)).toBe(true)
      expect(isMighty(notMighty)).toBe(false)
    })

    it('should identify trump jack correctly', () => {
      const trumpJack = createCard('hearts-J', 'hearts', 'J')
      const notTrumpJack = createCard('spades-J', 'spades', 'J')

      expect(isTrumpJack(trumpJack, 'hearts')).toBe(true)
      expect(isTrumpJack(notTrumpJack, 'hearts')).toBe(false)
    })

    it('should identify counter jack correctly', () => {
      const counterJack = createCard('diamonds-J', 'diamonds', 'J')
      const notCounterJack = createCard('spades-J', 'spades', 'J')

      expect(isCounterJack(counterJack, 'hearts')).toBe(true)
      expect(isCounterJack(notCounterJack, 'hearts')).toBe(false)
    })

    it('should identify trump cards correctly', () => {
      const trumpCard = createCard('hearts-K', 'hearts', 'K')
      const notTrumpCard = createCard('spades-K', 'spades', 'K')

      expect(isTrump(trumpCard, 'hearts')).toBe(true)
      expect(isTrump(notTrumpCard, 'hearts')).toBe(false)
    })

    it('should identify heart queen correctly', () => {
      const heartQueen = createCard('hearts-Q', 'hearts', 'Q')
      const notHeartQueen = createCard('spades-Q', 'spades', 'Q')

      expect(isHeartQueen(heartQueen)).toBe(true)
      expect(isHeartQueen(notHeartQueen)).toBe(false)
    })
  })

  describe('Card Strength', () => {
    it('should assign correct strength values', () => {
      const mighty = createCard('spades-A', 'spades', 'A')
      const trumpJack = createCard('hearts-J', 'hearts', 'J')
      const counterJack = createCard('diamonds-J', 'diamonds', 'J')
      const trumpCard = createCard('hearts-K', 'hearts', 'K')
      const leadingCard = createCard('clubs-A', 'clubs', 'A')
      const otherCard = createCard('spades-K', 'spades', 'K')

      expect(getCardStrength(mighty, 'hearts', 'clubs')).toBe(1000)
      expect(getCardStrength(trumpJack, 'hearts', 'clubs')).toBe(900)
      expect(getCardStrength(counterJack, 'hearts', 'clubs')).toBe(800)
      expect(getCardStrength(trumpCard, 'hearts', 'clubs')).toBeGreaterThan(700)
      expect(getCardStrength(leadingCard, 'hearts', 'clubs')).toBeGreaterThan(
        600
      )
      expect(getCardStrength(otherCard, 'hearts', 'clubs')).toBeLessThan(600)
    })
  })

  describe('Special Rules', () => {
    describe('Same 2 Rule', () => {
      it('should detect same 2 rule correctly', () => {
        const trick: Trick = {
          id: 'test-phase',
          cards: [
            createPlayedCard(createCard('clubs-K', 'clubs', 'K'), 'p1', 0),
            createPlayedCard(createCard('clubs-2', 'clubs', '2'), 'p2', 1),
            createPlayedCard(createCard('clubs-7', 'clubs', '7'), 'p3', 2),
            createPlayedCard(createCard('clubs-A', 'clubs', 'A'), 'p4', 3),
          ],
          completed: true,
        }

        const winner = checkSame2Rule(trick, 'hearts')
        expect(winner).not.toBeNull()
        expect(winner?.playerId).toBe('p2')
      })

      it('should not apply same 2 rule for trump suit', () => {
        const trick: Trick = {
          id: 'test-phase',
          cards: [
            createPlayedCard(createCard('hearts-K', 'hearts', 'K'), 'p1', 0),
            createPlayedCard(createCard('hearts-2', 'hearts', '2'), 'p2', 1),
            createPlayedCard(createCard('hearts-7', 'hearts', '7'), 'p3', 2),
            createPlayedCard(createCard('hearts-A', 'hearts', 'A'), 'p4', 3),
          ],
          completed: true,
        }

        const winner = checkSame2Rule(trick, 'hearts')
        expect(winner).toBeNull()
      })

      it('should not apply same 2 rule when counter jack is present (裏J > セイム2)', () => {
        const trick: Trick = {
          id: 'test-phase',
          cards: [
            createPlayedCard(createCard('clubs-K', 'clubs', 'K'), 'p1', 0),
            createPlayedCard(createCard('clubs-2', 'clubs', '2'), 'p2', 1),
            createPlayedCard(
              createCard('diamonds-J', 'diamonds', 'J'),
              'p3',
              2
            ), // 裏J (hearts trump)
            createPlayedCard(createCard('clubs-A', 'clubs', 'A'), 'p4', 3),
          ],
          completed: true,
        }

        // セイム2の条件は満たされているが、裏Jがあるので無効
        const winner = checkSame2Rule(trick, 'hearts')
        expect(winner).toBeNull()
      })
    })

    describe('Yoromeki Rule', () => {
      it('should detect yoromeki (mighty vs heart queen)', () => {
        const trick: Trick = {
          id: 'test-phase',
          cards: [
            createPlayedCard(createCard('spades-A', 'spades', 'A'), 'p1', 0),
            createPlayedCard(createCard('hearts-Q', 'hearts', 'Q'), 'p2', 1),
            createPlayedCard(createCard('clubs-7', 'clubs', '7'), 'p3', 2),
            createPlayedCard(
              createCard('diamonds-K', 'diamonds', 'K'),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkYoromekiRule(trick, 'clubs')
        expect(winner).not.toBeNull()
        expect(winner?.playerId).toBe('p2')
      })

      it('should not apply yoromeki when trump jack is present', () => {
        const trick: Trick = {
          id: 'test-phase',
          cards: [
            createPlayedCard(createCard('spades-A', 'spades', 'A'), 'p1', 0),
            createPlayedCard(createCard('hearts-Q', 'hearts', 'Q'), 'p2', 1),
            createPlayedCard(createCard('clubs-J', 'clubs', 'J'), 'p3', 2),
            createPlayedCard(
              createCard('diamonds-K', 'diamonds', 'K'),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkYoromekiRule(trick, 'clubs')
        expect(winner).toBeNull()
      })
    })

    describe('Hunting Jack Rule', () => {
      it('should detect hunting jack (spades J vs hearts J)', () => {
        const trick: Trick = {
          id: 'test-phase',
          cards: [
            createPlayedCard(createCard('spades-J', 'spades', 'J'), 'p1', 0),
            createPlayedCard(createCard('hearts-J', 'hearts', 'J'), 'p2', 1),
            createPlayedCard(createCard('clubs-7', 'clubs', '7'), 'p3', 2),
            createPlayedCard(
              createCard('diamonds-K', 'diamonds', 'K'),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkHuntingJackRule(trick, 'spades')
        expect(winner).not.toBeNull()
        expect(winner?.playerId).toBe('p2') // Hearts J (weakest) should win
      })

      it('should not apply hunting jack when mighty is present', () => {
        const trick: Trick = {
          id: 'test-phase',
          cards: [
            createPlayedCard(createCard('spades-J', 'spades', 'J'), 'p1', 0),
            createPlayedCard(createCard('hearts-J', 'hearts', 'J'), 'p2', 1),
            createPlayedCard(createCard('spades-A', 'spades', 'A'), 'p3', 2),
            createPlayedCard(
              createCard('diamonds-K', 'diamonds', 'K'),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkHuntingJackRule(trick, 'spades')
        expect(winner).toBeNull()
      })
    })
  })

  describe('Determine Winner With Special Rules', () => {
    it('should apply special rules in correct priority', () => {
      // Test with yoromeki rule
      const trick: Trick = {
        id: 'test-phase',
        cards: [
          createPlayedCard(createCard('spades-A', 'spades', 'A'), 'p1', 0),
          createPlayedCard(createCard('hearts-Q', 'hearts', 'Q'), 'p2', 1),
          createPlayedCard(createCard('clubs-7', 'clubs', '7'), 'p3', 2),
          createPlayedCard(createCard('diamonds-K', 'diamonds', 'K'), 'p4', 3),
        ],
        completed: true,
      }

      const winner = determineWinnerWithSpecialRules(trick, 'clubs', false)
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p2') // Yoromeki should win over mighty
    })

    it('should prioritize counter jack over same 2 rule', () => {
      // セイム2と裏Jが両方存在する場合、裏Jが勝利する
      const trick: Trick = {
        id: 'test-phase',
        cards: [
          createPlayedCard(createCard('clubs-K', 'clubs', 'K'), 'p1', 0),
          createPlayedCard(createCard('clubs-2', 'clubs', '2'), 'p2', 1), // セイム2候補
          createPlayedCard(createCard('diamonds-J', 'diamonds', 'J'), 'p3', 2), // 裏J (hearts trump)
          createPlayedCard(createCard('clubs-A', 'clubs', 'A'), 'p4', 3),
        ],
        completed: true,
      }

      const winner = determineWinnerWithSpecialRules(trick, 'hearts', false)
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p3') // 裏Jが勝利
    })

    it('should prioritize counter jack over same 2 rule - detailed test', () => {
      // より詳細なテスト：セイム2の条件を完全に満たしつつ裏Jが勝利することを確認
      const trick: Trick = {
        id: 'test-phase',
        cards: [
          createPlayedCard(createCard('spades-K', 'spades', 'K'), 'p1', 0), // リードはスペード
          createPlayedCard(createCard('spades-2', 'spades', '2'), 'p2', 1), // セイム2候補
          createPlayedCard(createCard('spades-7', 'spades', '7'), 'p3', 2), // 同じスート
          createPlayedCard(createCard('diamonds-J', 'diamonds', 'J'), 'p4', 3), // 裏J (hearts trump時)
        ],
        completed: true,
      }

      // ハートが切り札の場合、ダイヤのJは裏J
      const winner = determineWinnerWithSpecialRules(trick, 'hearts', false)
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p4') // 裏Jが勝利
    })

    it('should fall back to normal strength when no special rules apply', () => {
      const trick: Trick = {
        id: 'test-phase',
        cards: [
          createPlayedCard(createCard('clubs-K', 'clubs', 'K'), 'p1', 0),
          createPlayedCard(createCard('clubs-7', 'clubs', '7'), 'p2', 1),
          createPlayedCard(createCard('clubs-Q', 'clubs', 'Q'), 'p3', 2),
          createPlayedCard(createCard('clubs-A', 'clubs', 'A'), 'p4', 3),
        ],
        completed: true,
      }

      const winner = determineWinnerWithSpecialRules(trick, 'hearts', false)
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p4') // Ace should win normally
    })
  })
})
