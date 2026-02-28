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
  // 🔧 改善: 目標達成状況を計算
  const requirements = calculateWinningRequirements(gameState)
  const playConservatively = shouldPlayConservatively(player, requirements)
  const playAggressively = shouldPlayAggressively(player, requirements)

  // 🔧 改善: 手札構成を分析
  const composition = analyzeHandComposition(player.hand, gameState)

  // 🆕 改善: カードカウンティング情報を取得
  const cardCounting = trackAllCards(player, gameState)
  const playerVoids = estimatePlayerVoids(gameState)

  // 🆕 改善: 終盤状態を分析
  const endgameInfo = analyzeEndgameState(gameState, player)

  // 🆕 終盤戦略: 勝利確定の場合、最弱カードでリード
  if (endgameInfo.isEndgame) {
    if (player.isNapoleon || player.isAdjutant) {
      // ナポレオンチーム: 勝利確定の場合、最弱カードでリード（手札温存）
      if (endgameInfo.canSecureNapoleonVictory) {
        return playableCards.sort(
          (a, b) =>
            getCardStrengthSafe(a, gameState) -
            getCardStrengthSafe(b, gameState)
        )[0]
      }
    } else {
      // 連合軍: 勝利確定の場合、最弱カードでリード
      if (endgameInfo.canSecureAllianceVictory) {
        return playableCards.sort(
          (a, b) =>
            getCardStrengthSafe(a, gameState) -
            getCardStrengthSafe(b, gameState)
        )[0]
      }
    }
  }

  // 🔧 改善: 保守的プレイの場合、弱いカードで探る
  if (playConservatively) {
    if (player.isNapoleon || player.isAdjutant) {
      // ナポレオンチーム（保守的）: 既に目標達成済みまたは余裕がある
      // → 絵札を温存、非絵札で探る
      const nonFaceCards = playableCards.filter((card) => !isFaceCard(card))

      if (nonFaceCards.length > 0) {
        // 非絵札の中で最も弱いカードでリード
        return nonFaceCards.sort(
          (a, b) =>
            getCardStrengthSafe(a, gameState) -
            getCardStrengthSafe(b, gameState)
        )[0]
      }

      // 非絵札がない場合、最弱の絵札でリード
      return playableCards.sort(
        (a, b) =>
          getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
      )[0]
    } else {
      // 連合軍（保守的）: 既に阻止達成済みまたは勝利確定
      // → リスクを避けて弱いカードでリード
      return playableCards.sort(
        (a, b) =>
          getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
      )[0]
    }
  }

  // 🔧 改善: 攻撃的プレイの場合、絵札が多いスートを優先
  if (playAggressively) {
    if (player.isNapoleon || player.isAdjutant) {
      // ナポレオンチーム（攻撃的）: 目標達成が危うい
      // → 絵札が多いスートで積極的に得点を取りに行く
      const strategicSuit = selectBestLeadingSuit(
        player.hand,
        gameState,
        player,
        composition,
        cardCounting,
        playerVoids
      )

      if (strategicSuit) {
        const cardsInStrategicSuit = playableCards.filter(
          (card) => card.suit === strategicSuit
        )

        if (cardsInStrategicSuit.length > 0) {
          return selectBestCardFromSuit(
            cardsInStrategicSuit,
            gameState,
            player,
            strategicSuit
          )
        }
      }

      // 戦略的スートがない場合、絵札でリード
      const faceCards = playableCards.filter(isFaceCard)
      if (faceCards.length > 0) {
        // 最も強い絵札でリード（トリックを取りに行く）
        return faceCards.sort(
          (a, b) =>
            getCardStrengthSafe(b, gameState) -
            getCardStrengthSafe(a, gameState)
        )[0]
      }
    } else {
      // 連合軍（攻撃的）: ナポレオンが優勢で阻止が危うい
      // → 強いカードでナポレオンの強いカードを引き出す
      const strategicSuit = selectBestLeadingSuit(
        player.hand,
        gameState,
        player,
        composition,
        cardCounting,
        playerVoids
      )

      if (strategicSuit) {
        const cardsInStrategicSuit = playableCards.filter(
          (card) => card.suit === strategicSuit
        )

        if (cardsInStrategicSuit.length > 0) {
          return selectBestCardFromSuit(
            cardsInStrategicSuit,
            gameState,
            player,
            strategicSuit
          )
        }
      }
    }
  }

  // 🔧 通常プレイ: 戦略的なスートを選択
  const strategicSuit = selectBestLeadingSuit(
    player.hand,
    gameState,
    player,
    composition,
    cardCounting,
    playerVoids
  )

  // 戦略的スートが決まっている場合、そのスートからカードを選ぶ
  if (strategicSuit) {
    const cardsInStrategicSuit = playableCards.filter(
      (card) => card.suit === strategicSuit
    )

    if (cardsInStrategicSuit.length > 0) {
      return selectBestCardFromSuit(
        cardsInStrategicSuit,
        gameState,
        player,
        strategicSuit
      )
    }
  }

  // 戦略的スートがない場合、従来のロジックを使用
  // カードを戦略的価値で評価
  const cardEvaluations = playableCards.map((card) => ({
    card,
    strategicValue: evaluateCardStrategicValue(card, gameState, player),
    leadingStrategy: calculateLeadingStrategy(card, gameState, player),
  }))

  // 役割別のリード戦略
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 強いカードでトリックを取りに行く
    return cardEvaluations.sort(
      (a, b) =>
        b.strategicValue +
        b.leadingStrategy -
        (a.strategicValue + a.leadingStrategy)
    )[0].card
  } else {
    // 連合軍: 相手の強いカードを引き出すか、弱いカードで様子見
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
  // 🔧 改善: 目標達成状況を計算
  const requirements = calculateWinningRequirements(gameState)
  const playConservatively = shouldPlayConservatively(player, requirements)
  const playAggressively = shouldPlayAggressively(player, requirements)

  // 🔧 改善: 切り札追跡情報を取得
  const trumpTracking = trackTrumps(player, gameState)

  // 🆕 改善: 終盤状態を分析
  const endgameInfo = analyzeEndgameState(gameState, player)

  // 🔧 改善: ボイド（リードスートを持っていない）の判定
  const leadingSuit = currentTrick.leadingSuit || gameState.leadingSuit
  const isVoid = leadingSuit
    ? !playableCards.some((card) => card.suit === leadingSuit)
    : false

  // 🔧 改善: ボイド時の切り札介入判断
  if (isVoid && gameState.trumpSuit) {
    const shouldUseTrump = shouldInterventWithTrump(
      playableCards,
      currentTrick,
      gameState,
      player,
      trumpTracking
    )

    if (shouldUseTrump) {
      // 切り札で介入する：最も弱い勝てる切り札を使う
      const trumpCards = playableCards.filter(
        (card) => card.suit === gameState.trumpSuit || checkIsMighty(card)
      )

      if (trumpCards.length > 0) {
        // 既存のトリック内の切り札より強い切り札を探す
        const trickTrumps = currentTrick.cards
          .map((tc) => tc.card)
          .filter(
            (card) => card.suit === gameState.trumpSuit || checkIsMighty(card)
          )

        if (trickTrumps.length > 0) {
          // トリック内に切り札がある場合、それより強い最弱の切り札を使う
          const strongestTrickTrump = trickTrumps.sort(
            (a, b) =>
              getCardStrengthSafe(b, gameState) -
              getCardStrengthSafe(a, gameState)
          )[0]
          const strongestTrickTrumpStrength = getCardStrengthSafe(
            strongestTrickTrump,
            gameState
          )

          const winningTrumps = trumpCards.filter(
            (card) =>
              getCardStrengthSafe(card, gameState) > strongestTrickTrumpStrength
          )

          if (winningTrumps.length > 0) {
            // 勝てる切り札の中で最も弱いものを使う
            return winningTrumps.sort(
              (a, b) =>
                getCardStrengthSafe(a, gameState) -
                getCardStrengthSafe(b, gameState)
            )[0]
          }
        } else {
          // トリック内に切り札がない場合、最も弱い切り札を使う
          return trumpCards.sort(
            (a, b) =>
              getCardStrengthSafe(a, gameState) -
              getCardStrengthSafe(b, gameState)
          )[0]
        }
      }
    }
  }

  // 既に出ているカード全てを考慮して、勝てるか判定
  const canWinTrick = canWinCurrentTrick(playableCards, currentTrick, gameState)

  // 🆕 終盤戦略: 勝利確定または全絵札が必要な場合の特別な戦略
  if (endgameInfo.isEndgame) {
    if (player.isNapoleon || player.isAdjutant) {
      // ナポレオンチーム: 勝利確定の場合、最弱カードで温存
      if (endgameInfo.canSecureNapoleonVictory) {
        if (!canWinTrick) {
          return getWeakestCard(playableCards, gameState)
        }
        // 勝てる場合でも、絵札が無いトリックは最弱カードで勝つ
        const faceCardsInTrick = currentTrick.cards.filter((tc) =>
          isFaceCard(tc.card)
        ).length
        if (faceCardsInTrick === 0) {
          // 絵札が無いトリックは最弱の勝ちカードで取る
          return getLowestWinningCard(playableCards, currentTrick, gameState)
        }
      }

      // ナポレオンチーム: 残り全絵札を取る必要がある場合、確実に勝つ
      if (endgameInfo.napoleonNeedsAllRemaining && canWinTrick) {
        // トリック内に絵札がある場合、確実に取る
        const faceCardsInTrick = currentTrick.cards.filter((tc) =>
          isFaceCard(tc.card)
        ).length
        if (faceCardsInTrick > 0) {
          return getLowestWinningCard(playableCards, currentTrick, gameState)
        }
      }
    } else {
      // 連合軍: 勝利確定の場合、最弱カードで温存
      if (endgameInfo.canSecureAllianceVictory) {
        return getWeakestCard(playableCards, gameState)
      }

      // 連合軍: 残り全絵札を阻止する必要がある場合、確実にブロック
      if (endgameInfo.allianceNeedsAllRemaining && canWinTrick) {
        // ナポレオンチームが勝っている場合、確実にブロック
        if (isNapoleonWinning(currentTrick, gameState)) {
          return getLowestWinningCard(playableCards, currentTrick, gameState)
        }
      }
    }
  }

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

    // 🔧 改善: 目標達成状況に応じた判断
    if (playConservatively) {
      // 保守的プレイ: 既に目標達成済みまたは余裕がある場合
      // → 弱いカードで勝てるなら勝つ、絵札は温存
      const weakWinningCards = playableCards.filter(
        (card) =>
          !isFaceCard(card) &&
          getCardStrengthSafe(card, gameState) >
            getBestTrickCard(currentTrick, gameState).strength
      )

      if (weakWinningCards.length > 0) {
        // 非絵札で勝てるなら、最も弱い勝てるカードを使う
        return weakWinningCards.sort(
          (a, b) =>
            getCardStrengthSafe(a, gameState) -
            getCardStrengthSafe(b, gameState)
        )[0]
      }

      // 非絵札で勝てない場合、絵札を使うか捨てるか判断
      // トリック内の絵札が多い場合は取る価値がある
      const faceCardsInTrick = currentTrick.cards.filter((tc) =>
        isFaceCard(tc.card)
      ).length

      if (faceCardsInTrick >= 2) {
        // 絵札が2枚以上あるなら取る価値がある
        return getLowestWinningCard(playableCards, currentTrick, gameState)
      }

      // 絵札が少ないトリックは諦めて、弱いカードを捨てる
      return getWeakestCard(playableCards, gameState)
    }

    if (playAggressively) {
      // 攻撃的プレイ: 目標達成が危うい場合
      // → 絵札を積極的に取りに行く、強いカードを惜しまず使う
      return getLowestWinningCard(playableCards, currentTrick, gameState)
    }

    // 通常プレイ: 最低限の勝ちカードで勝つ
    return getLowestWinningCard(playableCards, currentTrick, gameState)
  } else {
    // 🔧 改善: 連合軍の協調戦略 + 目標達成状況考慮

    // 1. ナポレオンチームが現在勝っている場合
    if (isNapoleonWinning(currentTrick, gameState)) {
      if (playAggressively) {
        // 攻撃的ブロック: ナポレオンが優勢で阻止が危うい場合
        // → 確実にブロック、強いカードを惜しまず使う
        return getLowestWinningCard(playableCards, currentTrick, gameState)
      }

      // 通常ブロック: 最低限の勝ちカードでブロック
      return getLowestWinningCard(playableCards, currentTrick, gameState)
    }

    // 2. 連合軍の味方が勝っている場合：絵札を渡す戦略
    if (isAllianceWinning(currentTrick, gameState)) {
      const trickPosition = currentTrick.cards.length // 現在何枚出ているか（0-3）

      // 最後のプレイヤー（3枚目の後、4枚目）の場合
      // 味方が確実に勝つので、絵札を渡すチャンス
      if (trickPosition === 3) {
        const faceCardToPass = getFaceCardToPassToAlliance(
          playableCards,
          gameState
        )
        if (faceCardToPass) {
          return faceCardToPass
        }
      }

      // 2-3枚目の場合も、絵札を渡すチャンスがあれば渡す
      // ただし、ナポレオンチームが後から勝つリスクを考慮
      if (trickPosition >= 1) {
        const gameProgress = calculateGameProgress(gameState)

        // 中盤以降（絵札が重要になる時期）で、絵札があれば渡す
        if (gameProgress >= 0.4) {
          const faceCardToPass = getFaceCardToPassToAlliance(
            playableCards,
            gameState
          )
          if (faceCardToPass) {
            return faceCardToPass
          }
        }
      }

      // 🔧 改善: 保守的プレイの場合、味方に任せて弱いカードを出す
      if (playConservatively) {
        // 既に阻止達成済みまたは勝利確定
        // → 無理にブロックせず、弱いカードを出して絵札を温存
        return getWeakestCard(playableCards, gameState)
      }

      // 絵札がない場合、または序盤の場合は弱いカードを出す
      return getWeakestCard(playableCards, gameState)
    }

    // 3. まだ誰も勝っていない場合
    if (playAggressively) {
      // 攻撃的: ナポレオンが目標まであと少しで危機的状況
      // → 積極的に勝ってブロック
      return getLowestWinningCard(playableCards, currentTrick, gameState)
    }

    // 通常: 様子見（弱いカードを出す）
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

  // トリックが空の場合（リード時）
  if (currentTrick.cards.length === 0) {
    // 🔧 修正: 初旬（0-40%）は2を適度に温存（マイティより低い価値）
    if (gameProgress < 0.4) {
      return 250 // 適度に温存（マイティ+500より低い）
    }
    // 中盤（40-70%）も温存するが、使える場面では使う
    if (gameProgress < 0.7) {
      return 150 // 中程度の温存
    }
    // 終盤はセイム2を作るチャンス（積極的に使う）
    return 50
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
    // → まだ手札に余裕があるので、2は温存すべき
    if (trickPosition <= 2) {
      // 🔧 修正: ペナルティを緩和（捨てるべき場面では捨てる）
      let penalty = 0
      if (gameProgress < 0.5) {
        penalty = -150 // 序盤は温存（緩和）
      } else if (gameProgress < 0.7) {
        penalty = -100 // 中盤は捨てやすく
      } else {
        penalty = -50 // 終盤は積極的に捨てる
      }

      return penalty
    }

    // トリックの後半（3枚目）でMighty/Jackが出ている場合
    // → 手札が少なくなっているので、捨てても良い
    let penalty = 0
    if (gameProgress < 0.4) {
      penalty = -80 // 序盤でも捨てやすく
    } else if (gameProgress < 0.7) {
      penalty = -50 // 中盤は捨てる傾向
    } else {
      penalty = -20 // 終盤は積極的に捨てる
    }

    return penalty
  }

  // まだ全て同じスートの場合（Mighty/Jackなし）
  if (allSameSuit) {
    // リードスートと同じなら、セイム2の可能性が高い
    if (card.suit === leadingSuit) {
      // 🔧 修正: セイム2発動の可能性があるが、マイティより低い価値
      return 400 // 高ボーナスだが、マイティ（+500）より低い
    }
    // 異なるスートでも、次のトリックで可能性がある
    // 初旬ほど温存
    if (gameProgress < 0.4) {
      return 200 // 適度に温存（マイティより低い）
    }
    return gameProgress < 0.7 ? 100 : 50
  }

  // 異なるスートが混ざっている場合（セイム2無効）
  // このトリックでは使えないが、次のトリックでの可能性を考慮
  // 🔧 修正: セイム2が無効な場合は積極的に捨てる
  if (gameProgress < 0.3) {
    return -30 // 初旬でも捨てやすく
  }
  if (gameProgress < 0.6) {
    return -80 // 中盤は積極的に捨てる
  }
  // 終盤は最優先で捨てる
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

/**
 * 🆕 目標達成状況を計算
 * ナポレオンチームと連合軍の絵札獲得状況、残りトリック数を考慮
 */
interface WinningRequirements {
  napoleonTeamFaceCards: number // ナポレオンチームが獲得した絵札
  allianceTeamFaceCards: number // 連合軍が獲得した絵札
  remainingFaceCards: number // まだ場に出ていない絵札
  remainingTricks: number // 残りトリック数
  napoleonNeedsToWin: number // ナポレオンが目標達成に必要な絵札数
  allianceNeedsToBlock: number // 連合軍が阻止に必要な絵札数
  napoleonCanAffordToLose: number // ナポレオンが失っても良い絵札数
  isNapoleonAhead: boolean // ナポレオンが優勢か
  isAllianceAhead: boolean // 連合軍が優勢か
  isCriticalPhase: boolean // 勝敗が決まる重要局面か
}

function calculateWinningRequirements(
  gameState: GameState
): WinningRequirements {
  const totalFaceCards = 13 // ナポレオンゲームの絵札総数（10, J, Q, K, A各スート + Jokerなし）
  const napoleonTarget = gameState.napoleonDeclaration?.targetTricks || 8 // デフォルト8枚目標

  // 各チームが獲得した絵札をカウント
  let napoleonTeamFaceCards = 0
  let allianceTeamFaceCards = 0

  const napoleon = gameState.players.find((p) => p.isNapoleon)
  const adjutant = gameState.players.find((p) => p.isAdjutant)

  // 完了したトリックから絵札をカウント
  for (const trick of gameState.tricks) {
    const winner = trick.winnerPlayerId
    if (!winner) continue

    const faceCardsInTrick = trick.cards.filter((tc) =>
      isFaceCard(tc.card)
    ).length

    if (winner === napoleon?.id || (adjutant && winner === adjutant.id)) {
      napoleonTeamFaceCards += faceCardsInTrick
    } else {
      allianceTeamFaceCards += faceCardsInTrick
    }
  }

  // まだプレイされていない絵札の枚数
  const remainingFaceCards =
    totalFaceCards - napoleonTeamFaceCards - allianceTeamFaceCards

  // 残りトリック数（現在のトリック含む）
  const totalTricks = 12 // ナポレオンは12トリック（52枚 / 4人 = 13枚、13トリックだが最後は4枚なので12トリック）
  const completedTricks = gameState.tricks.length
  const remainingTricks = totalTricks - completedTricks

  // ナポレオンが目標達成に必要な絵札数
  const napoleonNeedsToWin = Math.max(0, napoleonTarget - napoleonTeamFaceCards)

  // 連合軍が阻止に必要な絵札数（ナポレオンを目標未満に抑える）
  const allianceNeedsToBlock = Math.max(
    0,
    totalFaceCards - napoleonTarget + 1 - allianceTeamFaceCards
  )

  // ナポレオンが失っても良い絵札数
  const napoleonCanAffordToLose = Math.max(
    0,
    remainingFaceCards - napoleonNeedsToWin
  )

  // 優勢判定
  const isNapoleonAhead = napoleonNeedsToWin <= remainingTricks / 2
  const isAllianceAhead = allianceNeedsToBlock <= remainingTricks / 2

  // 重要局面判定（残り2-3トリックで勝敗が決まる状況）
  const isCriticalPhase =
    remainingTricks <= 3 && (napoleonNeedsToWin > 0 || allianceNeedsToBlock > 0)

  return {
    napoleonTeamFaceCards,
    allianceTeamFaceCards,
    remainingFaceCards,
    remainingTricks,
    napoleonNeedsToWin,
    allianceNeedsToBlock,
    napoleonCanAffordToLose,
    isNapoleonAhead,
    isAllianceAhead,
    isCriticalPhase,
  }
}

/**
 * 🆕 保守的にプレイすべきか判定
 * 目標達成済みまたは優勢の場合は保守的にプレイ
 */
function shouldPlayConservatively(
  player: Player,
  requirements: WinningRequirements
): boolean {
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 既に目標達成済み、または大幅にリードしている場合
    if (requirements.napoleonNeedsToWin === 0) {
      return true // 目標達成済みなら保守的にプレイ
    }

    // 残り絵札が少なく、失っても良い絵札数が多い場合（余裕がある）
    if (
      requirements.napoleonCanAffordToLose >= 3 &&
      requirements.remainingTricks >= 4
    ) {
      return true
    }
  } else {
    // 連合軍: 既に阻止達成済み、または大幅にリードしている場合
    if (requirements.allianceNeedsToBlock === 0) {
      return true // 阻止達成済みなら保守的にプレイ
    }

    // ナポレオンが目標達成不可能な状況（連合軍の勝利確定）
    if (requirements.napoleonNeedsToWin > requirements.remainingTricks) {
      return true
    }
  }

  return false
}

