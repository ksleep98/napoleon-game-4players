/**
 * 特殊ルール込みでトリックの勝敗を評価するユーティリティ
 *
 * AI のヒューリスティック層はこれまで `getCardStrength()` の素の強度だけで
 * 「勝てるか / 誰が勝っているか」を判定していた。しかし実際の勝者判定は
 * `determineWinnerWithSpecialRules()` であり、狩りJ・よろめき・セイム2 は
 * 素の強度と逆転する。その結果、
 *
 * - 狩J（例: 切り札♠のとき♥J）は素の強度が「そのスート内で最弱」なので、
 *   場に表J（♠J）が出ていても AI は「勝てない」と判断して出さなかった。
 * - よろめき（マイティに♥Q）も同様に見えていなかった。
 *
 * ここでは実際の勝者判定関数をそのまま使って
 * 「この札を今出したらトリックを取れるか」を問い合わせる。
 */

import {
  CARD_RANKS,
  createDeck,
  GAME_CONFIG,
  SPECIAL_CARDS,
} from '@/lib/constants'
import {
  determineWinnerWithSpecialRules,
  isHeartQueen,
  isMighty,
} from '@/lib/napoleonCardRules'
import type { Card, GameState, PlayedCard, Suit, Trick } from '@/types/game'

/**
 * 仮想プレイの持ち主を表す番兵 ID。
 * 実プレイヤー ID と衝突しないよう内部専用の値を使う。
 */
const CANDIDATE_PLAYER_ID = '__ai_candidate__'

/** 「まだ見えていない札を持つ誰か」を表す番兵 ID */
const UNSEEN_PLAYER_ID = '__ai_unseen__'

const DEFAULT_TRUMP_SUIT: Suit = SPECIAL_CARDS.MIGHTY_SUIT

/** スート+ランクでカードを識別する（id の採番規則に依存しないため） */
function cardKey(card: Card): string {
  return `${card.suit}-${card.rank}`
}

const FULL_DECK: Card[] = createDeck()

function getTrumpSuit(gameState: GameState): Suit {
  return (gameState.trumpSuit as Suit) || DEFAULT_TRUMP_SUIT
}

function isFirstTrick(gameState: GameState): boolean {
  return (gameState.tricks?.length ?? 0) === 0
}

function appendToTrick(trick: Trick, card: Card, playerId: string): Trick {
  return {
    ...trick,
    cards: [...trick.cards, { card, playerId, order: trick.cards.length }],
  }
}

/**
 * 現時点でトリックを取っている手を返す（特殊ルール込み）
 * まだ 1 枚も出ていない場合は null
 */
export function getCurrentTrickWinner(
  currentTrick: Trick,
  gameState: GameState
): PlayedCard | null {
  if (currentTrick.cards.length === 0) return null

  return determineWinnerWithSpecialRules(
    currentTrick,
    getTrumpSuit(gameState),
    isFirstTrick(gameState)
  )
}

/**
 * この札を今出したらトリックを取れるか（特殊ルール込み）
 *
 * 「今出したら」であって「最終的に取れる」ではない点に注意。
 * 後続プレイヤーに抜かれる可能性は `isTrickSafeAfterPlaying` で別途評価する。
 */
export function wouldWinTrick(
  card: Card,
  currentTrick: Trick,
  gameState: GameState
): boolean {
  // リード局面では常に「今は自分が勝っている」
  if (currentTrick.cards.length === 0) return true

  const winner = determineWinnerWithSpecialRules(
    appendToTrick(currentTrick, card, CANDIDATE_PLAYER_ID),
    getTrumpSuit(gameState),
    isFirstTrick(gameState)
  )

  return winner?.playerId === CANDIDATE_PLAYER_ID
}

/**
 * 手札のうち、今出せばトリックを取れる札を返す（特殊ルール込み）
 */
