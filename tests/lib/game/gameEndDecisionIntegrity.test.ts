/**
 * 「勝敗の早期確定は、未マスクの真の役職で判定されなければならない」不変条件
 *
 * 背景（実際に起きた不具合）:
 *   processAITurn は AI の思考へ「未公開の副官の正体を伏せたビュー」を渡す。
 *   かつてはそのビューのままゲームを1手進めていたため、
 *   playCard → completeTrick → scoring.isGameDecided が
 *   players[].isAdjutant からチームを分ける際に副官を連合軍だと誤認し、
 *   副官が取ったトリックの絵札を連合軍側へ計上していた。
 *   その結果「連合軍が上限超過」の分岐が誤って発火し、5トリック目でゲームが
 *   終了。役職は保存前に真の値へ戻されるため、DB には
 *   「isAdjutant=true / tricks=5 / decided=false なのに phase=finished」という
 *   内部矛盾した状態が残り、結果画面は
 *   「ナポレオン 10 枚・連合軍 0 枚なのに連合軍の勝ち」と表示した。
 *
 * ここでは実際に壊れた局面を固定し、加えて実装の内部挙動ではなく
 * 「AI 経由で進めた状態 == 真の状態へ直接着手した状態」という不変条件で守る。
 */

import {
  CARD_RANKS,
  createDeck,
  GAME_CONFIG,
  GAME_PHASES,
  SUIT_ENUM,
} from '@/lib/constants'
import type { Card, GameState, Player, Rank, Suit, Trick } from '@/types/game'

jest.mock('@/lib/ai/gameTricks', () => ({
  selectAICardForCurrentPlayer: jest.fn(),
  processAllAIPhases: jest.fn(),
}))

import { selectAICardForCurrentPlayer } from '@/lib/ai/gameTricks'
import { playCard, processAITurn } from '@/lib/gameLogic'
import {
  calculateGameResult,
  getPlayerFaceCardCount,
  getTeamFaceCardCounts,
  isGameDecided,
} from '@/lib/scoring'

const DECK = createDeck()

/** 実カードを id ごと再現する（createDeck と同じ id 体系を使う） */
function card(suit: Suit, rank: Rank): Card {
  const found = DECK.find((c) => c.suit === suit && c.rank === rank)
  if (!found) {
    throw new Error(`card not found: ${suit} ${rank}`)
  }
  return { ...found }
}

// 実際に壊れたゲーム（Supabase dev / games.id = game_1785552113648_0bkhfcut3）の登場人物
const NAPOLEON_ID = 'player_0801gkr22'
const ALLY_1_ID = 'player_zrkq75lp0'
const ALLY_2_ID = 'player_70mhmo0bq'
const ADJUTANT_ID = 'player_5t0qwtzzd'

const DECLARED_TARGET = 15
const TRUMP_SUIT: Suit = SUIT_ENUM.HEARTS

/** 副官指定カード = マイティ（♠A）。ユーザー証言「副官がマイティーを出した」 */
const ADJUTANT_DESIGNATION_CARD = card(SUIT_ENUM.SPADES, CARD_RANKS.ACE)

function makePlayer(
  id: string,
  position: number,
  hand: Card[],
  overrides: Partial<Player> = {}
): Player {
  return {
    id,
    name: id,
    hand,
    isNapoleon: false,
    isAdjutant: false,
    position,
    isAI: true,
    ...overrides,
  }
}

/**
 * 完了済みトリックを組む。
 * 集計に効くのは winnerPlayerId と cards の絵札だけなので、
 * 着手者は循環で割り当てる（実ゲームの席順とは一致させない）。
 */
function completedTrick(id: string, winnerId: string, cards: Card[]): Trick {
  const seats = [NAPOLEON_ID, ALLY_1_ID, ALLY_2_ID, ADJUTANT_ID]
  return {
    id,
    cards: cards.map((c, order) => ({
      card: c,
      playerId: seats[order],
      order,
    })),
    winnerPlayerId: winnerId,
    completed: true,
    leadingSuit: cards[0].suit,
  }
}

/** DB に残っていた 4 トリック分（副官 6 枚 / ナポレオン 2 枚 / 連合軍 0 枚） */
function completedTricksFromIncident(): Trick[] {
  return [
    completedTrick('trick_1', ADJUTANT_ID, [
      card(SUIT_ENUM.SPADES, CARD_RANKS.JACK),
      card(SUIT_ENUM.SPADES, CARD_RANKS.FIVE),
      card(SUIT_ENUM.SPADES, CARD_RANKS.TWO),
      card(SUIT_ENUM.SPADES, CARD_RANKS.SIX),
    ]),
    completedTrick('trick_2', ADJUTANT_ID, [
      card(SUIT_ENUM.DIAMONDS, CARD_RANKS.JACK),
      card(SUIT_ENUM.DIAMONDS, CARD_RANKS.TEN),
      card(SUIT_ENUM.DIAMONDS, CARD_RANKS.KING),
      card(SUIT_ENUM.DIAMONDS, CARD_RANKS.TWO),
    ]),
    completedTrick('trick_3', NAPOLEON_ID, [
      card(SUIT_ENUM.CLUBS, CARD_RANKS.KING),
      card(SUIT_ENUM.CLUBS, CARD_RANKS.TWO),
      card(SUIT_ENUM.CLUBS, CARD_RANKS.ACE),
      card(SUIT_ENUM.CLUBS, CARD_RANKS.SIX),
    ]),
    completedTrick('trick_4', ADJUTANT_ID, [
      card(SUIT_ENUM.HEARTS, CARD_RANKS.EIGHT),
      card(SUIT_ENUM.HEARTS, CARD_RANKS.KING),
      card(SUIT_ENUM.HEARTS, CARD_RANKS.NINE),
      card(SUIT_ENUM.HEARTS, CARD_RANKS.ACE),
    ]),
  ]
}