/**
 * 🆕 攻撃的にプレイすべきか判定
 * 目標達成が危ういまたは劣勢の場合は攻撃的にプレイ
 */
function shouldPlayAggressively(
  player: Player,
  requirements: WinningRequirements
): boolean {
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 目標まであと少し、または劣勢の場合
    if (
      requirements.napoleonNeedsToWin > 0 &&
      requirements.napoleonNeedsToWin <= 2 &&
      requirements.isCriticalPhase
    ) {
      return true // 重要局面で目標まであと1-2枚なら攻撃的
    }

    // 劣勢（必要枚数が残りトリック数に対して多い）
    if (requirements.napoleonNeedsToWin >= requirements.remainingTricks / 2) {
      return true
    }
  } else {
    // 連合軍: ナポレオンが優勢で阻止が危うい場合
    if (
      requirements.isNapoleonAhead &&
      requirements.allianceNeedsToBlock > 0 &&
      requirements.isCriticalPhase
    ) {
      return true // ナポレオン優勢の重要局面なら攻撃的にブロック
    }

    // ナポレオンが目標まであと1-2枚（危機的状況）
    if (
      requirements.napoleonNeedsToWin > 0 &&
      requirements.napoleonNeedsToWin <= 2
    ) {
      return true
    }
  }

  return false
}

