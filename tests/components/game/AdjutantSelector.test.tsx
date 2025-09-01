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
    expect(screen.getAllByText('♠ スペード')).toHaveLength(2) // Appears in both declaration and card displays
  })

  it('should show important cards by default', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    expect(screen.getByText('🔥 Mighty (スペードのA)')).toBeInTheDocument()
    expect(
      screen.getByText('⚔️ Jacks (切り札と裏スートのJ)')
    ).toBeInTheDocument()
    expect(screen.getByText('👑 Aces (各スートのA)')).toBeInTheDocument()
  })

  it('should switch to all cards view when button is clicked', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    const allCardsButton = screen.getByText('All 52 Cards')
    fireEvent.click(allCardsButton)

    expect(screen.getByText('All 52 Cards:')).toBeInTheDocument()
    expect(screen.getAllByText('♠ スペード').length).toBeGreaterThan(1) // Declaration + card suit sections
    expect(screen.getByText('♥ ハート')).toBeInTheDocument()
  })

  it('should handle card selection', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    // Find and click any card button - there should be at least one important card displayed
    const buttons = screen.getAllByRole('button')
    const cardButtons = buttons.filter(
      (button) =>
        button.className.includes('bg-white') &&
        button.className.includes('border-2')
    )

    expect(cardButtons.length).toBeGreaterThan(0)

    // Click the first card
    fireEvent.click(cardButtons[0])

    // Should find selection text somewhere in the component
    expect(screen.getByText(/Selected adjutant card/)).toBeInTheDocument()
  })

  it('should call onAdjutantSelect when confirm button is clicked', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    // Find and click a card first
    const buttons = screen.getAllByRole('button')
    const cardButtons = buttons.filter(
      (button) =>
        button.className.includes('bg-white') &&
        button.className.includes('border-2')
    )

    expect(cardButtons.length).toBeGreaterThan(0)

    // Click the first card to select it
    fireEvent.click(cardButtons[0])

    // Click confirm button
    const confirmButton = screen.getByText('Confirm Adjutant Selection')
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

  it('should disable confirm button when no card is selected', () => {
    render(
      <AdjutantSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onAdjutantSelect={mockOnAdjutantSelect}
      />
    )

    const confirmButton = screen.getByText('Confirm Adjutant Selection')
    expect(confirmButton).toBeDisabled()
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

    expect(screen.getAllByText('♥ ハート')).toHaveLength(2) // Declaration and card sections
  })
})
