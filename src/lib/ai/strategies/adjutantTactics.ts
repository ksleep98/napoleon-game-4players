/**
 * Adjutant tactical strategy functions for AI card selection
 * 副官戦術関連の関数
 */

import {
  isCounterJack as checkIsCounterJack,
  isMighty as checkIsMighty,
  isTrumpJack as checkIsTrumpJack,
} from '@/lib/napoleonCardRules'
import type { Card, GameState, Suit, Trick } from '@/types/game'
import {
  calculateGameProgress,
  getCardStrengthSafe,
  isFaceCard,
} from './helpers'
import {
  canLeadingSuitThreatTakeTrick,
  isTrickSafeAfterPlaying,
  isTrickWonByTeamWithoutPlaying,
  wouldWinTrick,
} from './trickOutcome'
import { isNapoleonWinning } from './trumps'
import type { AdjutantTacticalInfo, WinningRequirements } from './types'

/**
 * 副官戦略評価
 */
export function evaluateAdjutantStrategy(
  card: Card,
  gameState: GameState
): number {
  let bonus = 0

  // 副官はナポレオンをサポート
  // 中程度の強さのカードを温存
  const baseStrength = getCardStrengthSafe(card, gameState)
  if (baseStrength >= 400 && baseStrength <= 600) bonus += 50

  // 副官指定カードなら早めに出すため大きなボーナス
  const adjutantCard = gameState.napoleonDeclaration?.adjutantCard
  if (adjutantCard && card.id === adjutantCard.id) {
    bonus += 500 // 副官指定カードを優先的に出すための高いボーナス
  }

  return bonus
}

/**
 * 副官呼びに応えて副官カードを出してよいか（安全判定）。
 *
 * 二段構え:
 *  1. トリックが自チームのものとして確定するなら、文句なく出してよい
 *  2. 確定しなくても、同じリードスートの未確認札に上から被せられる危険が
 *     無いなら出してよい
 *
 * 2 を残しているのは、マイティのよろめきリスク（未確認の♥Q）のように
 * 「その札に固有で、いつ出しても避けられないリスク」まで理由に手を止めると、
 * 副官カードを最後まで抱え込んで呼びに一度も応えられなくなるため。
 * 逆に、副官カードが普通の絵札（♠K など）で未確認の♠A に抜かれる、という
 * 回避可能な失点だけは 2 で確実に弾ける。
 */
function isAdjutantCallSafe(
  adjutantCard: Card,
  currentTrick: Trick,
  gameState: GameState,
  hand: Card[],
  isTeammate: (playerId: string) => boolean
): boolean {
  if (
    isTrickSafeAfterPlaying(
      adjutantCard,
      currentTrick,
      gameState,
      hand,
      isTeammate
    )
  ) {
    return true
  }

  return !canLeadingSuitThreatTakeTrick(
    adjutantCard,
    currentTrick,
    gameState,
    hand,
    isTeammate
  )
}

/**
 * 副官の戦術を評価
 * 副官特有の戦略（カード開示、ナポレオンへのサポート、協調プレイ）を最適化
 */
