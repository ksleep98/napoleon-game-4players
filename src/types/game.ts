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
}

export interface Player {
  id: string
  name: string
  hand: Card[]
  isNapoleon: boolean
  isAdjutant: boolean // 副官
  position: number // 1-4
}

export interface GameState {
  id: string
  players: Player[]
  currentTrick: Trick
  tricks: Trick[]
  currentPlayerIndex: number
  phase: GamePhase
  napoleonCard?: Card // ナポレオンが指定したカード
  leadingSuit?: Suit // そのトリックで最初に出されたスート
  trumpSuit?: Suit // 切り札のスート
  hiddenCards: Card[] // 伏せられた4枚
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
}

export type GamePhase =
  | 'setup' // ゲーム開始前
  | 'dealing' // カード配布
  | 'napoleon' // ナポレオン宣言
  | 'adjutant' // 副官選択
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
  targetTricks: number // ナポレオン側が取る必要があるトリック数
  napoleonBonus: number // ナポレオン成功時のボーナス点
  basePoints: number // 基本得点
}

export interface GameResult {
  gameId: string
  napoleonWon: boolean
  napoleonPlayerId: string
  adjutantPlayerId?: string
  tricksWon: number
  scores: PlayerScore[]
}

export interface PlayerScore {
  playerId: string
  points: number
  isWinner: boolean
}
