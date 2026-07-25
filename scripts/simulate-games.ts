/**
 * Headless AI vs AI simulator for accumulating ML training data.
 *
 * Usage:
 *   pnpm sim                 # default: 1 game
 *   pnpm sim 50              # run 50 games
 *
 * Requires Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * The simulator deliberately UNSETS NEXT_PUBLIC_ML_API_URL so it does not hammer
 * the Hugging Face Space; existing AI strategy (hybrid/MCTS) will be used.
 *
 * ML training data is collected automatically via processAIPlayingPhase ->
 * recordGameMove (existing pipeline). Final scores are recorded via
 * updateGameResult after each game.
 */

// Disable ML inference inside the simulator to avoid hammering the HF Space.
// Must be set BEFORE importing mlClient (which reads env at module load is fine,
// but we read it at call time, so this still works).
process.env.NEXT_PUBLIC_ML_API_URL = ''

import { GAME_PHASES } from '@/lib/constants'
import {
  initializeAIGame,
  isGameFinished,
  processAITurn,
  redealCards,
} from '@/lib/gameLogic'
import { updateGameResult } from '@/lib/ml/dataCollection'
import { calculateGameResult } from '@/lib/scoring'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { GameState } from '@/types/game'

const MAX_ITERATIONS_PER_GAME = 1_000

// recordGameMove inside processAIPlayingPhase is fire-and-forget. With back-to-
// back simulation turns those inserts can land AFTER updateGameResult runs,
// leaving rows with game_result = null. We wait this many ms after each game
// loop ends, then retry updateGameResult once to mop up stragglers.
const POST_GAME_FLUSH_MS = 1_500

interface GameOutcome {
  gameId: string
  napoleonWon: boolean
  faceCardsWon: number
  iterations: number
  redeals: number
  durationMs: number
}

/**
 * Replace human player slot with AI so the simulator can advance every phase.
 */
function makeAllAI(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => ({
      ...p,
      isAI: true,
      name: p.isAI ? p.name : `Simulated AI ${i + 1}`,
    })),
  }
}

/**
 * Run a single game end-to-end via processAITurn. processAIPlayingPhase
 * (called inside processAITurn for PLAYING) already records ML training data
 * via recordGameMove, so the simulator just orchestrates phase progression.
 */
async function runGame(): Promise<GameOutcome> {
  const startedAt = Date.now()
  let state = makeAllAI(initializeAIGame('Sim'))
  let iterations = 0
  let redeals = 0

  while (!isGameFinished(state) && iterations < MAX_ITERATIONS_PER_GAME) {
    iterations += 1

    if (state.needsRedeal) {
      state = redealCards(state)
      redeals += 1
      continue
    }

    const next = await processAITurn(state)
    if (next === state && state.phase !== GAME_PHASES.FINISHED) {
      // Same reference returned: phase handler did not advance. With all-AI
      // players this would indicate a bug or a state needing input we lack.
      console.warn(
        `[sim] phase ${state.phase} did not advance (iter=${iterations}). aborting game.`
      )
      break
    }
    state = next
  }

  if (!isGameFinished(state)) {
    throw new Error(
      `Game did not complete within ${MAX_ITERATIONS_PER_GAME} iterations (phase=${state.phase}, iter=${iterations})`
    )
  }

  // Wait for any in-flight recordGameMove fire-and-forget inserts to settle.
  await new Promise((r) => setTimeout(r, POST_GAME_FLUSH_MS))

  // Record final result (first pass)
  const result = calculateGameResult(state)
  const gameResult: 'napoleon_win' | 'allied_win' = result.napoleonWon
    ? 'napoleon_win'
    : 'allied_win'
  const scoresMap = Object.fromEntries(
    result.scores.map((s) => [s.playerId, s.points])
  )
  const updateRes = await updateGameResult(state.id, gameResult, scoresMap)
  if (!updateRes.success) {
    console.warn('[sim] updateGameResult failed:', updateRes.error)
  }

  // Retry once for any straggler rows that arrived after the first update.
  const stragglers = await supabaseAdmin
    .from('ml_training_data')
    .select('id, player_id')
    .eq('game_id', state.id)
    .is('game_result', null)
  if (stragglers.data && stragglers.data.length > 0) {
    await Promise.all(
      stragglers.data.map((row) =>
        supabaseAdmin
          .from('ml_training_data')
          .update({
            game_result: gameResult,
            player_final_score: scoresMap[row.player_id] ?? null,
          })
          .eq('id', row.id)
      )
    )
  }

  return {
    gameId: state.id,
    napoleonWon: result.napoleonWon,
    faceCardsWon: result.faceCardsWon,
    iterations,
    redeals,
    durationMs: Date.now() - startedAt,
  }
}

async function main() {
  const count = Number.parseInt(process.argv[2] ?? '1', 10)
  if (Number.isNaN(count) || count < 1) {
    console.error(`Invalid count: ${process.argv[2]}`)
    process.exit(1)
  }

  console.log(`[sim] Starting ${count} game(s)...`)
  console.log(
    `[sim] AI difficulty: ${process.env.NEXT_PUBLIC_AI_DIFFICULTY ?? 'normal (default)'}`
  )

  let napWins = 0
  let alliedWins = 0
  const overallStart = Date.now()
  for (let i = 1; i <= count; i++) {
    try {
      const outcome = await runGame()
      if (outcome.napoleonWon) napWins += 1
      else alliedWins += 1
      const winLabel = outcome.napoleonWon ? 'NAP' : 'ALL'
      console.log(
        `[sim] ${i}/${count}  ${winLabel}  faces=${outcome.faceCardsWon}  iter=${outcome.iterations}  redeals=${outcome.redeals}  ${outcome.durationMs}ms`
      )
    } catch (err) {
      console.error(`[sim] ${i}/${count}  FAILED: ${(err as Error).message}`)
    }
  }

  const totalSec = ((Date.now() - overallStart) / 1000).toFixed(1)
  console.log(
    `\n[sim] Done. napoleon_win=${napWins}  allied_win=${alliedWins}  total=${napWins + alliedWins}/${count}  elapsed=${totalSec}s`
  )
}

main().catch((err) => {
  console.error('[sim] fatal:', err)
  process.exit(1)
})
