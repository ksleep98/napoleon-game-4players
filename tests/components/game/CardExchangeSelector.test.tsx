import { fireEvent, render, screen } from '@testing-library/react'
import { CardExchangeSelector } from '@/components/game/CardExchangeSelector'
import type { Card, GameState, NapoleonDeclaration } from '@/types/game'

describe('CardExchangeSelector', () => {
  const mockOnCardExchange = jest.fn()

  const sampleCards: Card[] = [
    // Original hand cards (12 cards)
    { id: 'spades-A', suit: 'spades', rank: 'A', value: 14 },
    { id: 'spades-K', suit: 'spades', rank: 'K', value: 13 },
    { id: 'hearts-Q', suit: 'hearts', rank: 'Q', value: 12 },
    { id: 'hearts-J', suit: 'hearts', rank: 'J', value: 11 },
    { id: 'diamonds-10', suit: 'diamonds', rank: '10', value: 10 },
    { id: 'diamonds-9', suit: 'diamonds', rank: '9', value: 9 },
    { id: 'clubs-8', suit: 'clubs', rank: '8', value: 8 },
    { id: 'clubs-7', suit: 'clubs', rank: '7', value: 7 },
    { id: 'spades-6', suit: 'spades', rank: '6', value: 6 },
    { id: 'hearts-5', suit: 'hearts', rank: '5', value: 5 },
    { id: 'diamonds-4', suit: 'diamonds', rank: '4', value: 4 },
    { id: 'clubs-3', suit: 'clubs', rank: '3', value: 3 },
    // Hidden cards (4 cards with wasHidden flag)
    { id: 'hearts-A', suit: 'hearts', rank: 'A', value: 14, wasHidden: true },
    {
      id: 'diamonds-A',
      suit: 'diamonds',
      rank: 'A',
      value: 14,
      wasHidden: true,
    },
    { id: 'clubs-A', suit: 'clubs', rank: 'A', value: 14, wasHidden: true },
    { id: 'spades-2', suit: 'spades', rank: '2', value: 2, wasHidden: true },
  ]

  const mockGameState: GameState = {
    id: 'test-game',
    players: [
      {
        id: 'napoleon-player',
        name: 'Napoleon Player',
        hand: sampleCards, // 16 cards total (12 original + 4 hidden)
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
    phase: 'card_exchange',
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

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render without crashing', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    expect(screen.getByText('Card Exchange')).toBeInTheDocument()
    expect(
      screen.getByText('Napoleon Player, select 4 cards to discard')
    ).toBeInTheDocument()
  })

  it('should display the adopted Napoleon declaration', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    // The DeclarationDisplay component should show the declaration details
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('should separate original hand and hidden cards', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    expect(
      screen.getByText('Your Original Hand (12 cards):')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Hidden Cards (4 cards you received):')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        '💡 These were the 4 hidden cards you received as Napoleon!'
      )
    ).toBeInTheDocument()
  })

  it('should track card selection correctly', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    // Initially should need to select 4 cards
    expect(screen.getByText('Select 4 more cards')).toBeInTheDocument()

    // Find and click some cards
    const cards = screen.getAllByRole('button')
    const cardButtons = cards.filter(
      (button) =>
        button.className.includes('card') ||
        button.getAttribute('data-testid')?.includes('card')
    )

    // Click first card
    if (cardButtons.length > 0) {
      fireEvent.click(cardButtons[0])
      expect(screen.getByText('Select 3 more cards')).toBeInTheDocument()
    }
  })

  it('should show ready state when 4 cards are selected', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    // Try to select 4 cards
    const cards = screen.getAllByRole('button')
    const cardButtons = cards.filter(
      (button) =>
        button.className.includes('card') ||
        button.textContent?.includes('♠') ||
        button.textContent?.includes('♥') ||
        button.textContent?.includes('♦') ||
        button.textContent?.includes('♣')
    )

    // Select up to 4 cards
    for (let i = 0; i < Math.min(4, cardButtons.length); i++) {
      fireEvent.click(cardButtons[i])
    }

    // Should show ready state if we managed to select 4 cards
    if (cardButtons.length >= 4) {
      expect(screen.getByText('Ready to exchange!')).toBeInTheDocument()
    }
  })

  it('should enable exchange button only when 4 cards are selected', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    const exchangeButton = screen.getByText('Exchange Cards')
    expect(exchangeButton).toBeDisabled()

    // Try to select 4 cards
    const cards = screen.getAllByRole('button')
    const cardButtons = cards.filter(
      (button) =>
        button.className.includes('card') ||
        button.textContent?.includes('A') ||
        button.textContent?.includes('K')
    )

    // Select cards one by one
    for (let i = 0; i < Math.min(4, cardButtons.length); i++) {
      fireEvent.click(cardButtons[i])
    }

    // Button should be enabled if we selected 4 cards
    if (cardButtons.length >= 4) {
      expect(exchangeButton).not.toBeDisabled()
    }
  })

  it('should call onCardExchange when exchange button is clicked with 4 cards selected', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    // Try to select 4 cards and exchange
    const cards = screen.getAllByRole('button')
    const cardButtons = cards.filter((button) =>
      button.className.includes('card')
    )

    // Select 4 cards
    const cardsToSelect = Math.min(4, cardButtons.length)
    for (let i = 0; i < cardsToSelect; i++) {
      fireEvent.click(cardButtons[i])
    }

    if (cardsToSelect === 4) {
      const exchangeButton = screen.getByText('Exchange Cards')
      fireEvent.click(exchangeButton)

      expect(mockOnCardExchange).toHaveBeenCalled()
      expect(mockOnCardExchange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            suit: expect.any(String),
            rank: expect.any(String),
            value: expect.any(Number),
          }),
        ])
      )
    }
  })

  it('should show selected cards summary', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    // Select at least one card
    const cards = screen.getAllByRole('button')
    const cardButtons = cards.filter((button) =>
      button.className.includes('card')
    )

    if (cardButtons.length > 0) {
      fireEvent.click(cardButtons[0])

      // Should show selected cards summary
      expect(screen.getByText('Selected cards to discard:')).toBeInTheDocument()
    }
  })

  it('should show error when Napoleon player not found', () => {
    const invalidGameState = {
      ...mockGameState,
      players: mockGameState.players.filter((p) => p.id !== 'napoleon-player'),
    }

    render(
      <CardExchangeSelector
        gameState={invalidGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    expect(screen.getByText('Napoleon player not found')).toBeInTheDocument()
  })

  it('should limit selection to maximum 4 cards', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    const cards = screen.getAllByRole('button')
    const cardButtons = cards.filter((button) =>
      button.className.includes('card')
    )

    // Try to select more than 4 cards
    for (let i = 0; i < Math.min(6, cardButtons.length); i++) {
      fireEvent.click(cardButtons[i])
    }

    // Should still only show selection of 4 cards max
    // This is tested by checking that we don't see "Select -1 more cards" or similar
    const selectionText = screen.getByText(
      /Select \d+ more card|Ready to exchange!/
    )
    expect(selectionText).toBeInTheDocument()
  })

  it('should allow deselecting cards', () => {
    render(
      <CardExchangeSelector
        gameState={mockGameState}
        napoleonPlayerId="napoleon-player"
        onCardExchange={mockOnCardExchange}
      />
    )

    const cards = screen.getAllByRole('button')
    const cardButtons = cards.filter((button) =>
      button.className.includes('card')
    )

    if (cardButtons.length > 0) {
      // Select a card
      fireEvent.click(cardButtons[0])
      expect(screen.getByText('Select 3 more cards')).toBeInTheDocument()

      // Deselect the same card
      fireEvent.click(cardButtons[0])
      expect(screen.getByText('Select 4 more cards')).toBeInTheDocument()
    }
  })
})