export function getWinningCards(
  cards: Card[],
  currentTrick: Trick,
  gameState: GameState
): Card[] {
  return cards.filter((card) => wouldWinTrick(card, currentTrick, gameState))
}

/**
 * 「トリックの勝者を変えうる札」だけに絞り込む。
 *
 * リードスートでも切り札でもなく、J・マイティ・♥Q・2 のいずれでもない札は
 * 素の強度が `OTHER_BASE`（= 常にリード札の `LEADING_BASE` 未満）にしかならず、
 * 特殊ルール（狩りJ=J / よろめき=♥Q / セイム2=2）の対象にもならないので、
 * 勝者を動かすことはない。総当たりの探索空間を半分以下に落とすための枝刈り。
 */
function canPossiblyWin(
  card: Card,
  leadingSuit: Suit | undefined,
  trumpSuit: Suit
): boolean {
  if (card.suit === leadingSuit) return true
  if (card.suit === trumpSuit) return true
  if (card.rank === CARD_RANKS.JACK) return true
  if (card.rank === SPECIAL_CARDS.SAME_TWO_RANK) return true
  if (isMighty(card)) return true
  if (isHeartQueen(card)) return true
  return false
}

/**
 * まだ誰が持っているか分からない札のうち、勝者を動かしうるものを列挙する。
 *
 * 「完了したトリックの札」「現在のトリックの札」「自分の手札」を除いた残り。
 * 埋め札（4 枚）はナポレオンの手札に入るため除外せず、未知の札として扱う
 * ＝安全側（＝「まだ抜かれうる」と判定する側）に倒れる。
 */
function getRelevantUnseenCards(
  gameState: GameState,
  currentTrick: Trick,
  myHand: Card[]
): Card[] {
  const seen = new Set<string>()

  for (const trick of gameState.tricks ?? []) {
    for (const played of trick.cards) seen.add(cardKey(played.card))
  }
  for (const played of currentTrick.cards) seen.add(cardKey(played.card))
  for (const card of myHand) seen.add(cardKey(card))

  const trumpSuit = getTrumpSuit(gameState)
  const leadingSuit = currentTrick.cards[0]?.card.suit

  return FULL_DECK.filter(
    (card) =>
      !seen.has(cardKey(card)) && canPossiblyWin(card, leadingSuit, trumpSuit)
  )
}

/**
 * セイム2 が今後まだ成立しうるか。
 *
 * セイム2 は 4 枚揃って初めて判定されるルールなので、3 枚以下の局面で
 * 1 枚だけ足す試行では検出できない。「渡した絵札がセイム2 で持って
 * いかれる」事故を防ぐため、成立余地があるかを別途判定する。
 */
function isSame2StillPossible(
  hypotheticalTrick: Trick,
  gameState: GameState,
  myHand: Card[]
): boolean {
  const cards = hypotheticalTrick.cards
  if (cards.length >= GAME_CONFIG.PLAYERS_COUNT) return false

  const trumpSuit = getTrumpSuit(gameState)
  const leadingSuit = cards[0]?.card.suit
  if (!leadingSuit) return false

  // 切り札リードのトリックではセイム2 は成立しない
  if (leadingSuit === trumpSuit) return false

  // 途中で別スートが出ていれば 4 枚同スートにはならない
  if (cards.some((pc) => pc.card.suit !== leadingSuit)) return false

  // 既に 2 が出ているなら、残りが全て同スートで揃えばセイム2 が成立する
  const twoAlreadyPlayed = cards.some(
    (pc) => pc.card.rank === SPECIAL_CARDS.SAME_TWO_RANK
  )
  if (twoAlreadyPlayed) return true

  // まだ 2 が出ていない場合、そのスートの 2 が未確認なら成立余地がある
  const seen = new Set<string>()
  for (const trick of gameState.tricks ?? []) {
    for (const played of trick.cards) seen.add(cardKey(played.card))
  }
  for (const played of cards) seen.add(cardKey(played.card))
  for (const card of myHand) seen.add(cardKey(card))

  return !seen.has(`${leadingSuit}-${SPECIAL_CARDS.SAME_TWO_RANK}`)
}

