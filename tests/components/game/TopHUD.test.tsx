import { render, screen } from '@testing-library/react'
import { TopHUD } from '@/components/game/TopHUD'
import { ADJUTANT_CARD_LABEL, GAME_PHASES, SUIT_SYMBOLS } from '@/lib/constants'
import type { Card, GameState, Player } from '@/types/game'
import { isAdjutantIdentityPublic } from '@/utils/gameUtils'

const adjutantCard: Card = {
  id: 'adjutant-card',
  suit: 'hearts',
  rank: 'A',
  value: 14,
}

const createPlayer = (
  id: string,
  name: string,
  overrides: Partial<Player> = {}
): Player => ({
  id,
  name,
  hand: [],
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI: false,
  ...overrides,
})

/** 副官指定カードがまだ場に出ていない = 副官の正体は非公開の状態 */
const createGameState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'test-game',
  players: [
    createPlayer('p1', 'Napoleon Player', { isNapoleon: true }),
    createPlayer('p2', 'Second Player'),
    createPlayer('p3', 'Third Player'),
    createPlayer('p4', 'Fourth Player'),
  ],
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  tricks: [],
  hiddenCards: [],
  napoleonCard: adjutantCard,
  // ロゴが常に ♠ を描画するため、テストでは ♦ を切り札にして衝突を避ける
  trumpSuit: 'diamonds',
  napoleonDeclaration: {
    playerId: 'p1',
    targetTricks: 14,
    suit: 'diamonds',
    adjutantCard,
  },
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('TopHUD adjutant designation card', () => {
  it('shows the designation card while the adjutant identity is still hidden', () => {
    const gameState = createGameState()

    // 前提: 副官の正体はまだ公開されていない
    expect(isAdjutantIdentityPublic(gameState)).toBe(false)

    render(<TopHUD gameState={gameState} currentPlayerId="p2" />)

    // 指定カードは公開情報なので常に見える
    expect(screen.getByText(ADJUTANT_CARD_LABEL)).toBeInTheDocument()
    expect(
      screen.getByText(`${adjutantCard.rank} ${adjutantCard.suit}`)
    ).toBeVisible()
    expect(screen.getByText(SUIT_SYMBOLS.hearts)).toBeInTheDocument()
  })

  it('never names a player next to the designation card', () => {
    const gameState = createGameState({
      players: [
        createPlayer('p1', 'Napoleon Player', { isNapoleon: true }),
        createPlayer('p2', 'Second Player', { isAdjutant: true }),
        createPlayer('p3', 'Third Player'),
        createPlayer('p4', 'Fourth Player'),
      ],
    })

    render(<TopHUD gameState={gameState} currentPlayerId="p3" />)

    // 副官の正体（プレイヤー名）は HUD に一切出さない
    for (const player of gameState.players) {
      expect(screen.queryByText(player.name)).not.toBeInTheDocument()
    }
  })

  it('omits the designation card block when no card has been designated', () => {
    render(
      <TopHUD
        gameState={createGameState({
          napoleonCard: undefined,
          napoleonDeclaration: {
            playerId: 'p1',
            targetTricks: 14,
            suit: 'diamonds',
          },
        })}
        currentPlayerId="p2"
      />
    )

    expect(screen.queryByText(ADJUTANT_CARD_LABEL)).not.toBeInTheDocument()
    // 切り札チップは引き続き表示される
    expect(screen.getByText(SUIT_SYMBOLS.diamonds)).toBeInTheDocument()
  })

  it('still shows the designation card when the trump suit is unknown', () => {
    render(
      <TopHUD
        gameState={createGameState({
          trumpSuit: undefined,
          napoleonDeclaration: undefined,
        })}
        currentPlayerId="p2"
      />
    )

    expect(screen.getByText(ADJUTANT_CARD_LABEL)).toBeInTheDocument()
  })
})
