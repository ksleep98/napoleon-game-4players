import type {
  Card,
  GameState,
  NapoleonDeclaration,
  Player,
  Suit,
} from '@/types/game'

// スートの優先順位（強い順）
export const SUIT_PRIORITY: Record<Suit, number> = {
  spades: 4, // ♠ スペード（最強）
  hearts: 3, // ♥ ハート
  diamonds: 2, // ♦ ダイヤ
  clubs: 1, // ♣ クラブ（最弱）
}

// 最小宣言絵札数
export const MIN_NAPOLEON_FACE_CARDS = 13

// 最大宣言絵札数
export const MAX_NAPOLEON_FACE_CARDS = 20

/**
 * ナポレオン宣言が有効かチェック
 */
export function isValidNapoleonDeclaration(
  declaration: NapoleonDeclaration,
  currentDeclaration?: NapoleonDeclaration
): boolean {
  // 最小・最大絵札数チェック
  if (
    declaration.targetTricks < MIN_NAPOLEON_FACE_CARDS ||
    declaration.targetTricks > MAX_NAPOLEON_FACE_CARDS
  ) {
    return false
  }

  // 現在の宣言がない場合（最初の宣言）
  if (!currentDeclaration) {
    return declaration.targetTricks >= MIN_NAPOLEON_FACE_CARDS
  }

  // より多くの絵札数を宣言している場合
  if (declaration.targetTricks > currentDeclaration.targetTricks) {
    return true
  }

  // 同じ絵札数の場合、スートの優先順位で判定
  if (declaration.targetTricks === currentDeclaration.targetTricks) {
    return (
      SUIT_PRIORITY[declaration.suit] > SUIT_PRIORITY[currentDeclaration.suit]
    )
  }

  return false
}

/**
 * プレイヤーがナポレオンを宣言できるかチェック
 */
export function canDeclareNapoleon(
  gameState: GameState,
  playerId: string
): boolean {
  // ナポレオンフェーズでない場合は宣言不可
  if (gameState.phase !== 'napoleon') {
    return false
  }

  // 既にパスしたプレイヤーは宣言不可
  if (gameState.passedPlayers.includes(playerId)) {
    return false
  }

  return true
}

/**
 * 宣言可能な最小絵札数とスートを取得
 */
export function getMinimumDeclaration(
  currentDeclaration?: NapoleonDeclaration
): {
  minTricks: number
  availableSuits: Suit[]
} {
  if (!currentDeclaration) {
    return {
      minTricks: MIN_NAPOLEON_FACE_CARDS,
      availableSuits: ['clubs', 'diamonds', 'hearts', 'spades'],
    }
  }

  const currentTricks = currentDeclaration.targetTricks
  const currentSuit = currentDeclaration.suit
  const currentPriority = SUIT_PRIORITY[currentSuit]

  // 同じ絵札数で、より強いスートが可能かチェック
  const availableSuits: Suit[] = []
  for (const [suit, priority] of Object.entries(SUIT_PRIORITY)) {
    if (priority > currentPriority) {
      availableSuits.push(suit as Suit)
    }
  }

  // より強いスートがある場合は、同じ絵札数で可能
  if (availableSuits.length > 0) {
    return {
      minTricks: currentTricks,
      availableSuits,
    }
  }

  // より強いスートがない場合は、絵札数を上げる必要がある
  if (currentTricks < MAX_NAPOLEON_FACE_CARDS) {
    return {
      minTricks: currentTricks + 1,
      availableSuits: ['clubs', 'diamonds', 'hearts', 'spades'],
    }
  }

  // 最大絵札数で最強スートの場合、宣言不可
  return {
    minTricks: MAX_NAPOLEON_FACE_CARDS + 1, // 実質的に不可能
    availableSuits: [],
  }
}

/**
 * 配り直しが必要かチェック（全員がパスした場合）
 */
export function shouldRedeal(gameState: GameState): boolean {
  return (
    gameState.phase === 'napoleon' &&
    gameState.passedPlayers.length === gameState.players.length &&
    !gameState.napoleonDeclaration
  )
}

/**
 * 次の宣言者を取得
 */
export function getNextDeclarationPlayer(gameState: GameState): Player | null {
  // ナポレオンフェーズでない場合はnull
  if (gameState.phase !== 'napoleon') {
    return null
  }

  const players = gameState.players
  let currentTurn = gameState.declarationTurn

  // ナポレオン宣言がある場合は、宣言者以外の残りプレイヤーに機会を与える
  if (gameState.napoleonDeclaration) {
    // 全員が一巡するまで継続（宣言者以外）
    for (let i = 0; i < players.length; i++) {
      const player = players[currentTurn % players.length]

      // まだパスしていないプレイヤーで、かつ現在の宣言者でない場合
      if (
        !gameState.passedPlayers.includes(player.id) &&
        gameState.napoleonDeclaration.playerId !== player.id
      ) {
        return player
      }

      currentTurn++
    }

    // 全員がパスまたは宣言済みなら終了
    return null
  }

  // ナポレオン宣言がない場合は通常の順番
  for (let i = 0; i < players.length; i++) {
    const player = players[currentTurn % players.length]

    if (!gameState.passedPlayers.includes(player.id)) {
      return player
    }

    currentTurn++
  }

  return null // 全員がパス済み
}

/**
 * ナポレオン宣言フェーズを進行
 */
export function advanceNapoleonPhase(gameState: GameState): GameState {
  const nextPlayer = getNextDeclarationPlayer(gameState)

  if (!nextPlayer) {
    // 全員がパスした場合
    if (gameState.napoleonDeclaration) {
      // 誰かが宣言している場合は副官選択フェーズへ
      return {
        ...gameState,
        phase: 'adjutant',
        currentPlayerIndex: gameState.players.findIndex(
          (p) => p.id === gameState.napoleonDeclaration?.playerId
        ),
      }
    } else {
      // 誰も宣言していない場合は配り直し
      return {
        ...gameState,
        needsRedeal: true,
      }
    }
  }

  // 次のプレイヤーのターンに進む
  return {
    ...gameState,
    declarationTurn: gameState.declarationTurn + 1,
    currentPlayerIndex: gameState.players.findIndex(
      (p) => p.id === nextPlayer.id
    ),
  }
}

/**
 * 副官カードが有効かチェック
 */
export function isValidAdjutantCard(
  card: Card,
  napoleonHand: Card[],
  _hiddenCards: Card[]
): boolean {
  // ナポレオンの手札に同じカードがあれば無効
  if (napoleonHand.some((handCard) => handCard.id === card.id)) {
    return false
  }

  // 有効なカード
  return true
}

/**
 * 副官を特定（指定されたカードを持つプレイヤー）
 */
export function findAdjutant(
  gameState: GameState,
  adjutantCard: Card
): Player | null {
  for (const player of gameState.players) {
    if (player.hand.some((card) => card.id === adjutantCard.id)) {
      return player
    }
  }

  // 隠しカードにある場合は副官なし
  if (gameState.hiddenCards.some((card) => card.id === adjutantCard.id)) {
    return null
  }

  return null
}
