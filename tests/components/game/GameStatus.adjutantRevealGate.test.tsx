/**
 * GameStatus が副官の正体を公開するタイミングの不変条件テスト
 *
 * GameStatus はかつて `phase === GAME_PHASES.PLAYING &&` で始まる独自の
 * 公開判定を持っていた。しかし GameStatus は PLAYING では描画されない
 * （page.tsx の PLAYING 専用レイアウトは TopHUD だけを出す）ため、
 * この判定は常に false になり、終了画面でも副官が「??? (Hidden)」のままだった。
 *
 * 判定は gameUtils.isAdjutantIdentityPublic に一本化してある。
 * ここでは「実際に描画されるフェーズ」だけを対象に、次の 2 点を固定する:
 * - 終了画面（FINISHED）では副官の正体が Teams に出る
 * - 競り前・競り後の準備フェーズでは絶対に出ない（#511 の情報漏れ対策を維持）
 */

import { render, screen, within } from '@testing-library/react'
import { GameStatus } from '@/components/game/GameStatus'
import { GAME_PHASES, PLAYER_ROLES } from '@/lib/constants'
import type { Card, GameState, Player } from '@/types/game'
import { isAdjutantIdentityPublic } from '@/utils/gameUtils'

const adjutantCard: Card = {
  id: 'adjutant-card',
  suit: 'hearts',
  rank: 'K',
  value: 13,
}

const NAPOLEON_NAME = 'Napoleon Player'
const ADJUTANT_NAME = 'Second Player'
const HIDDEN_ADJUTANT_TEXT = '??? (Hidden)'

/**
 * GameStatus が実際に描画される、副官がまだ公開されないフェーズ。
 * NAPOLEON（競り中）は Teams ブロック自体が出ないため別で検証する
 */
const PRE_REVEAL_PHASES = [
  GAME_PHASES.DEALING,
  GAME_PHASES.ADJUTANT,
  GAME_PHASES.EXCHANGE,
] as const

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

/**
 * @param adjutantIsMasked maskGameStateForPlayer は未公開の閲覧者へ
 *   isAdjutant: false を渡す。公開前フェーズではこれを模す
 */
const createGameState = (
  phase: GameState['phase'],
  adjutantIsMasked: boolean
): GameState => ({
  id: 'reveal-gate-test',
  players: [
    createPlayer('nap', NAPOLEON_NAME, { isNapoleon: true }),
    createPlayer('p2', ADJUTANT_NAME, { isAdjutant: !adjutantIsMasked }),
    createPlayer('p3', 'Third Player'),
    createPlayer('p4', 'Fourth Player'),
  ],
  phase,
  currentPlayerIndex: 0,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  // 副官指定カードは 1 度も場に出ていない（早期終了を模す）
  tricks: [],
  hiddenCards: [],
  napoleonCard: adjutantCard,
  trumpSuit: 'spades',
  napoleonDeclaration: {
    playerId: 'nap',
    targetTricks: 14,
    suit: 'spades',
    adjutantCard,
  },
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  soloNapoleon: false,
  createdAt: new Date(),
  updatedAt: new Date(),
})

const getTeams = (): HTMLElement => {
  const heading = screen.getByText('Teams')
  const section = heading.parentElement
  if (!section) throw new Error('Teams section not found')
  return section
}

describe('GameStatus adjutant reveal gate', () => {
  it('reveals the adjutant in Teams on the finished screen', () => {
    const gameState = createGameState(GAME_PHASES.FINISHED, false)
    // 前提: 終了後は正体を公開してよい
    expect(isAdjutantIdentityPublic(gameState)).toBe(true)

    render(<GameStatus gameState={gameState} currentPlayerId="p3" />)

    const teams = getTeams()
    const adjutantPill = within(teams).getByText(PLAYER_ROLES.ADJUTANT)
    const adjutantRow = adjutantPill.parentElement
    if (!adjutantRow) throw new Error('Adjutant row not found')

    // 副官の名前が役職とともに出る
    expect(within(adjutantRow).getByText(ADJUTANT_NAME)).toBeInTheDocument()
    expect(
      within(teams).queryByText(HIDDEN_ADJUTANT_TEXT)
    ).not.toBeInTheDocument()

    // 公開済みなので Allied Forces の一覧からは外れる
    const alliedText = screen.getByText(/Allied Forces:/).textContent ?? ''
    expect(alliedText).not.toContain(ADJUTANT_NAME)
  })

  it.each(
    PRE_REVEAL_PHASES
  )('keeps the adjutant hidden during the %s phase', (phase) => {
    const gameState = createGameState(phase, true)
    // 前提: このフェーズではまだ公開してはいけない
    expect(isAdjutantIdentityPublic(gameState)).toBe(false)

    render(<GameStatus gameState={gameState} currentPlayerId="p3" />)

    const teams = getTeams()
    expect(within(teams).getByText(HIDDEN_ADJUTANT_TEXT)).toBeInTheDocument()

    // 副官名が役職行に現れない
    const adjutantPill = within(teams).getByText(PLAYER_ROLES.ADJUTANT)
    const adjutantRow = adjutantPill.parentElement
    if (!adjutantRow) throw new Error('Adjutant row not found')
    expect(
      within(adjutantRow).queryByText(ADJUTANT_NAME)
    ).not.toBeInTheDocument()
  })

  it('does not show the Teams panel at all while bidding is still open', () => {
    // #511: 競り中は最高提示者が確定チームに見えてはいけない
    render(
      <GameStatus
        gameState={createGameState(GAME_PHASES.NAPOLEON, true)}
        currentPlayerId="p3"
      />
    )

    expect(screen.queryByText('Teams')).not.toBeInTheDocument()
    expect(screen.queryByText(ADJUTANT_NAME)).not.toBeInTheDocument()
  })

  it('does not claim the adjutant was found by a card that was never played', () => {
    // 早期終了では副官指定カードが場に出ないまま終わる
    render(
      <GameStatus
        gameState={createGameState(GAME_PHASES.FINISHED, false)}
        currentPlayerId="p3"
      />
    )

    expect(
      screen.queryByText(new RegExp(`${PLAYER_ROLES.ADJUTANT} was found by`))
    ).not.toBeInTheDocument()
  })
})