/** 4枚目を出す連合軍 AI が持っているカード */
const FOURTH_CARD = card(SUIT_ENUM.SPADES, CARD_RANKS.TEN)

/**
 * 第5トリックの途中（副官がマイティでリードし、あと1枚で完成）。
 * 手番は連合軍 AI（= 副官でも人間でもない）で、ここが不具合の発火点だった。
 */
function incidentState(): GameState {
  const currentTrick: Trick = {
    id: 'trick_5',
    cards: [
      {
        card: ADJUTANT_DESIGNATION_CARD,
        playerId: ADJUTANT_ID,
        order: 0,
      },
      {
        card: card(SUIT_ENUM.CLUBS, CARD_RANKS.FIVE),
        playerId: NAPOLEON_ID,
        order: 1,
      },
      {
        card: card(SUIT_ENUM.SPADES, CARD_RANKS.SEVEN),
        playerId: ALLY_1_ID,
        order: 2,
      },
    ],
    completed: false,
    leadingSuit: SUIT_ENUM.SPADES,
  }

  return {
    id: 'game_1785552113648_0bkhfcut3',
    players: [
      makePlayer(NAPOLEON_ID, 1, [card(SUIT_ENUM.CLUBS, CARD_RANKS.THREE)], {
        isNapoleon: true,
        isAI: false,
      }),
      makePlayer(ALLY_1_ID, 2, [card(SUIT_ENUM.CLUBS, CARD_RANKS.FOUR)]),
      makePlayer(ALLY_2_ID, 3, [
        FOURTH_CARD,
        card(SUIT_ENUM.HEARTS, CARD_RANKS.THREE),
      ]),
      makePlayer(ADJUTANT_ID, 4, [card(SUIT_ENUM.CLUBS, CARD_RANKS.SEVEN)], {
        isAdjutant: true,
      }),
    ],
    currentTrick,
    tricks: completedTricksFromIncident(),
    currentPlayerIndex: 2, // ALLY_2（AI）が4枚目を出す
    phase: GAME_PHASES.PLAYING,
    napoleonDeclaration: {
      playerId: NAPOLEON_ID,
      targetTricks: DECLARED_TARGET,
      suit: TRUMP_SUIT,
    },
    napoleonCard: ADJUTANT_DESIGNATION_CARD,
    soloNapoleon: false,
    leadingSuit: SUIT_ENUM.SPADES,
    trumpSuit: TRUMP_SUIT,
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(selectAICardForCurrentPlayer as jest.Mock).mockImplementation(
    async () => FOURTH_CARD
  )
})

describe('early game-end decision must use the true adjutant identity', () => {
  it('the incident position is not decided yet (napoleon 10 / allied 0 / target 15)', () => {
    const state = incidentState()
    const afterFourthCard = playCard(state, ALLY_2_ID, FOURTH_CARD.id)

    expect(afterFourthCard.tricks).toHaveLength(5)
    expect(getTeamFaceCardCounts(afterFourthCard)).toEqual({
      napoleonTeam: 10,
      citizenTeam: 0,
    })
    expect(isGameDecided(afterFourthCard).decided).toBe(false)
  })

  it('does not finish the game when an allied AI completes the trick the adjutant won', async () => {
    const result = await processAITurn(incidentState())

    expect(result.phase).toBe(GAME_PHASES.PLAYING)
    expect(result.tricks).toHaveLength(5)
    expect(result.tricks[4].winnerPlayerId).toBe(ADJUTANT_ID)
  })

  it('reproduces the reported per-player tally but without ending the game', async () => {
    const result = await processAITurn(incidentState())

    // 報告された画面と同じ内訳（2 / 0 / 0 / 8）が出る局面であること
    expect(
      result.players.map((p) => getPlayerFaceCardCount(result, p.id))
    ).toEqual([2, 0, 0, 8])
    // それでもゲームは終わっていない
    expect(result.phase).not.toBe(GAME_PHASES.FINISHED)
  })

  it('advances exactly like playing the same card on the unmasked state', async () => {
    const viaAI = await processAITurn(incidentState())
    const direct = playCard(incidentState(), ALLY_2_ID, FOURTH_CARD.id)

    expect(viaAI.phase).toBe(direct.phase)
    expect(viaAI.tricks).toHaveLength(direct.tricks.length)
    expect(getTeamFaceCardCounts(viaAI)).toEqual(getTeamFaceCardCounts(direct))
    expect(viaAI.players.map((p) => p.isAdjutant)).toEqual(
      direct.players.map((p) => p.isAdjutant)
    )
  })

  it('never leaves a finished state that the result screen contradicts', async () => {
    const result = await processAITurn(incidentState())

    // 不変条件: 12トリック未満で FINISHED なら、必ず勝敗が確定していること。
    // かつ、その確定内容は結果画面の計算（calculateGameResult）と一致すること。
    if (
      result.phase === GAME_PHASES.FINISHED &&
      result.tricks.length < GAME_CONFIG.CARDS_PER_PLAYER
    ) {
      const decision = isGameDecided(result)
      expect(decision.decided).toBe(true)
      expect(decision.napoleonWon).toBe(calculateGameResult(result).napoleonWon)
    }

    // この局面ではそもそも終了してはいけない
    expect(result.phase).toBe(GAME_PHASES.PLAYING)
  })
})
