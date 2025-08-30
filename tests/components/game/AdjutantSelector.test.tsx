import { fireEvent, render, screen } from '@testing-library/react'
import { AdjutantSelector } from '@/components/game/AdjutantSelector'
import { createDeck } from '@/lib/constants'
import type { GameState, NapoleonDeclaration } from '@/types/game'

// Mock the createDeck function
jest.mock('@/lib/constants', () => ({
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
    currentPhase: {
      id: 'phase-1',
      cards: [],
      completed: false,
    },
    phases: [],
    currentPlayerIndex: 0,
    phase: 'adjutant',
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    napoleonDeclaration: {
      playerId: 'napoleon-player',
      targetTricks: 15,
      suit: 'spades',
    } as NapoleonDeclaration,
  }

  const mockDeck = [
    // Mighty (Spades A)
    {
      id: 'spades-A',
      suit: 'spades' as const,
      rank: 'A' as const,
      value: 14,
    },
    // All Jacks
    {
      id: 'spades-J',
      suit: 'spades' as const,
      rank: 'J' as const,
      value: 11,
    },
    {
      id: 'hearts-J',
      suit: 'hearts' as const,
      rank: 'J' as const,
      value: 11,
    },
    {
      id: 'diamonds-J',
      suit: 'diamonds' as const,
      rank: 'J' as const,
      value: 11,
    },
    {
      id: 'clubs-J',
      suit: 'clubs' as const,
      rank: 'J' as const,
      value: 11,
    },
    // All Aces
    {
      id: 'hearts-A',
      suit: 'hearts' as const,
      rank: 'A' as const,
      value: 14,
    },
    {
      id: 'diamonds-A',
      suit: 'diamonds' as const,
      rank: 'A' as const,
      value: 14,
    },
    {
      id: 'clubs-A',
      suit: 'clubs' as const,
      rank: 'A' as const,
      value: 14,
    },
    // Sample other cards
    {
      id: 'spades-K',
      suit: 'spades' as const,
      rank: 'K' as const,
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
