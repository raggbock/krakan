'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FleaMarketImage } from '@/lib/api'

export type ImageDraftExisting = FleaMarketImage & { _deleted?: boolean }

export type ImageDraftResult = {
  /** Existing images from DB, sorted by sort_order */
  existingImages: ImageDraftExisting[]
  /** Newly selected files (not yet uploaded) */
  newFiles: File[]
  /** Object URL previews for newFiles */
  newPreviews: string[]
  /** Total visible image count (existing non-deleted + new) */
  totalCount: number
  addFiles: (files: File[]) => void
  removeExisting: (id: string) => void
  undoRemoveExisting: (id: string) => void
  removeNew: (index: number) => void
  reset: (images: FleaMarketImage[]) => void
  resetNew: () => void
  serialize: () => {
    add: File[]
    remove: { id: string; storage_path: string; sort_order: number }[]
  }
}

const MAX_IMAGES = 6

export function useImageDraft(initialImages: FleaMarketImage[] = []): ImageDraftResult {
  const [existingImages, setExistingImages] = useState<ImageDraftExisting[]>(
    () => [...initialImages].sort((a, b) => a.sort_order - b.sort_order),
  )
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])

  const visibleExisting = useMemo(
    () => existingImages.filter((img) => !img._deleted),
    [existingImages],
  )
  const totalCount = visibleExisting.length + newFiles.length

  const addFiles = useCallback(
    (files: File[]) => {
      const remaining = MAX_IMAGES - totalCount
      const toAdd = files.slice(0, remaining)
      if (toAdd.length === 0) return
      setNewFiles((prev) => {
        const combined = [...prev, ...toAdd]
        // Revoke old previews
        setNewPreviews((oldPreviews) => {
          oldPreviews.forEach(URL.revokeObjectURL)
          return combined.map((f) => URL.createObjectURL(f))
        })
        return combined
      })
    },
    [totalCount],
  )

  const removeExisting = useCallback((id: string) => {
    setExistingImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, _deleted: true } : img)),
    )
  }, [])

  const undoRemoveExisting = useCallback((id: string) => {
    setExistingImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, _deleted: false } : img)),
    )
  }, [])

  const removeNew = useCallback((index: number) => {
    setNewFiles((prev) => {
      const next = prev.filter((_, i) => i !== index)
      setNewPreviews((oldPreviews) => {
        oldPreviews.forEach(URL.revokeObjectURL)
        return next.map((f) => URL.createObjectURL(f))
      })
      return next
    })
  }, [])

  const reset = useCallback((images: FleaMarketImage[]) => {
    setExistingImages([...images].sort((a, b) => a.sort_order - b.sort_order))
    setNewFiles([])
    setNewPreviews((prev) => {
      prev.forEach(URL.revokeObjectURL)
      return []
    })
  }, [])

  const resetNew = useCallback(() => {
    setNewFiles([])
    setNewPreviews((prev) => {
      prev.forEach(URL.revokeObjectURL)
      return []
    })
  }, [])

  // Revoke any outstanding blob URLs on unmount so we don't leak when the
  // user navigates away with images selected but not submitted.
  useEffect(() => {
    return () => {
      setNewPreviews((prev) => {
        prev.forEach(URL.revokeObjectURL)
        return prev
      })
    }
  }, [])

  const serialize = useCallback(
    () => ({
      add: newFiles,
      remove: existingImages
        .filter((img) => img._deleted)
        .map((img) => ({ id: img.id, storage_path: img.storage_path, sort_order: img.sort_order })),
    }),
    [newFiles, existingImages],
  )

  return useMemo(
    () => ({
      existingImages,
      newFiles,
      newPreviews,
      totalCount,
      addFiles,
      removeExisting,
      undoRemoveExisting,
      removeNew,
      reset,
      resetNew,
      serialize,
    }),
    [
      existingImages,
      newFiles,
      newPreviews,
      totalCount,
      addFiles,
      removeExisting,
      undoRemoveExisting,
      removeNew,
      reset,
      resetNew,
      serialize,
    ],
  )
}