/**
 * 🆕 各スートの追跡情報
 */
interface SuitTracking {
  suit: Suit
  playedCards: Card[] // 既に出たカード
  remainingCards: number // 残りカード枚数（推定）
  playedFaceCards: Card[] // 既に出た絵札
  remainingFaceCards: number // 残り絵札枚数（推定）
  myCards: Card[] // 自分の手札（このスートのカード）
  myFaceCards: Card[] // 自分の絵札（このスートの絵札）
  hasHighCards: boolean // 高位カード（A, K, Q, J）を持っているか
}

/**
 * 🆕 カードカウンティング全体情報
 */
interface CardCountingInfo {
  suitTracking: Map<Suit, SuitTracking> // 各スートの追跡情報
  totalPlayedCards: number // 既に出たカード総数
  totalRemainingCards: number // 残りカード総数
  totalPlayedFaceCards: number // 既に出た絵札総数
  totalRemainingFaceCards: number // 残り絵札総数
}

/**
 * 🆕 切り札カウンティング情報
 */
interface TrumpTracking {
  playedTrumps: Card[] // 既に出た切り札
  remainingTrumps: number // 残り切り札枚数（推定）
  myTrumps: Card[] // 自分の切り札
  myStrongestTrump: Card | null // 自分の最強切り札
  hasHighTrumps: boolean // 高位切り札（A, K, Q, J, Mighty）を持っているか
  trumpsStrongerThanMine: number // 自分より強い切り札の推定枚数
}

