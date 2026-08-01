/**
 * 競り（ナポレオン宣言フェーズ）中の「呼ぶ札」秘匿の不変条件
 *
 * AI は宣言と同時に副官指定カードを決め、人間は宣言後に選ぶ。この非対称のせいで
 * 競りの最中に AI の指定カードだけが人間へ届いていた。ここで固定したいのは
 * 実装手順ではなく次の 4 つの性質:
 *
 * 1. 宣言フェーズ中、宣言者以外へ渡る state には指定カードが一切残らない
 * 2. 宣言者本人には見える
 * 3. 宣言フェーズを抜けたら全員に見える（確定後は公開情報）
 * 4. サーバー側の副官決定ロジックはマスク済み state では成立しない
 *    = 権威ある処理には必ず未マスクの state を渡す必要がある
 */

import { GAME_PHASES, MASKED_CARD, SUIT_ENUM } from '@/lib/constants'
import { maskGameStateForPlayer } from '@/lib/game/maskGameState'
import { setAdjutant } from '@/lib/gameLogic'
import { findAdjutant, isAdjutantCardBuried } from '@/lib/napoleonRules'
import type { Card, GameState, Player } from '@/types/game'

const NAPOLEON_ID = 'ai-1'
const HUMAN_ID = 'human'
const HOLDER_ID = 'ai-2'
const OUTSIDER_ID = 'ai-3'

/** AI ナポレオンが宣言時に指定した「呼ぶ札」（♠A） */
const CALLED_CARD: Card = {
  id: 'called-spades-a',
  suit: SUIT_ENUM.SPADES,
  rank: 'A',
  value: 14,
}

const BURIED_CARD: Card = {
  id: 'buried-hearts-a',
  suit: SUIT_ENUM.HEARTS,
  rank: 'A',
  value: 14,
}

const createCard = (id: string): Card => ({
  id,
  suit: SUIT_ENUM.CLUBS,
  rank: '3',
  value: 3,
})

const createPlayer = (
  id: string,
  position: number,
  hand: Card[],
  overrides: Partial<Player> = {}
): Player => ({
  id,
  name: `Player ${id}`,
  hand,
  isNapoleon: false,
  isAdjutant: false,
  position,
  isAI: id !== HUMAN_ID,
  ...overrides,
})

/**
 * 競りの途中: AI ナポレオンが宣言済みだが、人間はまだ上乗せできる状態。
 * declareNapoleon が isNapoleon / trumpSuit / napoleonCard を立てるため、
 * この時点でも「暫定ナポレオン」は存在する
 */
const createBiddingState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'bidding-game',
  players: [
    createPlayer(NAPOLEON_ID, 1, [createCard('n1'), createCard('n2')], {
      isNapoleon: true,
    }),
    createPlayer(HUMAN_ID, 2, [createCard('h1'), createCard('h2')]),
    // 呼ばれた札を持っている＝副官になるプレイヤー
    createPlayer(HOLDER_ID, 3, [CALLED_CARD, createCard('a1')]),
    createPlayer(OUTSIDER_ID, 4, [createCard('o1'), createCard('o2')]),
  ],
  phase: GAME_PHASES.NAPOLEON,
  currentPlayerIndex: 1,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  tricks: [],
  hiddenCards: [BURIED_CARD, createCard('hidden-2')],
  trumpSuit: SUIT_ENUM.SPADES,
  napoleonDeclaration: {
    playerId: NAPOLEON_ID,
    targetTricks: 14,
    suit: SUIT_ENUM.SPADES,
    adjutantCard: CALLED_CARD,
  },
  // declareNapoleon が互換用に複製する（gameLogic.ts）
  napoleonCard: CALLED_CARD,
  passedPlayers: [],
  declarationTurn: 1,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('bidding phase - the called card must not leak to other bidders', () => {
  it('hides the called card from a player who can still outbid', () => {
    const masked = maskGameStateForPlayer(createBiddingState(), HUMAN_ID)

    expect(masked.napoleonDeclaration?.adjutantCard).toBeUndefined()
    expect(masked.napoleonCard).toBeUndefined()
  })

  it('leaves no trace of the called card anywhere in the payload', () => {
    const masked = maskGameStateForPlayer(createBiddingState(), HUMAN_ID)

    // 手札マスクの穴（呼ばれた札の持ち主の手札）も含めて漏れていないこと
    expect(JSON.stringify(masked)).not.toContain(CALLED_CARD.id)
  })

  it('keeps the public parts of the bid visible so it can be outbid', () => {
    const masked = maskGameStateForPlayer(createBiddingState(), HUMAN_ID)

    expect(masked.napoleonDeclaration?.playerId).toBe(NAPOLEON_ID)
    expect(masked.napoleonDeclaration?.targetTricks).toBe(14)
    expect(masked.napoleonDeclaration?.suit).toBe(SUIT_ENUM.SPADES)
  })

  it('shows the declarer their own called card', () => {
    const masked = maskGameStateForPlayer(createBiddingState(), NAPOLEON_ID)

    expect(masked.napoleonDeclaration?.adjutantCard?.id).toBe(CALLED_CARD.id)
    expect(masked.napoleonCard?.id).toBe(CALLED_CARD.id)
  })

  it('hides it from the player who happens to hold the called card', () => {
    const masked = maskGameStateForPlayer(createBiddingState(), HOLDER_ID)

    expect(masked.napoleonDeclaration?.adjutantCard).toBeUndefined()
    expect(masked.napoleonCard).toBeUndefined()
  })

  it('does not mutate the server side state', () => {
    const original = createBiddingState()
    maskGameStateForPlayer(original, HUMAN_ID)

    expect(original.napoleonDeclaration?.adjutantCard?.id).toBe(CALLED_CARD.id)
    expect(original.napoleonCard?.id).toBe(CALLED_CARD.id)
  })

  it('does not crash when nobody has declared yet', () => {
    const masked = maskGameStateForPlayer(
      createBiddingState({
        napoleonDeclaration: undefined,
        napoleonCard: undefined,
      }),
      HUMAN_ID
    )

    expect(masked.napoleonDeclaration).toBeUndefined()
    expect(masked.napoleonCard).toBeUndefined()
  })
})

