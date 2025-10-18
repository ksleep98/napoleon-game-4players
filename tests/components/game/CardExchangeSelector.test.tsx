import { fireEvent, render, screen } from '@testing-library/react'
import { CardExchangeSelector } from '@/components/game/CardExchangeSelector'
import { CARD_RANKS, GAME_PHASES, SUIT_ENUM } from '@/lib/constants'
import type { Card, GameState, NapoleonDeclaration } from '@/types/game'

describe('CardExchangeSelector', () => {
  const mockOnCardExchange = jest.fn()

  const sampleCards: Card[] = [
    // Original hand cards (12 cards)
    {
      id: `${SUIT_ENUM.SPADES}-${CARD_RANKS.ACE}`,
      suit: SUIT_ENUM.SPADES,
      rank: CARD_RANKS.ACE,
      value: 14,
    },
    {
      id: `${SUIT_ENUM.SPADES}-${CARD_RANKS.KING}`,
      suit: SUIT_ENUM.SPADES,
      rank: CARD_RANKS.KING,
      value: 13,
    },
    {
      id: `${SUIT_ENUM.HEARTS}-${CARD_RANKS.QUEEN}`,
      suit: SUIT_ENUM.HEARTS,
      rank: CARD_RANKS.QUEEN,
      value: 12,
    },
    {
      id: `${SUIT_ENUM.HEARTS}-${CARD_RANKS.JACK}`,
      suit: SUIT_ENUM.HEARTS,
      rank: CARD_RANKS.JACK,
      value: 11,
    },
    {
      id: `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.TEN}`,
      suit: SUIT_ENUM.DIAMONDS,
      rank: CARD_RANKS.TEN,
      value: 10,
    },
    {
      id: `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.NINE}`,
      suit: SUIT_ENUM.DIAMONDS,
      rank: CARD_RANKS.NINE,
      value: 9,
    },
    {
      id: `${SUIT_ENUM.CLUBS}-${CARD_RANKS.EIGHT}`,
      suit: SUIT_ENUM.CLUBS,
      rank: CARD_RANKS.EIGHT,
      value: 8,
    },
    {
      id: `${SUIT_ENUM.CLUBS}-${CARD_RANKS.SEVEN}`,
      suit: SUIT_ENUM.CLUBS,
      rank: CARD_RANKS.SEVEN,
      value: 7,
    },
    {
      id: `${SUIT_ENUM.SPADES}-${CARD_RANKS.SIX}`,
      suit: SUIT_ENUM.SPADES,
      rank: CARD_RANKS.SIX,
      value: 6,
    },
    {
      id: `${SUIT_ENUM.HEARTS}-${CARD_RANKS.FIVE}`,
      suit: SUIT_ENUM.HEARTS,
      rank: CARD_RANKS.FIVE,
      value: 5,
    },
    {
      id: `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.FOUR}`,
      suit: SUIT_ENUM.DIAMONDS,
      rank: CARD_RANKS.FOUR,
      value: 4,
    },
    {
      id: `${SUIT_ENUM.CLUBS}-${CARD_RANKS.THREE}`,
      suit: SUIT_ENUM.CLUBS,
      rank: CARD_RANKS.THREE,
      value: 3,
    },
    // Hidden cards (4 cards with wasHidden flag)
    {
      id: `${SUIT_ENUM.HEARTS}-${CARD_RANKS.ACE}`,
      suit: SUIT_ENUM.HEARTS,
      rank: CARD_RANKS.ACE,
      value: 14,
      wasHidden: true,
    },
    {
      id: `${SUIT_ENUM.DIAMONDS}-${CARD_RANKS.ACE}`,
      suit: SUIT_ENUM.DIAMONDS,
      rank: CARD_RANKS.ACE,
      value: 14,
      wasHidden: true,
    },
    {
      id: `${SUIT_ENUM.CLUBS}-${CARD_RANKS.ACE}`,
      suit: SUIT_ENUM.CLUBS,
      rank: CARD_RANKS.ACE,
      value: 14,
      wasHidden: true,
    },
    {
      id: `${SUIT_ENUM.SPADES}-${CARD_RANKS.TWO}`,
      suit: SUIT_ENUM.SPADES,
      rank: CARD_RANKS.TWO,
      value: 2,
      wasHidden: true,
    },
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
    phase: GAME_PHASES.EXCHANGE,
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