/**
 * 🆕 終盤状態情報
 */
interface EndgameInfo {
  isEndgame: boolean // 終盤かどうか（残りトリック <= 3）
  remainingTricks: number // 残りトリック数
  remainingCardsInHand: number // 自分の残り手札枚数
  canSecureNapoleonVictory: boolean // ナポレオンチームの勝利が確定しているか
  canSecureAllianceVictory: boolean // 連合軍の勝利が確定しているか
  napoleonNeedsAllRemaining: boolean // ナポレオンが残り全絵札を取る必要があるか
  allianceNeedsAllRemaining: boolean // 連合軍が残り全絵札を阻止する必要があるか
}

/**
 * 🆕 切り札をトラッキング
 * 既に出た切り札を記録し、残り切り札枚数と自分の切り札の相対的強さを評価
 */
function trackTrumps(player: Player, gameState: GameState): TrumpTracking {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const totalTrumpsInDeck = 13 // 各スート13枚

  // 既に出た切り札を収集
  const playedTrumps: Card[] = []

  // 完了したトリックから切り札を収集
  for (const trick of gameState.tricks) {
    for (const playedCard of trick.cards) {
      if (playedCard.card.suit === trumpSuit) {
        playedTrumps.push(playedCard.card)
      }
    }
  }

  // 現在のトリックからも切り札を収集
  for (const playedCard of gameState.currentTrick.cards) {
    if (playedCard.card.suit === trumpSuit) {
      playedTrumps.push(playedCard.card)
    }
  }

  // Mightyが出ている場合も切り札としてカウント（スペードAの場合）
  for (const trick of gameState.tricks) {
    for (const playedCard of trick.cards) {
      if (checkIsMighty(playedCard.card)) {
        // Mightyは常に最強なのでカウント
        playedTrumps.push(playedCard.card)
      }
    }
  }
  for (const playedCard of gameState.currentTrick.cards) {
    if (checkIsMighty(playedCard.card)) {
      playedTrumps.push(playedCard.card)
    }
  }

  // 自分の切り札を取得
  const myTrumps = player.hand.filter(
    (card) =>
      card.suit === trumpSuit ||
      checkIsMighty(card) ||
      checkIsTrumpJack(card, trumpSuit) ||
      checkIsCounterJack(card, trumpSuit)
  )

  // 自分の最強切り札を特定
  let myStrongestTrump: Card | null = null
  if (myTrumps.length > 0) {
    myStrongestTrump = myTrumps.sort(
      (a, b) =>
        getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
    )[0]
  }

  // 高位切り札を持っているか
  const hasHighTrumps = myTrumps.some(
    (card) =>
      checkIsMighty(card) ||
      checkIsTrumpJack(card, trumpSuit) ||
      checkIsCounterJack(card, trumpSuit) ||
      ['A', 'K', 'Q'].includes(card.rank)
  )

  // 残り切り札枚数を推定
  const remainingTrumps =
    totalTrumpsInDeck - playedTrumps.length - myTrumps.length

  // 自分より強い切り札の推定枚数
  let trumpsStrongerThanMine = 0
  if (myStrongestTrump) {
    const myStrongestStrength = getCardStrengthSafe(myStrongestTrump, gameState)

    // Mighty, Jack, 高位カードのうち、まだ出ていないものをカウント
    const highTrumps = [
      { rank: 'A', strength: 1400 }, // Mighty (if not Mighty suit)
      { rank: 'K', strength: 1300 },
      { rank: 'Q', strength: 1200 },
      { rank: 'J', strength: 1100 }, // Trump Jack or Counter Jack
    ]

    for (const highTrump of highTrumps) {
      if (highTrump.strength > myStrongestStrength) {
        // このカードが既に出ているかチェック
        const alreadyPlayed = playedTrumps.some(
          (card) => card.rank === highTrump.rank && card.suit === trumpSuit
        )
        // 自分が持っているかチェック
        const inMyHand = myTrumps.some((card) => card.rank === highTrump.rank)

        if (!alreadyPlayed && !inMyHand) {
          trumpsStrongerThanMine++
        }
      }
    }
  }

  return {
    playedTrumps,
    remainingTrumps,
    myTrumps,
    myStrongestTrump,
    hasHighTrumps,
    trumpsStrongerThanMine,
  }
}

