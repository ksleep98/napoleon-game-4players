import { processAllAIPhases } from '@/lib/ai/gameTricks'
import { GAME_PHASES } from '@/lib/constants'
import { determineWinnerWithSpecialRules } from '@/lib/napoleonCardRules'
import type {
  Card,
  GameState,
  NapoleonDeclaration,
  PlayedCard,
  Player,
  Trick,
} from '@/types/game'
import { createPlayersWithAI } from '@/utils/aiPlayerUtils'
import {
  canFollowSuit,
  dealCards,
  generateGameId,
  removeCardFromHand,
} from '@/utils/cardUtils'
import {
  advanceNapoleonPhase,
  canDeclareNapoleon,
  findAdjutant,
  isValidNapoleonDeclaration,
  shouldRedeal,
} from './napoleonRules'

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
    isAI: false, // デフォルトは人間プレイヤー
  }))

  const { players: playersWithCards, hiddenCards } = dealCards(players)

  return {
    id: generateGameId(),
    players: playersWithCards,
    currentTrick: createNewTrick(),
    tricks: [],
    currentPlayerIndex: 0,
    phase: GAME_PHASES.NAPOLEON,
    hiddenCards,
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * AI 対戦用のゲームを初期化（人間1人 + AI 3人）
 */
export function initializeAIGame(humanPlayerName: string): GameState {
  const players = createPlayersWithAI(humanPlayerName)
  const { players: playersWithCards, hiddenCards } = dealCards(players)

  return {
    id: generateGameId(),
    players: playersWithCards,
    currentTrick: createNewTrick(),
    tricks: [],
    currentPlayerIndex: 0,
    phase: GAME_PHASES.NAPOLEON,
    hiddenCards,
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * 新しいトリックを作成
 */
export function createNewTrick(): Trick {
  return {
    id: `trick_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    cards: [],
    completed: false,
  }
}

/**
 * ナポレオンを宣言（詳細版）
 */
export function declareNapoleonWithDeclaration(
  gameState: GameState,
  declaration: NapoleonDeclaration
): GameState {
  if (!canDeclareNapoleon(gameState, declaration.playerId)) {
    throw new Error('Cannot declare Napoleon at this time')
  }

  if (!isValidNapoleonDeclaration(declaration, gameState.napoleonDeclaration)) {
    throw new Error('Invalid Napoleon declaration')
  }

  // プレイヤーをナポレオンに設定
  const updatedPlayers = gameState.players.map((player) => {
    if (player.id === declaration.playerId) {
      return { ...player, isNapoleon: true }
    }
    // 前のナポレオンがいる場合は解除
    return { ...player, isNapoleon: false }
  })

  const newGameState = {
    ...gameState,
    players: updatedPlayers,
    napoleonDeclaration: declaration,
    // 互換性のため古い形式も保持
    napoleonCard: declaration.adjutantCard,
    updatedAt: new Date(),
  }

  // 次のフェーズに進行
  return advanceNapoleonPhase(newGameState)
}

/**
 * ナポレオンを宣言（簡単版 - 後方互換性のため）
 */
export function declareNapoleon(
  gameState: GameState,
  playerId: string,
  selectedCard?: Card
): GameState {
  if (gameState.phase !== GAME_PHASES.NAPOLEON) {
    throw new Error('Napoleon can only be declared during napoleon phase')
  }

  const updatedPlayers = gameState.players.map((player) => {
    if (player.id === playerId) {
      return { ...player, isNapoleon: true }
    }
    return player
  })

  return {
    ...gameState,
    players: updatedPlayers,
    phase: GAME_PHASES.ADJUTANT,
    napoleonCard: selectedCard,
    currentPlayerIndex: gameState.players.findIndex((p) => p.id === playerId),
    updatedAt: new Date(),
  }
}

/**
 * ナポレオン宣言をパス
 */
export function passNapoleonDeclaration(
  gameState: GameState,
  playerId: string
): GameState {
  if (!canDeclareNapoleon(gameState, playerId)) {
    throw new Error('Cannot pass Napoleon declaration at this time')
  }

  const updatedPassedPlayers = [...gameState.passedPlayers, playerId]

  const newGameState = {
    ...gameState,
    passedPlayers: updatedPassedPlayers,
    updatedAt: new Date(),
  }

  // 配り直しが必要かチェック
  if (shouldRedeal(newGameState)) {
    return {
      ...newGameState,
      needsRedeal: true,
    }
  }

  // 次のフェーズに進行
  return advanceNapoleonPhase(newGameState)
}

/**
 * 配り直しを実行
 */
export function redealCards(gameState: GameState): GameState {
  if (!gameState.needsRedeal) {
    throw new Error('Redeal is not needed')
  }

  // カードを再配布
  const { players: playersWithCards, hiddenCards } = dealCards(
    gameState.players
  )

  return {
    ...gameState,
    players: playersWithCards,
    hiddenCards,
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    napoleonDeclaration: undefined,
    napoleonCard: undefined,
    phase: GAME_PHASES.NAPOLEON,
    currentPlayerIndex: 0,
    updatedAt: new Date(),
  }
}

/**
 * 副官を設定（副官カードを持つプレイヤーを特定）
 */
export function setAdjutant(
  gameState: GameState,
  adjutantCard: Card
): GameState {
  if (gameState.phase !== GAME_PHASES.ADJUTANT) {
    throw new Error('Adjutant can only be set during adjutant phase')
  }

  const adjutantPlayer = findAdjutant(gameState, adjutantCard)

  const updatedPlayers = gameState.players.map((player) => {
    if (adjutantPlayer && player.id === adjutantPlayer.id) {
      return { ...player, isAdjutant: true }
    }
    return { ...player, isAdjutant: false }
  })

  // ナポレオンプレイヤーに隠しカード4枚を追加（隠しカードフラグ付き）
  const finalPlayers = updatedPlayers.map((player) => {
    if (player.isNapoleon) {
      console.log(
        `Adding ${gameState.hiddenCards.length} hidden cards to Napoleon ${player.name}. Current hand: ${player.hand.length} cards`
      )
      const hiddenCardsWithFlag = gameState.hiddenCards.map((card) => ({
        ...card,
        wasHidden: true,
      }))
      return {
        ...player,
        hand: [...player.hand, ...hiddenCardsWithFlag],
      }
    }
    return player
  })

  return {
    ...gameState,
    players: finalPlayers,
    phase: GAME_PHASES.EXCHANGE,
    napoleonCard: adjutantCard,
    updatedAt: new Date(),
  }
}

/**
 * 埋まっているカードとの交換
 */
export function exchangeCards(
  gameState: GameState,
  playerId: string,
  cardsToDiscard: Card[]
): GameState {
  if (gameState.phase !== GAME_PHASES.EXCHANGE) {
    throw new Error('Card exchange can only be done during card exchange phase')
  }

  if (
    !gameState.napoleonDeclaration ||
    gameState.napoleonDeclaration.playerId !== playerId
  ) {
    throw new Error('Only Napoleon can exchange cards')
  }

  if (cardsToDiscard.length !== 4) {
    throw new Error('Must discard exactly 4 cards')
  }

  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  // ナポレオンプレイヤーの手札は既に16枚（元の12枚+隠しカード4枚）になっている
  // 捨てるカード4枚を除いた残り12枚が新しい手札
  const newHand = player.hand.filter(
    (card) => !cardsToDiscard.some((discard) => discard.id === card.id)
  )

  // 念のため手札数をチェック
  if (newHand.length !== 12) {
    throw new Error(
      `Expected 12 cards after exchange, got ${newHand.length}. Player had ${player.hand.length} cards, discarded ${cardsToDiscard.length}`
    )
  }

  const updatedPlayers = gameState.players.map((p) => {
    if (p.id === playerId) {
      return { ...p, hand: newHand }
    }
    return p
  })

  return {
    ...gameState,
    players: updatedPlayers,
    exchangedCards: cardsToDiscard,
    phase: GAME_PHASES.PLAYING,
    currentPlayerIndex: gameState.players.findIndex((p) => p.id === playerId),
    updatedAt: new Date(),
  }
}

/**
 * AI フェーズを処理してゲーム状態を更新
 */
export async function processAITurn(gameState: GameState): Promise<GameState> {
  if (
    gameState.phase === GAME_PHASES.NAPOLEON ||
    gameState.phase === GAME_PHASES.ADJUTANT ||
    gameState.phase === GAME_PHASES.EXCHANGE
  ) {
    return await processAllAIPhases(gameState)
  }

  return gameState
}

/**
 * 現在のプレイヤーを取得
 */
export function getCurrentPlayer(gameState: GameState): Player | null {
  return gameState.players[gameState.currentPlayerIndex] || null
}

/**
 * カードをプレイ
 */
export function playCard(
  gameState: GameState,
  playerId: string,
  cardId: string
): GameState {
  if (gameState.phase !== GAME_PHASES.PLAYING) {
    throw new Error('Cards can only be played during playing phase')
  }

  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error('Player not found')
  }

  const card = player.hand.find((c) => c.id === cardId)
  if (!card) {
    throw new Error('Card not found in player hand')
  }

  // フォロー義務のチェック
  if (gameState.currentTrick.cards.length > 0 && gameState.leadingSuit) {
    if (canFollowSuit(player.hand, gameState.leadingSuit)) {
      if (card.suit !== gameState.leadingSuit) {
        throw new Error('Must follow suit if possible')
      }
    }
  }

  // ナポレオンが副官指定カードを出した場合の特別処理
  // 副官カードが隠しカードにあった場合、ナポレオンが出すと副官アイコンも表示
  let playedCardFlags = {}
  if (
    player.isNapoleon &&
    gameState.napoleonDeclaration?.adjutantCard &&
    card.id === gameState.napoleonDeclaration.adjutantCard.id &&
    card.wasHidden // 隠しカードだった場合のフラグ
  ) {
    playedCardFlags = { revealsAdjutant: true }
  }

  // カードをプレイ
  const playedCard: PlayedCard = {
    card,
    playerId,
    order: gameState.currentTrick.cards.length,
    ...playedCardFlags,
  }

  // プレイヤーの手札からカードを削除
  const updatedPlayers = gameState.players.map((p) => {
    if (p.id === playerId) {
      return {
        ...p,
        hand: removeCardFromHand(p.hand, cardId),
      }
    }
    return p
  })

  // トリックにカードを追加
  const updatedTrick: Trick = {
    ...gameState.currentTrick,
    cards: [...gameState.currentTrick.cards, playedCard],
  }

  // 最初のカードの場合、リードスーツを設定
  let leadingSuit = gameState.leadingSuit
  if (gameState.currentTrick.cards.length === 0) {
    leadingSuit = card.suit
    updatedTrick.leadingSuit = card.suit
  }

  const updatedGameState: GameState = {
    ...gameState,
    players: updatedPlayers,
    currentTrick: updatedTrick,
    leadingSuit,
    updatedAt: new Date(),
  }

  // トリックが完了したかチェック
  if (updatedTrick.cards.length === 4) {
    return completeTrick(updatedGameState)
  }

  // 次のプレイヤーに移動
  return {
    ...updatedGameState,
    currentPlayerIndex: (gameState.currentPlayerIndex + 1) % 4,
  }
}

/**
 * トリックを完了
 */
export function completeTrick(gameState: GameState): GameState {
  const winner = determineWinner(gameState.currentTrick, gameState)
  if (!winner) {
    throw new Error('Cannot determine trick winner')
  }

  const completedTrick: Trick = {
    ...gameState.currentTrick,
    winnerPlayerId: winner.playerId,
    completed: true,
  }

  const allTricks = [...gameState.tricks, completedTrick]

  // ゲーム終了チェック（12ターン目）
  if (allTricks.length === 12) {
    return {
      ...gameState,
      currentTrick: completedTrick,
      tricks: allTricks,
      phase: GAME_PHASES.FINISHED,
      showingTrickResult: true, // 12ターン目でもトリック結果を表示
      lastCompletedTrick: completedTrick,
      updatedAt: new Date(),
    }
  }

  // 次のトリックを開始（勝者が先手）
  const winnerIndex = gameState.players.findIndex(
    (p) => p.id === winner.playerId
  )

  return {
    ...gameState,
    currentTrick: createNewTrick(),
    tricks: allTricks,
    currentPlayerIndex: winnerIndex,
    leadingSuit: undefined,
    showingTrickResult: true,
    lastCompletedTrick: completedTrick,
    updatedAt: new Date(),
  }
}

/**
 * トリック結果表示を閉じる
 */
export function closeTrickResult(gameState: GameState): GameState {
  return {
    ...gameState,
    showingTrickResult: false,
    lastCompletedTrick: undefined,
    updatedAt: new Date(),
  }
}

/**
 * トリックの勝者を決定（特殊ルール適用）
 */
export function determineWinner(
  trick: Trick,
  gameState?: GameState
): PlayedCard | null {
  if (trick.cards.length === 0) {
    return null
  }

  // ゲームステートから切り札情報を取得
  const trumpSuit = gameState?.trumpSuit || gameState?.napoleonDeclaration?.suit
  if (!trumpSuit) {
    // 切り札が設定されていない場合は基本ロジック
    return determineWinnerBasic(trick)
  }

  // 最初のトリックかどうかを判定
  const isFirstTrick = gameState?.tricks?.length === 0

  // 特殊ルール適用の勝者決定
  return determineWinnerWithSpecialRules(trick, trumpSuit, isFirstTrick)
}

/**
 * 基本的なトリック勝者決定（特殊ルールなし）
 */
function determineWinnerBasic(trick: Trick): PlayedCard | null {
  const leadingSuit = trick.cards[0].card.suit
  let winner = trick.cards[0]

  for (const playedCard of trick.cards) {
    const currentCard = playedCard.card
    const winnerCard = winner.card

    if (currentCard.suit === leadingSuit && winnerCard.suit !== leadingSuit) {
      winner = playedCard
    } else if (
      currentCard.suit === winnerCard.suit &&
      currentCard.value > winnerCard.value
    ) {
      winner = playedCard
    }
  }

  return winner
}

/**
 * ゲーム終了チェック
 */
export function isGameFinished(gameState: GameState): boolean {
  return gameState.phase === GAME_PHASES.FINISHED
}

/**
 * ナポレオンチームの勝利チェック
 */
export function checkNapoleonVictory(gameState: GameState): boolean {
  const napoleonPlayer = gameState.players.find((p) => p.isNapoleon)
  const adjutantPlayer = gameState.players.find((p) => p.isAdjutant)

  if (!napoleonPlayer) {
    return false
  }

  // ナポレオンチームが取ったトリック数を計算
  let napoleonTricks = 0
  for (const trick of gameState.tricks) {
    if (trick.winnerPlayerId === napoleonPlayer.id) {
      napoleonTricks++
    }
    if (adjutantPlayer && trick.winnerPlayerId === adjutantPlayer.id) {
      napoleonTricks++
    }
  }

  return napoleonTricks >= 8
}

/**
 * ゲーム状態のバリデーション
 */
export function validateGameState(gameState: GameState): boolean {
  // 基本的なバリデーション
  if (gameState.players.length !== 4) {
    return false
  }

  // プレイヤーの手札数チェック
  const totalCards = gameState.players.reduce(
    (sum, player) => sum + player.hand.length,
    0
  )
  const playedCards = gameState.tricks.reduce(
    (sum, trick) => sum + trick.cards.length,
    0
  )
  const currentTrickCards = gameState.currentTrick.cards.length

  return (
    totalCards +
      playedCards +
      currentTrickCards +
      gameState.hiddenCards.length ===
    52
  )
}
