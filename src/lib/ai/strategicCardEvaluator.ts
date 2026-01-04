/**
 * 戦略的カード評価システム
 * ナポレオンゲームの特殊ルールと戦略を考慮したAI判断
 */

import {
  isCounterJack as checkIsCounterJack,
  isMighty as checkIsMighty,
  isTrumpJack as checkIsTrumpJack,
  getCardStrength,
} from '@/lib/napoleonCardRules'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'

/**
 * カードの戦略的価値を評価
 * @param card 評価するカード
 * @param gameState 現在のゲーム状態
 * @param player カードを持つプレイヤー
 * @returns 戦略的価値スコア（高いほど重要）
 */
export function evaluateCardStrategicValue(
  card: Card,
  gameState: GameState,
  player: Player
): number {
  let strategicValue = 0

  // 基本強度を取得
  const baseStrength = getCardStrengthSafe(card, gameState)
  strategicValue += baseStrength

  // 1. 特殊カードボーナス
  if (checkIsMighty(card)) {
    strategicValue += 500 // マイティは最強
  } else if (
    checkIsCounterJack(card, (gameState.trumpSuit as Suit) || 'spades')
  ) {
    strategicValue += 400 // 裏ジャックは強力
  } else if (
    checkIsTrumpJack(card, (gameState.trumpSuit as Suit) || 'spades')
  ) {
    strategicValue += 350 // 表ジャックも強力
  } else if (card.suit === gameState.trumpSuit) {
    strategicValue += 200 // 切り札ボーナス
  }

  // 2. 役割別戦略調整
  if (player.isNapoleon) {
    strategicValue += evaluateNapoleonStrategy(card, gameState)
  } else if (player.isAdjutant) {
    strategicValue += evaluateAdjutantStrategy(card, gameState)
  } else {
    strategicValue += evaluateAllianceStrategy(card, gameState)
  }

  // 3. セイム2ポテンシャル評価
  strategicValue += evaluateSame2Potential(card, gameState)

  // 4. セイム2無効化カード評価（Mighty/Jackペナルティ）
  strategicValue += evaluateSame2Breaker(card, gameState)

  // 5. セイム2リスク評価（絵札がセイム2で取られるリスク）
  strategicValue += evaluateSame2RiskForFaceCard(card, gameState, player)

  // 6. 4枚揃わないスート評価
  strategicValue += evaluateNonViableSuit(card, gameState)

  // 7. ゲーム進行状況による調整
  const gameProgress = calculateGameProgress(gameState)
  strategicValue += evaluateGamePhaseStrategy(card, gameProgress, player)

  return strategicValue
}

/**
 * プレイ可能カードから最適なカードを選択
 * @param playableCards プレイ可能なカード配列
 * @param gameState 現在のゲーム状態
 * @param player カードを選択するプレイヤー
 * @returns 選択されたカード
 */
export function selectBestStrategicCard(
  playableCards: Card[],
  gameState: GameState,
  player: Player
): Card | null {
  if (playableCards.length === 0) return null
  if (playableCards.length === 1) return playableCards[0]

  const currentTrick = gameState.currentTrick

  // フォロー義務がない場合（最初のプレイヤー）
  if (currentTrick.cards.length === 0) {
    return selectLeadingCard(playableCards, gameState, player)
  }

  // フォロー義務がある場合
  return selectFollowingCard(playableCards, gameState, player, currentTrick)
}

/**
 * リードカード選択戦略
 */
function selectLeadingCard(
  playableCards: Card[],
  gameState: GameState,
  player: Player
): Card {
  // カードを戦略的価値で評価
  const cardEvaluations = playableCards.map((card) => ({
    card,
    strategicValue: evaluateCardStrategicValue(card, gameState, player),
    leadingStrategy: calculateLeadingStrategy(card, gameState, player),
  }))

  // 役割別のリード戦略
  if (player.isNapoleon) {
    // ナポレオン：強いカードでトリックを取りに行く
    return cardEvaluations.sort(
      (a, b) =>
        b.strategicValue +
        b.leadingStrategy -
        (a.strategicValue + a.leadingStrategy)
    )[0].card
  } else {
    // 連合軍：相手の強いカードを引き出すか、弱いカードで様子見
    const weakCards = cardEvaluations.filter(
      (evaluation) => evaluation.strategicValue < 500
    )
    const strongCards = cardEvaluations.filter(
      (evaluation) => evaluation.strategicValue >= 500
    )

    // 弱いカードがある場合は弱いカードで探り
    if (weakCards.length > 0) {
      return weakCards.sort((a, b) => a.strategicValue - b.strategicValue)[0]
        .card
    }

    // 強いカードしかない場合は最強カードで勝負
    return strongCards.sort((a, b) => b.strategicValue - a.strategicValue)[0]
      .card
  }
}