/**
 * 🆕 全スートのカードをトラッキング
 * 各スートの残りカード枚数、絵札分布、自分の手札を分析
 */
function trackAllCards(player: Player, gameState: GameState): CardCountingInfo {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
  const suitTracking = new Map<Suit, SuitTracking>()
  const cardsPerSuit = 13 // 各スート13枚

  let totalPlayedCards = 0
  let totalPlayedFaceCards = 0

  // 各スートごとに追跡
  for (const suit of suits) {
    const playedCards: Card[] = []
    const playedFaceCards: Card[] = []

    // 完了したトリックからカードを収集
    for (const trick of gameState.tricks) {
      for (const playedCard of trick.cards) {
        if (playedCard.card.suit === suit) {
          playedCards.push(playedCard.card)
          if (isFaceCard(playedCard.card)) {
            playedFaceCards.push(playedCard.card)
          }
        }
      }
    }

    // 現在のトリックからカードを収集
    for (const playedCard of gameState.currentTrick.cards) {
      if (playedCard.card.suit === suit) {
        playedCards.push(playedCard.card)
        if (isFaceCard(playedCard.card)) {
          playedFaceCards.push(playedCard.card)
        }
      }
    }

    // 自分の手札からこのスートのカードを収集
    const myCards = player.hand.filter((card) => card.suit === suit)
    const myFaceCards = myCards.filter((card) => isFaceCard(card))

    // 残りカード枚数を推定（総数 - 出たカード - 自分の手札）
    const remainingCards = cardsPerSuit - playedCards.length - myCards.length

    // このスートの絵札総数（4枚：A, K, Q, J）
    const faceCardsPerSuit = 4
    const remainingFaceCards =
      faceCardsPerSuit - playedFaceCards.length - myFaceCards.length

    // 高位カード（A, K, Q, J）を持っているか
    const hasHighCards = myCards.some((card) =>
      ['A', 'K', 'Q', 'J'].includes(card.rank)
    )

    suitTracking.set(suit, {
      suit,
      playedCards,
      remainingCards,
      playedFaceCards,
      remainingFaceCards,
      myCards,
      myFaceCards,
      hasHighCards,
    })

    totalPlayedCards += playedCards.length
    totalPlayedFaceCards += playedFaceCards.length
  }

  // 全体の統計
  const totalCardsInDeck = 52
  const totalFaceCardsInDeck = 16 // 4スート × 4絵札
  const totalRemainingCards =
    totalCardsInDeck - totalPlayedCards - player.hand.length
  const myTotalFaceCards = player.hand.filter((card) => isFaceCard(card)).length
  const totalRemainingFaceCards =
    totalFaceCardsInDeck - totalPlayedFaceCards - myTotalFaceCards

  return {
    suitTracking,
    totalPlayedCards,
    totalRemainingCards,
    totalPlayedFaceCards,
    totalRemainingFaceCards,
  }
}

/**
 * 🆕 ボイド後の切り札介入を判断
 * 自分がボイド（そのスートを持っていない）で、切り札を使うべきか判断
 */
