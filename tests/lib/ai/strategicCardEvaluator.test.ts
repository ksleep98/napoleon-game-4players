/**
 * 戦略的カード評価システムのテスト
 */

import { evaluateCardStrategicValue } from '@/lib/ai/strategicCardEvaluator'
import { GAME_PHASES } from '@/lib/constants'
import type { Card, GameState, Player } from '@/types/game'

// テスト用のモックカード作成
const createMockCard = (
  id: string,
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs',
  rank:
    | 'A'
    | 'K'
    | 'Q'
    | 'J'
    | '10'
    | '9'
    | '8'
    | '7'
    | '6'
    | '5'
    | '4'
    | '3'
    | '2',
  value: number
): Card => ({
  id,
  suit,
  rank,
  value,
})

// テスト用のモックプレイヤー作成
const createMockPlayer = (
  id: string,
  name: string,
  isNapoleon: boolean = false,
  isAdjutant: boolean = false,
  isAI: boolean = true
): Player => ({
  id,
  name,
  hand: [],
  isNapoleon,
  isAdjutant,
  isAI,
  position: 1,
})

// テスト用のモックゲーム状態作成
const createMockGameState = (napoleonDeclaration?: {
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs'
  targetTricks: number
  adjutantCard?: Card
  playerId: string
}): GameState => ({
  id: 'test-game',
  players: [],
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  hiddenCards: [],
  trumpSuit: 'spades',
  currentTrick: { id: 'current-trick', cards: [], completed: false },
  tricks: [],
  napoleonDeclaration,
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('Strategic Card Evaluator - Adjutant Strategy', () => {
  test('副官指定カードに高いボーナスが付与される', () => {
    // 副官指定カード
    const adjutantCard = createMockCard('adj-card', 'hearts', '10', 10)
    // 通常のカード
    const normalCard = createMockCard('normal-card', 'clubs', '8', 8)

    // 副官プレイヤー
    const adjutantPlayer = createMockPlayer(
      'adj-player',
      'Adjutant',
      false,
      true,
      true
    )

    // ゲーム状態（副官指定カード付き）
    const gameState = createMockGameState({
      suit: 'spades',
      targetTricks: 13,
      adjutantCard,
      playerId: 'napoleon-player',
    })

    // 副官指定カードの戦略的価値を評価
    const adjutantCardValue = evaluateCardStrategicValue(
      adjutantCard,
      gameState,
      adjutantPlayer
    )

    // 通常カードの戦略的価値を評価
    const normalCardValue = evaluateCardStrategicValue(
      normalCard,
      gameState,
      adjutantPlayer
    )

    // 副官指定カードの方が大幅に高い価値になっていることを確認
    expect(adjutantCardValue).toBeGreaterThan(normalCardValue)

    // 副官指定カードには+500のボーナスが付いているはず
    const bonusDifference = adjutantCardValue - normalCardValue
    expect(bonusDifference).toBeGreaterThanOrEqual(450) // 基本強度差を考慮して450以上
  })

  test('副官指定カードが指定されていない場合はボーナスが付与されない', () => {
    const testCard = createMockCard('test-card', 'hearts', '10', 10)
    const adjutantPlayer = createMockPlayer(
      'adj-player',
      'Adjutant',
      false,
      true,
      true
    )

    // 副官指定カードなしのゲーム状態
    const gameStateWithoutAdjutant = createMockGameState({
      suit: 'spades',
      targetTricks: 13,
      // adjutantCard: undefined
      playerId: 'napoleon-player',
    })

    const cardValueWithoutAdjutant = evaluateCardStrategicValue(
      testCard,
      gameStateWithoutAdjutant,
      adjutantPlayer
    )

    // 副官指定カード付きのゲーム状態
    const gameStateWithAdjutant = createMockGameState({
      suit: 'spades',
      targetTricks: 13,
      adjutantCard: testCard, // 同じカードを副官指定カードとして設定
      playerId: 'napoleon-player',
    })

    const cardValueWithAdjutant = evaluateCardStrategicValue(
      testCard,
      gameStateWithAdjutant,
      adjutantPlayer
    )

    // 副官指定カードありの方が+500ボーナス分高くなっているはず
    expect(cardValueWithAdjutant - cardValueWithoutAdjutant).toBe(500)
  })

  test('副官以外のプレイヤーは副官指定カードのボーナスを受けない', () => {
    const adjutantCard = createMockCard('adj-card', 'hearts', '10', 10)

    // 副官プレイヤー
    const adjutantPlayer = createMockPlayer(
      'adj-player',
      'Adjutant',
      false,
      true,
      true
    )
    // ナポレオンプレイヤー
    const napoleonPlayer = createMockPlayer(
      'napoleon-player',
      'Napoleon',
      true,
      false,
      true
    )
    // 連合軍プレイヤー
    const alliancePlayer = createMockPlayer(
      'alliance-player',
      'Alliance',
      false,
      false,
      true
    )

    const gameState = createMockGameState({
      suit: 'spades',
      targetTricks: 13,
      adjutantCard,
      playerId: 'napoleon-player',
    })

    // 各プレイヤーでの戦略的価値を評価
    const adjutantValue = evaluateCardStrategicValue(
      adjutantCard,
      gameState,
      adjutantPlayer
    )
    const napoleonValue = evaluateCardStrategicValue(
      adjutantCard,
      gameState,
      napoleonPlayer
    )
    const allianceValue = evaluateCardStrategicValue(
      adjutantCard,
      gameState,
      alliancePlayer
    )

    // 副官プレイヤーのみがボーナスを受けるため、他のプレイヤーより高い価値になる
    expect(adjutantValue).toBeGreaterThan(napoleonValue)
    expect(adjutantValue).toBeGreaterThan(allianceValue)
  })
})
