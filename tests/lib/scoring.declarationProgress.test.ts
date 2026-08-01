/**
 * getGameProgress の「あと何枚必要か」不変条件テスト
 *
 * 表示文言ではなく数値の関係だけを検証する。
 * - ナポレオン側: 宣言枚数 - 獲得枚数（下限 0）
 * - 連合軍側: 阻止が確定する最小枚数 - 獲得枚数（下限 0）
 *   連合軍の勝利条件は isGameDecided と同じ「TOTAL - 宣言 を超えること」なので、
 *   両者が食い違わないことを isGameDecided と突き合わせて確認する
 */

import {
  CARD_RANKS,
  countFaceCards,
  GAME_PHASES,
  NAPOLEON_RULES,
  SUIT_ENUM,
} from '@/lib/constants'
import { getGameProgress, isGameDecided } from '@/lib/scoring'
import type { Card, GameState, Player, Trick } from '@/types/game'

const NAPOLEON_ID = 'nap'
const ADJUTANT_ID = 'adj'
const CITIZEN_ID = 'cit'

const createPlayer = (id: string, overrides: Partial<Player> = {}): Player => ({
  id,
  name: id,
  hand: [],
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI: false,
  ...overrides,
})

/** 絵札 1 枚だけを含むトリック。winnerPlayerId で獲得チームを決める */
const createFaceCardTrick = (index: number, winnerPlayerId: string): Trick => {
  const card: Card = {
    id: `face-${index}`,
    suit: SUIT_ENUM.SPADES,
    rank: CARD_RANKS.KING,
    value: 13,
  }
  // 前提確認: このカードは絵札として数えられる
  expect(countFaceCards([card])).toBe(1)

  return {
    id: `trick-${index}`,
    completed: true,
    winnerPlayerId,
    cards: [{ card, playerId: winnerPlayerId, order: 0 }],
  }
}

/** ナポレオン側 / 連合軍側がそれぞれ指定枚数の絵札を取った状態を作る */
const createGameState = ({
  targetTricks,
  napoleonFaceCards,
  citizenFaceCards,
}: {
  targetTricks: number
  napoleonFaceCards: number
  citizenFaceCards: number
}): GameState => {
  const tricks: Trick[] = []
  for (let i = 0; i < napoleonFaceCards; i++) {
    tricks.push(createFaceCardTrick(tricks.length, NAPOLEON_ID))
  }
  for (let i = 0; i < citizenFaceCards; i++) {
    tricks.push(createFaceCardTrick(tricks.length, CITIZEN_ID))
  }

  return {
    id: 'progress-test',
    players: [
      createPlayer(NAPOLEON_ID, { isNapoleon: true }),
      createPlayer(ADJUTANT_ID, { isAdjutant: true }),
      createPlayer(CITIZEN_ID),
      createPlayer('cit2'),
    ],
    phase: GAME_PHASES.PLAYING,
    currentPlayerIndex: 0,
    currentTrick: { id: 'current', cards: [], completed: false },
    tricks,
    hiddenCards: [],
    trumpSuit: SUIT_ENUM.SPADES,
    napoleonDeclaration: {
      playerId: NAPOLEON_ID,
      targetTricks,
      suit: SUIT_ENUM.SPADES,
    },
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('getGameProgress remaining face cards', () => {
  it('reports Napoleon remaining as declaration minus cards already won', () => {
    const state = createGameState({
      targetTricks: 15,
      napoleonFaceCards: 8,
      citizenFaceCards: 0,
    })

    const progress = getGameProgress(state)

    expect(progress.napoleonTeamFaceCards).toBe(8)
    expect(progress.napoleonNeedsToWin).toBe(15 - 8)
  })

  it('clamps each side to zero instead of going negative', () => {
    // ナポレオン側が宣言を超えて取った場合
    const napoleonOvershoot = getGameProgress(
      createGameState({
        targetTricks: 13,
        napoleonFaceCards: 16,
        citizenFaceCards: 0,
      })
    )
    expect(napoleonOvershoot.napoleonNeedsToWin).toBe(0)

    // 連合軍が阻止に必要な枚数を超えて取った場合
    const allianceOvershoot = getGameProgress(
      createGameState({
        targetTricks: 13,
        napoleonFaceCards: 0,
        citizenFaceCards: 12,
      })
    )
    expect(allianceOvershoot.allianceNeedsToWin).toBe(0)
  })

  it.each([
    13,
    15,
    18,
    NAPOLEON_RULES.TOTAL_FACE_CARDS,
  ])('reports an alliance remaining count consistent with isGameDecided (target %i)', (targetTricks) => {
    const blockingTotal = NAPOLEON_RULES.TOTAL_FACE_CARDS - targetTricks + 1
    const alreadyWon = Math.max(0, blockingTotal - 2)

    const state = createGameState({
      targetTricks,
      napoleonFaceCards: 0,
      citizenFaceCards: alreadyWon,
    })
    const progress = getGameProgress(state)

    // 不変条件: 残り枚数ちょうどを取れば阻止が確定し、1 枚足りなければ未確定
    expect(progress.allianceNeedsToWin).toBeGreaterThan(0)

    const oneShort = createGameState({
      targetTricks,
      napoleonFaceCards: 0,
      citizenFaceCards: alreadyWon + progress.allianceNeedsToWin - 1,
    })
    expect(isGameDecided(oneShort).decided).toBe(false)

    const exact = createGameState({
      targetTricks,
      napoleonFaceCards: 0,
      citizenFaceCards: alreadyWon + progress.allianceNeedsToWin,
    })
    const decided = isGameDecided(exact)
    expect(decided.decided).toBe(true)
    expect(decided.napoleonWon).toBe(false)
  })

  it('shrinks the alliance remaining count as they take more face cards', () => {
    const before = getGameProgress(
      createGameState({
        targetTricks: 15,
        napoleonFaceCards: 0,
        citizenFaceCards: 2,
      })
    )
    const after = getGameProgress(
      createGameState({
        targetTricks: 15,
        napoleonFaceCards: 0,
        citizenFaceCards: 5,
      })
    )

    expect(after.allianceNeedsToWin).toBe(before.allianceNeedsToWin - 3)
  })
})
