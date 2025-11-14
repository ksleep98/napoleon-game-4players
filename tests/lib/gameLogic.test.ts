import { CARD_RANKS, GAME_PHASES, SUIT_ENUM } from '@/lib/constants'
import {
  completeTrick,
  createNewTrick,
  declareNapoleon,
  determineWinner,
  exchangeCards,
  getCurrentPlayer,
  initializeAIGame,
  initializeGame,
  passNapoleonDeclaration,
  playCard,
  setAdjutant,
} from '@/lib/gameLogic'
import type { Card, GameState, NapoleonDeclaration, Trick } from '@/types/game'

describe('Game Logic', () => {
  let gameState: GameState

  beforeEach(() => {
    const playerNames = ['Player 1', 'Player 2', 'Player 3', 'Player 4']
    gameState = initializeGame(playerNames)
  })

  describe('initializeGame', () => {
    it('should initialize game with correct structure', () => {
      expect(gameState.players).toHaveLength(4)
      expect(gameState.hiddenCards).toHaveLength(4)
      expect(gameState.currentTrick).toHaveProperty('id')
      expect(gameState.currentTrick).toHaveProperty('cards')
      expect(gameState.currentTrick).toHaveProperty('completed', false)
      expect(gameState.tricks).toEqual([])
      expect(gameState.phase).toBe('napoleon')
      expect(gameState.currentPlayerIndex).toBe(0)
    })

    it('should deal 12 cards to each player', () => {
      gameState.players.forEach((player) => {
        expect(player.hand).toHaveLength(12)
      })
    })

    it('should assign sequential player IDs', () => {
      expect(gameState.players[0].id).toBe('player_1')
      expect(gameState.players[1].id).toBe('player_2')
      expect(gameState.players[2].id).toBe('player_3')
      expect(gameState.players[3].id).toBe('player_4')
    })
  })

  describe('getCurrentPlayer', () => {
    it('should return the current player', () => {
      const currentPlayer = getCurrentPlayer(gameState)
      expect(currentPlayer).toBe(gameState.players[0])
    })
  })

  describe('createNewTrick', () => {
    it('should create a new empty trick', () => {
      const trick = createNewTrick()
      expect(trick).toHaveProperty('id')
      expect(trick.cards).toEqual([])
      expect(trick.completed).toBe(false)
    })
  })

  // isCardStronger function removed - logic integrated into determineWinner

  describe('determineWinner', () => {
    it('should return null for empty trick', () => {
      const emptyTrick: Trick = {
        id: 'empty-trick',
        cards: [],
        completed: false,
      }

      const winner = determineWinner(emptyTrick)
      expect(winner).toBeNull()
    })
  })

  describe('Napoleon Declaration', () => {
    describe('passNapoleonDeclaration', () => {
      it('should add player to passed list', () => {
        const playerId = gameState.players[0].id

        const updatedState = passNapoleonDeclaration(gameState, playerId)

        expect(updatedState.passedPlayers).toContain(playerId)
        expect(updatedState.phase).toBe('napoleon') // Still in napoleon phase after one pass
      })

      it('should throw error if not in napoleon phase', () => {
        const gameStateInWrongPhase = {
          ...gameState,
          phase: GAME_PHASES.PLAYING,
        }
        const playerId = gameState.players[0].id

        expect(() => {
          passNapoleonDeclaration(gameStateInWrongPhase, playerId)
        }).toThrow('Cannot pass Napoleon declaration at this time')
      })

      it('should trigger redeal when all players pass', () => {
        // すべてのプレイヤーがパスした状態を作る
        let currentState = gameState
        for (let i = 0; i < 4; i++) {
          currentState = passNapoleonDeclaration(
            currentState,
            currentState.players[i].id
          )
        }

        expect(currentState.needsRedeal).toBe(true)
      })
    })

    describe('declareNapoleon', () => {
      it('should declare Napoleon with full declaration', () => {
        const declaration: NapoleonDeclaration = {
          playerId: gameState.players[0].id,
          targetTricks: 15,
          suit: SUIT_ENUM.SPADES,
          adjutantCard: gameState.players[0].hand[0],
        }

        const updatedState = declareNapoleon(gameState, declaration)

        expect(updatedState.players[0].isNapoleon).toBe(true)
        expect(updatedState.napoleonDeclaration).toEqual(declaration)
        expect(updatedState.napoleonCard).toBe(declaration.adjutantCard)
      })

      it('should clear previous Napoleon when new one is declared', () => {
        // First declaration
        const firstDeclaration: NapoleonDeclaration = {
          playerId: gameState.players[0].id,
          targetTricks: 15,
          suit: SUIT_ENUM.SPADES,
        }
        let updatedState = declareNapoleon(gameState, firstDeclaration)

        // Second declaration by different player
        const secondDeclaration: NapoleonDeclaration = {
          playerId: gameState.players[1].id,
          targetTricks: 16,
          suit: SUIT_ENUM.SPADES,
        }
        updatedState = declareNapoleon(updatedState, secondDeclaration)

        expect(updatedState.players[0].isNapoleon).toBe(false)
        expect(updatedState.players[1].isNapoleon).toBe(true)
        expect(updatedState.napoleonDeclaration).toEqual(secondDeclaration)
      })

      it('should throw error for invalid declaration', () => {
        const invalidDeclaration: NapoleonDeclaration = {
          playerId: gameState.players[0].id,
          targetTricks: 5, // Too low
          suit: SUIT_ENUM.SPADES,
        }

        expect(() => {
          declareNapoleon(gameState, invalidDeclaration)
        }).toThrow('Invalid Napoleon declaration')
      })
    })
  })

  describe('AI Game Initialization', () => {
    it('should initialize AI game with human player and 3 AI players', () => {
      const aiGameState = initializeAIGame('Human Player')

      expect(aiGameState.players).toHaveLength(4)
      expect(aiGameState.players[0].name).toBe('Human Player')
      expect(aiGameState.players[0].isAI).toBe(false)
      expect(aiGameState.players[1].isAI).toBe(true)
      expect(aiGameState.players[2].isAI).toBe(true)
      expect(aiGameState.players[3].isAI).toBe(true)
      expect(aiGameState.phase).toBe('napoleon')
    })
  })

  describe('Adjutant Phase', () => {
    describe('setAdjutant', () => {
      it('should set adjutant and add hidden cards to Napoleon', () => {
        // First declare Napoleon
        const declaration = {
          playerId: gameState.players[0].id,
          targetTricks: 13,
          suit: SUIT_ENUM.SPADES,
          adjutantCard: gameState.players[0].hand[0],
        }
        const napoleonState = declareNapoleon(gameState, declaration)

        // Mock hidden cards
        const hiddenCards: Card[] = [
          {
            id: 'hidden-1',
            suit: SUIT_ENUM.HEARTS,
            rank: CARD_RANKS.ACE,
            value: 14,
          },
          {
            id: 'hidden-2',
            suit: SUIT_ENUM.DIAMONDS,
            rank: CARD_RANKS.KING,
            value: 13,
          },
          {
            id: 'hidden-3',
            suit: SUIT_ENUM.CLUBS,
            rank: CARD_RANKS.QUEEN,
            value: 12,
          },
          {
            id: 'hidden-4',
            suit: SUIT_ENUM.SPADES,
            rank: CARD_RANKS.JACK,
            value: 11,
          },
        ]

        const stateWithHidden = {
          ...napoleonState,
          phase: GAME_PHASES.ADJUTANT,
          hiddenCards,
        }

        const adjutantCard = hiddenCards[0] // Card not in any player's hand
        const updatedState = setAdjutant(stateWithHidden, adjutantCard)

        expect(updatedState.phase).toBe('card_exchange')
        expect(updatedState.napoleonCard).toBe(adjutantCard)

        // Napoleon should now have 16 cards (12 original + 4 hidden)
        const napoleonPlayer = updatedState.players.find((p) => p.isNapoleon)
        expect(napoleonPlayer?.hand).toHaveLength(16)

        // Hidden cards should have wasHidden flag
        const hiddenCardsInHand = napoleonPlayer?.hand.filter(
          (card) => card.wasHidden
        )
        expect(hiddenCardsInHand).toHaveLength(4)
      })

      it('should find adjutant if card is in player hand', () => {
        const declaration = {
          playerId: gameState.players[0].id,
          targetTricks: 13,
          suit: SUIT_ENUM.SPADES,
          adjutantCard: gameState.players[0].hand[0],
        }
        const napoleonState = declareNapoleon(gameState, declaration)
        const stateWithAdjutant = {
          ...napoleonState,
          phase: GAME_PHASES.ADJUTANT,
        }

        const adjutantCard = gameState.players[1].hand[0] // Card in player 2's hand
        const updatedState = setAdjutant(stateWithAdjutant, adjutantCard)

        expect(updatedState.players[1].isAdjutant).toBe(true)
        expect(updatedState.players[0].isAdjutant).toBe(false)
      })

      it('should throw error if not in adjutant phase', () => {
        const adjutantCard = gameState.players[1].hand[0]

        expect(() => {
          setAdjutant(gameState, adjutantCard)
        }).toThrow('Adjutant can only be set during adjutant phase')
      })
    })
  })

  describe('Card Exchange Phase', () => {
    describe('exchangeCards', () => {
      it('should exchange cards and reduce Napoleon hand to 12', () => {
        // Setup: Declare Napoleon with full declaration
        const declaration: NapoleonDeclaration = {
          playerId: gameState.players[0].id,
          targetTricks: 15,
          suit: SUIT_ENUM.SPADES,
        }

        const napoleonState = declareNapoleon(gameState, declaration)
        const hiddenCards: Card[] = [
          {
            id: 'hidden-1',
            suit: SUIT_ENUM.HEARTS,
            rank: CARD_RANKS.ACE,
            value: 14,
          },
          {
            id: 'hidden-2',
            suit: SUIT_ENUM.DIAMONDS,
            rank: CARD_RANKS.KING,
            value: 13,
          },
          {
            id: 'hidden-3',
            suit: SUIT_ENUM.CLUBS,
            rank: CARD_RANKS.QUEEN,
            value: 12,
          },
          {
            id: 'hidden-4',
            suit: SUIT_ENUM.SPADES,
            rank: CARD_RANKS.JACK,
            value: 11,
          },
        ]

        const adjutantState = {
          ...napoleonState,
          phase: GAME_PHASES.ADJUTANT,
          hiddenCards,
        }

        const afterAdjutant = setAdjutant(adjutantState, hiddenCards[0])

        // Napoleon should now have 16 cards
        const napoleonPlayer = afterAdjutant.players.find((p) => p.isNapoleon)
        expect(napoleonPlayer).toBeDefined()
        expect(napoleonPlayer?.hand).toHaveLength(16)

        // Exchange 4 cards
        const cardsToDiscard = napoleonPlayer?.hand.slice(0, 4) || []
        const updatedState = exchangeCards(
          afterAdjutant,
          napoleonPlayer?.id || '',
          cardsToDiscard
        )

        expect(updatedState.phase).toBe('playing')
        expect(updatedState.exchangedCards).toEqual(cardsToDiscard)

        // Napoleon should now have 12 cards
        const finalNapoleonPlayer = updatedState.players.find(
          (p) => p.isNapoleon
        )
        expect(finalNapoleonPlayer).toBeDefined()
        expect(finalNapoleonPlayer?.hand).toHaveLength(12)

        // Discarded cards should not be in hand
        for (const discardedCard of cardsToDiscard) {
          expect(
            finalNapoleonPlayer?.hand.find(
              (card) => card.id === discardedCard.id
            )
          ).toBeUndefined()
        }
      })

      it('should throw error if not exactly 4 cards discarded', () => {
        const declaration: NapoleonDeclaration = {
          playerId: gameState.players[0].id,
          targetTricks: 15,
          suit: SUIT_ENUM.SPADES,
        }

        const napoleonState = declareNapoleon(gameState, declaration)
        const stateWithExchange = {
          ...napoleonState,
          phase: GAME_PHASES.EXCHANGE,
        }

        const tooFewCards = [gameState.players[0].hand[0]]
        const tooManyCards = gameState.players[0].hand.slice(0, 5)

        expect(() => {
          exchangeCards(stateWithExchange, gameState.players[0].id, tooFewCards)
        }).toThrow('Must discard exactly 4 cards')

        expect(() => {
          exchangeCards(
            stateWithExchange,
            gameState.players[0].id,
            tooManyCards
          )
        }).toThrow('Must discard exactly 4 cards')
      })

      it('should throw error if not in card exchange phase', () => {
        const cardsToDiscard = gameState.players[0].hand.slice(0, 4)

        expect(() => {
          exchangeCards(gameState, gameState.players[0].id, cardsToDiscard)
        }).toThrow('Card exchange can only be done during card exchange phase')
      })

      it('should throw error if non-Napoleon tries to exchange', () => {
        const declaration: NapoleonDeclaration = {
          playerId: gameState.players[0].id,
          targetTricks: 15,
          suit: SUIT_ENUM.SPADES,
        }

        const stateWithExchange = {
          ...gameState,
          phase: GAME_PHASES.EXCHANGE,
          napoleonDeclaration: declaration,
        }

        const cardsToDiscard = gameState.players[1].hand.slice(0, 4)

        expect(() => {
          exchangeCards(
            stateWithExchange,
            gameState.players[1].id,
            cardsToDiscard
          )
        }).toThrow('Only Napoleon can exchange cards')
      })
    })
  })

  describe('Early Game Termination', () => {
    /**
     * Helper function to create a game state in playing phase with specified face cards distribution
     */
    function createPlayingGameState(
      napoleonFaceCards: number,
      completedTricks: number
    ): GameState {
      // Setup Napoleon declaration
      const declaration: NapoleonDeclaration = {
        playerId: gameState.players[0].id,
        targetTricks: 15, // Default target
        suit: SUIT_ENUM.SPADES,
        adjutantCard: gameState.players[1].hand[0],
      }

      const stateWithNapoleon = declareNapoleon(gameState, declaration)

      // Mock completed tricks
      let remainingFaceCards = napoleonFaceCards
      const tricks = Array.from({ length: completedTricks }, (_, index) => {
        // Each trick has 4 cards, distribute face cards accordingly
        const faceCardsThisTrick = Math.min(remainingFaceCards, 4)
        const cards = []

        for (let i = 0; i < 4; i++) {
          const isFaceCard = i < faceCardsThisTrick
          cards.push({
            card: {
              id: `card-${index}-${i}`,
              suit: SUIT_ENUM.HEARTS,
              rank: isFaceCard ? CARD_RANKS.ACE : CARD_RANKS.TWO,
              value: isFaceCard ? 14 : 2,
            },
            playerId: gameState.players[i].id,
            order: i,
          })
        }

        remainingFaceCards -= faceCardsThisTrick

        return {
          id: `trick-${index}`,
          cards,
          completed: true,
          winnerPlayerId: stateWithNapoleon.players[0].id, // Napoleon wins
        }
      })

      return {
        ...stateWithNapoleon,
        phase: GAME_PHASES.PLAYING,
        tricks,
        players: stateWithNapoleon.players.map((p, i) => ({
          ...p,
          isNapoleon: i === 0,
          isAdjutant: i === 1,
        })),
      }
    }

    it('should end game early when Napoleon reaches target face cards', () => {
      // Napoleon needs 15 face cards, has already won 12 from 3 tricks
      // The 4th trick will give Napoleon 3 more face cards, reaching 15 total
      const playingState = createPlayingGameState(12, 3)

      // Create a current trick with 3 face cards (ACE, KING, QUEEN) + 1 non-face card
      // Napoleon wins this trick, gaining 3 more face cards (12 + 3 = 15 total)
      const currentTrick: Trick = {
        id: 'current-trick',
        cards: [
          {
            card: {
              id: 'card-1',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.ACE,
              value: 14,
            },
            playerId: playingState.players[0].id,
            order: 0,
          },
          {
            card: {
              id: 'card-2',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.KING,
              value: 13,
            },
            playerId: playingState.players[1].id,
            order: 1,
          },
          {
            card: {
              id: 'card-3',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.QUEEN,
              value: 12,
            },
            playerId: playingState.players[2].id,
            order: 2,
          },
          {
            card: {
              id: 'card-4',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.THREE,
              value: 3,
            },
            playerId: playingState.players[3].id,
            order: 3,
          },
        ],
        completed: false,
        leadingSuit: SUIT_ENUM.HEARTS,
      }

      const stateWithTrick = {
        ...playingState,
        currentTrick,
        trumpSuit: SUIT_ENUM.SPADES,
      }

      const result = completeTrick(stateWithTrick)

      // Game should end in FINISHED phase
      expect(result.phase).toBe(GAME_PHASES.FINISHED)
      expect(result.tricks.length).toBe(4) // 3 previous + 1 current
      expect(result.showingTrickResult).toBe(true)
    })

    it('should end game early when Napoleon cannot possibly win', () => {
      // Napoleon needs 15 face cards, but has 0 and only 2 tricks remaining
      // Maximum possible: 0 + (2 * 5) = 10 face cards < 15 required
      const playingState = createPlayingGameState(0, 10)

      // Create a current trick
      const currentTrick: Trick = {
        id: 'current-trick',
        cards: [
          {
            card: {
              id: 'card-1',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.TWO,
              value: 2,
            },
            playerId: playingState.players[2].id, // Alliance wins
            order: 0,
          },
          {
            card: {
              id: 'card-2',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.THREE,
              value: 3,
            },
            playerId: playingState.players[1].id,
            order: 1,
          },
          {
            card: {
              id: 'card-3',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.FOUR,
              value: 4,
            },
            playerId: playingState.players[2].id,
            order: 2,
          },
          {
            card: {
              id: 'card-4',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.FIVE,
              value: 5,
            },
            playerId: playingState.players[3].id,
            order: 3,
          },
        ],
        completed: false,
        leadingSuit: SUIT_ENUM.HEARTS,
      }

      const stateWithTrick = {
        ...playingState,
        currentTrick,
        trumpSuit: SUIT_ENUM.SPADES,
      }

      const result = completeTrick(stateWithTrick)

      // Game should end in FINISHED phase because Napoleon cannot win
      expect(result.phase).toBe(GAME_PHASES.FINISHED)
      expect(result.tricks.length).toBe(11) // 10 previous + 1 current
    })

    it('should continue game when outcome is not yet decided', () => {
      // Napoleon needs 15 face cards, has 10, with 3 tricks remaining
      // Maximum possible: 10 + (3 * 5) = 25 face cards >= 15 required
      // Minimum possible with alliance winning all: 10 face cards < 15 required
      // Outcome is not decided yet
      const playingState = createPlayingGameState(10, 8)

      const currentTrick: Trick = {
        id: 'current-trick',
        cards: [
          {
            card: {
              id: 'card-1',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.KING,
              value: 13,
            },
            playerId: playingState.players[0].id,
            order: 0,
          },
          {
            card: {
              id: 'card-2',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.THREE,
              value: 3,
            },
            playerId: playingState.players[1].id,
            order: 1,
          },
          {
            card: {
              id: 'card-3',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.FOUR,
              value: 4,
            },
            playerId: playingState.players[2].id,
            order: 2,
          },
          {
            card: {
              id: 'card-4',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.FIVE,
              value: 5,
            },
            playerId: playingState.players[3].id,
            order: 3,
          },
        ],
        completed: false,
        leadingSuit: SUIT_ENUM.HEARTS,
      }

      const stateWithTrick = {
        ...playingState,
        currentTrick,
        trumpSuit: SUIT_ENUM.SPADES,
      }

      const result = completeTrick(stateWithTrick)

      // Game should continue in PLAYING phase
      expect(result.phase).toBe(GAME_PHASES.PLAYING)
      expect(result.tricks.length).toBe(9) // 8 previous + 1 current
      expect(result.currentTrick.cards).toHaveLength(0) // New trick started
    })

    it('should still end at 12 tricks even without early termination', () => {
      // Napoleon needs 15 face cards, has 14, at trick 11
      // Game could end early on trick 12, but we test the 12-trick end condition
      const playingState = createPlayingGameState(14, 11)

      const currentTrick: Trick = {
        id: 'current-trick',
        cards: [
          {
            card: {
              id: 'card-1',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.TWO,
              value: 2,
            },
            playerId: playingState.players[0].id,
            order: 0,
          },
          {
            card: {
              id: 'card-2',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.THREE,
              value: 3,
            },
            playerId: playingState.players[1].id,
            order: 1,
          },
          {
            card: {
              id: 'card-3',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.FOUR,
              value: 4,
            },
            playerId: playingState.players[2].id,
            order: 2,
          },
          {
            card: {
              id: 'card-4',
              suit: SUIT_ENUM.HEARTS,
              rank: CARD_RANKS.FIVE,
              value: 5,
            },
            playerId: playingState.players[3].id,
            order: 3,
          },
        ],
        completed: false,
        leadingSuit: SUIT_ENUM.HEARTS,
      }

      const stateWithTrick = {
        ...playingState,
        currentTrick,
        trumpSuit: SUIT_ENUM.SPADES,
      }

      const result = completeTrick(stateWithTrick)

      // Game should end because it's the 12th trick
      expect(result.phase).toBe(GAME_PHASES.FINISHED)
      expect(result.tricks.length).toBe(12)
    })
  })
})
