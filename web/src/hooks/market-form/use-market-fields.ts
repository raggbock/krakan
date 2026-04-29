'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AddressValue } from '@/components/address-picker'
import type { FleaMarketDetails } from '@fyndstigen/shared'

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
  reset: (from: FleaMarketDetails) => void
}

function detailsToAddress(m: FleaMarketDetails): AddressValue {
  return {
    street: m.street,
    zipCode: m.zip_code ?? '',
    city: m.city,
    latitude: m.latitude ?? null,
    longitude: m.longitude ?? null,
  }
}

export function useMarketFields(initial?: FleaMarketDetails): MarketFields {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [address, setAddress] = useState<AddressValue>(
    initial
      ? detailsToAddress(initial)
      : { street: '', zipCode: '', city: '', latitude: null, longitude: null },
  )
  const [isPermanent, setIsPermanent] = useState(initial?.is_permanent ?? true)
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(
    initial?.auto_accept_bookings ?? false,
  )

  const isValid = useMemo(
    () => name.trim().length > 0 && address.street.trim().length > 0 && address.city.trim().length > 0,
    [name, address.street, address.city],
  )

  const reset = useCallback((from: FleaMarketDetails) => {
    setName(from.name)
    setDescription(from.description ?? '')
    setAddress(detailsToAddress(from))
    setIsPermanent(from.is_permanent)
    setAutoAcceptBookings(from.auto_accept_bookings ?? false)
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
