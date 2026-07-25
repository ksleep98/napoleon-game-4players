import { createDeck, GAME_PHASES } from '@/lib/constants'
import { initializeGame, playCard } from '@/lib/gameLogic'
import type { Card, GameState } from '@/types/game'

// Test specifically for the new adjutant reveal functionality
describe('Adjutant Card Reveal Feature', () => {
  let gameState: GameState
  let testDeck: Card[]

  beforeEach(() => {
    testDeck = createDeck()
    gameState = initializeGame(['Player1', 'Player2', 'Player3', 'Player4'])

    // Set up a controlled game state for testing
    // Player 1 becomes Napoleon
    gameState.players[0].isNapoleon = true

    const adjutantCard = testDeck.find(
      (card) => card.suit === 'hearts' && card.rank === 'J'
    )
    expect(adjutantCard).toBeDefined()

    // Get actual Napoleon player ID
    const napoleon = gameState.players.find((p) => p.isNapoleon)
    expect(napoleon).toBeDefined()

    if (!napoleon) {
      throw new Error('Napoleon player not found')
    }

    // initializeGame はデッキをシャッフルして配るため、その手札に testDeck の
    // カードを継ぎ足すと同じ id のカードが手札に 2 枚並びうる。playCard は id で
    // カードを探すので、wasHidden の付いていない方を掴むとテストが間欠的に落ちる。
    // 配札そのものを testDeck の重複しないスライスで決定的に置き換える。
    const deckWithoutAdjutant = testDeck.filter(
      (card) => card.id !== adjutantCard?.id
    )
    gameState.players.forEach((player, index) => {
      player.hand = deckWithoutAdjutant.slice(index * 12, index * 12 + 12)
    })

    gameState.napoleonDeclaration = {
      playerId: napoleon.id,
      targetTricks: 13,
      suit: 'spades',
      adjutantCard: adjutantCard as Card,
    }

    // Put the adjutant card in hidden cards to simulate the scenario.
    // 残り 3 枚は誰の手札にも配られていない末尾から取る。
    gameState.hiddenCards = [
      adjutantCard as Card,
      ...deckWithoutAdjutant.slice(48, 51),
    ]

    // Add hidden cards to Napoleon's hand (simulating the exchange phase)
    napoleon.hand = [
      ...napoleon.hand.slice(0, 8), // Keep some original cards
      ...gameState.hiddenCards.map((card) => ({ ...card, wasHidden: true })),
    ]

    // Set to playing phase
    gameState.phase = GAME_PHASES.PLAYING
    gameState.currentPlayerIndex = 0 // Napoleon starts
  })

  test('should set revealsAdjutant flag when Napoleon plays adjutant card from hidden cards', () => {
    const napoleon = gameState.players.find((p) => p.isNapoleon)
    expect(napoleon).toBeDefined()

    // Find the adjutant card in Napoleon's hand - should have wasHidden flag
    const adjutantCard = napoleon?.hand.find(
      (card) =>
        card.wasHidden &&
        gameState.napoleonDeclaration?.adjutantCard &&
        card.suit === gameState.napoleonDeclaration.adjutantCard.suit &&
        card.rank === gameState.napoleonDeclaration.adjutantCard.rank
    )
    expect(adjutantCard).toBeDefined()

    if (napoleon && adjutantCard) {
      // Napoleon plays the adjutant card that was in hidden cards
      const updatedGameState = playCard(gameState, napoleon.id, adjutantCard.id)

      // Check that the played card has the revealsAdjutant flag
      const playedCard = updatedGameState.currentTrick.cards[0]
      expect(playedCard.revealsAdjutant).toBe(true)
      expect(playedCard.playerId).toBe(napoleon.id)
      expect(playedCard.card.id).toBe(adjutantCard.id)
    }
  })

  test('should NOT set revealsAdjutant flag when Napoleon plays regular card', () => {
    const napoleon = gameState.players.find((p) => p.isNapoleon)
    expect(napoleon).toBeDefined()

    const regularCard = napoleon?.hand.find((card) => !card.wasHidden)
    expect(regularCard).toBeDefined()

    if (napoleon && regularCard) {
      // Napoleon plays a regular card (not the adjutant card)
      const updatedGameState = playCard(gameState, napoleon.id, regularCard.id)

      // Check that the played card does NOT have the revealsAdjutant flag
      const playedCard = updatedGameState.currentTrick.cards[0]
      expect(playedCard.revealsAdjutant).toBeUndefined()
      expect(playedCard.playerId).toBe(napoleon.id)
      expect(playedCard.card.id).toBe(regularCard.id)
    }
  })

  test('should NOT set revealsAdjutant flag when non-Napoleon player plays adjutant card', () => {
    // Set up scenario where a non-Napoleon player has the adjutant card
    gameState.currentPlayerIndex = 1 // Player 2's turn
    const player2 = gameState.players[1]

    const declaredAdjutantCard = gameState.napoleonDeclaration?.adjutantCard
    expect(declaredAdjutantCard).toBeDefined()

    // Give player2 the adjutant card (simulate different scenario)
    if (declaredAdjutantCard) {
      const adjutantCard = {
        ...declaredAdjutantCard,
        wasHidden: true,
      }
      player2.hand = [...player2.hand, adjutantCard]

      // Player 2 plays the adjutant card
      const updatedGameState = playCard(gameState, player2.id, adjutantCard.id)

      // Check that the played card does NOT have the revealsAdjutant flag
      // (only Napoleon playing the adjutant card from hidden cards should trigger this)
      const playedCard = updatedGameState.currentTrick.cards[0]
      expect(playedCard.revealsAdjutant).toBeUndefined()
      expect(playedCard.playerId).toBe(player2.id)
    }
  })

  test('should NOT set revealsAdjutant flag when Napoleon plays adjutant card that was not hidden', () => {
    // Create a new game state without the hidden cards setup
    const cleanGameState = initializeGame([
      'Player1',
      'Player2',
      'Player3',
      'Player4',
    ])
    cleanGameState.players[0].isNapoleon = true

    const testAdjutantCard = testDeck.find(
      (card) => card.suit === 'hearts' && card.rank === 'J'
    )
    expect(testAdjutantCard).toBeDefined()

    if (testAdjutantCard) {
      // Get actual Napoleon player ID for clean game state
      const napoleonClean = cleanGameState.players.find((p) => p.isNapoleon)
      expect(napoleonClean).toBeDefined()

      if (napoleonClean) {
        cleanGameState.napoleonDeclaration = {
          playerId: napoleonClean.id,
          targetTricks: 13,
          suit: 'spades',
          adjutantCard: testAdjutantCard,
        }

        // Give Napoleon the adjutant card in original hand (no wasHidden flag).
        // beforeEach と同様に、配札を testDeck の決定的なスライスへ置き換えて
        // 副官カードの id が手札に重複しないようにする。
        const adjutantCardNotHidden = { ...testAdjutantCard }

        napoleonClean.hand = [
          ...testDeck
            .filter((card) => card.id !== testAdjutantCard.id)
            .slice(0, 8),
          adjutantCardNotHidden,
        ]

        // Set to playing phase
        cleanGameState.phase = GAME_PHASES.PLAYING
        cleanGameState.currentPlayerIndex = 0

        // Napoleon plays the adjutant card that was NOT in hidden cards
        const updatedGameState = playCard(
          cleanGameState,
          napoleonClean.id,
          adjutantCardNotHidden.id
        )

        // Check that the played card does NOT have the revealsAdjutant flag
        const playedCard = updatedGameState.currentTrick.cards[0]
        expect(playedCard.revealsAdjutant).toBeUndefined()
        expect(playedCard.playerId).toBe(napoleonClean.id)
      }
    }
  })
})