/**
 * フォローカード選択戦略
 */
function selectFollowingCard(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  currentTrick: Trick
): Card {
  // 既に出ているカード全てを考慮して、勝てるか判定
  const canWinTrick = canWinCurrentTrick(playableCards, currentTrick, gameState)

  // 勝てない場合は最弱カードを出す（役割に応じて戦略を変える）
  if (!canWinTrick) {
    let weakest: Card

    if (player.isNapoleon || player.isAdjutant) {
      // ナポレオンチーム：通常の最弱カード
      weakest = getWeakestCard(playableCards, gameState)
    } else {
      // 連合軍：非絵札を優先（絵札を取られないようにする）
      const weakestNonFace = getWeakestNonFaceCard(playableCards, gameState)
      weakest = weakestNonFace || getWeakestCard(playableCards, gameState)
    }

    return weakest
  }

  // 勝てる場合、役割に応じて判断
  if (player.isNapoleon || player.isAdjutant) {
    // 副官の特殊ロジック
    if (player.isAdjutant) {
      // 1. 副官カード早期開示（ナポレオンに認知してもらう）
      const adjutantCardReveal = shouldRevealAdjutantCard(
        playableCards,
        gameState,
        currentTrick
      )
      if (adjutantCardReveal) {
        return adjutantCardReveal
      }

      // 2. ナポレオンに絵札を渡す（得点稼ぎ）
      const faceCardPass = shouldPassFaceCardToNapoleon(
        playableCards,
        gameState,
        currentTrick,
        canWinTrick
      )
      if (faceCardPass) {
        return faceCardPass
      }

      // 3. ナポレオンが既に勝っている場合は絵札を渡す（マイティー除外）
      if (isNapoleonWinning(currentTrick, gameState)) {
        const cardToPlay = getFaceCardToPassToNapoleon(playableCards, gameState)
        return cardToPlay
      }
    }

    // ナポレオンチーム：勝てるなら勝つ（絵札を集める）
    return getLowestWinningCard(playableCards, currentTrick, gameState)
  } else {
    // 連合軍：ナポレオンチームが現在勝っている場合のみ勝つ（ブロック）
    if (isNapoleonWinning(currentTrick, gameState)) {
      return getLowestWinningCard(playableCards, currentTrick, gameState)
    }
    // 連合軍が既に勝っている場合は弱いカードを出す（味方に任せる）
    return getWeakestCard(playableCards, gameState)
  }
}

/**
 * ナポレオン戦略評価
 */
function evaluateNapoleonStrategy(card: Card, gameState: GameState): number {
  let bonus = 0

  // ナポレオンは積極的に強いカードを使う
  const baseStrength = getCardStrengthSafe(card, gameState)
  if (baseStrength > 700) bonus += 100 // 強いカードにボーナス

  return bonus
}

/**
 * 副官戦略評価
 */
