/**
 * BlockSale domain — pure logic for kvartersloppis (block-sale) events.
 *
 * Covers:
 *   - Slug generation: deterministic from (name, city, startDate); Swedish
 *     characters (å/ä/ö) are transliterated to ASCII.
 *   - Date expansion: `expandEventDates` returns every calendar date in the
 *     [startDate, endDate] range — used to generate per-day stand slots.
 *   - Stand status transitions: pending → confirmed → approved|rejected.
 *     `canTransitionStandStatus` is the single gatekeeper; edge functions call
 *     it before any UPDATE so illegal transitions are rejected uniformly.
 *   - Input validation: `validateBlockSaleInput` returns a typed result with a
 *     string reason code (not a Swedish message — callers resolve via messageFor).
 *
 * No I/O — all functions are pure and synchronous.
 */

import type { BlockSaleStandStatus } from '../types'

export function generateBlockSaleSlug(name: string, city: string, startDate: string): string {
  const slugify = (s: string) => s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const namePart = slugify(name).slice(0, 40)
  const cityPart = slugify(city).slice(0, 25)
  return `${namePart}-${cityPart}-${startDate}`.slice(0, 80)
}

export function expandEventDates(startDate: string, endDate: string): string[] {
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  if (end < start) throw new Error('endDate before startDate')
  const out: string[] = []
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

const STATUS_TRANSITIONS: Record<BlockSaleStandStatus, BlockSaleStandStatus[]> = {
  pending: ['confirmed'],
  confirmed: ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

export function canTransitionStandStatus(from: BlockSaleStandStatus, to: BlockSaleStandStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export type BlockSaleInput = {
  name: string
  description?: string
  startDate: string
  endDate: string
  dailyOpen: string
  dailyClose: string
  city: string
}

export function validateBlockSaleInput(input: BlockSaleInput):
  | { ok: true }
  | { ok: false; reason: string }
{
  if (input.name.length < 3 || input.name.length > 120) return { ok: false, reason: 'name_length' }
  if (input.city.length < 1 || input.city.length > 80) return { ok: false, reason: 'city_length' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return { ok: false, reason: 'start_date_format' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) return { ok: false, reason: 'end_date_format' }
  if (!/^\d{2}:\d{2}$/.test(input.dailyOpen)) return { ok: false, reason: 'open_format' }
  if (!/^\d{2}:\d{2}$/.test(input.dailyClose)) return { ok: false, reason: 'close_format' }
  const today = new Date().toISOString().slice(0, 10)
  if (input.startDate < today) return { ok: false, reason: 'start_in_past' }
  if (input.endDate < input.startDate) return { ok: false, reason: 'end_before_start' }
  if (input.dailyClose <= input.dailyOpen) return { ok: false, reason: 'close_before_open' }
  return { ok: true }
}