/**
 * この札を出したとき、トリックが自チームのものとして確定するか。
 *
 * 「味方が勝っているから絵札を渡す」判断は、この関数が true のときだけ
 * 行ってよい。トリック内順位を見ずに渡すと、後続の相手に勝ち札を出されて
 * 渡した絵札ごと持っていかれる（実際に起きていたバグ）。
 *
 * 判定方法:
 * - 自分が最後の打ち手 → 4 枚揃った状態で実際の勝者判定を行う（厳密）
 * - それ以外 → 未確認札を足して勝ちが相手に移らないかを総当たりで確認する。
 *   残り 2 席あるときは 2 枚の組み合わせまで展開する（下記参照）。
 *   唯一 4 枚揃って初めて成立するセイム2 だけ `isSame2StillPossible` で別途弾く。
 *
 * ⚠️ 「追加された札自身が勝つか」だけを見てはいけない。特殊ルールは、
 * 追加された札が勝たなくても **既に場に出ている相手の札へ勝ちを移す** ことが
 * ある。必ず「勝者が自チームのままか」で判定すること。
 *   例1: 切り札♥、場 [相手:♦J(裏J), 味方:♦4]、自分がマイティ → 未確認の♥Q が
 *        来ると「よろめき」で勝ちが相手の♦J に移る（♥Q 自身は勝たない）
 *   例2: 切り札♠、場 [相手:♠J, 味方:♠5]、自分が♥J(狩J)で勝ち → 未確認の
 *        ♣J(裏J)が来ると狩りJ が無効化され、勝ちが相手の♠J に戻る
 *
 * 後続プレイヤーのフォロー義務は考慮しない（＝抜ける札が理論上存在する
 * だけで「確定していない」と判定する）ので、常に保守側に倒れる。
 */
export function isTrickSafeAfterPlaying(
  card: Card,
  currentTrick: Trick,
  gameState: GameState,
  myHand: Card[],
  isTeammate: (playerId: string) => boolean
): boolean {
  // リード局面では後続が 3 人残っており、確定などしない
  if (currentTrick.cards.length === 0) return false

  const hypothetical = appendToTrick(currentTrick, card, CANDIDATE_PLAYER_ID)
  return isTrickLockedForTeam(hypothetical, gameState, myHand, isTeammate)
}

/**
 * 自分が何も出していない時点で、既にトリックが自チームのものとして
 * 確定しているか。
 *
 * 確定しているなら、そこへマイティなどの最強札を重ねるのはただの無駄打ち。
 */
export function isTrickWonByTeamWithoutPlaying(
  currentTrick: Trick,
  gameState: GameState,
  myHand: Card[],
  isTeammate: (playerId: string) => boolean
): boolean {
  if (currentTrick.cards.length === 0) return false

  // 自分の手番ぶんの席は「まだ自分が出していない」＝残席から除く必要がある。
  // ここでは自分の札を足さずに、残りの相手席だけで奪われないかを見る。
  return isTrickLockedForTeam(
    currentTrick,
    gameState,
    myHand,
    isTeammate,
    /* seatsAlreadyCommitted */ 1
  )
}

/**
 * 与えられた（自分の札まで含んだ）トリックが、自チームのものとして確定するか。
 *
 * `seatsAlreadyCommitted` は「この trick には含まれないが、もう相手が動けない席」
 * の数。`isTrickWonByTeamWithoutPlaying` から自分の席ぶんを差し引くために使う。
 */
