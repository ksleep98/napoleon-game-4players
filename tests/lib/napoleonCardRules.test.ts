import { CARD_RANKS, SUIT_ENUM } from '@/lib/constants'
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
      expect(getCounterSuit(SUIT_ENUM.SPADES)).toBe(SUIT_ENUM.CLUBS)
      expect(getCounterSuit(SUIT_ENUM.CLUBS)).toBe(SUIT_ENUM.SPADES)
      expect(getCounterSuit(SUIT_ENUM.HEARTS)).toBe(SUIT_ENUM.DIAMONDS)
      expect(getCounterSuit(SUIT_ENUM.DIAMONDS)).toBe(SUIT_ENUM.HEARTS)
    })

    it('should identify mighty (♠A) correctly', () => {
      const mighty = createCard(
        `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
        SUIT_ENUM.SPADES,
        CARD_RANKS.ACE
      )
      const notMighty = createCard(
        `${SUIT_ENUM.HEARTS}-${CARD_RANKS.ACE}`,
        SUIT_ENUM.HEARTS,
        CARD_RANKS.ACE
      )

      expect(isMighty(mighty)).toBe(true)
      expect(isMighty(notMighty)).toBe(false)
    })

    it('should identify trump jack correctly', () => {
      const trumpJack = createCard(
        `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
        SUIT_ENUM.HEARTS,
        CARD_RANKS.JACK
      )
      const notTrumpJack = createCard(
        `${SUIT_ENUM.SPADES}-${CARD_RANKS.JACK}`,
        SUIT_ENUM.SPADES,
        CARD_RANKS.JACK
      )

      expect(isTrumpJack(trumpJack, SUIT_ENUM.HEARTS)).toBe(true)
      expect(isTrumpJack(notTrumpJack, SUIT_ENUM.HEARTS)).toBe(false)
    })

    it('should identify counter jack correctly', () => {
      const counterJack = createCard(
        `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.JACK}`,
        SUIT_ENUM.DIAMONDS,
        CARD_RANKS.JACK
      )
      const notCounterJack = createCard(
        `${SUIT_ENUM.SPADES}-${CARD_RANKS.JACK}`,
        SUIT_ENUM.SPADES,
        CARD_RANKS.JACK
      )

      expect(isCounterJack(counterJack, SUIT_ENUM.HEARTS)).toBe(true)
      expect(isCounterJack(notCounterJack, SUIT_ENUM.HEARTS)).toBe(false)
    })

    it('should identify trump cards correctly', () => {
      const trumpCard = createCard(
        `${SUIT_ENUM.HEARTS}-${CARD_RANKS.KING}`,
        SUIT_ENUM.HEARTS,
        CARD_RANKS.KING
      )
      const notTrumpCard = createCard(
        `${SUIT_ENUM.SPADES}-${CARD_RANKS.KING}`,
        SUIT_ENUM.SPADES,
        CARD_RANKS.KING
      )

      expect(isTrump(trumpCard, SUIT_ENUM.HEARTS)).toBe(true)
      expect(isTrump(notTrumpCard, SUIT_ENUM.HEARTS)).toBe(false)
    })

    it('should identify heart queen correctly', () => {
      const heartQueen = createCard(
        `${SUIT_ENUM.HEARTS}-${CARD_RANKS.QUEEN}`,
        SUIT_ENUM.HEARTS,
        CARD_RANKS.QUEEN
      )
      const notHeartQueen = createCard(
        `${SUIT_ENUM.SPADES}-${CARD_RANKS.QUEEN}`,
        SUIT_ENUM.SPADES,
        CARD_RANKS.QUEEN
      )

      expect(isHeartQueen(heartQueen)).toBe(true)
      expect(isHeartQueen(notHeartQueen)).toBe(false)
    })
  })

  describe('Card Strength', () => {
    it('should assign correct strength values', () => {
      const mighty = createCard(
        `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
        SUIT_ENUM.SPADES,
        CARD_RANKS.ACE
      )
      const trumpJack = createCard(
        `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
        SUIT_ENUM.HEARTS,
        CARD_RANKS.JACK
      )
      const counterJack = createCard(
        `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.JACK}`,
        SUIT_ENUM.DIAMONDS,
        CARD_RANKS.JACK
      )
      const trumpCard = createCard(
        `${SUIT_ENUM.HEARTS}-${CARD_RANKS.KING}`,
        SUIT_ENUM.HEARTS,
        CARD_RANKS.KING
      )
      const leadingCard = createCard(
        `${SUIT_ENUM.CLUBS}-${CARD_RANKS.ACE}`,
        SUIT_ENUM.CLUBS,
        CARD_RANKS.ACE
      )
      const otherCard = createCard(
        `${SUIT_ENUM.SPADES}-${CARD_RANKS.KING}`,
        SUIT_ENUM.SPADES,
        CARD_RANKS.KING
      )

      expect(getCardStrength(mighty, SUIT_ENUM.HEARTS, SUIT_ENUM.CLUBS)).toBe(
        1000
      )
      expect(
        getCardStrength(trumpJack, SUIT_ENUM.HEARTS, SUIT_ENUM.CLUBS)
      ).toBe(900)
      expect(
        getCardStrength(counterJack, SUIT_ENUM.HEARTS, SUIT_ENUM.CLUBS)
      ).toBe(800)
      expect(
        getCardStrength(trumpCard, SUIT_ENUM.HEARTS, SUIT_ENUM.CLUBS)
      ).toBeGreaterThan(700)
      expect(
        getCardStrength(leadingCard, SUIT_ENUM.HEARTS, SUIT_ENUM.CLUBS)
      ).toBeGreaterThan(600)
      expect(
        getCardStrength(otherCard, SUIT_ENUM.HEARTS, SUIT_ENUM.CLUBS)
      ).toBeLessThan(600)
    })
  })

  describe('Special Rules', () => {
    describe('Same 2 Rule', () => {
      it('should detect same 2 rule correctly', () => {
        const trick: Trick = {
          id: 'test-trick',
          cards: [
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.KING}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.KING
              ),
              'p1',
              0
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.TWO}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.TWO
              ),
              'p2',
              1
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.SEVEN}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.SEVEN
              ),
              'p3',
              2
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.ACE}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.ACE
              ),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkSame2Rule(trick, SUIT_ENUM.HEARTS)
        expect(winner).not.toBeNull()
        expect(winner?.playerId).toBe('p2')
      })

      it('should not apply same 2 rule for trump suit', () => {
        const trick: Trick = {
          id: 'test-trick',
          cards: [
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.KING}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.KING
              ),
              'p1',
              0
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.TWO}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.TWO
              ),
              'p2',
              1
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.SEVEN}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.SEVEN
              ),
              'p3',
              2
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.ACE}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.ACE
              ),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkSame2Rule(trick, SUIT_ENUM.HEARTS)
        expect(winner).toBeNull()
      })

      it('should not apply same 2 rule when counter jack is present (裏J > セイム2)', () => {
        const trick: Trick = {
          id: 'test-trick',
          cards: [
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.KING}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.KING
              ),
              'p1',
              0
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.TWO}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.TWO
              ),
              'p2',
              1
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.DIAMONDS,
                CARD_RANKS.JACK
              ),
              'p3',
              2
            ), // 裏J (hearts trump)
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.ACE}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.ACE
              ),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        // セイム2の条件は満たされているが、裏Jがあるので無効
        const winner = checkSame2Rule(trick, SUIT_ENUM.HEARTS)
        expect(winner).toBeNull()
      })
    })

    describe('Yoromeki Rule', () => {
      it('should detect yoromeki (mighty vs heart queen)', () => {
        const trick: Trick = {
          id: 'test-trick',
          cards: [
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
                SUIT_ENUM.SPADES,
                CARD_RANKS.ACE
              ),
              'p1',
              0
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.QUEEN}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.QUEEN
              ),
              'p2',
              1
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.SEVEN}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.SEVEN
              ),
              'p3',
              2
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.KING}`,
                SUIT_ENUM.DIAMONDS,
                CARD_RANKS.KING
              ),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkYoromekiRule(trick, SUIT_ENUM.CLUBS)
        expect(winner).not.toBeNull()
        expect(winner?.playerId).toBe('p2')
      })

      it('should not apply yoromeki when trump jack is present', () => {
        const trick: Trick = {
          id: 'test-trick',
          cards: [
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
                SUIT_ENUM.SPADES,
                CARD_RANKS.ACE
              ),
              'p1',
              0
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.QUEEN}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.QUEEN
              ),
              'p2',
              1
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.JACK
              ),
              'p3',
              2
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.KING}`,
                SUIT_ENUM.DIAMONDS,
                CARD_RANKS.KING
              ),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkYoromekiRule(trick, SUIT_ENUM.CLUBS)
        expect(winner).toBeNull()
      })
    })

    describe('Hunting Jack Rule', () => {
      it('should detect hunting jack (spades J vs hearts J)', () => {
        const trick: Trick = {
          id: 'test-trick',
          cards: [
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.SPADES}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.SPADES,
                CARD_RANKS.JACK
              ),
              'p1',
              0
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.JACK
              ),
              'p2',
              1
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.SEVEN}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.SEVEN
              ),
              'p3',
              2
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.KING}`,
                SUIT_ENUM.DIAMONDS,
                CARD_RANKS.KING
              ),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkHuntingJackRule(trick, SUIT_ENUM.SPADES)
        expect(winner).not.toBeNull()
        expect(winner?.playerId).toBe('p2') // Hearts J (weakest) should win
      })

      it('should not apply hunting jack when mighty is present', () => {
        const trick: Trick = {
          id: 'test-trick',
          cards: [
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.SPADES}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.SPADES,
                CARD_RANKS.JACK
              ),
              'p1',
              0
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.JACK
              ),
              'p2',
              1
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
                SUIT_ENUM.SPADES,
                CARD_RANKS.ACE
              ),
              'p3',
              2
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.KING}`,
                SUIT_ENUM.DIAMONDS,
                CARD_RANKS.KING
              ),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        const winner = checkHuntingJackRule(trick, SUIT_ENUM.SPADES)
        expect(winner).toBeNull()
      })
    })
  })

  describe('Determine Winner With Special Rules', () => {
    it('should apply special rules in correct priority', () => {
      // Test with yoromeki rule
      const trick: Trick = {
        id: 'test-trick',
        cards: [
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
              SUIT_ENUM.SPADES,
              CARD_RANKS.ACE
            ),
            'p1',
            0
          ),
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.HEARTS}-${CARD_RANKS.QUEEN}`,
              SUIT_ENUM.HEARTS,
              CARD_RANKS.QUEEN
            ),
            'p2',
            1
          ),
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.CLUBS}-${CARD_RANKS.SEVEN}`,
              SUIT_ENUM.CLUBS,
              CARD_RANKS.SEVEN
            ),
            'p3',
            2
          ),
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.KING}`,
              SUIT_ENUM.DIAMONDS,
              CARD_RANKS.KING
            ),
            'p4',
            3
          ),
        ],
        completed: true,
      }

      const winner = determineWinnerWithSpecialRules(
        trick,
        SUIT_ENUM.CLUBS,
        false
      )
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p2') // Yoromeki should win over mighty
    })

    it('should prioritize counter jack over same 2 rule', () => {
      // セイム2と裏Jが両方存在する場合、裏Jが勝利する
      const trick: Trick = {
        id: 'test-trick',
        cards: [
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.CLUBS}-${CARD_RANKS.KING}`,
              SUIT_ENUM.CLUBS,
              CARD_RANKS.KING
            ),
            'p1',
            0
          ),
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.CLUBS}-${CARD_RANKS.TWO}`,
              SUIT_ENUM.CLUBS,
              CARD_RANKS.TWO
            ),
            'p2',
            1
          ), // セイム2候補
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.JACK}`,
              SUIT_ENUM.DIAMONDS,
              CARD_RANKS.JACK
            ),
            'p3',
            2
          ), // 裏J (hearts trump)
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.CLUBS}-${CARD_RANKS.ACE}`,
              SUIT_ENUM.CLUBS,
              CARD_RANKS.ACE
            ),
            'p4',
            3
          ),
        ],
        completed: true,
      }

      const winner = determineWinnerWithSpecialRules(
        trick,
        SUIT_ENUM.HEARTS,
        false
      )
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p3') // 裏Jが勝利
    })

    it('should prioritize counter jack over same 2 rule - detailed test', () => {
      // より詳細なテスト：セイム2の条件を完全に満たしつつ裏Jが勝利することを確認
      const trick: Trick = {
        id: 'test-trick',
        cards: [
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.SPADES}-${CARD_RANKS.KING}`,
              SUIT_ENUM.SPADES,
              CARD_RANKS.KING
            ),
            'p1',
            0
          ), // リードはスペード
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.SPADES}-${CARD_RANKS.TWO}`,
              SUIT_ENUM.SPADES,
              CARD_RANKS.TWO
            ),
            'p2',
            1
          ), // セイム2候補
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.SPADES}-${CARD_RANKS.SEVEN}`,
              SUIT_ENUM.SPADES,
              CARD_RANKS.SEVEN
            ),
            'p3',
            2
          ), // 同じスート
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.JACK}`,
              SUIT_ENUM.DIAMONDS,
              CARD_RANKS.JACK
            ),
            'p4',
            3
          ), // 裏J (hearts trump時)
        ],
        completed: true,
      }

      // ハートが切り札の場合、ダイヤのJは裏J
      const winner = determineWinnerWithSpecialRules(
        trick,
        SUIT_ENUM.HEARTS,
        false
      )
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p4') // 裏Jが勝利
    })

    it('should fall back to normal strength when no special rules apply', () => {
      const trick: Trick = {
        id: 'test-trick',
        cards: [
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.CLUBS}-${CARD_RANKS.KING}`,
              SUIT_ENUM.CLUBS,
              CARD_RANKS.KING
            ),
            'p1',
            0
          ),
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.CLUBS}-${CARD_RANKS.SEVEN}`,
              SUIT_ENUM.CLUBS,
              CARD_RANKS.SEVEN
            ),
            'p2',
            1
          ),
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.CLUBS}-${CARD_RANKS.QUEEN}`,
              SUIT_ENUM.CLUBS,
              CARD_RANKS.QUEEN
            ),
            'p3',
            2
          ),
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.CLUBS}-${CARD_RANKS.ACE}`,
              SUIT_ENUM.CLUBS,
              CARD_RANKS.ACE
            ),
            'p4',
            3
          ),
        ],
        completed: true,
      }

      const winner = determineWinnerWithSpecialRules(
        trick,
        SUIT_ENUM.HEARTS,
        false
      )
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p4') // Ace should win normally
    })
  })
})
