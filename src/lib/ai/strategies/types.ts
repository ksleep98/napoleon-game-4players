/**
 * AI戦略の共通型定義
 */

import type { Card, Suit } from '@/types/game'

/**
 * 目標達成要件情報
 */
export interface WinningRequirements {
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

/**
 * 各スートの追跡情報
 */
export interface SuitTracking {
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
 * カードカウンティング全体情報
 */
export interface CardCountingInfo {
  suitTracking: Map<Suit, SuitTracking> // 各スートの追跡情報
  totalPlayedCards: number // 既に出たカード総数
  totalRemainingCards: number // 残りカード総数
  totalPlayedFaceCards: number // 既に出た絵札総数
  totalRemainingFaceCards: number // 残り絵札総数
}

/**
 * 切り札カウンティング情報
 */
export interface TrumpTracking {
  playedTrumps: Card[] // 既に出た切り札
  remainingTrumps: number // 残り切り札枚数（推定）
  myTrumps: Card[] // 自分の切り札
  myStrongestTrump: Card | null // 自分の最強切り札
  hasHighTrumps: boolean // 高位切り札（A, K, Q, J, Mighty）を持っているか
  trumpsStrongerThanMine: number // 自分より強い切り札の推定枚数
}

/**
 * 終盤状態情報
 */
export interface EndgameInfo {
  isEndgame: boolean // 終盤かどうか（残りトリック <= 3）
  remainingTricks: number // 残りトリック数
  remainingCardsInHand: number // 自分の残り手札枚数
  canSecureNapoleonVictory: boolean // ナポレオンチームの勝利が確定しているか
  canSecureAllianceVictory: boolean // 連合軍の勝利が確定しているか
  napoleonNeedsAllRemaining: boolean // ナポレオンが残り全絵札を取る必要があるか
  allianceNeedsAllRemaining: boolean // 連合軍が残り全絵札を阻止する必要があるか
}

/**
 * 特殊カード戦略情報
 */
export interface SpecialCardStrategy {
  hasMighty: boolean // Mightyを持っているか
  hasTrumpJack: boolean // Trump Jackを持っているか
  hasCounterJack: boolean // Counter Jackを持っているか
  mightyCard: Card | null // Mightyカード
  trumpJackCard: Card | null // Trump Jackカード
  counterJackCard: Card | null // Counter Jackカード
  shouldUseMighty: boolean // Mightyを使うべきか
  shouldUseTrumpJack: boolean // Trump Jackを使うべきか
  shouldUseCounterJack: boolean // Counter Jackを使うべきか
  faceCardsInTrick: number // トリック内の絵札数
  hasSame2Risk: boolean // セイム2のリスクがあるか
}

/**
 * 副官戦術情報（Adjutant Tactical Information）
 */
export interface AdjutantTacticalInfo {
  shouldRevealNow: boolean // 副官カードを今開示すべきか
  shouldProtectNapoleon: boolean // ナポレオンを保護すべきか（積極的にサポート）
  shouldPassFaceCard: boolean // 絵札をナポレオンに渡すべきか
  shouldWinForNapoleon: boolean // ナポレオンのために勝つべきか（ナポレオンが弱い時）
  napoleonNeedsHelp: boolean // ナポレオンが助けを必要としているか
  trickValueForNapoleon: number // このトリックのナポレオンへの価値（0-10）
  optimalRevealTiming: number // 最適な開示タイミング評価（0-10、高いほど今が良い）
  napoleonIsWinning: boolean // ナポレオンが現在のトリックで勝っているか
  adjutantCard: Card | null // 副官指定カード
  faceCardToPass: Card | null // ナポレオンに渡すべき絵札
  shouldAnswerAdjutantCall: boolean // ナポレオンの副官呼びに副官カードで応えるべきか
  adjutantCallCard: Card | null // 副官呼びに応えて出す副官指定カード
}

/**
 * 手札の構成を分析
 */
export interface HandComposition {
  suitCounts: Map<Suit, number>
  faceCardsBySuit: Map<Suit, Card[]>
  trumpCount: number
  totalFaceCards: number
  voidSuits: Suit[] // 持っていないスート
  shortSuits: Suit[] // 1-2枚しかないスート（ボイド作成候補）
}

/**
 * シグナルタイプ
 * カード選択を通じてパートナーに送る情報の種類
 */
export type SignalType =
  | 'SUIT_STRENGTH' // このスートに強いカードを持っている
  | 'VOID_SUIT' // このスートがボイド（持っていない）
  | 'TRUMP_STRENGTH' // 強い切り札を持っている
  | 'FACE_CARD_COUNT' // 絵札の強さを示す
  | 'NEED_HELP' // パートナーの助けが必要
  | 'CAN_WIN' // このトリックを勝てる
  | 'BLOCK_NAPOLEON' // 連合軍: ナポレオンをブロックすることに集中
  | 'SUPPORT_NAPOLEON' // 副官: ナポレオンをサポート

/**
 * シグナル情報
 * カード選択に込められた意味のある情報
 */
export interface Signal {
  type: SignalType // シグナルの種類
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE' // 強度
  suit?: Suit // 関連するスート（オプション）
  trickNumber: number // トリック番号
  playerId: string // 送信者のプレイヤーID
  confidence: number // 信頼度（0-1）、このシグナルの確実性
}

/**
 * カードプレイパターン
 * プレイヤーのカード選択パターンを記録
 */
export interface CardPlayPattern {
  playerId: string // プレイヤーID
  trickNumber: number // トリック番号
  wasLeading: boolean // リードしていたか
  cardPlayed: Card // プレイしたカード
  playableCards: number // プレイ可能だったカード数
  context: 'AGGRESSIVE' | 'CONSERVATIVE' | 'SIGNALING' | 'NORMAL' // プレイの文脈
}

/**
 * シグナル履歴
 * ゲーム中の送受信シグナルと観察されたパターン
 */
export interface SignalHistory {
  sentSignals: Signal[] // 自分が送ったシグナル
  receivedSignals: Signal[] // パートナーから受け取ったシグナル
  partnerPlayPatterns: CardPlayPattern[] // パートナーのプレイパターン
}

/**
 * 協調戦略情報
 * パートナーとの協調プレイに関する戦略的判断
 */
export interface CooperativeStrategyInfo {
  shouldSignal: boolean // シグナルを送るべきか
  signalToSend?: Signal // 送信するシグナル（オプション）
  partnerSignals: Signal[] // パートナーからのシグナル
  coordinatedPlay?: Card // 協調プレイ推奨カード（オプション）
  reasoning: string // 判断の理由
  cooperationBonus: number // カードスコアに追加される協調ボーナス
}