function evaluateAdjutantStrategy(card: Card, gameState: GameState): number {
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
 * 連合軍戦略評価
 */
function evaluateAllianceStrategy(card: Card, gameState: GameState): number {
  let bonus = 0

  // 連合軍はナポレオンを妨害
  // 強いカードは温存、弱いカードで探り
  const baseStrength = getCardStrengthSafe(card, gameState)
  if (baseStrength < 300) bonus += 30 // 弱いカードで探り
  if (baseStrength > 800) bonus += 80 // 強いカードは温存して重要な場面で使用

  return bonus
}

/**
 * ゲーム進行段階による戦略調整
 */
function evaluateGamePhaseStrategy(
  _card: Card,
  gameProgress: number,
  player: Player
): number {
  let bonus = 0

  if (gameProgress < 0.3) {
    // 序盤：情報収集と温存
    bonus += player.isNapoleon ? 20 : -20
  } else if (gameProgress < 0.7) {
    // 中盤：積極的プレイ
    bonus += 30
  } else {
    // 終盤：全力勝負
    bonus += player.isNapoleon ? 50 : 40
  }

  return bonus
}

/**
 * セイム2ポテンシャル評価
 * 切り札以外の2は、そのスートが4枚揃う可能性がある場合に価値が高い
 */
function evaluateSame2Potential(card: Card, gameState: GameState): number {
  // 2以外のカードは評価しない
  if (card.rank !== '2') return 0

  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 切り札の2はセイム2にならないので評価しない
  if (card.suit === trumpSuit) return 0

  // ゲーム進行度を取得（初旬ほど2を温存すべき）
  const gameProgress = calculateGameProgress(gameState)

  // 現在のトリックを確認
  const currentTrick = gameState.currentTrick

  // デバッグ用フラグ（5%の確率でログ出力）
  const _shouldLog = Math.random() < 0.05

  // トリックが空の場合（リード時）
  if (currentTrick.cards.length === 0) {
    // 初旬（0-40%）は2でリードしない（強力に温存）
    if (gameProgress < 0.4) {
      return 800 // マイティー超えの超高ボーナスで温存
    }
    // 中盤（40-70%）もある程度温存
    if (gameProgress < 0.7) {
      return 400
    }
    // 終盤はセイム2を作るチャンス
    return 200
  }

  // 現在のトリックで異なるスートが出ている場合、そのスートは4枚揃わない
  const leadingSuit = currentTrick.cards[0].card.suit
  const allSameSuit = currentTrick.cards.every(
    (pc) => pc.card.suit === leadingSuit
  )

  // トリックにセイム2を無効化するカード（Mighty、Jack）があるかチェック
  const hasSame2Breaker = currentTrick.cards.some(
    (trickCard) =>
      checkIsMighty(trickCard.card) ||
      checkIsTrumpJack(trickCard.card, trumpSuit) ||
      checkIsCounterJack(trickCard.card, trumpSuit)
  )

  // Mighty/Jackが出ていてセイム2が無効化されている場合
  if (hasSame2Breaker) {
    // このトリックで2を出すのは無駄
    // トリック内の位置を考慮（早い段階ほど2を温存すべき）
    const trickPosition = currentTrick.cards.length // 現在何枚出ているか

    // トリックの早い段階（1-2枚目）でMighty/Jackが出ている場合
    // → まだ手札に余裕があるので、2は絶対に温存すべき
    if (trickPosition <= 2) {
      // 序盤・中盤は特に大きなペナルティ（2を絶対に出さない）
      let penalty = 0
      if (gameProgress < 0.5) {
        penalty = -400 // 超大ペナルティで2を温存
      } else if (gameProgress < 0.7) {
        penalty = -300 // 中盤後半も大ペナルティ
      } else {
        penalty = -200 // 終盤は捨てても良い
      }

      return penalty
    }

    // トリックの後半（3枚目）でMighty/Jackが出ている場合
    // → 手札が少なくなっているが、まだ温存の価値あり
    let penalty = 0
    if (gameProgress < 0.4) {
      penalty = -200 // 序盤は温存
    } else if (gameProgress < 0.7) {
      penalty = -150 // 中盤も温存傾向
    } else {
      penalty = -100 // 終盤は積極的に捨てる
    }

    return penalty
  }

  // まだ全て同じスートの場合（Mighty/Jackなし）
  if (allSameSuit) {
    // リードスートと同じなら、セイム2の可能性が高い
    if (card.suit === leadingSuit) {
      // セイム2発動の可能性があるので、超高ボーナス
      return 600
    }
    // 異なるスートでも、次のトリックで可能性がある
    // 初旬ほど温存
    if (gameProgress < 0.4) {
      return 500 // 初旬は強力に温存
    }
    return gameProgress < 0.7 ? 300 : 150
  }

  // 異なるスートが混ざっている場合（セイム2無効）
  // このトリックでは使えないが、次のトリックでの可能性を考慮
  if (gameProgress < 0.3) {
    return 0 // 初旬は捨てても良い（ただし他に捨てるカードがあれば）
  }
  if (gameProgress < 0.6) {
    return -50 // 中盤は捨てる傾向
  }
  // 終盤は積極的に捨てる
  return -100
}

/**
 * 4枚揃わないスート評価
 * 現在のトリックで異なるスートが出た場合、そのスートは弱い
 */
function evaluateNonViableSuit(card: Card, gameState: GameState): number {
  const currentTrick = gameState.currentTrick

  // トリックが空か、まだ1枚しか出ていない場合は判定不可
  if (currentTrick.cards.length <= 1) return 0

  const leadingSuit = currentTrick.cards[0].card.suit

  // 異なるスートが出ているかチェック
  const hasDifferentSuit = currentTrick.cards.some(
    (pc) => pc.card.suit !== leadingSuit
  )

  // 異なるスートが出ている = リードスートは4枚揃わない確定
  if (hasDifferentSuit && card.suit === leadingSuit) {
    // リードスートのカードは価値が下がる（捨てる優先度が高い）
    // ただし、絵札や高いカードは別の場面で使えるので、2-5のみペナルティ
    if (['2', '3', '4', '5'].includes(card.rank)) {
      return -50 // 低いカードは捨てる優先度が高い
    }
  }

  return 0
}

/**
 * セイム2無効化カード評価
 * マイティー・ジャックはセイム2を無効化するため、セイム2の可能性があるトリックでは出さない
 */
function evaluateSame2Breaker(card: Card, gameState: GameState): number {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // このカードがセイム2を無効化するカードか判定
  const isSame2Breaker =
    checkIsMighty(card) ||
    checkIsTrumpJack(card, trumpSuit) ||
    checkIsCounterJack(card, trumpSuit)

  if (!isSame2Breaker) return 0

  const currentTrick = gameState.currentTrick

  // トリックが空の場合は判定しない
  if (currentTrick.cards.length === 0) return 0

  const leadingSuit = currentTrick.cards[0].card.suit

  // 全て同じスートで、まだセイム2の可能性がある場合
  const allSameSuit = currentTrick.cards.every(
    (pc) => pc.card.suit === leadingSuit
  )

  // まだMighty/Jackが出ていないかチェック
  const alreadyHasSame2Breaker = currentTrick.cards.some(
    (trickCard) =>
      checkIsMighty(trickCard.card) ||
      checkIsTrumpJack(trickCard.card, trumpSuit) ||
      checkIsCounterJack(trickCard.card, trumpSuit)
  )

  // セイム2の可能性があるトリックでMighty/Jackを出すとセイム2を台無しにする
  if (
    allSameSuit &&
    !alreadyHasSame2Breaker &&
    currentTrick.cards.length >= 2
  ) {
    // ゲーム進行度を取得
    const gameProgress = calculateGameProgress(gameState)

    // 非常に大きなペナルティ（マイティーの+500を上回る）
    // トリックのカード枚数が多いほど（3枚の時）、セイム2の可能性が高いのでペナルティも大きく
    const basePenalty = currentTrick.cards.length >= 3 ? -600 : -450

    // 初旬ほどセイム2の価値が高いので、ペナルティも大きく
    if (gameProgress < 0.4) {
      return basePenalty - 100 // 初旬は特に大きなペナルティ
    }
    if (gameProgress < 0.7) {
      return basePenalty - 50 // 中盤もペナルティ
    }
    return basePenalty // 終盤でもペナルティ
  }

  return 0
}

/**
 * セイム2リスク評価（絵札用）
 * トリックに同じスートが2-3枚出ている状況で、絵札を出すと相手の2に取られるリスクを評価
 */
function evaluateSame2RiskForFaceCard(
  card: Card,
  gameState: GameState,
  player: Player
): number {
  // 絵札以外は評価しない
  if (!isFaceCard(card)) return 0

  const currentTrick = gameState.currentTrick

  // トリックが空の場合は評価しない
  if (currentTrick.cards.length === 0) return 0

  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const leadingSuit = currentTrick.cards[0].card.suit

  // 切り札は評価しない（セイム2にならない）
  if (card.suit === trumpSuit) return 0

  // 全て同じスートか確認
  const allSameSuit = currentTrick.cards.every(
    (pc) => pc.card.suit === leadingSuit
  )

  // 異なるスートが混ざっている場合、セイム2のリスクなし
  if (!allSameSuit) return 0

  // カードが リードスートと一致するか確認
  if (card.suit !== leadingSuit) return 0

  // Mighty/Jackが出ている場合、セイム2は発動しない
  const hasSame2Breaker = currentTrick.cards.some(
    (trickCard) =>
      checkIsMighty(trickCard.card) ||
      checkIsTrumpJack(trickCard.card, trumpSuit) ||
      checkIsCounterJack(trickCard.card, trumpSuit)
  )
  if (hasSame2Breaker) return 0

  // トリックの枚数を確認（2-3枚の時がセイム2リスク）
  const trickCardCount = currentTrick.cards.length

  // 2枚または3枚の時、4枚目で絵札を出すと相手の2に取られるリスク
  if (trickCardCount >= 2 && trickCardCount <= 3) {
    // 例外: 意図的に絵札を渡す戦略の場合は適用しない
    // ナポレオンが既に勝っている場合（副官が絵札を渡す戦略）
    if (player.isAdjutant && isNapoleonWinning(currentTrick, gameState)) {
      return 0 // 絵札を渡す戦略なのでペナルティなし
    }

    // ゲーム進行度を取得
    const gameProgress = calculateGameProgress(gameState)

    // セイム2リスクのペナルティ
    // 3枚目（4枚揃う可能性が非常に高い）の方が危険
    const baseRiskPenalty = trickCardCount === 3 ? -250 : -150

    // トリックに既に絵札がたくさんある場合、リスクが高い
    const faceCardsInTrick = currentTrick.cards.filter((tc) =>
      isFaceCard(tc.card)
    ).length

    // 絵札が多いほどリスク大（取られる絵札が増える）
    const faceCardMultiplier = faceCardsInTrick >= 2 ? 1.5 : 1.0

    // 序盤・中盤ほどリスク回避すべき
    let finalPenalty = baseRiskPenalty * faceCardMultiplier
    if (gameProgress < 0.4) {
      finalPenalty *= 1.3 // 序盤は特にリスク回避
    } else if (gameProgress < 0.7) {
      finalPenalty *= 1.1 // 中盤もリスク回避
    }

    return Math.round(finalPenalty)
  }

  return 0
}

// ヘルパー関数群
/**
 * ゲーム状態からカードの強度を安全に計算
 */
function getCardStrengthSafe(
  card: Card,
  gameState: GameState,
  leadingSuit?: Suit
): number {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const effectiveLeadingSuit =
    leadingSuit ||
    (gameState.currentTrick.cards.length > 0
      ? gameState.currentTrick.cards[0].card.suit
      : trumpSuit)

  return getCardStrength(card, trumpSuit, effectiveLeadingSuit as Suit)
}

function calculateGameProgress(gameState: GameState): number {
  const totalTricks = 12 // ナポレオンは12トリック
  const completedTricks = gameState.tricks.length
  return completedTricks / totalTricks
}

function calculateLeadingStrategy(
  card: Card,
  gameState: GameState,
  player: Player
): number {
  // リード時の戦略的価値
  let strategy = 0

  const strength = getCardStrengthSafe(card, gameState)

  if (player.isNapoleon) {
    // ナポレオンは強いカードでリード
    strategy += strength > 600 ? 100 : -50
  } else {
    // 連合軍は探りのための弱いカードまたは決定的な強いカード
    strategy += strength < 300 || strength > 900 ? 100 : -30
  }

  return strategy
}

function canWinCurrentTrick(
  cards: Card[],
  currentTrick: Trick,
  gameState: GameState
): boolean {
  const bestOpponentCard = getBestTrickCard(currentTrick, gameState)
  return cards.some(
    (card) => getCardStrengthSafe(card, gameState) > bestOpponentCard.strength
  )
}

function getBestTrickCard(currentTrick: Trick, gameState: GameState) {
  let bestCard = currentTrick.cards[0].card
  let bestStrength = getCardStrengthSafe(bestCard, gameState)

  for (const trickCard of currentTrick.cards) {
    const strength = getCardStrengthSafe(trickCard.card, gameState)
    if (strength > bestStrength) {
      bestCard = trickCard.card
      bestStrength = strength
    }
  }

  return { card: bestCard, strength: bestStrength }
}

function getLowestWinningCard(
  cards: Card[],
  currentTrick: Trick,
  gameState: GameState
): Card {
  const bestOpponent = getBestTrickCard(currentTrick, gameState)
  const winningCards = cards.filter(
    (card) => getCardStrengthSafe(card, gameState) > bestOpponent.strength
  )

  if (winningCards.length === 0) return cards[0]

  return winningCards.sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )[0]
}

