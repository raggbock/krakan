import { z } from 'zod'

export const ImportCategory = z.enum([
  'Privat',
  'Kyrklig-bistånd',
  'Antik-retro',
  'Kommunal',
  'Kedja',
  'Evenemang',
])

export const ImportStatus = z.enum(['confirmed', 'unverified', 'closed'])

const Address = z.object({
  street: z.string().nullish(),
  postalCode: z.string().nullish(),
  locality: z.string(),
  municipality: z.string(),
  region: z.string(),
  country: z.string(),
})

const Geo = z.object({
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  precision: z.enum(['locality', 'postalcode', 'address']).nullish(),
  source: z.string().nullish(),
}).nullish()

const Contact = z.object({
  phone: z.string().nullish(),
  phoneRaw: z.string().nullish(),
  email: z.string().nullish(),
  website: z.string().nullish(),
  facebook: z.string().nullish(),
  instagram: z.string().nullish(),
}).nullish()

const OpeningHours = z.object({
  regular: z.array(z.object({
    day: z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']),
    opens: z.string().nullish(),
    closes: z.string().nullish(),
  })).nullish(),
  freeText: z.string().nullish(),
  closedMonths: z.array(z.string()).nullish(),
}).nullish()

const Takeover = z.object({
  shouldSendEmail: z.boolean(),
  priority: z.number().int().min(1).max(3),
})

export const ImportBusiness = z.object({
  slug: z.string(),
  name: z.string(),
  category: ImportCategory,
  description: z.string().nullish(),
  address: Address,
  geo: Geo,
  contact: Contact,
  openingHours: OpeningHours,
  distanceFromOrebroKm: z.number().nullish(),
  status: ImportStatus,
  takeover: Takeover,
  notes: z.string().nullish(),
  source: z.string().nullish(),
})

export type ImportBusiness = z.infer<typeof ImportBusiness>

export const AdminBusinessImportInput = z.object({
  businesses: z.array(ImportBusiness),
})

export const ImportRowAction = z.enum(['create', 'update', 'unchanged', 'error'])

export const ImportRowResult = z.object({
  index: z.number().int(),
  slug: z.string().nullable(),
  action: ImportRowAction,
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
})

export const AdminBusinessImportOutput = z.object({
  dryRun: z.literal(true),
  summary: z.object({
    total: z.number().int(),
    created: z.number().int(),
    updated: z.number().int(),
    unchanged: z.number().int(),
    errors: z.number().int(),
    warnings: z.number().int(),
  }),
  rows: z.array(ImportRowResult),
})

export type AdminBusinessImportOutput = z.infer<typeof AdminBusinessImportOutput>
export type ImportRowResult = z.infer<typeof ImportRowResult>
