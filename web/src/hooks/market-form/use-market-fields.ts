'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AddressValue } from '@/components/address-picker'
import type { FleaMarketDetailsView } from '@fyndstigen/shared'

export type MarketFields = {
  name: string
  description: string
  address: AddressValue
  isPermanent: boolean
  autoAcceptBookings: boolean
  setName: (v: string) => void
  setDescription: (v: string) => void
  setAddress: (v: AddressValue) => void
  setIsPermanent: (v: boolean) => void
  setAutoAcceptBookings: (v: boolean) => void
  isValid: boolean
  reset: (from: FleaMarketDetailsView) => void
}

function detailsToAddress(m: FleaMarketDetailsView): AddressValue {
  return {
    street: m.street,
    zipCode: m.zipCode ?? '',
    city: m.city,
    latitude: m.latitude ?? null,
    longitude: m.longitude ?? null,
  }
}

export function useMarketFields(initial?: FleaMarketDetailsView): MarketFields {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [address, setAddress] = useState<AddressValue>(
    initial
      ? detailsToAddress(initial)
      : { street: '', zipCode: '', city: '', latitude: null, longitude: null },
  )
  const [isPermanent, setIsPermanent] = useState(initial?.isPermanent ?? true)
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(
    initial?.autoAcceptBookings ?? false,
  )

  const isValid = useMemo(
    () => name.trim().length > 0 && address.street.trim().length > 0 && address.city.trim().length > 0,
    [name, address.street, address.city],
  )

  const reset = useCallback((from: FleaMarketDetailsView) => {
    setName(from.name)
    setDescription(from.description ?? '')
    setAddress(detailsToAddress(from))
    setIsPermanent(from.isPermanent)
    setAutoAcceptBookings(from.autoAcceptBookings ?? false)
  }, [])

  return useMemo(
    () => ({
      name,
      description,
      address,
      isPermanent,
      autoAcceptBookings,
      setName,
      setDescription,
      setAddress,
      setIsPermanent,
      setAutoAcceptBookings,
      isValid,
      reset,
    }),
    [name, description, address, isPermanent, autoAcceptBookings, isValid, reset],
  )
}