function shouldInterventWithTrump(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  player: Player,
  trumpTracking: TrumpTracking
): boolean {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 切り札を持っていない場合はfalse
  if (trumpTracking.myTrumps.length === 0) return false

  // 既に切り札が出ている場合は、勝てるかチェック
  const trumpInTrick = currentTrick.cards.find(
    (tc) =>
      tc.card.suit === trumpSuit ||
      checkIsMighty(tc.card) ||
      checkIsTrumpJack(tc.card, trumpSuit) ||
      checkIsCounterJack(tc.card, trumpSuit)
  )

  if (trumpInTrick) {
    // 切り札が既に出ている場合、勝てる切り札があるかチェック
    const canWin = playableCards.some(
      (card) =>
        (card.suit === trumpSuit ||
          checkIsMighty(card) ||
          checkIsTrumpJack(card, trumpSuit) ||
          checkIsCounterJack(card, trumpSuit)) &&
        getCardStrengthSafe(card, gameState) >
          getCardStrengthSafe(trumpInTrick.card, gameState)
    )

    if (!canWin) {
      return false // 勝てないなら切り札を使わない
    }
  }

  // トリック内の絵札をカウント
  const faceCardsInTrick = currentTrick.cards.filter((tc) =>
    isFaceCard(tc.card)
  ).length

  // 役割別の判断
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 絵札が2枚以上あるなら切り札で取る
    if (faceCardsInTrick >= 2) {
      return true
    }

    // 連合軍が勝っている場合、切り札でブロック
    if (isAllianceWinning(currentTrick, gameState)) {
      return true
    }
  } else {
    // 連合軍: ナポレオンが勝っている場合、切り札でブロック
    if (isNapoleonWinning(currentTrick, gameState)) {
      return true
    }

    // 絵札が3枚以上ある場合、味方に渡すために切り札で勝つ
    if (faceCardsInTrick >= 3) {
      return true
    }
  }

  // 切り札の強さを考慮
  // 弱い切り札（2-7）しかない場合は使わない
  const hasOnlyWeakTrumps = trumpTracking.myTrumps.every(
    (card) =>
      !checkIsMighty(card) &&
      !checkIsTrumpJack(card, trumpSuit) &&
      !checkIsCounterJack(card, trumpSuit) &&
      ['2', '3', '4', '5', '6', '7'].includes(card.rank)
  )

  if (hasOnlyWeakTrumps && faceCardsInTrick < 2) {
    return false // 弱い切り札は温存
  }

  return false
}

/**
 * 🆕 プレイヤー別のボイド（特定スートを持っていない）を推定
 * 過去のトリックで、リードスートと異なるスートを出したプレイヤーを記録
 */
function estimatePlayerVoids(gameState: GameState): Map<string, Set<Suit>> {
  const playerVoids = new Map<string, Set<Suit>>()

  // 各プレイヤーのボイドセットを初期化
  for (const player of gameState.players) {
    playerVoids.set(player.id, new Set<Suit>())
  }

  // 完了したトリックを分析
  for (const trick of gameState.tricks) {
    if (!trick.leadingSuit) continue

    const leadingSuit = trick.leadingSuit

    // トリック内の各カードをチェック
    for (const playedCard of trick.cards) {
      const playerId = playedCard.playerId
      const card = playedCard.card

      // リードスートと異なるスートを出した場合、そのプレイヤーはリードスートをボイドしている
      // ただし、Mightyやジャックは特殊なので除外
      if (
        card.suit !== leadingSuit &&
        !checkIsMighty(card) &&
        !checkIsTrumpJack(card, (gameState.trumpSuit as Suit) || 'spades') &&
        !checkIsCounterJack(card, (gameState.trumpSuit as Suit) || 'spades')
      ) {
        const voidSet = playerVoids.get(playerId)
        if (voidSet) {
          voidSet.add(leadingSuit)
        }
      }
    }
  }

  // 現在のトリックも分析（ただし、まだ完了していないので注意）
  if (gameState.currentTrick.leadingSuit) {
    const leadingSuit = gameState.currentTrick.leadingSuit

    for (const playedCard of gameState.currentTrick.cards) {
      const playerId = playedCard.playerId
      const card = playedCard.card

      if (
        card.suit !== leadingSuit &&
        !checkIsMighty(card) &&
        !checkIsTrumpJack(card, (gameState.trumpSuit as Suit) || 'spades') &&
        !checkIsCounterJack(card, (gameState.trumpSuit as Suit) || 'spades')
      ) {
        const voidSet = playerVoids.get(playerId)
        if (voidSet) {
          voidSet.add(leadingSuit)
        }
      }
    }
  }

  return playerVoids
}

/**
 * 🆕 終盤状態を分析
 * 残りトリック数と目標達成状況から、終盤の戦略を決定
 */
