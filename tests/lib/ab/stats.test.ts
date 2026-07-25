import { mean, pairedComparison, standardDeviation } from '@/lib/ab/stats'

describe('ab/stats', () => {
  describe('mean', () => {
    it('returns 0 for an empty array', () => {
      expect(mean([])).toBe(0)
    })

    it('computes the arithmetic mean', () => {
      expect(mean([1, 2, 3, 4])).toBe(2.5)
    })
  })

  describe('standardDeviation', () => {
    it('returns 0 for fewer than 2 samples', () => {
      expect(standardDeviation([])).toBe(0)
      expect(standardDeviation([5])).toBe(0)
    })

    it('computes the sample standard deviation', () => {
      // values 2,4,4,4,5,5,7,9 -> sample sd = 2.13809...
      expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(
        2.13809,
        4
      )
    })
  })

  describe('pairedComparison', () => {
    it('throws when the arrays have different lengths', () => {
      expect(() => pairedComparison('m', [1, 2], [1])).toThrow()
    })

    it('computes B - A with a zero-width CI for a constant difference', () => {
      const result = pairedComparison('margin', [1, 2, 3], [2, 3, 4])

      expect(result.meanDiff).toBeCloseTo(1, 10)
      expect(result.sdDiff).toBeCloseTo(0, 10)
      expect(result.standardError).toBeCloseTo(0, 10)
      expect(result.ci95Lower).toBeCloseTo(1, 10)
      expect(result.ci95Upper).toBeCloseTo(1, 10)
      expect(result.significant).toBe(true)
      expect(result.n).toBe(3)
    })

    it('reports no difference when both variants match', () => {
      const values = [3, -1, 0, 5]
      const result = pairedComparison('margin', values, values)

      expect(result.meanDiff).toBe(0)
      expect(result.significant).toBe(false)
    })

    it('produces a CI that straddles zero for noisy differences', () => {
      const a = [0, 1, 0, 1, 0, 1]
      const b = [1, 0, 1, 0, 1, 0]
      const result = pairedComparison('napoleonWinRate', a, b)

      expect(result.meanDiff).toBeCloseTo(0, 10)
      expect(result.ci95Lower).toBeLessThan(0)
      expect(result.ci95Upper).toBeGreaterThan(0)
      expect(result.significant).toBe(false)
    })
  })
})
