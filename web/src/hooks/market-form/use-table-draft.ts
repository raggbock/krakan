'use client'

import { useCallback, useMemo, useState } from 'react'
import type { MarketTable } from '@fyndstigen/shared'

export type TableDraftRow = {
  id?: string // present for existing DB rows
  label: string
  description: string
  priceSek: number
  sizeDescription: string
  _deleted?: boolean // only for existing rows
}

export type TableDraftResult = {
  existingTables: TableDraftRow[]
  newTables: TableDraftRow[]
  addBatch: (rows: Omit<TableDraftRow, 'id' | '_deleted'>[]) => void
  removeNew: (index: number) => void
  markDeleted: (id: string) => void
  undoDelete: (id: string) => void
  reset: (tables: MarketTable[]) => void
  resetNew: () => void
  serialize: () => {
    add: { label: string; description: string; priceSek: number; sizeDescription: string }[]
    remove: string[]
  }
}

function fromMarketTable(t: MarketTable): TableDraftRow {
  return {
    id: t.id,
    label: t.label,
    description: t.description ?? '',
    priceSek: t.price_sek,
    sizeDescription: t.size_description ?? '',
  }
}

export function useTableDraft(initialTables: MarketTable[] = []): TableDraftResult {
  const [existingTables, setExistingTables] = useState<TableDraftRow[]>(
    () => initialTables.map(fromMarketTable),
  )
  const [newTables, setNewTables] = useState<TableDraftRow[]>([])

  const addBatch = useCallback((rows: Omit<TableDraftRow, 'id' | '_deleted'>[]) => {
    setNewTables((prev) => [...prev, ...rows])
  }, [])

  const removeNew = useCallback((index: number) => {
    setNewTables((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const markDeleted = useCallback((id: string) => {
    setExistingTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, _deleted: true } : t)),
    )
  }, [])

  const undoDelete = useCallback((id: string) => {
    setExistingTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, _deleted: false } : t)),
    )
  }, [])

  const reset = useCallback((tables: MarketTable[]) => {
    setExistingTables(tables.map(fromMarketTable))
    setNewTables([])
  }, [])

  const resetNew = useCallback(() => {
    setNewTables([])
  }, [])

  const serialize = useCallback(
    () => ({
      add: newTables.map((t) => ({
        label: t.label,
        description: t.description,
        priceSek: t.priceSek,
        sizeDescription: t.sizeDescription,
      })),
      remove: existingTables.filter((t) => t._deleted && t.id).map((t) => t.id!),
    }),
    [newTables, existingTables],
  )

  return useMemo(
    () => ({
      existingTables,
      newTables,
      addBatch,
      removeNew,
      markDeleted,
      undoDelete,
      reset,
      resetNew,
      serialize,
    }),
    [existingTables, newTables, addBatch, removeNew, markDeleted, undoDelete, reset, resetNew, serialize],
  )
}
