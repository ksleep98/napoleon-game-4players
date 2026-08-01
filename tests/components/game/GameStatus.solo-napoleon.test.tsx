/**
 * 一人ナポレオン時の GameStatus 表示テスト
 *
 * 要件:
 * - 公開前は副官バッジを一切出さない（ソロだと分かること自体が情報）
 * - 公開後はナポレオン本人に Napoleon と Adjutant の両方を出す
 * - Teams パネルでナポレオンが 2 行に重複しない / Allied Forces に混ざらない
 * - 通常ゲームの表示は従来どおり
 *
 * ⚠️ 描画されるフェーズだけで検証すること。
 * GameStatus は PLAYING では描画されない（page.tsx の PLAYING 専用レイアウトは
 * TopHUD だけを出す）。以前はこのテストが phase: PLAYING で
 * 「Face Cards Won by Player」セクションの N/A バッジを見ていたが、
 * そのセクションごとアプリ上に存在しなかったため検証が空回りしていた。
 * 実際に描画されるのは競り後の準備フェーズ（ADJUTANT / EXCHANGE）と
 * 終了画面（FINISHED）なので、公開前後をこの 2 つで表現する。
 */

import { render, screen, within } from '@testing-library/react'
import { GameStatus } from '@/components/game/GameStatus'
import {
  GAME_PHASES,
  PLAYER_ROLES,
  SOLO_NAPOLEON_LABELS,
} from '@/lib/constants'
import type { Card, GameState, Player } from '@/types/game'

// rank は K を使う。A にすると「A of hearts」等の本文と
// 役職ピルのテキスト検索が衝突するため
const adjutantCard: Card = {
  id: 'adjutant-card',
  suit: 'hearts',
  rank: 'K',
  value: 13,
}

const NAPOLEON_NAME = 'Napoleon Player'
const ADJUTANT_NAME = 'Second Player'
const HIDDEN_ADJUTANT_TEXT = '??? (Hidden)'
const HIDDEN_ADJUTANT_NOTE = /includes hidden adjutant/

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

const createGameState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'test-game',
  players: [
    createPlayer('nap', NAPOLEON_NAME, { isNapoleon: true }),
    createPlayer('p2', ADJUTANT_NAME),
    createPlayer('p3', 'Third Player'),
    createPlayer('p4', 'Fourth Player'),
  ],
  // 副官の正体がまだ伏せられている、実際に GameStatus が描画されるフェーズ
  phase: GAME_PHASES.EXCHANGE,
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

/** 終了画面（= 副官の正体が公開されるフェーズ）の state */
const createFinishedState = (overrides: Partial<GameState> = {}): GameState =>
  createGameState({ phase: GAME_PHASES.FINISHED, ...overrides })

/** 見出しを持つセクション（見出しの親要素）を取得する */
const getSection = (headingText: string): HTMLElement => {
  const heading = screen.getByText(headingText)
  const section = heading.parentElement
  if (!section) throw new Error(`Section not found: ${headingText}`)
  return section
}

const getTeams = (): HTMLElement => getSection('Teams')

/** Teams パネル内で、指定した役職ピルと同じ行（親要素）を返す */
const getRoleRow = (roleLabel: string): HTMLElement => {
  const pill = within(getTeams()).getByText(roleLabel)
  const row = pill.parentElement
  if (!row) throw new Error(`Role row not found: ${roleLabel}`)
  return row
}