function isTrickLockedForTeam(
  trick: Trick,
  gameState: GameState,
  myHand: Card[],
  isTeammate: (playerId: string) => boolean,
  seatsAlreadyCommitted = 0
): boolean {
  const trumpSuit = getTrumpSuit(gameState)
  const firstTrick = isFirstTrick(gameState)

  const isOurs = (playerId: string): boolean =>
    playerId === CANDIDATE_PLAYER_ID || isTeammate(playerId)

  const winnerIsOurs = (probe: Trick): boolean => {
    const winner = determineWinnerWithSpecialRules(probe, trumpSuit, firstTrick)
    return winner !== null && isOurs(winner.playerId)
  }

  const remainingSeats =
    GAME_CONFIG.PLAYERS_COUNT - trick.cards.length - seatsAlreadyCommitted

  // これ以上場が動かないなら、今の勝者がそのまま勝者（セイム2 も込みで厳密）
  if (remainingSeats <= 0) return winnerIsOurs(trick)

  // 現時点で味方が勝っていなければ、確定の前提が崩れている
  if (!winnerIsOurs(trick)) return false

  // 4 枚揃って初めて成立するセイム2 の余地が残っていれば確定扱いしない
  if (isSame2StillPossible(trick, gameState, myHand)) return false

  // 未確認札を足して勝ちが相手に移らないか総当たりで確認。
  // 残っている席は全員相手だと仮定する（保守側）。
  const threats = getRelevantUnseenCards(gameState, trick, myHand)

  for (const threat of threats) {
    if (!winnerIsOurs(appendToTrick(trick, threat, UNSEEN_PLAYER_ID))) {
      return false
    }
  }

  // 残り 2 席のときは「2 枚揃って初めて勝ちが移る」複合手がある。
  // 例: 自陣のマイティが場にある局面で、未確認の♥Q と 表J/裏J が両方来ると
  // よろめき＋J の優先順位で相手の J が勝つ。1 手先読みでは原理的に検出できない。
  // 内側ループは 1 枚探査を全通過した候補でしか回らないので実行頻度は低い。
  if (remainingSeats >= 2) {
    for (let i = 0; i < threats.length; i++) {
      const first = appendToTrick(trick, threats[i], UNSEEN_PLAYER_ID)
      for (let j = i + 1; j < threats.length; j++) {
        if (!winnerIsOurs(appendToTrick(first, threats[j], UNSEEN_PLAYER_ID))) {
          return false
        }
      }
    }
  }

  return true
}

/**
 * 自分が `card` を出した後、**リードスートの未確認札** で勝ちを奪われうるか。
 *
 * `isTrickSafeAfterPlaying` の緩和版。マイティのよろめきリスクのように
 * 「その札に固有で、いつ出しても避けられないリスク」まで理由に手を止めると、
 * 副官カードを最後まで抱え込んで呼びに応えられなくなる。そこで
 * 「同じスートで普通に上から被せられる」危険（♠K に対する未確認の♠A など）
 * だけを見る。
 */
export function canLeadingSuitThreatTakeTrick(
  card: Card,
  currentTrick: Trick,
  gameState: GameState,
  myHand: Card[],
  isTeammate: (playerId: string) => boolean
): boolean {
  if (currentTrick.cards.length === 0) return true

  const leadingSuit = currentTrick.cards[0].card.suit
  const trumpSuit = getTrumpSuit(gameState)
  const firstTrick = isFirstTrick(gameState)
  const hypothetical = appendToTrick(currentTrick, card, CANDIDATE_PLAYER_ID)

  const remainingSeats = GAME_CONFIG.PLAYERS_COUNT - hypothetical.cards.length
  if (remainingSeats <= 0) return false

  const isOurs = (playerId: string): boolean =>
    playerId === CANDIDATE_PLAYER_ID || isTeammate(playerId)

  return getRelevantUnseenCards(gameState, currentTrick, myHand)
    .filter((threat) => threat.suit === leadingSuit)
    .some((threat) => {
      const winner = determineWinnerWithSpecialRules(
        appendToTrick(hypothetical, threat, UNSEEN_PLAYER_ID),
        trumpSuit,
        firstTrick
      )
      return winner === null || !isOurs(winner.playerId)
    })
}
