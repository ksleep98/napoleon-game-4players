/**
 * 戦略的カード評価システム
 * ナポレオンゲームの特殊ルールと戦略を考慮したAI判断
 */

import {
  isCounterJack as checkIsCounterJack,
  isMighty as checkIsMighty,
  isTrumpJack as checkIsTrumpJack,
} from '@/lib/napoleonCardRules'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'
import {
  evaluateAdjutantStrategy,
  evaluateAdjutantTactics,
} from './strategies/adjutantTactics'
import { evaluateAllianceCooperation } from './strategies/allianceCooperation'
import {
  estimatePlayerVoids,
  trackAllCards,
  trackTrumps,
} from './strategies/cardCounting'
import {
  analyzeCardSequence,
  calculateSequencingBonus,
} from './strategies/cardSequencing'
import {
  analyzeEndgameState,
  shouldPlayAggressively,
  shouldPlayConservatively,
} from './strategies/endgame'
import {
  shouldUseEndgameSolver,
  solveEndgame,
} from './strategies/endgameSolver'
import {
  calculateGameProgress,
  getBestTrickCard,
  getCardStrengthSafe,
  getLowestWinningCard,
  getWeakestCard,
  getWeakestNonFaceCard,
  isFaceCard,
} from './strategies/helpers'
import { evaluateNapoleonCooperation } from './strategies/napoleonCooperation'
import {
  analyzeOpponents,
  calculateOpponentModelingBonus,
} from './strategies/opponentModeling'
import {
  calculateProbabilisticBonus,
  evaluateCardProbability,
} from './strategies/probabilisticDecision'
import { buildSignalHistory } from './strategies/signalDecoder'
import {
  evaluateNonViableSuit,
  evaluateSame2Breaker,
  evaluateSame2Potential,
  evaluateSame2RiskForFaceCard,
  evaluateSpecialCardStrategy,
} from './strategies/specialCards'
import {
  isAllianceWinning,
  isNapoleonWinning,
  shouldInterventWithTrump,
  shouldLeadWithTrump,
} from './strategies/trumps'
import type { HandComposition } from './strategies/types'
import {
  analyzeVoidCreation,
  calculateVoidCreationBonus,
} from './strategies/voidCreation'

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

  // 🆕 エンドゲームソルバー: 残り2-3トリックで完全探索
  if (shouldUseEndgameSolver(gameState, 3)) {
    const cardCounting = trackAllCards(player, gameState)
    const endgameResult = solveEndgame(
      playableCards,
      gameState,
      player,
      cardCounting,
      3 // 最大3トリック先まで探索
    )

    if (endgameResult && endgameResult.confidence >= 0.8) {
      // 高い信頼度（0.8以上）の場合、エンドゲームソルバーの結果を採用
      return endgameResult.bestCard
    }
  }

  // 🆕 協力戦略を評価（シグナリング統合）
  const cooperativeStrategy = evaluateCooperativeStrategy(
    playableCards,
    gameState,
    player,
    currentTrick
  )

  // 🆕 協調プレイが推奨されている場合、それを優先
  if (
    cooperativeStrategy.coordinatedPlay &&
    playableCards.some((c) => c.id === cooperativeStrategy.coordinatedPlay?.id)
  ) {
    return cooperativeStrategy.coordinatedPlay
  }

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
  // 🆕 対戦相手モデリング: 相手の行動パターンを分析
  const opponentModeling = analyzeOpponents(gameState, player)

  // 🆕 カード使用順序戦略: 複数トリックにわたる最適化
  const sequenceStrategy = analyzeCardSequence(
    player.hand,
    gameState,
    player,
    cardCounting
  )
  const currentTrickNumber = gameState.tricks.length + 1

  // 🆕 ボイド作成戦略: 戦略的なボイド作成計画
  const voidStrategy = analyzeVoidCreation(
    player.hand,
    gameState,
    player,
    cardCounting
  )

  // カードを戦略的価値で評価
  const cardEvaluations = playableCards.map((card) => {
    const strategicValue = evaluateCardStrategicValue(card, gameState, player)
    const leadingStrategy = calculateLeadingStrategy(card, gameState, player)

    // 🆕 確率的評価: 勝率と期待値を考慮
    const probabilisticResult = evaluateCardProbability(
      card,
      playableCards,
      gameState,
      player,
      cardCounting,
      requirements
    )
    const probabilisticBonus = calculateProbabilisticBonus(
      probabilisticResult,
      requirements,
      player.isNapoleon || player.isAdjutant
    )

    // 🆕 対戦相手モデリングボーナス: 相手の弱点を突く
    const opponentBonus = calculateOpponentModelingBonus(
      card,
      playableCards,
      gameState,
      player,
      opponentModeling
    )

    // 🆕 カード順序ボーナス: 最適タイミングでの使用
    const sequencingBonus = calculateSequencingBonus(
      card,
      currentTrickNumber,
      sequenceStrategy,
      gameState
    )

    // 🆕 ボイド作成ボーナス: 戦略的ボイド作成支援
    const voidCreationBonus = calculateVoidCreationBonus(
      card,
      voidStrategy,
      gameState
    )

    return {
      card,
      strategicValue,
      leadingStrategy,
      probabilisticBonus,
      opponentBonus,
      sequencingBonus,
      voidCreationBonus,
      totalScore:
        strategicValue +
        leadingStrategy +
        probabilisticBonus +
        opponentBonus +
        sequencingBonus +
        voidCreationBonus,
    }
  })

  // 役割別のリード戦略
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 強いカードでトリックを取りに行く（確率的評価含む）
    return cardEvaluations.sort((a, b) => b.totalScore - a.totalScore)[0].card
  } else {
    // 連合軍: 相手の強いカードを引き出すか、弱いカードで様子見（確率的評価含む）
    const weakCards = cardEvaluations.filter(
      (evaluation) => evaluation.strategicValue < 500
    )
    const strongCards = cardEvaluations.filter(
      (evaluation) => evaluation.strategicValue >= 500
    )

    // 弱いカードがある場合は弱いカードで探り（確率的評価で選択）
    if (weakCards.length > 0) {
      return weakCards.sort((a, b) => b.totalScore - a.totalScore)[0].card
    }

    // 強いカードしかない場合は最強カードで勝負（確率的評価で選択）
    return strongCards.sort((a, b) => b.totalScore - a.totalScore)[0].card
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

  // 🆕 改善: 特殊カード戦略を評価（Mighty, Trump Jack, Counter Jack）
  const specialCardStrategy = evaluateSpecialCardStrategy(
    player,
    playableCards,
    currentTrick,
    gameState,
    calculateWinningRequirements
  )

  // 🆕 確率的評価: 各カードの勝率と期待値を事前計算
  const cardCounting = trackAllCards(player, gameState)
  const probabilisticEvaluations = new Map(
    playableCards.map((card) => {
      const result = evaluateCardProbability(
        card,
        playableCards,
        gameState,
        player,
        cardCounting,
        requirements
      )
      const bonus = calculateProbabilisticBonus(
        result,
        requirements,
        player.isNapoleon || player.isAdjutant
      )
      return [card.id, { result, bonus }]
    })
  )

  // 🆕 対戦相手モデリング: 相手の行動パターンを分析
  const opponentModeling = analyzeOpponents(gameState, player)

  // 🆕 カード使用順序戦略: 複数トリックにわたる最適化
  const sequenceStrategy = analyzeCardSequence(
    player.hand,
    gameState,
    player,
    cardCounting
  )

  // 🆕 ボイド作成戦略: 戦略的なボイド作成計画
  const voidStrategy = analyzeVoidCreation(
    player.hand,
    gameState,
    player,
    cardCounting
  )

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

  // 🆕 改善: 特殊カード優先使用判定（Same-2リスク回避も考慮）
  if (canWinTrick && !specialCardStrategy.hasSame2Risk) {
    // Mightyを使うべき場合
    if (specialCardStrategy.shouldUseMighty && specialCardStrategy.mightyCard) {
      return specialCardStrategy.mightyCard
    }

    // Trump Jackを使うべき場合
    if (
      specialCardStrategy.shouldUseTrumpJack &&
      specialCardStrategy.trumpJackCard
    ) {
      return specialCardStrategy.trumpJackCard
    }

    // Counter Jackを使うべき場合
    if (
      specialCardStrategy.shouldUseCounterJack &&
      specialCardStrategy.counterJackCard
    ) {
      return specialCardStrategy.counterJackCard
    }
  }

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
    // 🆕 副官の高度な戦術ロジック
    if (player.isAdjutant) {
      const adjutantTactics = evaluateAdjutantTactics(
        playableCards,
        currentTrick,
        gameState,
        requirements
      )

      // 1. 副官カード早期開示（最適なタイミングで）
      if (adjutantTactics.shouldRevealNow && adjutantTactics.adjutantCard) {
        return adjutantTactics.adjutantCard
      }

      // 2. ナポレオンに絵札を渡す（最適化された絵札選択）
      if (
        adjutantTactics.shouldPassFaceCard &&
        adjutantTactics.faceCardToPass
      ) {
        return adjutantTactics.faceCardToPass
      }

      // 3. ナポレオンのために積極的に勝つ（ナポレオンが弱い時）
      if (adjutantTactics.shouldWinForNapoleon && canWinTrick) {
        // トリック内に絵札が多い場合、確実に取る
        if (adjutantTactics.trickValueForNapoleon >= 7) {
          return getLowestWinningCard(playableCards, currentTrick, gameState)
        }
      }

      // 4. ナポレオン保護（ナポレオンが負けそうな時）
      if (adjutantTactics.shouldProtectNapoleon && canWinTrick) {
        return getLowestWinningCard(playableCards, currentTrick, gameState)
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

      // 絵札が少ないトリックは諦めて、確率的評価で最適カードを選択
      return selectCardWithProbabilisticEvaluation(
        playableCards,
        probabilisticEvaluations,
        gameState,
        player,
        opponentModeling,
        sequenceStrategy,
        voidStrategy,
        true // ナポレオンチームは高勝率優先
      )
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

    // 通常: 様子見（確率的評価で最適カードを選択）
    return selectCardWithProbabilisticEvaluation(
      playableCards,
      probabilisticEvaluations,
      gameState,
      player,
      opponentModeling,
      sequenceStrategy,
      voidStrategy,
      false // 連合軍の場合は低リスク優先
    )
  }
}

/**
 * 確率的評価を使用してカードを選択
 * Select card using probabilistic evaluation
 */
function selectCardWithProbabilisticEvaluation(
  candidates: Card[],
  probabilisticEvaluations: Map<
    string,
    {
      result: import('./strategies/probabilisticDecision').ProbabilisticResult
      bonus: number
    }
  >,
  gameState: GameState,
  player: Player,
  opponentModeling: import('./strategies/opponentModeling').OpponentModelingResult,
  sequenceStrategy: import('./strategies/cardSequencing').SequenceStrategy,
  voidStrategy: import('./strategies/voidCreation').VoidCreationStrategy,
  preferHighProbability: boolean = true
): Card {
  if (candidates.length === 0) {
    throw new Error('No candidate cards provided')
  }
  if (candidates.length === 1) {
    return candidates[0]
  }

  const currentTrickNumber = gameState.tricks.length + 1

  // 確率的評価に基づいてソート
  const scoredCandidates = candidates
    .map((card) => {
      const evaluation = probabilisticEvaluations.get(card.id)
      if (!evaluation) {
        return { card, score: 0 }
      }

      const { result, bonus } = evaluation

      // 🆕 対戦相手モデリングボーナスを追加
      const opponentBonus = calculateOpponentModelingBonus(
        card,
        candidates,
        gameState,
        player,
        opponentModeling
      )

      // 🆕 カード順序ボーナス: 最適タイミングでの使用
      const sequencingBonus = calculateSequencingBonus(
        card,
        currentTrickNumber,
        sequenceStrategy,
        gameState
      )

      // 🆕 ボイド作成ボーナス: 戦略的ボイド作成支援
      const voidCreationBonus = calculateVoidCreationBonus(
        card,
        voidStrategy,
        gameState
      )

      // スコア = 勝率 × 貢献度 + ボーナス + 対戦相手ボーナス + 順序ボーナス + ボイドボーナス
      const score =
        result.winProbability * result.contributionScore +
        bonus +
        opponentBonus +
        sequencingBonus +
        voidCreationBonus

      return { card, score }
    })
    .sort((a, b) => {
      if (preferHighProbability) {
        return b.score - a.score // 高スコア優先
      } else {
        return a.score - b.score // 低スコア優先
      }
    })

  return scoredCandidates[0].card
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
export interface CardCountingInfo {
  suitTracking: Map<Suit, SuitTracking> // 各スートの追跡情報
  totalPlayedCards: number // 既に出たカード総数
  totalRemainingCards: number // 残りカード総数
  totalPlayedFaceCards: number // 既に出た絵札総数
  totalRemainingFaceCards: number // 残り絵札総数
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

/**
 * 🆕 協力戦略を評価（シグナリング統合）
 * Evaluate cooperative strategy with signaling integration
 */
function evaluateCooperativeStrategy(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  currentTrick: Trick
): import('./strategies/types').CooperativeStrategyInfo {
  // カードカウンティング情報を取得
  const cardCounting = trackAllCards(player, gameState)

  // シグナル履歴を構築
  const signalHistory = buildSignalHistory(player, gameState, cardCounting)

  // 目標達成状況を計算
  const requirements = calculateWinningRequirements(gameState)

  // 役割に応じて協力戦略を評価
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: napoleonCooperationを使用
    return evaluateNapoleonCooperation(
      playableCards,
      currentTrick,
      gameState,
      player,
      signalHistory,
      cardCounting,
      requirements
    )
  } else {
    // 連合軍: allianceCooperationを使用
    return evaluateAllianceCooperation(
      playableCards,
      currentTrick,
      gameState,
      player,
      signalHistory,
      cardCounting
    )
  }
}