function getWeakestCard(cards: Card[], gameState: GameState): Card {
  return cards.sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )[0]
}

/**
 * カードが絵札かどうか判定（10, J, Q, K, A）
 */
function isFaceCard(card: Card): boolean {
  return ['10', 'J', 'Q', 'K', 'A'].includes(card.rank)
}

/**
 * 非絵札の中で最も弱いカードを取得
 * 非絵札がない場合はnullを返す
 */
function getWeakestNonFaceCard(
  cards: Card[],
  gameState: GameState
): Card | null {
  const nonFaceCards = cards.filter((card) => !isFaceCard(card))
  if (nonFaceCards.length === 0) return null

  return nonFaceCards.sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )[0]
}

/**
 * ナポレオンに渡す絵札を取得（マイティー除外）
 * 副官がナポレオンに得点を渡す際に、絵札を優先しつつマイティーを保護
 */
function getFaceCardToPassToNapoleon(
  cards: Card[],
  gameState: GameState
): Card {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // マイティーを除外した絵札を取得
  const faceCardsExcludingMighty = cards.filter(
    (card) => isFaceCard(card) && !checkIsMighty(card)
  )

  // 絵札（マイティー除外）がある場合は、最も弱い絵札を返す
  if (faceCardsExcludingMighty.length > 0) {
    return faceCardsExcludingMighty.sort(
      (a, b) =>
        getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
    )[0]
  }

  // 絵札がない場合は、特殊カード以外の最弱カードを返す
  const nonSpecialCards = cards.filter(
    (card) =>
      !checkIsMighty(card) &&
      !checkIsTrumpJack(card, trumpSuit) &&
      !checkIsCounterJack(card, trumpSuit)
  )

  if (nonSpecialCards.length > 0) {
    // 非絵札を優先
    const weakestNonFace = getWeakestNonFaceCard(nonSpecialCards, gameState)
    if (weakestNonFace) return weakestNonFace

    // 非絵札がない場合は特殊カード以外のカード
    return nonSpecialCards.sort(
      (a, b) =>
        getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
    )[0]
  }

  // すべて特殊カードの場合（稀なケース）は通常の最弱カードを返す
  return getWeakestCard(cards, gameState)
}

