import {
  createSeededRandom,
  getSeed,
  isSeeded,
  random,
  randomInt,
  resetToMathRandom,
  setSeed,
  withSeed,
} from '@/lib/utils/rng'

describe('rng (seedable RNG seam)', () => {
  afterEach(() => {
    resetToMathRandom()
    jest.restoreAllMocks()
  })

  describe('unseeded behaviour equals Math.random', () => {
    it('delegates directly to Math.random when no seed is set', () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.123456)

      expect(isSeeded()).toBe(false)
      expect(getSeed()).toBeNull()
      expect(random()).toBe(0.123456)
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('does not call Math.random once seeded', () => {
      const spy = jest.spyOn(Math, 'random')
      setSeed(1)

      random()
      random()

      expect(spy).not.toHaveBeenCalled()
      expect(isSeeded()).toBe(true)
      expect(getSeed()).toBe(1)
    })

    it('returns to Math.random after resetToMathRandom', () => {
      setSeed(1)
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5)

      resetToMathRandom()

      expect(isSeeded()).toBe(false)
      expect(random()).toBe(0.5)
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('produces values in [0, 1) like Math.random when unseeded', () => {
      for (let i = 0; i < 200; i++) {
        const value = random()
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
      }
    })
  })

  describe('seeded behaviour', () => {
    it('reproduces the same sequence for the same seed', () => {
      setSeed(12345)
      const first = Array.from({ length: 10 }, () => random())

      setSeed(12345)
      const second = Array.from({ length: 10 }, () => random())

      expect(second).toEqual(first)
    })

    it('produces a different sequence for a different seed', () => {
      setSeed(1)
      const first = Array.from({ length: 10 }, () => random())

      setSeed(2)
      const second = Array.from({ length: 10 }, () => random())

      expect(second).not.toEqual(first)
    })

    it('stays within [0, 1)', () => {
      setSeed(999)
      for (let i = 0; i < 500; i++) {
        const value = random()
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
      }
    })

    it('randomInt stays in range', () => {
      setSeed(7)
      for (let i = 0; i < 200; i++) {
        const value = randomInt(5)
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(5)
      }
    })
  })

  describe('createSeededRandom', () => {
    it('creates independent generators', () => {
      const a = createSeededRandom(42)
      const b = createSeededRandom(42)

      expect([a(), a(), a()]).toEqual([b(), b(), b()])
    })
  })

  describe('withSeed', () => {
    it('restores the unseeded state afterwards', () => {
      const value = withSeed(5, () => {
        expect(isSeeded()).toBe(true)
        return random()
      })

      expect(typeof value).toBe('number')
      expect(isSeeded()).toBe(false)
    })

    it('restores a previous seed afterwards', () => {
      setSeed(100)
      const beforeNested = random()

      setSeed(100)
      withSeed(200, () => random())
      const afterNested = random()

      expect(afterNested).toBe(beforeNested)
    })
  })
})
