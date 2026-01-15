import type {
  ACTION_TYPES,
  GAME_PHASES,
  GAME_ROOM_STATUS,
  RANKS,
  SUITS,
} from '@/lib/constants'

export type Suit = (typeof SUITS)[number]
export type Rank = (typeof RANKS)[number]

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
  reshuffleCount?: number // リシャッフル回数
  lastReshuffleReason?: string // 最後のリシャッフル理由
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
  | typeof GAME_PHASES.SETUP // ゲーム開始前
  | typeof GAME_PHASES.DEALING // カード配布
  | typeof GAME_PHASES.NAPOLEON // ナポレオン宣言
  | typeof GAME_PHASES.ADJUTANT // 副官選択
  | typeof GAME_PHASES.EXCHANGE // 埋まっている4枚との交換
  | typeof GAME_PHASES.PLAYING // ゲームプレイ
  | typeof GAME_PHASES.FINISHED // ゲーム終了

// Context state management types
export interface GameContextState {
  gameState: GameState | null
  loading: boolean
  error: string | null
  initialized: boolean
}

export interface GameAction {
  type:
    | typeof ACTION_TYPES.GAME.SET_LOADING
    | typeof ACTION_TYPES.GAME.SET_ERROR
    | typeof ACTION_TYPES.GAME.SET_GAME_STATE
    | typeof ACTION_TYPES.GAME.SET_INITIALIZED
    | typeof ACTION_TYPES.GAME.RESET_ERROR
    | typeof ACTION_TYPES.GAME.RESET_STATE
  payload?: {
    gameState?: GameState | null
    error?: string | null
    loading?: boolean
    initialized?: boolean
  }
}

export interface GameRoom {
  id: string
  name: string
  playerCount: number
  maxPlayers: number
  status:
    | typeof GAME_ROOM_STATUS.WAITING
    | typeof GAME_ROOM_STATUS.PLAYING
    | typeof GAME_ROOM_STATUS.FINISHED
  createdAt: Date
  hostPlayerId: string
  gameId?: string // ルームで実行中のゲームID（ゲーム開始後に設定）
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
