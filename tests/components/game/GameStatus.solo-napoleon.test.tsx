/**
 * 一人ナポレオン時の GameStatus 表示テスト
 *
 * 要件:
 * - 公開前は副官バッジを一切出さない（ソロだと分かること自体が情報）
 * - 公開後はナポレオン本人に Napoleon と Adjutant の両方を出す
 * - Teams パネルでナポレオンが 2 行に重複しない / Allied Forces に混ざらない
 * - 通常ゲームの表示は従来どおり
 */

import { render, screen, within } from '@testing-library/react'
import { GameStatus } from '@/components/game/GameStatus'
import { GAME_PHASES, PLAYER_ROLES } from '@/lib/constants'
import type { Card, GameState, Player, Trick } from '@/types/game'

// rank は K を使う。A にすると「A of hearts」等の本文と
// 副官バッジの "A" がテキスト検索で衝突するため
const adjutantCard: Card = {
  id: 'adjutant-card',
  suit: 'hearts',
  rank: 'K',
  value: 13,
}

const NAPOLEON_NAME = 'Napoleon Player'
const ADJUTANT_BADGE_TEXT = 'A'
const NAPOLEON_BADGE_TEXT = 'N'

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

/** ナポレオンが埋め札の副官カードを出したトリック（= 公開済み） */
const revealingTrick: Trick = {
  id: 'trick-reveal',
  completed: true,
  winnerPlayerId: 'nap',
  cards: [
    {
      card: { ...adjutantCard, wasHidden: true },
      playerId: 'nap',
      order: 0,
      revealsAdjutant: true,
    },
  ],
}

