'use client'

import { useEffect, useReducer } from 'react'
import {
  ACTION_TYPES,
  SUIT_DISPLAY_COLORS,
  SUIT_ENUM,
  SUIT_NAME_PARTS,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  SUITS,
} from '@/lib/constants'
import { getMinimumDeclaration } from '@/lib/napoleonRules'
import type { NapoleonDeclaration, Player, Suit } from '@/types/game'

interface NapoleonSelectorProps {
  players: Player[]
  currentPlayerId: string | null
  currentDeclaration?: NapoleonDeclaration
  nextDeclarationPlayerId?: string | null
  onNapoleonSelect: (playerId: string, declaration: NapoleonDeclaration) => void
  onPass: (playerId: string) => void
}

interface NapoleonSelectorState {
  selectedTricks: number
  selectedSuit: Suit
}

interface NapoleonSelectorAction {
  type:
    | typeof ACTION_TYPES.NAPOLEON_SELECTOR.SET_SELECTED_TRICKS
    | typeof ACTION_TYPES.NAPOLEON_SELECTOR.SET_SELECTED_SUIT
    | typeof ACTION_TYPES.NAPOLEON_SELECTOR.RESET_TO_MIN_DECLARATION
  payload?: {
    tricks?: number
    suit?: Suit
    minDeclaration?: {
      minTricks: number
      availableSuits: Suit[]
    }
  }
}

function napoleonSelectorReducer(
  state: NapoleonSelectorState,
  action: NapoleonSelectorAction
): NapoleonSelectorState {
  switch (action.type) {
    case ACTION_TYPES.NAPOLEON_SELECTOR.SET_SELECTED_TRICKS:
      return {
        ...state,
        selectedTricks: action.payload?.tricks ?? state.selectedTricks,
      }
    case ACTION_TYPES.NAPOLEON_SELECTOR.SET_SELECTED_SUIT:
      return {
        ...state,
        selectedSuit: action.payload?.suit ?? state.selectedSuit,
      }
    case ACTION_TYPES.NAPOLEON_SELECTOR.RESET_TO_MIN_DECLARATION: {
      const minDeclaration = action.payload?.minDeclaration
      if (!minDeclaration) return state

      return {
        ...state,
        selectedTricks: minDeclaration.minTricks,
        selectedSuit:
          minDeclaration.availableSuits.length > 0
            ? minDeclaration.availableSuits[0]
            : state.selectedSuit,
      }
    }
    default:
      return state
  }
}

