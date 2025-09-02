export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'

export interface Card {
  id: string
  suit: Suit
  rank: Rank
  value: number // ナポレオンでの実際の強さ
  wasHidden?: boolean // 隠しカードだったかどうか
}

export interface Player {
  id: string
  name: string
  hand: Card[]
  isNapoleon: boolean
  isAdjutant: boolean // 副官
  position: number // 1-4
  isAI: boolean // AI プレイヤーかどうか
}

// ナポレオン宣言の詳細
export interface NapoleonDeclaration {
  playerId: string
  targetTricks: number // 取る予定の絵札数（11, 12, 13...20）
  suit: Suit // 宣言したスート
  adjutantCard?: Card // 指定する副官カード
}

export interface GameState {
  id: string
  players: Player[]
  currentTrick: Trick
  tricks: Trick[]
  currentPlayerIndex: number
  phase: GamePhase
  napoleonDeclaration?: NapoleonDeclaration // ナポレオン宣言の詳細
  napoleonCard?: Card // ナポレオンが指定したカード（旧形式、互換性のため残す）
  leadingSuit?: Suit // そのトリックで最初に出されたスート
  trumpSuit?: Suit // 切り札のスート
  hiddenCards: Card[] // 伏せられた4枚
  passedPlayers: string[] // ナポレオン宣言をパスしたプレイヤー
  declarationTurn: number // 現在の宣言ターン（0から開始）
  needsRedeal: boolean // 配り直しが必要かどうか
  exchangedCards?: Card[] // ナポレオンが交換で捨てたカード
  showingTrickResult?: boolean // トリック結果を表示中かどうか
  lastCompletedTrick?: Trick // 最後に完了したトリック
  createdAt: Date
  updatedAt: Date
}

export interface Trick {
  id: string
  cards: PlayedCard[]
  winnerPlayerId?: string
  leadingSuit?: Suit
  completed: boolean
}

export interface PlayedCard {
  card: Card
  playerId: string
  order: number
  revealsAdjutant?: boolean // ナポレオンが隠しカードの副官カードを出した場合
}

export type GamePhase =
  | 'setup' // ゲーム開始前
  | 'dealing' // カード配布
  | 'napoleon' // ナポレオン宣言
  | 'adjutant' // 副官選択
  | 'card_exchange' // 埋まっている4枚との交換
  | 'playing' // ゲームプレイ
  | 'finished' // ゲーム終了

export interface GameRoom {
  id: string
  name: string
  playerCount: number
  maxPlayers: number
  status: 'waiting' | 'playing' | 'finished'
  createdAt: Date
  hostPlayerId: string
}

// Napoleon game specific rules
export interface NapoleonRules {
  targetTricks: number // ナポレオン側が取る必要がある絵札数
  napoleonBonus: number // ナポレオン成功時のボーナス点
  basePoints: number // 基本得点
}

export interface GameResult {
  gameId: string
  napoleonWon: boolean
  napoleonPlayerId: string
  adjutantPlayerId?: string
  faceCardsWon: number
  scores: PlayerScore[]
}

export interface PlayerScore {
  playerId: string
  points: number
  isWinner: boolean
}
