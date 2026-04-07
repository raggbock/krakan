export type Address = {
  name: string
  address: string
  city: string
  location: {
    latitude: number
    longitude: number
  }
}

export type Price = {
  amount: number
  currency: string
}

export type Slot = {
  bandId: string
  name: string
  imageUrl: string
  from: string
  to: string
}

export type TicketListSlot = {
  bandId?: string
  bandName?: string
  images?: string[]
  dateFrom?: string
  timeTo?: string
}

export type TicketListItem = {
  id: string
  showId?: string
  ticketTypeId?: string
  name?: string
  venueName?: string
  date: string
  address?: {
    street?: string
    city?: string
    location?: {
      latitude?: number
      longitude?: number
    }
  }
  price?: Price
  ticketType?: string
  attendings?: number
  imageUrl?: string
  qrGuid?: string
  used?: boolean
  orderId?: string
  ticketHolder?: string
  doorsOpen?: string
  slots?: TicketListSlot[]
}

export type TicketData = {
  id: string
  name: string
  date: string
  address: Address
  price: Price
  ticketType: string
  attendings: number
  imageUrl: string
  slots: Slot[]
  status?: 'upcoming' | 'used' | 'cancelled'
  orderId?: string
  qrCode?: string
  ticketHolder?: string
  doorsOpen?: string
  isPreview?: boolean
}