function isNapoleonWinning(currentTrick: Trick, gameState: GameState): boolean {
  const napoleon = gameState.players.find((p) => p.isNapoleon)
  const adjutant = gameState.players.find((p) => p.isAdjutant)
  if (!napoleon) return false

  const bestCard = getBestTrickCard(currentTrick, gameState)
  return currentTrick.cards.some(
    (trickCard) =>
      (trickCard.playerId === napoleon.id ||
        trickCard.playerId === adjutant?.id) &&
      trickCard.card === bestCard.card
  )
}

/**
 * 副官が副官指定カードを早期開示すべきか判定
 * ナポレオンに副官だと認知してもらうため、スートが呼ばれた時に積極的に出す
 */
function shouldRevealAdjutantCard(
  playableCards: Card[],
  gameState: GameState,
  currentTrick: Trick
): Card | null {
  // 副官指定カードを取得
  const adjutantCard = gameState.napoleonDeclaration?.adjutantCard
  if (!adjutantCard) return null

  // プレイ可能なカードに副官カードがあるかチェック
  const adjutantCardInHand = playableCards.find(
    (card) => card.id === adjutantCard.id
  )
  if (!adjutantCardInHand) return null

  // トリックが空の場合は開示しない（リード時は出さない）
  if (currentTrick.cards.length === 0) return null

  // リードスートを取得
  const leadingSuit = currentTrick.cards[0].card.suit

  // 副官カードのスートがリードスートと一致するかチェック
  if (adjutantCard.suit !== leadingSuit) return null

  // マイティーとの競合チェック
  if (checkIsMighty(adjutantCard)) return null

  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 切り札ジャックとの競合チェック
  if (checkIsTrumpJack(adjutantCard, trumpSuit)) return null
  if (checkIsCounterJack(adjutantCard, trumpSuit)) return null

  // 既にマイティーやジャックが出ている場合は出さない（競合回避）
  const hasMightyOrJack = currentTrick.cards.some(
    (trickCard) =>
      checkIsMighty(trickCard.card) ||
      checkIsTrumpJack(trickCard.card, trumpSuit) ||
      checkIsCounterJack(trickCard.card, trumpSuit)
  )
  if (hasMightyOrJack) return null

  // ゲーム進行度を確認（早期ほど開示しやすい）
  const gameProgress = calculateGameProgress(gameState)

  // 序盤〜中盤（70%まで）なら積極的に開示
  if (gameProgress < 0.7) {
    return adjutantCardInHand
  }

  // 終盤でも、ナポレオンが副官を認知していない可能性がある場合は開示
  // （簡易的に30%の確率で開示）
  if (Math.random() < 0.3) {
    return adjutantCardInHand
  }

  return null
}