function analyzeEndgameState(
  gameState: GameState,
  player: Player
): EndgameInfo {
  // 残りトリック数を計算（12トリック - 完了したトリック）
  const totalTricks = 12
  const completedTricks = gameState.tricks.length
  const remainingTricks = totalTricks - completedTricks

  // 終盤の定義: 残り3トリック以下
  const isEndgame = remainingTricks <= 3

  // 自分の残り手札枚数
  const remainingCardsInHand = player.hand.length

  // 各チームの絵札獲得数を計算（calculateWinningRequirementsと同様のロジック）
  const totalFaceCards = 13
  const napoleonTarget = gameState.napoleonDeclaration?.targetTricks || 8

  let napoleonTeamFaceCards = 0
  let allianceTeamFaceCards = 0

  // 完了したトリックから絵札を集計
  for (const trick of gameState.tricks) {
    if (!trick.winnerPlayerId) continue

    const winnerPlayer = gameState.players.find(
      (p) => p.id === trick.winnerPlayerId
    )
    if (!winnerPlayer) continue

    const faceCardsInTrick = trick.cards.filter((tc) =>
      isFaceCard(tc.card)
    ).length

    if (winnerPlayer.isNapoleon || winnerPlayer.isAdjutant) {
      napoleonTeamFaceCards += faceCardsInTrick
    } else {
      allianceTeamFaceCards += faceCardsInTrick
    }
  }

  // 残り絵札数
  const remainingFaceCards =
    totalFaceCards - napoleonTeamFaceCards - allianceTeamFaceCards

  // ナポレオンチームが必要な残り絵札数
  const napoleonNeedsToWin = napoleonTarget - napoleonTeamFaceCards

  // 連合軍が阻止するために取るべき絵札数
  const allianceNeedsToBlock = napoleonTarget - allianceTeamFaceCards

  // 勝利確定判定
  const canSecureNapoleonVictory = napoleonTeamFaceCards >= napoleonTarget
  const canSecureAllianceVictory = napoleonNeedsToWin > remainingFaceCards

  // 残り全絵札を取る必要があるか
  const napoleonNeedsAllRemaining =
    napoleonNeedsToWin === remainingFaceCards && remainingFaceCards > 0
  const allianceNeedsAllRemaining =
    allianceNeedsToBlock === remainingFaceCards && remainingFaceCards > 0

  return {
    isEndgame,
    remainingTricks,
    remainingCardsInHand,
    canSecureNapoleonVictory,
    canSecureAllianceVictory,
    napoleonNeedsAllRemaining,
    allianceNeedsAllRemaining,
  }
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
 * 🆕 連合軍が現在のトリックで勝っているか判定
 */
function isAllianceWinning(currentTrick: Trick, gameState: GameState): boolean {
  const napoleon = gameState.players.find((p) => p.isNapoleon)
  const adjutant = gameState.players.find((p) => p.isAdjutant)
  if (!napoleon) return false

  const bestCard = getBestTrickCard(currentTrick, gameState)
  // 最強カードがナポレオンチーム以外のプレイヤーのものか確認
  return currentTrick.cards.some(
    (trickCard) =>
      trickCard.playerId !== napoleon.id &&
      trickCard.playerId !== adjutant?.id &&
      trickCard.card === bestCard.card
  )
}

/**
 * 🆕 連合軍が味方に絵札を渡す
 * ナポレオンに絵札を取られないよう、味方が勝っている場合に絵札を出す
 */
function getFaceCardToPassToAlliance(
  cards: Card[],
  gameState: GameState
): Card | null {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // マイティーと特殊カードを除外した絵札を取得
  const faceCardsExcludingSpecial = cards.filter(
    (card) =>
      isFaceCard(card) &&
      !checkIsMighty(card) &&
      !checkIsTrumpJack(card, trumpSuit) &&
      !checkIsCounterJack(card, trumpSuit)
  )

  // 絵札（特殊カード除外）がある場合は、最も強い絵札を返す
  // （味方に確実に渡すため、勝つ必要はないので強い絵札を出す）
  if (faceCardsExcludingSpecial.length > 0) {
    return faceCardsExcludingSpecial.sort(
      (a, b) =>
        getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
    )[0]
  }

  return null
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

/**
 * 🆕 手札の構成を分析
 * スート別のカード枚数、絵札の分布を把握
 */
interface HandComposition {
  suitCounts: Map<Suit, number>
  faceCardsBySuit: Map<Suit, Card[]>
  trumpCount: number
  totalFaceCards: number
  voidSuits: Suit[] // 持っていないスート
  shortSuits: Suit[] // 1-2枚しかないスート（ボイド作成候補）
}

function analyzeHandComposition(
  hand: Card[],
  gameState: GameState
): HandComposition {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

  const suitCounts = new Map<Suit, number>()
  const faceCardsBySuit = new Map<Suit, Card[]>()

  // 初期化
  for (const suit of suits) {
    suitCounts.set(suit, 0)
    faceCardsBySuit.set(suit, [])
  }

  // スート別にカウント
  for (const card of hand) {
    const currentCount = suitCounts.get(card.suit) || 0
    suitCounts.set(card.suit, currentCount + 1)

    if (isFaceCard(card)) {
      const faceCards = faceCardsBySuit.get(card.suit) || []
      faceCards.push(card)
      faceCardsBySuit.set(card.suit, faceCards)
    }
  }

  const trumpCount = suitCounts.get(trumpSuit) || 0
  const totalFaceCards = hand.filter(isFaceCard).length

  // ボイドスート（0枚）とショートスート（1-2枚）を特定
  const voidSuits: Suit[] = []
  const shortSuits: Suit[] = []

  for (const suit of suits) {
    const count = suitCounts.get(suit) || 0
    if (count === 0) {
      voidSuits.push(suit)
    } else if (count <= 2 && suit !== trumpSuit) {
      shortSuits.push(suit)
    }
  }

  return {
    suitCounts,
    faceCardsBySuit,
    trumpCount,
    totalFaceCards,
    voidSuits,
    shortSuits,
  }
}

/**
 * 🆕 切り札でリードすべきか判定
 * ナポレオンは切り札支配を狙う、連合軍は切り札引き出しを狙う
 */
function shouldLeadWithTrump(
  hand: Card[],
  gameState: GameState,
  player: Player,
  composition: HandComposition
): boolean {
  const gameProgress = calculateGameProgress(gameState)
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 切り札を持っていない場合はfalse
  if (composition.trumpCount === 0) return false

  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 切り札支配戦略

    // 終盤（70%以降）で切り札が複数ある場合、切り札でリード
    if (gameProgress >= 0.7 && composition.trumpCount >= 2) {
      return true
    }

    // 中盤（40-70%）で強い切り札（Mighty, Jack, A, K）がある場合
    if (gameProgress >= 0.4 && gameProgress < 0.7) {
      const strongTrumps = hand.filter(
        (card) =>
          card.suit === trumpSuit &&
          (checkIsMighty(card) ||
            checkIsTrumpJack(card, trumpSuit) ||
            ['A', 'K'].includes(card.rank))
      )
      if (strongTrumps.length > 0) {
        return true
      }
    }
  } else {
    // 連合軍: 切り札引き出し戦略

    // 序盤（0-40%）で弱い切り札（2-7）がある場合、ナポレオンの強い切り札を引き出す
    if (gameProgress < 0.4) {
      const weakTrumps = hand.filter(
        (card) =>
          card.suit === trumpSuit &&
          !checkIsMighty(card) &&
          !checkIsTrumpJack(card, trumpSuit) &&
          !checkIsCounterJack(card, trumpSuit) &&
          ['2', '3', '4', '5', '6', '7'].includes(card.rank)
      )

      // 弱い切り札が1-2枚ある場合、引き出し戦略を実行
      if (weakTrumps.length >= 1 && weakTrumps.length <= 2) {
        return true
      }
    }
  }

  return false
}

/**
 * 🆕 戦略的にリードすべきスートを選択
 * 絵札が多いスート、ボイド作成候補スートなどを考慮
 */
function selectBestLeadingSuit(
  hand: Card[],
  gameState: GameState,
  player: Player,
  composition: HandComposition,
  cardCounting: CardCountingInfo,
  playerVoids: Map<string, Set<Suit>>
): Suit | null {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const gameProgress = calculateGameProgress(gameState)

  // 切り札でリードすべき場合
  if (shouldLeadWithTrump(hand, gameState, player, composition)) {
    return trumpSuit
  }

  // 🆕 他のプレイヤーのボイド状況を考慮したスート評価
  const evaluateSuitSafety = (suit: Suit): number => {
    let safety = 0
    const suitInfo = cardCounting.suitTracking.get(suit)
    if (!suitInfo) return 0

    // 残り絵札が多いスートは魅力的（得点チャンス）
    safety += suitInfo.remainingFaceCards * 10

    // 他のプレイヤーがこのスートをボイドしている数をカウント
    let voidPlayerCount = 0
    for (const [playerId, voidSuits] of playerVoids) {
      if (playerId !== player.id && voidSuits.has(suit)) {
        voidPlayerCount++
      }
    }

    // ボイドしているプレイヤーが多いスートは避ける（切り札で取られるリスク）
    safety -= voidPlayerCount * 15

    // 自分が高位カードを持っている場合はボーナス
    if (suitInfo.hasHighCards) {
      safety += 5
    }

    return safety
  }

  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 絵札が多いスートでリード（得点チャンス）

    let bestSuit: Suit | null = null
    let maxScore = -100

    for (const [suit, faceCards] of composition.faceCardsBySuit) {
      // 切り札以外で評価
      if (suit !== trumpSuit) {
        // 🆕 手札の絵札数とスートの安全性を総合評価
        const faceCardScore = faceCards.length * 10
        const safetyScore = evaluateSuitSafety(suit)
        const totalScore = faceCardScore + safetyScore

        if (totalScore > maxScore) {
          maxScore = totalScore
          bestSuit = suit
        }
      }
    }

    // スコアが一定以上あるスートがあれば選択
    if (bestSuit && maxScore >= 15) {
      return bestSuit
    }
  } else {
    // 連合軍: ボイド作成戦略

    // 序盤〜中盤（0-70%）でショートスートがある場合、そこでリード
    // → 早めにそのスートを使い切り、後で切り札で介入できるようにする
    if (gameProgress < 0.7 && composition.shortSuits.length > 0) {
      // 🆕 ショートスートの中で、安全性も考慮して選択
      const shortSuitsByScore = composition.shortSuits.sort((a, b) => {
        const faceCardsA = composition.faceCardsBySuit.get(a)?.length || 0
        const faceCardsB = composition.faceCardsBySuit.get(b)?.length || 0
        const safetyA = evaluateSuitSafety(a)
        const safetyB = evaluateSuitSafety(b)

        // 絵札が少ない + 安全性が高いスートを優先
        return faceCardsA - faceCardsB + (safetyB - safetyA) / 10
      })

      return shortSuitsByScore[0]
    }

    // 中盤〜終盤（40%以降）で絵札が多いスートがある場合
    // → 味方と協力して得点を取りに行く
    if (gameProgress >= 0.4) {
      let bestSuit: Suit | null = null
      let maxScore = -100

      for (const [suit, faceCards] of composition.faceCardsBySuit) {
        if (suit !== trumpSuit) {
          // 🆕 絵札数と安全性を総合評価
          const faceCardScore = faceCards.length * 10
          const safetyScore = evaluateSuitSafety(suit)
          const totalScore = faceCardScore + safetyScore

          if (totalScore > maxScore) {
            maxScore = totalScore
            bestSuit = suit
          }
        }
      }

      if (bestSuit && maxScore >= 15) {
        return bestSuit
      }
    }
  }

  return null
}