describe('after bidding closes - the called card is public', () => {
  const phasesAfterBidding = [
    GAME_PHASES.ADJUTANT,
    GAME_PHASES.EXCHANGE,
    GAME_PHASES.PLAYING,
    GAME_PHASES.FINISHED,
  ]

  it.each(phasesAfterBidding)('exposes it to everyone in %s', (phase) => {
    const state = createBiddingState({ phase })

    for (const viewerId of [NAPOLEON_ID, HUMAN_ID, HOLDER_ID, OUTSIDER_ID]) {
      const masked = maskGameStateForPlayer(state, viewerId)

      expect(masked.napoleonDeclaration?.adjutantCard?.id).toBe(CALLED_CARD.id)
      expect(masked.napoleonCard?.id).toBe(CALLED_CARD.id)
    }
  })
})

/**
 * マスクは「クライアントへ返す直前」だけのもので、副官を決める権威ある処理は
 * 未マスクの state を読む。マスク済み state を流し込むと副官が成立しない
 * ことをここで固定し、両者が取り違えられたら落ちるようにしておく
 */
describe('server side adjutant resolution runs on the unmasked state', () => {
  it('findAdjutant locates the holder in the unmasked state', () => {
    const state = createBiddingState()

    expect(findAdjutant(state, CALLED_CARD)?.id).toBe(HOLDER_ID)
    expect(isAdjutantCardBuried(state, CALLED_CARD)).toBe(false)
    expect(isAdjutantCardBuried(state, BURIED_CARD)).toBe(true)
  })

  it('cannot resolve the adjutant from a client masked state', () => {
    const masked = maskGameStateForPlayer(createBiddingState(), HUMAN_ID)

    // 他プレイヤーの手札も埋め札もダミーに置き換わっているため、
    // 「誰が持っているか」「埋まっているか」を判定する材料が残っていない
    expect(findAdjutant(masked, CALLED_CARD)).toBeNull()
    expect(isAdjutantCardBuried(masked, BURIED_CARD)).toBe(false)
    for (const card of masked.hiddenCards) {
      expect(card.id.startsWith(MASKED_CARD.ID_PREFIX)).toBe(true)
    }
  })

  it('setAdjutant flags the real holder when given the unmasked state', () => {
    const state = createBiddingState({ phase: GAME_PHASES.ADJUTANT })
    const result = setAdjutant(state, CALLED_CARD)

    expect(result.players.find((p) => p.isAdjutant)?.id).toBe(HOLDER_ID)
    expect(result.soloNapoleon).toBe(false)
    expect(result.napoleonCard?.id).toBe(CALLED_CARD.id)
  })

  it('setAdjutant on a masked state would wrongly produce a solo Napoleon', () => {
    // 取り違え検知用。マスク済みビューでは誰も副官になれず、埋め札判定も
    // 外れるため「副官不在なのに soloNapoleon でもない」壊れた state になる
    const masked = maskGameStateForPlayer(
      createBiddingState({ phase: GAME_PHASES.ADJUTANT }),
      HUMAN_ID
    )
    const result = setAdjutant(masked, CALLED_CARD)

    expect(result.players.some((p) => p.isAdjutant)).toBe(false)
    expect(result.soloNapoleon).toBe(false)
  })
})
