import type {
  Card,
  GamePhase,
  GameState,
  PlayedCard,
  Player,
  Trick,
} from '@/types/game'
import {
  canFollowSuit,
  dealCards,
  generateGameId,
  removeCardFromHand,
} from '@/utils/cardUtils'

/**
 * 新しいゲームを初期化
 */
export function initializeGame(playerNames: string[]): GameState {
  if (playerNames.length !== 4) {
    throw new Error('Napoleon game requires exactly 4 players')
  }

  const players: Player[] = playerNames.map((name, index) => ({
    id: `player_${index + 1}`,
    name,
    hand: [],
    isNapoleon: false,
    isAdjutant: false,
    position: index + 1,
  }))

  const { players: playersWithCards, hiddenCards } = dealCards(players)

  return {
    id: generateGameId(),
    players: playersWithCards,
    currentTrick: createNewTrick(),
    tricks: [],
    currentPlayerIndex: 0,
    phase: 'napoleon',
    hiddenCards,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * 新しいトリックを作成
 */
export function createNewTrick(): Trick {
  return {
    id: `trick_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    cards: [],
    completed: false,
  }
}

/**
 * プレイヤーがカードをプレイ
 */
export function playCard(
  gameState: GameState,
  playerId: string,
  cardId: string
): GameState {
  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  const card = player.hand.find((c) => c.id === cardId)
  if (!card) {
    throw new Error('Card not found in player hand')
  }

  // フォロー義務をチェック
  if (gameState.currentTrick.cards.length > 0 && gameState.leadingSuit) {
    if (
      canFollowSuit(player.hand, gameState.leadingSuit) &&
      card.suit !== gameState.leadingSuit
    ) {
      throw new Error('Must follow suit if possible')
    }
  }

  // カードをプレイ
  const playedCard: PlayedCard = {
    card,
    playerId,
    order: gameState.currentTrick.cards.length + 1,
  }

  const updatedPlayers = gameState.players.map((p) =>
    p.id === playerId ? { ...p, hand: removeCardFromHand(p.hand, cardId) } : p
  )

  const updatedTrick: Trick = {
    ...gameState.currentTrick,
    cards: [...gameState.currentTrick.cards, playedCard],
    leadingSuit:
      gameState.currentTrick.cards.length === 0
        ? card.suit
        : gameState.currentTrick.leadingSuit,
  }

  // トリックが完了したかチェック
  const trickCompleted = updatedTrick.cards.length === 4
  let newGameState: GameState

  if (trickCompleted) {
    const winner = determineTrickWinner(updatedTrick, gameState.trumpSuit)
    const completedTrick: Trick = {
      ...updatedTrick,
      completed: true,
      winnerPlayerId: winner.playerId,
    }

    // 次のプレイヤーインデックスを勝者に設定
    const winnerIndex = gameState.players.findIndex(
      (p) => p.id === winner.playerId
    )

    newGameState = {
      ...gameState,
      players: updatedPlayers,
      tricks: [...gameState.tricks, completedTrick],
      currentTrick: createNewTrick(),
      currentPlayerIndex: winnerIndex,
      leadingSuit: undefined,
      updatedAt: new Date(),
    }

    // ゲーム終了チェック
    if (newGameState.tricks.length === 12) {
      newGameState.phase = 'finished'
    }
  } else {
    // 次のプレイヤーに移行
    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % 4

    newGameState = {
      ...gameState,
      players: updatedPlayers,
      currentTrick: updatedTrick,
      currentPlayerIndex: nextPlayerIndex,
      leadingSuit: updatedTrick.leadingSuit,
      updatedAt: new Date(),
    }
  }

  return newGameState
}

/**
 * トリックの勝者を決定
 */
export function determineTrickWinner(
  trick: Trick,
  trumpSuit?: string
): PlayedCard {
  if (trick.cards.length === 0) {
    throw new Error('Cannot determine winner of empty trick')
  }

  let winner = trick.cards[0]

  for (const playedCard of trick.cards.slice(1)) {
    if (
      isCardStronger(playedCard.card, winner.card, trick.leadingSuit, trumpSuit)
    ) {
      winner = playedCard
    }
  }

  return winner
}

/**
 * カードAがカードBより強いかを判定
 */
export function isCardStronger(
  cardA: Card,
  cardB: Card,
  leadingSuit?: string,
  trumpSuit?: string
): boolean {
  // 両方とも切り札の場合
  if (trumpSuit && cardA.suit === trumpSuit && cardB.suit === trumpSuit) {
    return cardA.value > cardB.value
  }

  // カードAが切り札でカードBが切り札でない場合
  if (trumpSuit && cardA.suit === trumpSuit && cardB.suit !== trumpSuit) {
    return true
  }

  // カードBが切り札でカードAが切り札でない場合
  if (trumpSuit && cardB.suit === trumpSuit && cardA.suit !== trumpSuit) {
    return false
  }

  // 両方とも切り札ではない場合
  if (leadingSuit) {
    // 両方ともリードスートの場合
    if (cardA.suit === leadingSuit && cardB.suit === leadingSuit) {
      return cardA.value > cardB.value
    }

    // カードAがリードスートでカードBがリードスートでない場合
    if (cardA.suit === leadingSuit && cardB.suit !== leadingSuit) {
      return true
    }

    // カードBがリードスートでカードAがリードスートでない場合
    if (cardB.suit === leadingSuit && cardA.suit !== leadingSuit) {
      return false
    }
  }

  // どちらも切り札でもリードスートでもない場合は、値で比較
  return cardA.value > cardB.value
}

/**
 * ナポレオンを設定
 */
export function setNapoleon(
  gameState: GameState,
  playerId: string,
  napoleonCard?: Card
): GameState {
  const updatedPlayers = gameState.players.map((player) => ({
    ...player,
    isNapoleon: player.id === playerId,
  }))

  return {
    ...gameState,
    players: updatedPlayers,
    napoleonCard,
    phase: 'adjutant' as GamePhase,
    updatedAt: new Date(),
  }
}

/**
 * 副官を設定
 */
export function setAdjutant(
  gameState: GameState,
  adjutantCard: Card
): GameState {
  // 副官カードを持つプレイヤーを見つける
  const adjutantPlayer = gameState.players.find((player) =>
    player.hand.some((card) => card.id === adjutantCard.id)
  )

  if (!adjutantPlayer) {
    throw new Error('Adjutant card not found in any player hand')
  }

  const updatedPlayers = gameState.players.map((player) => ({
    ...player,
    isAdjutant: player.id === adjutantPlayer.id,
  }))

  return {
    ...gameState,
    players: updatedPlayers,
    phase: 'playing' as GamePhase,
    updatedAt: new Date(),
  }
}

/**
 * 現在のプレイヤーを取得
 */
export function getCurrentPlayer(gameState: GameState): Player {
  return gameState.players[gameState.currentPlayerIndex]
}

/**
 * ナポレオンプレイヤーを取得
 */
export function getNapoleonPlayer(gameState: GameState): Player | undefined {
  return gameState.players.find((player) => player.isNapoleon)
}

/**
 * 副官プレイヤーを取得
 */
export function getAdjutantPlayer(gameState: GameState): Player | undefined {
  return gameState.players.find((player) => player.isAdjutant)
}