/**
 * 副官がナポレオンに絵札を積極的に渡すべきか判定
 * ナポレオンチームの得点を増やすため、勝っているナポレオンに絵札を渡す
 */
function shouldPassFaceCardToNapoleon(
  playableCards: Card[],
  gameState: GameState,
  currentTrick: Trick,
  canWinTrick: boolean
): Card | null {
  // トリックが空の場合は判定不可
  if (currentTrick.cards.length === 0) return null

  // ナポレオンを取得
  const napoleon = gameState.players.find((p) => p.isNapoleon)
  if (!napoleon) return null

  // ナポレオンが現在勝っているかチェック
  const napoleonIsWinning = isNapoleonWinning(currentTrick, gameState)
  if (!napoleonIsWinning) return null

  // プレイ可能な絵札を取得
  const faceCards = playableCards.filter(isFaceCard)
  if (faceCards.length === 0) return null

  // 副官が勝てる場合でも、ナポレオンが勝っているなら絵札を渡す方が良い
  // （ナポレオンに得点を集中させる）

  // 絵札を弱い順にソート（10, Q, K, A の順）
  const sortedFaceCards = faceCards.sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )

  // 最も弱い絵札を選択（10やQを優先）
  const weakestFaceCard = sortedFaceCards[0]

  // ただし、副官が勝てる状況で、より強い絵札を持っている場合
  // （例：副官がAを持っていて、ナポレオンが現在Kで勝っている場合）
  // この場合は副官が勝った方が良いので、nullを返す
  if (canWinTrick) {
    // 副官が勝てるカードの中で、最も弱い勝てるカードを取得
    const lowestWinning = getLowestWinningCard(
      playableCards,
      currentTrick,
      gameState
    )
    const lowestWinningStrength = getCardStrengthSafe(lowestWinning, gameState)

    // 最も弱い絵札が勝てるカードより弱い場合は、その絵札を出す
    const weakestFaceStrength = getCardStrengthSafe(weakestFaceCard, gameState)

    if (weakestFaceStrength < lowestWinningStrength) {
      return weakestFaceCard
    }

    // 勝てるカードと弱い絵札が同じ場合、40%の確率でナポレオンに譲る
    if (weakestFaceStrength === lowestWinningStrength && Math.random() < 0.4) {
      // より弱い絵札を探す（2番目に弱い絵札）
      if (sortedFaceCards.length > 1) {
        return sortedFaceCards[1]
      }
    }

    // それ以外の場合は勝つべき（副官が勝った方が得点が高い）
    return null
  }

  // 副官が勝てない場合は、弱い絵札を出してナポレオンに渡す
  return weakestFaceCard
}