const createGameState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'test-game',
  players: [
    createPlayer('nap', NAPOLEON_NAME, { isNapoleon: true }),
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
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/** 見出しを持つセクション（見出しの親要素）を取得する */
const getSection = (headingText: string): HTMLElement => {
  const heading = screen.getByText(headingText)
  const section = heading.parentElement
  if (!section) throw new Error(`Section not found: ${headingText}`)
  return section
}

/** "Face Cards Won by Player" 一覧から指定プレイヤーの行を取得する */
const getPlayerRow = (playerName: string): HTMLElement => {
  const section = getSection('Face Cards Won by Player')
  const nameSpan = within(section).getByText(playerName)
  const row = nameSpan.parentElement
  if (!row) throw new Error(`Player row not found: ${playerName}`)
  return row
}

describe('GameStatus - solo napoleon badges', () => {
  it('shows no adjutant badge before the buried card is played', () => {
    // マスク済み状態を模す: 未公開の閲覧者には soloNapoleon が届かない
    render(
      <GameStatus
        gameState={createGameState({ soloNapoleon: undefined })}
        currentPlayerId="p2"
      />
    )

    // 副官は「??? (Hidden)」のまま。誰にも A バッジは付かない
    expect(screen.getByText('??? (Hidden)')).toBeInTheDocument()
    const section = getSection('Face Cards Won by Player')
    expect(
      within(section).queryByText(ADJUTANT_BADGE_TEXT)
    ).not.toBeInTheDocument()
  })

  it('shows no adjutant badge to Napoleon either before the reveal', () => {
    // ナポレオン本人は soloNapoleon を受け取るが、公開前は出さない
    render(
      <GameStatus
        gameState={createGameState({ soloNapoleon: true })}
        currentPlayerId="nap"
      />
    )

    const section = getSection('Face Cards Won by Player')
    expect(
      within(section).queryByText(ADJUTANT_BADGE_TEXT)
    ).not.toBeInTheDocument()
  })

  it('gives Napoleon both the N and A badges after the reveal', () => {
    render(
      <GameStatus
        gameState={createGameState({
          soloNapoleon: true,
          tricks: [revealingTrick],
        })}
        currentPlayerId="p2"
      />
    )

    const napoleonRow = getPlayerRow(NAPOLEON_NAME)
    expect(
      within(napoleonRow).getByText(NAPOLEON_BADGE_TEXT)
    ).toBeInTheDocument()
    expect(
      within(napoleonRow).getByText(ADJUTANT_BADGE_TEXT)
    ).toBeInTheDocument()

    // A バッジは一覧全体で 1 つだけ = 他プレイヤーには付いていない
    const section = getSection('Face Cards Won by Player')
    expect(within(section).getAllByText(ADJUTANT_BADGE_TEXT)).toHaveLength(1)
  })

  it('does not duplicate Napoleon in the Teams panel after the reveal', () => {
    render(
      <GameStatus
        gameState={createGameState({
          soloNapoleon: true,
          tricks: [revealingTrick],
        })}
        currentPlayerId="p2"
      />
    )

    const teams = getSection('Teams')

    // ナポレオン名は Teams パネル内で 1 回だけ（副官用の行が増えない）
    expect(within(teams).getAllByText(NAPOLEON_NAME)).toHaveLength(1)

    // 同じ行に Napoleon と Adjutant のピルが並ぶ
    const napoleonPill = within(teams).getByText(PLAYER_ROLES.NAPOLEON)
    const row = napoleonPill.parentElement
    if (!row) throw new Error('Napoleon team row not found')
    expect(within(row).getByText(PLAYER_ROLES.ADJUTANT)).toBeInTheDocument()
    expect(within(row).getByText(NAPOLEON_NAME)).toBeInTheDocument()

    // 「??? (Hidden)」は消えている
    expect(within(teams).queryByText('??? (Hidden)')).not.toBeInTheDocument()
  })

  it('keeps Napoleon out of the Allied Forces list in a solo game', () => {
    render(
      <GameStatus
        gameState={createGameState({
          soloNapoleon: true,
          tricks: [revealingTrick],
        })}
        currentPlayerId="p2"
      />
    )

    const alliedLine = screen.getByText(/Allied Forces:/)
    const text = alliedLine.textContent ?? ''

    expect(text).toContain('Second Player')
    expect(text).toContain('Third Player')
    expect(text).toContain('Fourth Player')
    expect(text).not.toContain(NAPOLEON_NAME)
    // 存在しない副官を待たせる文言を出さない
    expect(text).not.toContain('includes hidden adjutant')
  })
})

describe('GameStatus - normal game is unchanged', () => {
  const normalState = (overrides: Partial<GameState> = {}) =>
    createGameState({
      soloNapoleon: false,
      players: [
        createPlayer('nap', NAPOLEON_NAME, { isNapoleon: true }),
        createPlayer('p2', 'Second Player', { isAdjutant: true }),
        createPlayer('p3', 'Third Player'),
        createPlayer('p4', 'Fourth Player'),
      ],
      ...overrides,
    })

  it('still hides the adjutant before the designation card is played', () => {
    render(<GameStatus gameState={normalState()} currentPlayerId="p3" />)

    expect(screen.getByText('??? (Hidden)')).toBeInTheDocument()
    const section = getSection('Face Cards Won by Player')
    expect(
      within(section).queryByText(ADJUTANT_BADGE_TEXT)
    ).not.toBeInTheDocument()
    expect(screen.getByText(/includes hidden adjutant/)).toBeInTheDocument()
  })

  it('shows the A badge on the real adjutant only, after the reveal', () => {
    const revealedByAdjutant: Trick = {
      id: 'trick-a',
      completed: true,
      winnerPlayerId: 'p2',
      cards: [{ card: adjutantCard, playerId: 'p2', order: 0 }],
    }

    render(
      <GameStatus
        gameState={normalState({ tricks: [revealedByAdjutant] })}
        currentPlayerId="p3"
      />
    )

    const adjutantRow = getPlayerRow('Second Player')
    expect(
      within(adjutantRow).getByText(ADJUTANT_BADGE_TEXT)
    ).toBeInTheDocument()

    // ナポレオンには N のみ、A は付かない
    const napoleonRow = getPlayerRow(NAPOLEON_NAME)
    expect(
      within(napoleonRow).getByText(NAPOLEON_BADGE_TEXT)
    ).toBeInTheDocument()
    expect(
      within(napoleonRow).queryByText(ADJUTANT_BADGE_TEXT)
    ).not.toBeInTheDocument()

    const section = getSection('Face Cards Won by Player')
    expect(within(section).getAllByText(ADJUTANT_BADGE_TEXT)).toHaveLength(1)
  })
})
