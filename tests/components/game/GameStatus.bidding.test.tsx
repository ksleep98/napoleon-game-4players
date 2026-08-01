/**
 * 競り（ナポレオン宣言フェーズ）中の GameStatus 表示の不変条件
 *
 * declareNapoleon は宣言のたびに isNapoleon / trumpSuit を立てるため、
 * 競りの最中でも「暫定ナポレオン」が state 上に存在する。それを確定した
 * チーム・役職として描画すると、まだ上乗せできる閲覧者に対して
 * 「自分は連合軍」「副官は誰かが隠れている」と誤った情報を与えてしまう。
 *
 * ここで固定するのは次の性質:
 * - 競り中は確定チーム（Napoleon / Adjutant / Allied Forces）を描かない
 * - 競り中は自分の役職を断定しない
 * - 競り中の宣言は「現在の最高提示」として提示する
 * - 競りを抜けたら従来どおり確定表示に戻る
 */

import { render, screen } from '@testing-library/react'
import { GameStatus } from '@/components/game/GameStatus'
import {
  BIDDING_LABELS,
  GAME_PHASES,
  PLAYER_ROLES,
  SUIT_ENUM,
} from '@/lib/constants'
import type { GameState, Player } from '@/types/game'

const BIDDER_ID = 'ai-1'
const VIEWER_ID = 'human'

const createPlayer = (
  id: string,
  name: string,
  position: number,
  overrides: Partial<Player> = {}
): Player => ({
  id,
  name,
  hand: [],
  isNapoleon: false,
  isAdjutant: false,
  position,
  isAI: id !== VIEWER_ID,
  ...overrides,
})

/**
 * AI が 14 / スペードで提示済み。閲覧者（人間）はまだ上乗せできる。
 * 副官指定カードは maskGameStateForPlayer が落とすので閲覧者側には届かない
 */
const createBiddingState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'bidding-game',
  players: [
    createPlayer(BIDDER_ID, 'AI Player 1', 1, { isNapoleon: true }),
    createPlayer(VIEWER_ID, 'You', 2),
    createPlayer('ai-2', 'AI Player 2', 3),
    createPlayer('ai-3', 'AI Player 3', 4),
  ],
  phase: GAME_PHASES.NAPOLEON,
  currentPlayerIndex: 1,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  tricks: [],
  hiddenCards: [],
  trumpSuit: SUIT_ENUM.SPADES,
  napoleonDeclaration: {
    playerId: BIDDER_ID,
    targetTricks: 14,
    suit: SUIT_ENUM.SPADES,
  },
  passedPlayers: [],
  declarationTurn: 1,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('GameStatus during the bidding phase', () => {
  it('does not present the bid as a decided team', () => {
    render(
      <GameStatus
        gameState={createBiddingState()}
        currentPlayerId={VIEWER_ID}
      />
    )

    expect(screen.queryByText('Teams')).not.toBeInTheDocument()
    expect(screen.queryByText(PLAYER_ROLES.NAPOLEON)).not.toBeInTheDocument()
    expect(screen.queryByText(PLAYER_ROLES.ADJUTANT)).not.toBeInTheDocument()
    expect(screen.queryByText(/Allied Forces/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument()
  })

  it('does not assert the viewer role while they can still outbid', () => {
    render(
      <GameStatus
        gameState={createBiddingState()}
        currentPlayerId={VIEWER_ID}
      />
    )

    expect(screen.queryByText('Role:')).not.toBeInTheDocument()
  })

  it('labels the declaration as the current highest bid', () => {
    render(
      <GameStatus
        gameState={createBiddingState()}
        currentPlayerId={VIEWER_ID}
      />
    )

    expect(screen.getByText(BIDDING_LABELS.SECTION_TITLE)).toBeInTheDocument()
    expect(screen.getByText(BIDDING_LABELS.UNDECIDED_NOTE)).toBeInTheDocument()
    expect(screen.getByText(/Highest bid by:/)).toBeInTheDocument()
    // 提示内容そのものは公開情報なので、上乗せ判断のために見えている必要がある
    expect(screen.getByText('14')).toBeInTheDocument()
  })

  it('restores the decided team view once bidding is over', () => {
    render(
      <GameStatus
        gameState={createBiddingState({ phase: GAME_PHASES.ADJUTANT })}
        currentPlayerId={VIEWER_ID}
      />
    )

    expect(screen.getByText('Teams')).toBeInTheDocument()
    expect(screen.getByText(PLAYER_ROLES.NAPOLEON)).toBeInTheDocument()
    expect(screen.getByText('Role:')).toBeInTheDocument()
    expect(
      screen.queryByText(BIDDING_LABELS.SECTION_TITLE)
    ).not.toBeInTheDocument()
  })
})
