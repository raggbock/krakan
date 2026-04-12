import { describe, it, expect } from 'vitest'
import { calculateCommission, calculateStripeAmounts, COMMISSION_RATE } from '@fyndstigen/shared'

describe('Stripe amount calculations — critical path', () => {
  describe('basic calculations', () => {
    it('100 SEK table: 12 kr commission, 11200 öre total, 1200 öre fee', () => {
      const r = calculateStripeAmounts(100)
      expect(r.commissionSek).toBe(12)
      expect(r.totalOre).toBe(11200)
      expect(r.applicationFeeOre).toBe(1200)
    })

    it('200 SEK table: 24 kr commission, 22400 öre total, 2400 öre fee', () => {
      const r = calculateStripeAmounts(200)
      expect(r.commissionSek).toBe(24)
      expect(r.totalOre).toBe(22400)
      expect(r.applicationFeeOre).toBe(2400)
    })

    it('500 SEK table: 60 kr commission, 56000 öre total, 6000 öre fee', () => {
      const r = calculateStripeAmounts(500)
      expect(r.commissionSek).toBe(60)
      expect(r.totalOre).toBe(56000)
      expect(r.applicationFeeOre).toBe(6000)
    })

    it('1000 SEK table: 120 kr commission, 112000 öre total, 12000 öre fee', () => {
      const r = calculateStripeAmounts(1000)
      expect(r.commissionSek).toBe(120)
      expect(r.totalOre).toBe(112000)
      expect(r.applicationFeeOre).toBe(12000)
    })
  })

  describe('rounding edge cases', () => {
    it('1 SEK table: rounds commission to 0 (1*0.12=0.12)', () => {
      const r = calculateStripeAmounts(1)
      expect(r.commissionSek).toBe(0)
      expect(r.totalOre).toBe(100)
      expect(r.applicationFeeOre).toBe(0)
    })

    it('3 SEK table: rounds commission to 0 (3*0.12=0.36)', () => {
      const r = calculateStripeAmounts(3)
      expect(r.commissionSek).toBe(0)
      expect(r.totalOre).toBe(300)
    })

    it('4 SEK table: rounds commission to 0 (4*0.12=0.48)', () => {
      const r = calculateStripeAmounts(4)
      expect(r.commissionSek).toBe(0)
    })

    it('5 SEK table: rounds commission to 1 (5*0.12=0.6)', () => {
      const r = calculateStripeAmounts(5)
      expect(r.commissionSek).toBe(1)
      expect(r.totalOre).toBe(600)
      expect(r.applicationFeeOre).toBe(100)
    })

    it('8 SEK table: rounds commission to 1 (8*0.12=0.96)', () => {
      const r = calculateStripeAmounts(8)
      expect(r.commissionSek).toBe(1)
    })

    it('9 SEK table: rounds commission to 1 (9*0.12=1.08)', () => {
      const r = calculateStripeAmounts(9)
      expect(r.commissionSek).toBe(1)
    })

    it('25 SEK table: commission 3 (25*0.12=3.0, exact)', () => {
      const r = calculateStripeAmounts(25)
      expect(r.commissionSek).toBe(3)
    })

    it('33 SEK table: rounds commission to 4 (33*0.12=3.96)', () => {
      const r = calculateStripeAmounts(33)
      expect(r.commissionSek).toBe(4)
    })

    it('37 SEK table: rounds commission to 4 (37*0.12=4.44)', () => {
      const r = calculateStripeAmounts(37)
      expect(r.commissionSek).toBe(4)
    })

    it('42 SEK table: rounds commission to 5 (42*0.12=5.04)', () => {
      const r = calculateStripeAmounts(42)
      expect(r.commissionSek).toBe(5)
    })

    it('83 SEK table: rounds commission to 10 (83*0.12=9.96)', () => {
      const r = calculateStripeAmounts(83)
      expect(r.commissionSek).toBe(10)
    })

    it('117 SEK table: rounds commission to 14 (117*0.12=14.04)', () => {
      const r = calculateStripeAmounts(117)
      expect(r.commissionSek).toBe(14)
    })
  })

  describe('zero and boundary', () => {
    it('0 SEK table: all amounts are 0', () => {
      const r = calculateStripeAmounts(0)
      expect(r.commissionSek).toBe(0)
      expect(r.totalOre).toBe(0)
      expect(r.applicationFeeOre).toBe(0)
    })

    it('negative price throws', () => {
      expect(() => calculateStripeAmounts(-1)).toThrow()
      expect(() => calculateStripeAmounts(-100)).toThrow()
    })
  })

  describe('large amounts', () => {
    it('10000 SEK table', () => {
      const r = calculateStripeAmounts(10000)
      expect(r.commissionSek).toBe(1200)
      expect(r.totalOre).toBe(1120000)
      expect(r.applicationFeeOre).toBe(120000)
    })

    it('50000 SEK table', () => {
      const r = calculateStripeAmounts(50000)
      expect(r.commissionSek).toBe(6000)
      expect(r.totalOre).toBe(5600000)
      expect(r.applicationFeeOre).toBe(600000)
    })
  })

  describe('invariants', () => {
    const testPrices = [0, 1, 5, 10, 25, 33, 50, 75, 100, 150, 200, 250, 300, 500, 750, 999, 1000, 2500, 5000, 9999]

    it.each(testPrices)('price %i SEK: totalOre = (price + commission) * 100', (price) => {
      const r = calculateStripeAmounts(price)
      expect(r.totalOre).toBe((r.priceSek + r.commissionSek) * 100)
    })

    it.each(testPrices)('price %i SEK: applicationFeeOre = commission * 100', (price) => {
      const r = calculateStripeAmounts(price)
      expect(r.applicationFeeOre).toBe(r.commissionSek * 100)
    })

    it.each(testPrices)('price %i SEK: commission <= price', (price) => {
      const r = calculateStripeAmounts(price)
      expect(r.commissionSek).toBeLessThanOrEqual(r.priceSek)
    })

    it.each(testPrices)('price %i SEK: totalOre >= priceSek * 100', (price) => {
      const r = calculateStripeAmounts(price)
      expect(r.totalOre).toBeGreaterThanOrEqual(r.priceSek * 100)
    })

    it.each(testPrices)('price %i SEK: all öre amounts are integers', (price) => {
      const r = calculateStripeAmounts(price)
      expect(Number.isInteger(r.totalOre)).toBe(true)
      expect(Number.isInteger(r.applicationFeeOre)).toBe(true)
      expect(Number.isInteger(r.commissionSek)).toBe(true)
    })

    it.each(testPrices)('price %i SEK: commission is non-negative', (price) => {
      const r = calculateStripeAmounts(price)
      expect(r.commissionSek).toBeGreaterThanOrEqual(0)
    })

    it('commission rate is exactly 0.12', () => {
      expect(COMMISSION_RATE).toBe(0.12)
    })
  })
})