export function evaluateAdjutantTactics(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  requirements: WinningRequirements,
  hand: Card[] = playableCards
): AdjutantTacticalInfo {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // ナポレオンを取得
  const napoleon = gameState.players.find((p) => p.isNapoleon)

  // 副官指定カードを取得
  const adjutantCardId = gameState.napoleonDeclaration?.adjutantCard?.id
  const adjutantCard = adjutantCardId
    ? playableCards.find((card) => card.id === adjutantCardId) || null
    : null

  // ナポレオンが現在のトリックで勝っているかチェック
  const napoleonIsWinning = napoleon
    ? isNapoleonWinning(currentTrick, gameState)
    : false

  // トリック内の絵札数
  const faceCardsInTrick = currentTrick.cards.filter((tc) =>
    isFaceCard(tc.card)
  ).length

  // ゲーム進行度
  const gameProgress = calculateGameProgress(gameState)
  const remainingTricks = 12 - gameState.tricks.length

  // ナポレオンの目標達成状況を評価
  const napoleonNeedsHelp =
    requirements.napoleonNeedsToWin > 0 &&
    requirements.napoleonNeedsToWin >= remainingTricks * 0.5 // 残りトリックの50%以上必要な場合

  // トリックのナポレオンへの価値評価（0-10）
  let trickValueForNapoleon = 0
  if (faceCardsInTrick >= 3)
    trickValueForNapoleon = 10 // 非常に価値が高い
  else if (faceCardsInTrick === 2)
    trickValueForNapoleon = 7 // 価値が高い
  else if (faceCardsInTrick === 1)
    trickValueForNapoleon = 4 // 中程度の価値
  else trickValueForNapoleon = 1 // 低い価値

  // 終盤（残り3トリック以下）はトリック価値を上昇
  if (remainingTricks <= 3 && faceCardsInTrick > 0) {
    trickValueForNapoleon = Math.min(10, trickValueForNapoleon + 3)
  }

  // 副官カード開示の最適タイミング評価（0-10）
  let optimalRevealTiming = 0
  if (adjutantCard) {
    // リードスートと一致するか
    const leadingSuit = currentTrick.leadingSuit || gameState.leadingSuit
    const matchesLeadingSuit = leadingSuit
      ? adjutantCard.suit === leadingSuit
      : false

    if (matchesLeadingSuit) {
      // 序盤〜中盤（70%まで）は開示しやすい
      if (gameProgress < 0.3)
        optimalRevealTiming = 9 // 早期開示が最適
      else if (gameProgress < 0.5)
        optimalRevealTiming = 7 // 中盤も良い
      else if (gameProgress < 0.7)
        optimalRevealTiming = 5 // まだ間に合う
      else optimalRevealTiming = 3 // 終盤は遅い

      // 特殊カードとの競合チェック
      if (
        checkIsMighty(adjutantCard) ||
        checkIsTrumpJack(adjutantCard, trumpSuit) ||
        checkIsCounterJack(adjutantCard, trumpSuit)
      ) {
        optimalRevealTiming = 0 // 特殊カードは開示に使わない
      }

      // トリック内に特殊カードがある場合は開示しない
      const hasMightyOrJack = currentTrick.cards.some(
        (tc) =>
          checkIsMighty(tc.card) ||
          checkIsTrumpJack(tc.card, trumpSuit) ||
          checkIsCounterJack(tc.card, trumpSuit)
      )
      if (hasMightyOrJack) {
        optimalRevealTiming = Math.max(0, optimalRevealTiming - 5)
      }
    }
  }

  // 副官カードを今開示すべきか
  const shouldRevealNow =
    adjutantCard !== null &&
    optimalRevealTiming >= 7 &&
    currentTrick.cards.length > 0 // リード時は出さない

  // ナポレオンを保護すべきか（積極的にサポート）
  const shouldProtectNapoleon =
    napoleonNeedsHelp || (faceCardsInTrick >= 2 && !napoleonIsWinning)

  // ナポレオンの「副官呼び」に副官カードで応えるべきか。
  //
  // ナポレオンは副官指定カードのスートを（10 や Q あたりで）リードして副官を
  // 呼び出す。副官がそれに応えず絵札だけ捨てると、後続の連合軍に絵札ごと
  // トリックを持っていかれる。副官カードで実際にトリックを取れるなら出す。
  //
  // 開示タイミング評価（optimalRevealTiming）はマイティ・表J・裏Jを 0 に
  // 落とすため、副官カードがマイティのときに永久に出せなくなっていた。
  // 「呼ばれていて、かつ勝てる」場面は温存する理由がないので別判定にする。
  //
  // ただし「今勝てる」だけでは足りない:
  //  - 副官カードが普通の絵札（♠K など）だと、後続の連合軍に♠A で抜かれて
  //    絵札ごと献上することになる → 抜かれないことを確認する
  //  - 既に自チームがトリックを取り切っているなら、マイティを重ねるのは
  //    ただの無駄打ち → 自陣が確定勝ちの局面では出さない
  const currentLeadingSuit = currentTrick.leadingSuit || gameState.leadingSuit
  const isNapoleonTeamMember = (playerId: string): boolean =>
    playerId === napoleon?.id

  // 自分が出す前に、既に自チームでトリックが確定しているか
  const alreadySecuredWithoutMe =
    napoleonIsWinning &&
    currentTrick.cards.length > 0 &&
    isTrickWonByTeamWithoutPlaying(currentTrick, gameState, hand, (playerId) =>
      isNapoleonTeamMember(playerId)
    )

  const adjutantCallWins =
    adjutantCard !== null &&
    currentTrick.cards.length > 0 &&
    currentLeadingSuit === adjutantCard.suit &&
    faceCardsInTrick >= 1 &&
    wouldWinTrick(adjutantCard, currentTrick, gameState)

  const shouldAnswerAdjutantCall =
    adjutantCallWins &&
    !alreadySecuredWithoutMe &&
    adjutantCard !== null &&
    isAdjutantCallSafe(
      adjutantCard,
      currentTrick,
      gameState,
      hand,
      isNapoleonTeamMember
    )
  const adjutantCallCard = shouldAnswerAdjutantCall ? adjutantCard : null

  // ナポレオンのために勝つべきか（ナポレオンが弱い時）
  const shouldWinForNapoleon =
    napoleonNeedsHelp &&
    !napoleonIsWinning &&
    faceCardsInTrick >= 2 &&
    remainingTricks <= 6 // 中盤以降

  // ナポレオンに渡すべき絵札を選択
  //
  // マイティーだけでなく表J・裏Jも除外する。これらは「弱い絵札」ではなく
  // 単独で別トリックを取れる最強級カードなので、マイティーが既に勝っている
  // トリックに被せて捨ててはいけない（連合軍側の getFaceCardToPassToAlliance
  // と同じ除外条件に揃える）。
  const passableFaceCards = playableCards.filter(
    (card) =>
      isFaceCard(card) &&
      !checkIsMighty(card) &&
      !checkIsTrumpJack(card, trumpSuit) &&
      !checkIsCounterJack(card, trumpSuit)
  )

  // 最も弱い絵札を選択（10 > Q > K > A の順）
  const weakestFaceCard =
    passableFaceCards.length > 0
      ? [...passableFaceCards].sort(
          (a, b) =>
            getCardStrengthSafe(a, gameState) -
            getCardStrengthSafe(b, gameState)
        )[0]
      : null

  // 絵札をナポレオンに渡すべきか
  //
  // 「ナポレオンが今勝っている」だけでは渡してはいけない。自分がまだ 2 番手・
  // 3 番手なら後続の連合軍に抜かれ、渡した絵札ごと相手の得点になる。実際に
  // 「ナポレオンが副官を呼ぶ 10/Q を出したのに、副官が別の絵札を捨てて
  // 連合軍に取られる」という事故が起きていた。
  // 渡してよいのは、その絵札を出してもトリックが自チームのものとして
  // 確定する場合だけ。
  const shouldPassFaceCard =
    napoleonIsWinning &&
    faceCardsInTrick >= 1 &&
    weakestFaceCard !== null &&
    isTrickSafeAfterPlaying(
      weakestFaceCard,
      currentTrick,
      gameState,
      hand,
      (playerId) => playerId === napoleon?.id
    )

  const faceCardToPass = shouldPassFaceCard ? weakestFaceCard : null

  return {
    shouldRevealNow,
    shouldProtectNapoleon,
    shouldPassFaceCard,
    shouldWinForNapoleon,
    napoleonNeedsHelp,
    trickValueForNapoleon,
    optimalRevealTiming,
    napoleonIsWinning,
    adjutantCard,
    faceCardToPass,
    shouldAnswerAdjutantCall,
    adjutantCallCard,
  }
}
