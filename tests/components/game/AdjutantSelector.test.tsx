import { fireEvent, render, screen } from '@testing-library/react'
import { AdjutantSelector } from '@/components/game/AdjutantSelector'
import { CARD_RANKS, createDeck, GAME_PHASES, SUIT_ENUM } from '@/lib/constants'
import type { Card, GameState, NapoleonDeclaration } from '@/types/game'

// Mock only createDeck, keep actual constants
jest.mock('@/lib/constants', () => ({
  ...jest.requireActual('@/lib/constants'),
  createDeck: jest.fn(),
}))

const mockCreateDeck = createDeck as jest.MockedFunction<typeof createDeck>

describe('AdjutantSelector', () => {
  const mockOnAdjutantSelect = jest.fn()

  const mockGameState: GameState = {
    id: 'test-game',
    players: [
      {
        id: 'napoleon-player',
        name: 'Napoleon Player',
        hand: [],
        isNapoleon: true,
        isAdjutant: false,
        position: 1,
        isAI: false,
      },
      {
        id: 'player-2',
        name: 'Player 2',
        hand: [],
        isNapoleon: false,
        isAdjutant: false,
        position: 2,
        isAI: false,
      },
      {
        id: 'player-3',
        name: 'Player 3',
        hand: [],
        isNapoleon: false,
        isAdjutant: false,
        position: 3,
        isAI: false,
      },
      {
        id: 'player-4',
        name: 'Player 4',
        hand: [],
        isNapoleon: false,
        isAdjutant: false,
        position: 4,
        isAI: false,
      },
    ],
    currentTrick: {
      id: 'trick-1',
      cards: [],
      completed: false,
    },
    tricks: [],
    currentPlayerIndex: 0,
    phase: GAME_PHASES.ADJUTANT,
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    napoleonDeclaration: {
      playerId: 'napoleon-player',
      targetTricks: 15,
      suit: SUIT_ENUM.SPADES,
    } as NapoleonDeclaration,
  }

  const mockDeck: Card[] = [
    // Mighty (Spades A)
    {
      id: `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
      suit: SUIT_ENUM.SPADES,
      rank: CARD_RANKS.ACE,
      value: 14,
    },
    // All Jacks
    {
      id: `${SUIT_ENUM.SPADES}-${CARD_RANKS.JACK}`,
      suit: SUIT_ENUM.SPADES,
      rank: CARD_RANKS.JACK,
      value: 11,
    },
    {
      id: `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
      suit: SUIT_ENUM.HEARTS,
      rank: CARD_RANKS.JACK,
      value: 11,
    },
    {
      id: `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.JACK}`,
      suit: SUIT_ENUM.DIAMONDS,
      rank: CARD_RANKS.JACK,
      value: 11,
    },
    {
      id: `${SUIT_ENUM.CLUBS}-${CARD_RANKS.JACK}`,
      suit: SUIT_ENUM.CLUBS,
      rank: CARD_RANKS.JACK,
      value: 11,
    },
    // All Aces
    {
      id: `${SUIT_ENUM.HEARTS}-${CARD_RANKS.ACE}`,
      suit: SUIT_ENUM.HEARTS,
      rank: CARD_RANKS.ACE,
      value: 14,
    },
    {
      id: `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.ACE}`,
      suit: SUIT_ENUM.DIAMONDS,
      rank: CARD_RANKS.ACE,
      value: 14,
    },
    {
      id: `${SUIT_ENUM.CLUBS}-${CARD_RANKS.ACE}`,
      suit: SUIT_ENUM.CLUBS,
      rank: CARD_RANKS.ACE,
      value: 14,
    },
    // Sample other cards
    {
      id: `${SUIT_ENUM.SPADES}-${CARD_RANKS.KING}`,
      suit: SUIT_ENUM.SPADES,
      rank: CARD_RANKS.KING,
      value: 13,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateDeck.mockReturnValue(mockDeck)
  })

  it('should render without crashing', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    expect(screen.getByText('Select Adjutant Card')).toBeInTheDocument()
    expect(
      screen.getByText('Napoleon Player, choose a card to find your adjutant!')
    ).toBeInTheDocument()
  })

  it('should display Napoleon declaration correctly', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    expect(screen.getByText('Your Napoleon Declaration')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getAllByText('♠ スペード')).toHaveLength(1) // Only appears in declaration
  })

  it('should show important cards by default', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    // Check that important cards are displayed
    expect(screen.getByText('Important Cards')).toBeInTheDocument()
    // The important cards are now displayed as card buttons, not text descriptions
  })

  it('should switch to all cards view when button is clicked', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    const allCardsButton = screen.getByText('All Cards')
    fireEvent.click(allCardsButton)

    // Check that the button changed to active state
    expect(allCardsButton).toHaveClass('bg-blue-600')
    // All cards are now displayed as card buttons without suit headings
  })

  it('should handle card selection', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    // Click the first important card (Spades A - Mighty)
    const spadesAceCard = screen.getByTestId('card-spades-A')
    fireEvent.click(spadesAceCard)

    // Should find selection text somewhere in the component
    expect(screen.getByText(/Selected Adjutant Card:/)).toBeInTheDocument()
  })

  it('should call onAdjutantSelect when confirm button is clicked', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    // Click the first important card (Spades A - Mighty) to select it
    const spadesAceCard = screen.getByTestId('card-spades-A')
    fireEvent.click(spadesAceCard)

    // Click confirm button
    const confirmButton = screen.getByText('✅ Confirm Adjutant Selection')
    fireEvent.click(confirmButton)

    expect(mockOnAdjutantSelect).toHaveBeenCalled()
  })

  it('should show error when Napoleon player not found', () => {
    const invalidGameState = {
      ...mockGameState,
      players: mockGameState.players.filter((p) => p.id !== 'napoleon-player'),
    }

    render(
      <AdjutantSelector
        gameState={invalidGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    expect(screen.getByText('Napoleon player not found')).toBeInTheDocument()
  })

  it('should show error when Napoleon declaration not found', () => {
    const gameStateWithoutDeclaration = {
      ...mockGameState,
      napoleonDeclaration: undefined,
    }

    render(
      <AdjutantSelector
        gameState={gameStateWithoutDeclaration}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    expect(
      screen.getByText('Napoleon declaration not found')
    ).toBeInTheDocument()
  })

  it('should not show confirm button when no card is selected', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    // Confirm button should not be visible when no card is selected
    expect(
      screen.queryByText(/Confirm Adjutant Selection/)
    ).not.toBeInTheDocument()
  })

  it('should handle different trump suits correctly', () => {
    const heartsGameState = {
      ...mockGameState,
      napoleonDeclaration: {
        ...(mockGameState.napoleonDeclaration || {}),
        playerId: 'napoleon-player',
        targetTricks: 15,
        suit: 'hearts' as const,
      },
    }

    render(
      <AdjutantSelector
        gameState={heartsGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    expect(screen.getAllByText('♥ ハート')).toHaveLength(1) // Only in declaration
  })
})
