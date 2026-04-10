'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'

// ── useQuery: fetch data on mount / deps change ─────────────────

export type QueryResult<T> = {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useQuery<T>(
  fetcher: () => Promise<T>,
  options?: {
    deps?: unknown[]
    enabled?: boolean
    errorMessage?: string
  },
): QueryResult<T> {
  const { deps = [], enabled = true, errorMessage = 'Något gick fel' } = options ?? {}
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const seqRef = useRef(0)

  const execute = useCallback(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    setError(null)
    fetcher()
      .then((result) => {
        if (seq === seqRef.current) setData(result)
      })
      .catch((err) => {
        if (seq === seqRef.current) setError(errorMessage)
        Sentry.captureException(err)
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  useEffect(() => {
    execute()
  }, [execute])

  return { data, loading, error, refetch: execute }
}

// ── useMutation: fire on demand ─────────────────────────────────

export type MutationResult<TPayload, TReturn = void> = {
  mutate: (payload: TPayload) => Promise<TReturn | undefined>
  loading: boolean
  error: string | null
  reset: () => void
}

export function useMutation<TPayload, TReturn = void>(
  action: (payload: TPayload) => Promise<TReturn>,
  options?: {
    onSuccess?: (result: TReturn) => void
    errorMessage?: string
  },
): MutationResult<TPayload, TReturn> {
  const { onSuccess, errorMessage = 'Något gick fel' } = options ?? {}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function mutate(payload: TPayload): Promise<TReturn | undefined> {
    if (loading) return undefined
    setLoading(true)
    setError(null)
    try {
      const result = await action(payload)
      onSuccess?.(result)
      return result
    } catch (err) {
      setError(errorMessage)
      Sentry.captureException(err)
      return undefined
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setError(null)
    setLoading(false)
  }

  return { mutate, loading, error, reset }
}
