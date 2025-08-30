import {
  createNewPhase,
  declareNapoleon,
  declareNapoleonWithDeclaration,
  determineWinner,
  exchangeCards,
  getCurrentPlayer,
  initializeAIGame,
  initializeGame,
  passNapoleonDeclaration,
  setAdjutant,
} from '@/lib/gameLogic'
import type { Card, GameState, NapoleonDeclaration, Phase } from '@/types/game'

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
      expect(gameState.currentPhase).toHaveProperty('id')
      expect(gameState.currentPhase).toHaveProperty('cards')
      expect(gameState.currentPhase).toHaveProperty('completed', false)
      expect(gameState.phases).toEqual([])
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

  describe('createNewPhase', () => {
    it('should create a new empty phase', () => {
      const phase = createNewPhase()
      expect(phase).toHaveProperty('id')
      expect(phase.cards).toEqual([])
      expect(phase.completed).toBe(false)
    })
  })

  // isCardStronger function removed - logic integrated into determineWinner

  describe('determineWinner', () => {
    it('should determine winner of a complete phase', () => {
      const phase: Phase = {
        id: 'test-phase',
        cards: [
          {
            card: {
              id: 'hearts-7',
              suit: 'hearts' as const,
              rank: '7' as const,
              value: 7,
            },
            playerId: 'p1',
            order: 1,
          },
          {
            card: {
              id: 'hearts-K',
              suit: 'hearts' as const,
              rank: 'K' as const,
              value: 13,
            },
            playerId: 'p2',
            order: 2,
          },
          {
            card: {
              id: 'hearts-5',
              suit: 'hearts' as const,
              rank: '5' as const,
              value: 5,
            },
            playerId: 'p3',
            order: 3,
          },
          {
            card: {
              id: 'hearts-A',
              suit: 'hearts' as const,
              rank: 'A' as const,
              value: 14,
            },
            playerId: 'p4',
            order: 4,
          },
        ],
        completed: false,
        leadingSuit: 'hearts',
      }

      const winner = determineWinner(phase)
      expect(winner).not.toBeNull()
      expect(winner?.playerId).toBe('p4') // Player with Ace of Hearts should win
    })

    it('should return null for empty phase', () => {
      const emptyPhase: Phase = {
        id: 'empty-phase',
        cards: [],
        completed: false,
      }

      const winner = determineWinner(emptyPhase)
      expect(winner).toBeNull()
    })
  })

  describe('Napoleon Declaration', () => {
    describe('declareNapoleon', () => {
      it('should set player as Napoleon and move to adjutant phase', () => {
        const playerId = gameState.players[0].id
        const selectedCard = gameState.players[0].hand[0]

        const updatedState = declareNapoleon(gameState, playerId, selectedCard)

        expect(updatedState.phase).toBe('adjutant')
        expect(updatedState.players[0].isNapoleon).toBe(true)
        expect(updatedState.players[1].isNapoleon).toBe(false)
        expect(updatedState.players[2].isNapoleon).toBe(false)
        expect(updatedState.players[3].isNapoleon).toBe(false)
        expect(updatedState.napoleonCard).toBe(selectedCard)
        expect(updatedState.currentPlayerIndex).toBe(0) // Napoleon becomes current player
      })

      it('should throw error if not in napoleon phase', () => {
        const gameStateInWrongPhase = {
          ...gameState,
          phase: 'playing' as const,
        }
        const playerId = gameState.players[0].id

        expect(() => {
          declareNapoleon(gameStateInWrongPhase, playerId)
        }).toThrow('Napoleon can only be declared during napoleon phase')
      })

      it('should work without selecting a card', () => {
        const playerId = gameState.players[0].id

        const updatedState = declareNapoleon(gameState, playerId)

        expect(updatedState.phase).toBe('adjutant')
        expect(updatedState.players[0].isNapoleon).toBe(true)
        expect(updatedState.napoleonCard).toBeUndefined()
      })
    })

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
          phase: 'playing' as const,
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

    describe('declareNapoleonWithDeclaration', () => {
      it('should declare Napoleon with full declaration', () => {
        const declaration: NapoleonDeclaration = {
          playerId: gameState.players[0].id,
          targetTricks: 15,
          suit: 'spades',
          adjutantCard: gameState.players[0].hand[0],
        }

        const updatedState = declareNapoleonWithDeclaration(
          gameState,
          declaration
        )

        expect(updatedState.players[0].isNapoleon).toBe(true)
        expect(updatedState.napoleonDeclaration).toEqual(declaration)
        expect(updatedState.napoleonCard).toBe(declaration.adjutantCard)
      })

      it('should clear previous Napoleon when new one is declared', () => {
        // First declaration
        const firstDeclaration: NapoleonDeclaration = {
          playerId: gameState.players[0].id,
          targetTricks: 15,
          suit: 'spades',
        }
        let updatedState = declareNapoleonWithDeclaration(
          gameState,
          firstDeclaration
        )

        // Second declaration by different player
        const secondDeclaration: NapoleonDeclaration = {
          playerId: gameState.players[1].id,
          targetTricks: 16,
          suit: 'spades',
        }
        updatedState = declareNapoleonWithDeclaration(
          updatedState,
          secondDeclaration
        )

        expect(updatedState.players[0].isNapoleon).toBe(false)
        expect(updatedState.players[1].isNapoleon).toBe(true)
        expect(updatedState.napoleonDeclaration).toEqual(secondDeclaration)
      })

      it('should throw error for invalid declaration', () => {
        const invalidDeclaration: NapoleonDeclaration = {
          playerId: gameState.players[0].id,
          targetTricks: 5, // Too low
          suit: 'spades',
        }

        expect(() => {
          declareNapoleonWithDeclaration(gameState, invalidDeclaration)
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
        const napoleonState = declareNapoleon(
          gameState,
          gameState.players[0].id
        )

        // Mock hidden cards
        const hiddenCards: Card[] = [
          { id: 'hidden-1', suit: 'hearts', rank: 'A', value: 14 },
          { id: 'hidden-2', suit: 'diamonds', rank: 'K', value: 13 },
          { id: 'hidden-3', suit: 'clubs', rank: 'Q', value: 12 },
          { id: 'hidden-4', suit: 'spades', rank: 'J', value: 11 },
        ]

        const stateWithHidden = {
          ...napoleonState,
          phase: 'adjutant' as const,
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
        const napoleonState = declareNapoleon(
          gameState,
          gameState.players[0].id
        )
        const stateWithAdjutant = {
          ...napoleonState,
          phase: 'adjutant' as const,
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
          suit: 'spades',
        }

        const napoleonState = declareNapoleonWithDeclaration(
          gameState,
          declaration
        )
        const hiddenCards: Card[] = [
          { id: 'hidden-1', suit: 'hearts', rank: 'A', value: 14 },
          { id: 'hidden-2', suit: 'diamonds', rank: 'K', value: 13 },
          { id: 'hidden-3', suit: 'clubs', rank: 'Q', value: 12 },
          { id: 'hidden-4', suit: 'spades', rank: 'J', value: 11 },
        ]

        const adjutantState = {
          ...napoleonState,
          phase: 'adjutant' as const,
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
          suit: 'spades',
        }

        const napoleonState = declareNapoleonWithDeclaration(
          gameState,
          declaration
        )
        const stateWithExchange = {
          ...napoleonState,
          phase: 'card_exchange' as const,
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
          suit: 'spades',
        }

        const stateWithExchange = {
          ...gameState,
          phase: 'card_exchange' as const,
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
})
