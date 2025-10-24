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

      it('should not apply same 2 rule when mighty is present (マイティ > セイム2)', () => {
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
                `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
                SUIT_ENUM.SPADES,
                CARD_RANKS.ACE
              ),
              'p3',
              2
            ), // マイティ
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

        // セイム2の条件は満たされているが、マイティがあるので無効
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

      it('should return trump jack when yoromeki conditions are met but trump jack is present', () => {
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
        expect(winner).not.toBeNull()
        expect(winner?.playerId).toBe('p3') // 表J（クラブのJ）が勝つ
      })

      it('should return counter jack when yoromeki conditions are met but counter jack is present', () => {
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
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.KING}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.KING
              ),
              'p4',
              3
            ),
          ],
          completed: true,
        }

        // スペードが切り札の場合、クラブのJが裏J
        const winner = checkYoromekiRule(trick, SUIT_ENUM.SPADES)
        expect(winner).not.toBeNull()
        expect(winner?.playerId).toBe('p3') // 裏J（クラブのJ）が勝つ
      })
    })

    describe('Hunting Jack Rule', () => {
      it('should detect hunting jack (spades J vs hearts J) - trump jack and its hunting jack', () => {
        // スペードが切り札の場合、表J（♠J）の狩J = ♥J
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
            ), // 表J
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.JACK
              ),
              'p2',
              1
            ), // 表Jの狩J
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.SEVEN}`,
                SUIT_ENUM.DIAMONDS,
                CARD_RANKS.SEVEN
              ),
              'p3',
              2
            ),
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.KING}`,
                SUIT_ENUM.CLUBS,
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
        expect(winner?.playerId).toBe('p2') // Hearts J (hunting jack) should win
      })

      it('should detect hunting jack (clubs J vs diamonds J) - counter jack and its hunting jack', () => {
        // スペードが切り札の場合、裏J（♣J）の狩J = ♦J
        const trick: Trick = {
          id: 'test-trick',
          cards: [
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.JACK
              ),
              'p1',
              0
            ), // 裏J
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.DIAMONDS,
                CARD_RANKS.JACK
              ),
              'p2',
              1
            ), // 裏Jの狩J
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
                `${SUIT_ENUM.SPADES}-${CARD_RANKS.KING}`,
                SUIT_ENUM.SPADES,
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
        expect(winner?.playerId).toBe('p2') // Diamonds J (hunting jack) should win
      })

      it('should NOT apply hunting jack when trump jack and counter jack are together (表J + 裏J)', () => {
        // 表Jと裏Jの組み合わせは狩Jペアではない
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
            ), // 表J
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.CLUBS}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.CLUBS,
                CARD_RANKS.JACK
              ),
              'p2',
              1
            ), // 裏J（狩Jではない）
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
        expect(winner).toBeNull() // 狩Jルールは発動しない
      })

      it('should not apply hunting jack when mighty is present', () => {
        // スペードが切り札の場合、♠J（表J）と ♥J（表Jの狩J）のペアだがマイティで無効
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
            ), // 表J
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
                SUIT_ENUM.HEARTS,
                CARD_RANKS.JACK
              ),
              'p2',
              1
            ), // 表Jの狩J
            createPlayedCard(
              createCard(
                `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
                SUIT_ENUM.SPADES,
                CARD_RANKS.ACE
              ),
              'p3',
              2
            ), // マイティ
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
        expect(winner).toBeNull() // マイティがあるので狩Jルール無効
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

    it('should prioritize mighty over same 2 rule', () => {
      // マイティとセイム2が両方存在する場合、マイティが勝利する
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
              `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
              SUIT_ENUM.SPADES,
              CARD_RANKS.ACE
            ),
            'p3',
            2
          ), // マイティ
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
      expect(winner?.playerId).toBe('p3') // マイティが勝利
    })

    it('should prioritize trump jack over counter jack when NO hunting jack rule applies', () => {
      // 表J（切り札のJ）と裏J（裏スートのJ）が直接対決
      // 狩りJルールは発動しない（別ペアでない）ため、通常の強度で表Jが勝つ
      const trick: Trick = {
        id: 'test-trick',
        cards: [
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
              SUIT_ENUM.HEARTS,
              CARD_RANKS.JACK
            ),
            'p1',
            0
          ), // 表J (hearts trump) - 強度900
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.JACK}`,
              SUIT_ENUM.DIAMONDS,
              CARD_RANKS.JACK
            ),
            'p2',
            1
          ), // 裏J (hearts trump時) - 強度800、狩Jペアではない
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
              `${SUIT_ENUM.SPADES}-${CARD_RANKS.KING}`,
              SUIT_ENUM.SPADES,
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
        SUIT_ENUM.HEARTS,
        false
      )
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p1') // 表Jが通常強度で勝利（狩Jルールなし）
    })

    it('should NOT allow same 2 rule to defeat trump jack (表J > セイム2)', () => {
      // セイム2ルールは発動するが、表J（900）が最終的に勝利する例
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
              `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
              SUIT_ENUM.HEARTS,
              CARD_RANKS.JACK
            ),
            'p3',
            2
          ), // 表J（hearts trump時）
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
      expect(winner?.playerId).toBe('p3') // 実際は表Jが勝利（セイム2は発動するが表Jが最強）
    })

    it('should allow hunting jack to defeat trump jack in specific conditions', () => {
      // 狩りJルールで表Jが負ける例（表J + 表Jの狩J）
      // スペードが切り札 → 表J（♠J）の狩J = ♥J
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
          ), // 表J (spades trump)
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
              SUIT_ENUM.HEARTS,
              CARD_RANKS.JACK
            ),
            'p2',
            1
          ), // 表Jの狩J（別ペアの普通のJ）
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.SEVEN}`,
              SUIT_ENUM.DIAMONDS,
              CARD_RANKS.SEVEN
            ),
            'p3',
            2
          ),
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.CLUBS}-${CARD_RANKS.KING}`,
              SUIT_ENUM.CLUBS,
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
        SUIT_ENUM.SPADES,
        false
      )
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p2') // ♥J（狩J）が狩りJルールで勝利
    })

    it('should maintain correct order: trump jack > counter jack > trump ace', () => {
      // 表J（900）> 裏J（800）> 切り札A（714）の順序確認
      // 表Jと裏Jは狩Jペアではないため、通常の強度で表Jが勝つ
      const trick: Trick = {
        id: 'test-trick',
        cards: [
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
              SUIT_ENUM.HEARTS,
              CARD_RANKS.JACK
            ),
            'p1',
            0
          ), // 表J (hearts trump) = 900
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.JACK}`,
              SUIT_ENUM.DIAMONDS,
              CARD_RANKS.JACK
            ),
            'p2',
            1
          ), // 裏J (hearts trump時) = 800（狩Jペアではない）
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.HEARTS}-${CARD_RANKS.ACE}`,
              SUIT_ENUM.HEARTS,
              CARD_RANKS.ACE
            ),
            'p3',
            2
          ), // 切り札A (hearts trump) = 700+14=714
          createPlayedCard(
            createCard(
              `${SUIT_ENUM.SPADES}-${CARD_RANKS.KING}`,
              SUIT_ENUM.SPADES,
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
        SUIT_ENUM.HEARTS,
        false
      )
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p1') // 通常強度で表J（♥J）が勝利
    })

    it('should confirm trump ace is NOT mighty and has lower priority', () => {
      // ハートのAは切り札でもマイティ（スペードA）ではないことを確認
      const heartsAce = createCard(
        `${SUIT_ENUM.HEARTS}-${CARD_RANKS.ACE}`,
        SUIT_ENUM.HEARTS,
        CARD_RANKS.ACE
      )
      const spadesAce = createCard(
        `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
        SUIT_ENUM.SPADES,
        CARD_RANKS.ACE
      )

      expect(isMighty(heartsAce)).toBe(false) // ハートAはマイティでない
      expect(isMighty(spadesAce)).toBe(true) // スペードAのみがマイティ

      // 強度確認
      expect(
        getCardStrength(heartsAce, SUIT_ENUM.HEARTS, SUIT_ENUM.CLUBS)
      ).toBe(714) // 700+14
      expect(
        getCardStrength(spadesAce, SUIT_ENUM.HEARTS, SUIT_ENUM.CLUBS)
      ).toBe(1000) // MIGHTY
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
