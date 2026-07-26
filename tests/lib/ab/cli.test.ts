import { CLI_FLAGS, helpText, parseArgs, parseVariantSpec } from '@/lib/ab/cli'
import {
  AB_DEFAULTS,
  DETERMINISTIC_TIME_LIMIT_MS,
  EMULATE_TRUMP_TARGETS,
  MCTS_PRESET_NAMES,
  SETUP_DECLARATION_POLICIES,
  STRATEGY_NAMES,
  VARIANT_ROLES,
} from '@/lib/ab/constants'

describe('ab/cli', () => {
  describe('parseVariantSpec', () => {
    it('parses a heuristic spec without an MCTS config', () => {
      const spec = parseVariantSpec(STRATEGY_NAMES.HEURISTIC)

      expect(spec.label).toBe(STRATEGY_NAMES.HEURISTIC)
      expect(spec.config.strategy).toBe(STRATEGY_NAMES.HEURISTIC)
      expect(spec.config.mctsConfig).toBeUndefined()
    })

    it('defaults MCTS strategies to the fast preset', () => {
      const spec = parseVariantSpec(STRATEGY_NAMES.MCTS)

      expect(spec.label).toBe(
        `${STRATEGY_NAMES.MCTS}:${MCTS_PRESET_NAMES.FAST}`
      )
      expect(spec.config.mctsConfig?.simulationCount).toBeGreaterThan(0)
    })

    it('disables the MCTS wall-clock limit by default for determinism', () => {
      const spec = parseVariantSpec(
        `${STRATEGY_NAMES.MCTS}:${MCTS_PRESET_NAMES.STRONG}`
      )

      expect(spec.config.mctsConfig?.timeLimit).toBe(
        DETERMINISTIC_TIME_LIMIT_MS
      )
    })

    it('applies simulation/determinization/time overrides', () => {
      const spec = parseVariantSpec(STRATEGY_NAMES.HYBRID, {
        simulationCount: 7,
        determinizationCount: 2,
        timeLimit: 50,
      })

      expect(spec.config.mctsConfig).toEqual(
        expect.objectContaining({
          simulationCount: 7,
          determinizationCount: 2,
          timeLimit: 50,
        })
      )
    })

    it('rejects an unknown strategy', () => {
      expect(() => parseVariantSpec('nope')).toThrow(/Unknown strategy/)
    })

    it('rejects an unknown MCTS preset', () => {
      expect(() => parseVariantSpec(`${STRATEGY_NAMES.MCTS}:turbo`)).toThrow(
        /Unknown MCTS preset/
      )
    })

    it('rejects a preset on the heuristic strategy', () => {
      expect(() =>
        parseVariantSpec(`${STRATEGY_NAMES.HEURISTIC}:fast`)
      ).toThrow(/does not take an MCTS preset/)
    })
  })

  describe('parseArgs', () => {
    it('applies defaults with no arguments', () => {
      const parsed = parseArgs([])

      expect(parsed.help).toBe(false)
      expect(parsed.jsonPath).toBeUndefined()
      expect(parsed.options.games).toBe(AB_DEFAULTS.GAMES)
      expect(parsed.options.seed).toBe(AB_DEFAULTS.SEED)
      expect(parsed.options.variantRole).toBe(AB_DEFAULTS.VARIANT_ROLE)
      expect(parsed.options.progress).toBe(true)
    })

    it('parses a full command line', () => {
      const parsed = parseArgs([
        CLI_FLAGS.GAMES,
        '200',
        CLI_FLAGS.SEED,
        '42',
        CLI_FLAGS.A,
        STRATEGY_NAMES.HYBRID,
        CLI_FLAGS.B,
        `${STRATEGY_NAMES.MCTS}:${MCTS_PRESET_NAMES.STRONG}`,
        CLI_FLAGS.VARIANT_ROLE,
        VARIANT_ROLES.NAPOLEON_TEAM,
        CLI_FLAGS.SETUP_DECLARATION,
        SETUP_DECLARATION_POLICIES.MCTS,
        CLI_FLAGS.JSON,
        '/tmp/out.json',
        CLI_FLAGS.QUIET,
      ])

      expect(parsed.options.games).toBe(200)
      expect(parsed.options.seed).toBe(42)
      expect(parsed.options.variantA.label).toBe(
        `${STRATEGY_NAMES.HYBRID}:${MCTS_PRESET_NAMES.FAST}`
      )
      expect(parsed.options.variantB.label).toBe(
        `${STRATEGY_NAMES.MCTS}:${MCTS_PRESET_NAMES.STRONG}`
      )
      expect(parsed.options.variantRole).toBe(VARIANT_ROLES.NAPOLEON_TEAM)
      expect(parsed.options.setupDeclaration).toBe(
        SETUP_DECLARATION_POLICIES.MCTS
      )
      expect(parsed.jsonPath).toBe('/tmp/out.json')
      expect(parsed.options.progress).toBe(false)
    })

    it('sets the help flag', () => {
      expect(parseArgs([CLI_FLAGS.HELP]).help).toBe(true)
    })

    it('rejects unknown arguments', () => {
      expect(() => parseArgs(['--bogus'])).toThrow(/Unknown argument/)
    })

    it('rejects a missing value', () => {
      expect(() => parseArgs([CLI_FLAGS.GAMES])).toThrow(/Missing value/)
    })

    it('rejects a non-positive game count', () => {
      expect(() => parseArgs([CLI_FLAGS.GAMES, '0'])).toThrow(
        /positive integer/
      )
    })

    it('rejects an unknown variant role', () => {
      expect(() => parseArgs([CLI_FLAGS.VARIANT_ROLE, 'dealer'])).toThrow(
        /Unknown --variant-role/
      )
    })

    it('defaults the missing-trump-suit emulation to off', () => {
      const parsed = parseArgs([])

      expect(parsed.options.emulateMissingTrumpSuit).toBe(
        EMULATE_TRUMP_TARGETS.NONE
      )
      expect(parsed.options.emulateRole).toBe(VARIANT_ROLES.ALL)
    })

    it('parses the missing-trump-suit emulation flags', () => {
      const parsed = parseArgs([
        CLI_FLAGS.EMULATE_MISSING_TRUMP_SUIT,
        EMULATE_TRUMP_TARGETS.A,
        CLI_FLAGS.EMULATE_ROLE,
        VARIANT_ROLES.NAPOLEON_TEAM,
      ])

      expect(parsed.options.emulateMissingTrumpSuit).toBe(
        EMULATE_TRUMP_TARGETS.A
      )
      expect(parsed.options.emulateRole).toBe(VARIANT_ROLES.NAPOLEON_TEAM)
    })

    it('rejects an unknown missing-trump-suit target', () => {
      expect(() =>
        parseArgs([CLI_FLAGS.EMULATE_MISSING_TRUMP_SUIT, 'sometimes'])
      ).toThrow(/Unknown --emulate-missing-trump-suit/)
    })

    it('rejects an unknown emulate role', () => {
      expect(() => parseArgs([CLI_FLAGS.EMULATE_ROLE, 'dealer'])).toThrow(
        /Unknown --emulate-role/
      )
    })
  })

  describe('helpText', () => {
    it('documents every CLI flag', () => {
      const text = helpText()
      for (const flag of Object.values(CLI_FLAGS)) {
        expect(text).toContain(flag)
      }
    })
  })
})