/**
 * 🆕 指定されたスートから最適なリードカードを選択
 */
function selectBestCardFromSuit(
  cardsInSuit: Card[],
  gameState: GameState,
  player: Player,
  suit: Suit
): Card {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const gameProgress = calculateGameProgress(gameState)

  // 切り札の場合
  if (suit === trumpSuit) {
    if (player.isNapoleon || player.isAdjutant) {
      // ナポレオンチーム: 強い切り札でリード（切り札支配）
      const strongTrumps = cardsInSuit.filter(
        (card) =>
          checkIsMighty(card) ||
          checkIsTrumpJack(card, trumpSuit) ||
          ['A', 'K', 'Q'].includes(card.rank)
      )

      if (strongTrumps.length > 0) {
        // 最も強い切り札を選択
        return strongTrumps.sort(
          (a, b) =>
            getCardStrengthSafe(b, gameState) -
            getCardStrengthSafe(a, gameState)
        )[0]
      }

      // 強い切り札がない場合は、最弱の切り札
      return cardsInSuit.sort(
        (a, b) =>
          getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
      )[0]
    } else {
      // 連合軍: 弱い切り札でリード（ナポレオンの強い切り札を引き出す）
      const weakTrumps = cardsInSuit.filter(
        (card) =>
          !checkIsMighty(card) &&
          !checkIsTrumpJack(card, trumpSuit) &&
          !checkIsCounterJack(card, trumpSuit)
      )

      if (weakTrumps.length > 0) {
        // 最も弱い切り札を選択
        return weakTrumps.sort(
          (a, b) =>
            getCardStrengthSafe(a, gameState) -
            getCardStrengthSafe(b, gameState)
        )[0]
      }

      // 弱い切り札がない場合は、最弱の切り札
      return cardsInSuit.sort(
        (a, b) =>
          getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
      )[0]
    }
  }

  // 切り札以外の場合
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 絵札が多いスートでは強いカードでリード
    const faceCards = cardsInSuit.filter(isFaceCard)

    if (faceCards.length >= 2) {
      // 絵札が2枚以上ある場合、最も強い絵札でリード（トリックを取りに行く）
      return faceCards.sort(
        (a, b) =>
          getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
      )[0]
    }

    // 絵札が1枚以下の場合、最弱カードでリード（探り）
    return cardsInSuit.sort(
      (a, b) =>
        getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
    )[0]
  } else {
    // 連合軍: ショートスート（ボイド作成）の場合は最弱カード
    // それ以外の場合も基本的に最弱カードで探り

    // 序盤〜中盤（0-60%）: 最弱カードで探り
    if (gameProgress < 0.6) {
      return cardsInSuit.sort(
        (a, b) =>
          getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
      )[0]
    }

    // 終盤（60%以降）: 絵札が多いスートでは強いカードでリード
    const faceCards = cardsInSuit.filter(isFaceCard)

    if (faceCards.length >= 2) {
      // 終盤で絵札が多い場合、味方と協力して得点を取りに行く
      return faceCards.sort(
        (a, b) =>
          getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
      )[0]
    }

    // それ以外は最弱カード
    return cardsInSuit.sort(
      (a, b) =>
        getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
    )[0]
  }
}
