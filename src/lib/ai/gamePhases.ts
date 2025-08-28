import type { Card, GameState } from '@/types/game'
import {
  declareNapoleonWithDeclaration,
  exchangeCards,
  passNapoleonDeclaration,
  setAdjutant,
} from '../gameLogic'
import { getNextDeclarationPlayer } from '../napoleonRules'
import { allianceAIStrategy } from './alliance'
import { napoleonAIStrategy } from './napoleon'

// ナポレオン決定フェーズの AI 処理（改善版）
export async function processNapoleonPhase(
  gameState: GameState
): Promise<GameState> {
  let updatedGameState = { ...gameState }

  // 現在の宣言者がAIかチェック
  const currentPlayer = getNextDeclarationPlayer(updatedGameState)
  if (!currentPlayer || !currentPlayer.isAI) {
    // 次のプレイヤーがいない場合は副官フェーズへ
    if (!currentPlayer && updatedGameState.napoleonDeclaration) {
      return {
        ...updatedGameState,
        phase: 'adjutant',
        currentPlayerIndex: updatedGameState.players.findIndex(
          (p) => p.id === updatedGameState.napoleonDeclaration?.playerId
        ),
      }
    }
    return updatedGameState
  }

  console.log(`Processing Napoleon phase for AI player: ${currentPlayer.name}`)

  // そのプレイヤーが実際に宣言可能かチェック
  const { canDeclareNapoleon, advanceNapoleonPhase } = await import(
    '../napoleonRules'
  )
  if (!canDeclareNapoleon(updatedGameState, currentPlayer.id)) {
    console.log(
      `AI Player ${currentPlayer.name} cannot declare Napoleon (already passed)`
    )
    // 次のプレイヤーに進む
    updatedGameState = advanceNapoleonPhase(updatedGameState)
    return updatedGameState
  }

  const strategy = napoleonAIStrategy(updatedGameState, currentPlayer.id)

  if (strategy.shouldDeclare && strategy.declaration) {
    // ナポレオンを宣言
    updatedGameState = declareNapoleonWithDeclaration(
      updatedGameState,
      strategy.declaration
    )
    console.log(
      `AI Player ${currentPlayer.name} declares Napoleon: ${strategy.declaration.targetTricks} tricks with ${strategy.declaration.suit}!`
    )
  } else {
    // パス
    updatedGameState = passNapoleonDeclaration(
      updatedGameState,
      currentPlayer.id
    )
    console.log(`AI Player ${currentPlayer.name} passes Napoleon declaration`)
  }

  return updatedGameState
}

// 副官決定フェーズの AI 処理（改善版）
export async function processAdjutantPhase(
  gameState: GameState
): Promise<GameState> {
  let updatedGameState = { ...gameState }

  // ナポレオンプレイヤーを取得
  const napoleonPlayer = updatedGameState.players.find((p) => p.isNapoleon)

  // ナポレオンが人間プレイヤーの場合は自動処理をスキップ
  if (napoleonPlayer && !napoleonPlayer.isAI) {
    return updatedGameState
  }

  if (!updatedGameState.napoleonDeclaration?.adjutantCard) {
    // 副官カードが指定されていない場合はスキップ
    updatedGameState.phase = 'card_exchange'
    return updatedGameState
  }

  const adjutantCard = updatedGameState.napoleonDeclaration.adjutantCard
  updatedGameState = setAdjutant(updatedGameState, adjutantCard)

  // 副官が決まったログ出力
  const adjutantPlayer = updatedGameState.players.find((p) => p.isAdjutant)
  if (adjutantPlayer) {
    console.log(
      `${adjutantPlayer.name} becomes adjutant with ${adjutantCard.suit}-${adjutantCard.rank}`
    )
  } else {
    console.log('No adjutant found - card is in hidden cards')
  }

  return updatedGameState
}

// カード交換フェーズの AI 処理
export async function processCardExchangePhase(
  gameState: GameState
): Promise<GameState> {
  let updatedGameState = { ...gameState }

  if (!updatedGameState.napoleonDeclaration) {
    return updatedGameState
  }

  const napoleonPlayer = updatedGameState.players.find((p) => p.isNapoleon)
  if (!napoleonPlayer || !napoleonPlayer.isAI) {
    return updatedGameState
  }

  // AIが交換するカードを選択（ナポレオンの手札は既に16枚）
  const cardsToDiscard = selectCardsToDiscard(
    napoleonPlayer.hand,
    [] // 隠しカードは既に手札に統合済み
  )

  updatedGameState = exchangeCards(
    updatedGameState,
    napoleonPlayer.id,
    cardsToDiscard
  )
  console.log(`AI Napoleon ${napoleonPlayer.name} exchanges 4 cards`)

  return updatedGameState
}

// 捨てるカードを選択するAIロジック
function selectCardsToDiscard(hand: Card[], _hiddenCards: Card[]): Card[] {
  // ナポレオンの手札は既に16枚（元の手札+隠しカード）統合済み
  const allCards = hand

  // 価値の低い順にソート
  const sortedCards = allCards.sort((a, b) => {
    // 基本的な価値で比較
    if (a.value !== b.value) {
      return a.value - b.value
    }
    // 同じ価値なら、より多く持っているスートを優先して捨てる
    return 0
  })

  return sortedCards.slice(0, 4)
}

// 連合軍決定フェーズの AI 処理
export async function processAlliancePhase(
  gameState: GameState
): Promise<GameState> {
  const updatedGameState = { ...gameState }

  // 各 AI プレイヤー（ナポレオンチーム以外）の戦略を決定
  for (let i = 0; i < updatedGameState.players.length; i++) {
    const player = updatedGameState.players[i]

    if (player.isAI && !player.isNapoleon && !player.isAdjutant) {
      const strategy = allianceAIStrategy(updatedGameState, player.id)
      console.log(`AI Player ${player.name}: ${strategy.reasoning}`)
    }
  }

  // 連合軍戦略が決まったらゲーム開始
  updatedGameState.phase = 'playing'

  return updatedGameState
}

// すべての AI フェーズを統合処理
export async function processAllAIPhases(
  gameState: GameState
): Promise<GameState> {
  let updatedState = gameState

  // ナポレオンフェーズでは一度に一人だけ処理
  if (gameState.phase === 'napoleon') {
    updatedState = await processNapoleonPhase(updatedState)
    // フェーズが変わったら処理停止（次回のAI処理で継続）
    return updatedState
  }

  if (updatedState.phase === 'adjutant') {
    updatedState = await processAdjutantPhase(updatedState)
    // 副官フェーズ後はカード交換に進む
    return updatedState
  }

  if (updatedState.phase === 'card_exchange') {
    updatedState = await processCardExchangePhase(updatedState)
    return updatedState
  }

  if (updatedState.phase === 'playing') {
    updatedState = await processAlliancePhase(updatedState)
    return updatedState
  }

  return updatedState
}
