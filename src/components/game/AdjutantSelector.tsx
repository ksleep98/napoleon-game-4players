'use client'

import { useReducer } from 'react'
import {
  ACTION_TYPES,
  CARD_RANKS,
  createDeck,
  SUIT_ENUM,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  SUIT_TEXT_COLORS,
} from '@/lib/constants'
import type { Card as CardType, GameState, Suit } from '@/types/game'

interface AdjutantSelectorProps {
  gameState: GameState
  napoleonPlayerId: string
  onAdjutantSelect: (card: CardType) => void
}

// 重要カード取得関数
function getImportantCards(trumpSuit: Suit): CardType[] {
  const allCards = createDeck()

  // ナポレオン（スペードA）
  const napoleon = allCards.find(
    (card) => card.suit === SUIT_ENUM.SPADES && card.rank === CARD_RANKS.ACE
  )

  // 切り札のJ
  const trumpJack = allCards.find(
    (card) => card.suit === trumpSuit && card.rank === CARD_RANKS.JACK
  )

  // 裏J（切り札と同じ色の反対スート）
  const oppositeColor: Suit =
    trumpSuit === SUIT_ENUM.SPADES || trumpSuit === SUIT_ENUM.CLUBS
      ? trumpSuit === SUIT_ENUM.SPADES
        ? SUIT_ENUM.CLUBS
        : SUIT_ENUM.SPADES
      : trumpSuit === SUIT_ENUM.HEARTS
        ? SUIT_ENUM.DIAMONDS
        : SUIT_ENUM.HEARTS
  const oppositeJack = allCards.find(
    (card) => card.suit === oppositeColor && card.rank === CARD_RANKS.JACK
  )

  // A
  const aces = allCards.filter(
    (card) => card.rank === CARD_RANKS.ACE && card.suit !== SUIT_ENUM.SPADES
  )

  const importantCards: CardType[] = []
  if (napoleon) importantCards.push(napoleon)
  if (trumpJack) importantCards.push(trumpJack)
  if (oppositeJack) importantCards.push(oppositeJack)
  importantCards.push(...aces)

  return importantCards
}

interface AdjutantSelectorState {
  selectedCard: CardType | null
  viewMode: 'important' | 'all'
}

interface AdjutantSelectorAction {
  type:
    | typeof ACTION_TYPES.ADJUTANT_SELECTOR.SET_SELECTED_CARD
    | typeof ACTION_TYPES.ADJUTANT_SELECTOR.SET_VIEW_MODE
  payload?: {
    card?: CardType | null
    viewMode?: 'important' | 'all'
  }
}

function adjutantSelectorReducer(
  state: AdjutantSelectorState,
  action: AdjutantSelectorAction
): AdjutantSelectorState {
  switch (action.type) {
    case ACTION_TYPES.ADJUTANT_SELECTOR.SET_SELECTED_CARD:
      return {
        ...state,
        selectedCard: action.payload?.card ?? null,
      }
    case ACTION_TYPES.ADJUTANT_SELECTOR.SET_VIEW_MODE:
      return {
        ...state,
        viewMode: action.payload?.viewMode ?? state.viewMode,
      }
    default:
      return state
  }
}

export function AdjutantSelector({
  gameState,
  napoleonPlayerId,
  onAdjutantSelect,
}: AdjutantSelectorProps) {
  const [state, dispatch] = useReducer(adjutantSelectorReducer, {
    selectedCard: null,
    viewMode: 'important' as const,
  })

  const napoleonPlayer = gameState.players.find(
    (p) => p.id === napoleonPlayerId
  )
  if (!napoleonPlayer) {
    return <div>Napoleon player not found</div>
  }

  if (!gameState.napoleonDeclaration) {
    return <div>Napoleon declaration not found</div>
  }

  const trumpSuit = gameState.napoleonDeclaration.suit
  const allCards = createDeck()
  const importantCards = getImportantCards(trumpSuit)

  const handleCardSelect = (cardId: string) => {
    const card = allCards.find((c) => c.id === cardId)
    dispatch({
      type: ACTION_TYPES.ADJUTANT_SELECTOR.SET_SELECTED_CARD,
      payload: { card: card || null },
    })
  }

  const getSuitDisplay = (suit: Suit) => {
    return SUIT_NAMES[suit]
  }

  const getSuitColor = (suit: Suit) => {
    return SUIT_TEXT_COLORS[suit]
  }

  const handleConfirmSelection = () => {
    if (state.selectedCard) {
      onAdjutantSelect(state.selectedCard)
    }
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Select Adjutant Card
        </h2>
        <p className="text-gray-600">
          {napoleonPlayer.name}, choose a card to find your adjutant!
        </p>
        <p className="text-sm text-gray-500 mt-2">
          The player who has this card will become your adjutant
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <h3 className="text-lg font-bold text-yellow-800 mb-2">
          Your Napoleon Declaration
        </h3>
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-700">
              {gameState.napoleonDeclaration.targetTricks}
            </div>
            <div className="text-sm text-yellow-600">tricks</div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${getSuitColor(trumpSuit)}`}>
              {getSuitDisplay(trumpSuit)}
            </div>
            <div className="text-sm text-yellow-600">trump suit</div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: ACTION_TYPES.ADJUTANT_SELECTOR.SET_VIEW_MODE,
              payload: { viewMode: 'important' },
            })
          }
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            state.viewMode === 'important'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50'
          }`}
        >
          Important Cards
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: ACTION_TYPES.ADJUTANT_SELECTOR.SET_VIEW_MODE,
              payload: { viewMode: 'all' },
            })
          }
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            state.viewMode === 'all'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-50'
          }`}
        >
          All Cards
        </button>
      </div>

      {state.selectedCard && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">
            Selected Adjutant Card:
          </h4>
          <div className="text-center">
            <div
              className={`text-2xl font-bold ${getSuitColor(state.selectedCard.suit)}`}
            >
              {SUIT_SYMBOLS[state.selectedCard.suit]}
              {state.selectedCard.rank}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto">
        {(state.viewMode === 'important' ? importantCards : allCards).map(
          (card) => {
            const isSelected = state.selectedCard?.id === card.id
            const isInNapoleonHand = napoleonPlayer.hand.some(
              (h) => h.id === card.id
            )

            return (
              <button
                key={card.id}
                type="button"
                data-testid={`card-${card.id}`}
                onClick={() => handleCardSelect(card.id)}
                className={`p-2 rounded-lg border-2 transition-all text-xs font-medium relative ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : isInNapoleonHand
                      ? 'border-green-300 bg-green-50 hover:border-green-400'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {isInNapoleonHand && (
                  <div className="absolute top-0 right-0 -mt-1 -mr-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    ✓
                  </div>
                )}
                <div className={getSuitColor(card.suit)}>
                  {SUIT_SYMBOLS[card.suit]}
                  {card.rank}
                </div>
              </button>
            )
          }
        )}
      </div>

      {state.selectedCard && (
        <div className="flex gap-4 justify-center">
          <button
            type="button"
            onClick={handleConfirmSelection}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            ✅ Confirm Adjutant Selection
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: ACTION_TYPES.ADJUTANT_SELECTOR.SET_SELECTED_CARD,
                payload: { card: null },
              })
            }
            className="px-6 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  )
}