export function NapoleonSelector({
  players,
  currentPlayerId,
  currentDeclaration,
  nextDeclarationPlayerId,
  onNapoleonSelect,
  onPass,
}: NapoleonSelectorProps) {
  const minDeclaration = getMinimumDeclaration(currentDeclaration)

  const [state, dispatch] = useReducer(napoleonSelectorReducer, {
    selectedTricks: minDeclaration.minTricks,
    selectedSuit:
      minDeclaration.availableSuits.length > 0
        ? minDeclaration.availableSuits[0]
        : SUIT_ENUM.CLUBS,
  })

  const maxTricks = 20
  const currentPlayer = currentPlayerId
    ? players.find((p) => p.id === currentPlayerId)
    : null

  useEffect(() => {
    const newMinDeclaration = getMinimumDeclaration(currentDeclaration)
    dispatch({
      type: ACTION_TYPES.NAPOLEON_SELECTOR.RESET_TO_MIN_DECLARATION,
      payload: { minDeclaration: newMinDeclaration },
    })
  }, [currentDeclaration])

  if (!currentPlayer || !currentPlayerId) {
    return <div>Player not found</div>
  }

  const availableTricks = Array.from(
    { length: 21 - minDeclaration.minTricks },
    (_, i) => minDeclaration.minTricks + i
  )

  const availableSuits: Suit[] =
    currentDeclaration &&
    state.selectedTricks === currentDeclaration.targetTricks
      ? minDeclaration.availableSuits
      : [...SUITS]

  const handleNapoleonDeclaration = () => {
    const declaration: NapoleonDeclaration = {
      playerId: currentPlayerId,
      targetTricks: state.selectedTricks,
      suit: state.selectedSuit,
    }
    onNapoleonSelect(currentPlayerId, declaration)
  }

  const handlePass = () => {
    onPass(currentPlayerId)
  }

  const getSuitDisplay = (suit: Suit) => {
    return SUIT_NAMES[suit]
  }

  const getSuitDisplayForOption = (suit: Suit) => {
    return `${SUIT_SYMBOLS[suit]} ${SUIT_NAME_PARTS[suit]}`
  }

  const getSuitColor = (suit: Suit) => {
    return SUIT_DISPLAY_COLORS[suit]
  }

  const currentDeclarationPlayer = currentDeclaration
    ? players.find((p) => p.id === currentDeclaration.playerId)
    : null

  const nextDeclarationPlayer = nextDeclarationPlayerId
    ? players.find((p) => p.id === nextDeclarationPlayerId)
    : null

  const isWaitingForOtherPlayer =
    nextDeclarationPlayer && nextDeclarationPlayer.id !== currentPlayerId

  if (isWaitingForOtherPlayer) {
    return (
      <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            🎩 Napoleon Declaration Phase
          </h2>
        </div>

        {currentDeclaration && currentDeclarationPlayer && (
          <div className="border border-yellow-300 bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-3 text-center">
              🏆 Current Highest Bid
            </h3>
            <div className="bg-white rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600">Player</div>
                  <div className="text-lg font-bold text-yellow-700">
                    {currentDeclarationPlayer.name}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Face Cards</div>
                  <div className="text-2xl font-bold text-yellow-700">
                    {currentDeclaration.targetTricks}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Trump Suit</div>
                  <div
                    className={`text-2xl font-bold ${getSuitColor(currentDeclaration.suit)}`}
                  >
                    {getSuitDisplay(currentDeclaration.suit)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border border-blue-300 bg-blue-50 p-6 rounded-lg">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <h3 className="font-semibold text-blue-800 text-lg">
                Waiting for Declaration
              </h3>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="text-center">
                <div className="text-sm text-blue-600 mb-2">
                  Currently declaring:
                </div>
                <div className="text-xl font-bold text-blue-700">
                  {nextDeclarationPlayer.name}
                  {nextDeclarationPlayer.isAI && ' (COM)'}
                </div>
              </div>
            </div>
            <p className="text-sm text-blue-600">
              <span className="font-semibold">
                {nextDeclarationPlayer.name}
              </span>{' '}
              is making their Napoleon declaration. Please wait for your turn.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">
            Declaration Order:
          </h4>
          <div className="flex justify-center space-x-4">
            {players.map((player) => (
              <div
                key={player.id}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  player.id === nextDeclarationPlayerId
                    ? 'bg-blue-600 text-white animate-pulse'
                    : player.id === currentPlayerId
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {player.name}
                {player.id === nextDeclarationPlayerId && ' ⏳'}
                {player.id === currentPlayerId && ' (You)'}
                {player.isAI && ' 🤖'}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎩 Napoleon Declaration
        </h2>
        <p className="text-gray-600">
          {currentPlayer.name}, make your declaration or pass
        </p>
      </div>

      {currentDeclaration && currentDeclarationPlayer && (
        <div className="border border-yellow-300 bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-3 text-center">
            🏆 Current Highest Bid (to beat)
          </h3>
          <div className="bg-white rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-sm text-gray-600">Player</div>
                <div className="text-lg font-bold text-yellow-700">
                  {currentDeclarationPlayer.name}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Face Cards</div>
                <div className="text-2xl font-bold text-yellow-700">
                  {currentDeclaration.targetTricks}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Trump Suit</div>
                <div
                  className={`text-2xl font-bold ${getSuitColor(currentDeclaration.suit)}`}
                >
                  {getSuitDisplay(currentDeclaration.suit)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Stepper for face card count */}
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-2">
            Target Face Cards (絵札数)
          </div>
          <div className="flex justify-center">
            <div className="inline-flex items-stretch rounded-xl overflow-hidden bg-white shadow-md">
              <button
                type="button"
                className="w-12 bg-gray-100 hover:bg-gray-200 text-2xl font-bold text-gray-900 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                onClick={() =>
                  dispatch({
                    type: ACTION_TYPES.NAPOLEON_SELECTOR.SET_SELECTED_TRICKS,
                    payload: { tricks: state.selectedTricks - 1 },
                  })
                }
                disabled={state.selectedTricks <= availableTricks[0]}
              >
                −
              </button>
              <div className="px-6 py-3 text-3xl font-extrabold text-gray-900 min-w-[80px] text-center leading-none flex items-center justify-center">
                {state.selectedTricks}
              </div>
              <button
                type="button"
                className="w-12 bg-gray-100 hover:bg-gray-200 text-2xl font-bold text-gray-900 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                onClick={() =>
                  dispatch({
                    type: ACTION_TYPES.NAPOLEON_SELECTOR.SET_SELECTED_TRICKS,
                    payload: { tricks: state.selectedTricks + 1 },
                  })
                }
                disabled={state.selectedTricks >= maxTricks}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Suit picker: 4 large buttons */}
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-2">
            Trump Suit (切り札)
          </div>
          <div className="grid grid-cols-4 gap-2">
            {SUITS.map((suit) => {
              const isAvailable = availableSuits.includes(suit)
              const isActive = state.selectedSuit === suit
              return (
                <button
                  key={suit}
                  type="button"
                  className={`flex flex-col items-center gap-1 p-3.5 rounded-xl border-2 text-3xl font-bold transition-all cursor-pointer
                    ${isActive ? 'border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]' : 'border-gray-200 bg-white hover:border-gray-400'}
                    ${!isAvailable ? 'opacity-40 cursor-not-allowed' : ''}
                  `}
                  disabled={!isAvailable}
                  onClick={() =>
                    dispatch({
                      type: ACTION_TYPES.NAPOLEON_SELECTOR.SET_SELECTED_SUIT,
                      payload: { suit },
                    })
                  }
                >
                  <span className={SUIT_DISPLAY_COLORS[suit]}>
                    {SUIT_SYMBOLS[suit]}
                  </span>
                  <span className="text-[10px] text-gray-500 font-semibold tracking-wide">
                    {SUIT_NAME_PARTS[suit]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Declaration preview */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">Your Declaration:</h4>
          <div className="text-sm text-blue-700">
            <span className="font-semibold">{state.selectedTricks}</span> face
            cards with{' '}
            <span
              className={`font-semibold ${getSuitColor(state.selectedSuit)}`}
            >
              {getSuitDisplay(state.selectedSuit)}
            </span>{' '}
            as trump
          </div>
        </div>
      </div>

      <div className="flex gap-4 justify-center">
        <button
          type="button"
          onClick={handleNapoleonDeclaration}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors cursor-pointer"
        >
          🎩 Declare Napoleon
        </button>
        <button
          type="button"
          onClick={handlePass}
          className="px-6 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors cursor-pointer"
        >
          ⏭️ Pass
        </button>
      </div>
    </div>
  )
}