describe('GameStatus - solo napoleon badges', () => {
  it('shows no adjutant badge before the game is finished', () => {
    // マスク済み状態を模す: 未公開の閲覧者には soloNapoleon が届かない
    render(
      <GameStatus
        gameState={createGameState({ soloNapoleon: undefined })}
        currentPlayerId="p2"
      />
    )

    const teams = getTeams()
    // 副官は「??? (Hidden)」のまま
    expect(within(teams).getByText(HIDDEN_ADJUTANT_TEXT)).toBeInTheDocument()
    // ソロであることも伏せられている
    expect(
      within(teams).queryByText(SOLO_NAPOLEON_LABELS.BADGE)
    ).not.toBeInTheDocument()
    // ナポレオンの行に Adjutant ピルは付かない
    expect(
      within(getRoleRow(PLAYER_ROLES.NAPOLEON)).queryByText(
        PLAYER_ROLES.ADJUTANT
      )
    ).not.toBeInTheDocument()
  })

  it('shows no adjutant badge to Napoleon either before the reveal', () => {
    // ナポレオン本人は soloNapoleon を受け取るが、公開前は A を出さない
    render(
      <GameStatus
        gameState={createGameState({ soloNapoleon: true })}
        currentPlayerId="nap"
      />
    )

    expect(
      within(getRoleRow(PLAYER_ROLES.NAPOLEON)).queryByText(
        PLAYER_ROLES.ADJUTANT
      )
    ).not.toBeInTheDocument()
  })

  it('gives Napoleon both the Napoleon and Adjutant pills after the reveal', () => {
    render(
      <GameStatus
        gameState={createFinishedState({ soloNapoleon: true })}
        currentPlayerId="p2"
      />
    )

    // 同じ行に Napoleon と Adjutant のピルが並ぶ
    const napoleonRow = getRoleRow(PLAYER_ROLES.NAPOLEON)
    expect(
      within(napoleonRow).getByText(PLAYER_ROLES.ADJUTANT)
    ).toBeInTheDocument()
    expect(within(napoleonRow).getByText(NAPOLEON_NAME)).toBeInTheDocument()

    // Adjutant ピルは Teams 全体で 1 つだけ = 他プレイヤーには付いていない
    expect(within(getTeams()).getAllByText(PLAYER_ROLES.ADJUTANT)).toHaveLength(
      1
    )
  })

  it('does not duplicate Napoleon in the Teams panel after the reveal', () => {
    render(
      <GameStatus
        gameState={createFinishedState({ soloNapoleon: true })}
        currentPlayerId="p2"
      />
    )

    const teams = getTeams()

    // ナポレオン名は Teams パネル内で 1 回だけ（副官用の行が増えない）
    expect(within(teams).getAllByText(NAPOLEON_NAME)).toHaveLength(1)

    // 「??? (Hidden)」は消えている
    expect(
      within(teams).queryByText(HIDDEN_ADJUTANT_TEXT)
    ).not.toBeInTheDocument()
  })

  it('keeps Napoleon out of the Allied Forces list in a solo game', () => {
    render(
      <GameStatus
        gameState={createFinishedState({ soloNapoleon: true })}
        currentPlayerId="p2"
      />
    )

    const alliedLine = screen.getByText(/Allied Forces:/)
    const text = alliedLine.textContent ?? ''

    expect(text).toContain(ADJUTANT_NAME)
    expect(text).toContain('Third Player')
    expect(text).toContain('Fourth Player')
    expect(text).not.toContain(NAPOLEON_NAME)
    // 存在しない副官を待たせる文言を出さない
    expect(text).not.toMatch(HIDDEN_ADJUTANT_NOTE)
  })
})

describe('GameStatus - normal game is unchanged', () => {
  /** 実在する副官がいる通常ゲーム */
  const normalPlayers = (): Player[] => [
    createPlayer('nap', NAPOLEON_NAME, { isNapoleon: true }),
    createPlayer('p2', ADJUTANT_NAME, { isAdjutant: true }),
    createPlayer('p3', 'Third Player'),
    createPlayer('p4', 'Fourth Player'),
  ]

  it('still hides the adjutant before the designation card is played', () => {
    // maskGameStateForPlayer は未公開の閲覧者へ isAdjutant: false で渡す
    render(
      <GameStatus
        gameState={createGameState({
          soloNapoleon: false,
          players: normalPlayers().map((player) => ({
            ...player,
            isAdjutant: false,
          })),
        })}
        currentPlayerId="p3"
      />
    )

    const teams = getTeams()
    expect(within(teams).getByText(HIDDEN_ADJUTANT_TEXT)).toBeInTheDocument()
    expect(within(teams).getByText(HIDDEN_ADJUTANT_NOTE)).toBeInTheDocument()
    // 副官名が役職として示されていない
    expect(
      within(getRoleRow(PLAYER_ROLES.ADJUTANT)).queryByText(ADJUTANT_NAME)
    ).not.toBeInTheDocument()
  })

  it('names the real adjutant only, after the reveal', () => {
    render(
      <GameStatus
        gameState={createFinishedState({
          soloNapoleon: false,
          players: normalPlayers(),
        })}
        currentPlayerId="p3"
      />
    )

    // Adjutant ピルの行に副官の名前が出る
    expect(
      within(getRoleRow(PLAYER_ROLES.ADJUTANT)).getByText(ADJUTANT_NAME)
    ).toBeInTheDocument()

    // ナポレオンの行には Adjutant ピルが付かない
    expect(
      within(getRoleRow(PLAYER_ROLES.NAPOLEON)).queryByText(
        PLAYER_ROLES.ADJUTANT
      )
    ).not.toBeInTheDocument()

    // Adjutant ピルは Teams 全体で 1 つだけ
    expect(within(getTeams()).getAllByText(PLAYER_ROLES.ADJUTANT)).toHaveLength(
      1
    )
  })
})
