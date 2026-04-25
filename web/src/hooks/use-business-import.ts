'use client'

import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  AdminBusinessImportOutput,
  ImportBusiness,
} from '@fyndstigen/shared/contracts/admin-business-import'

type ImportArgs = { businesses: ImportBusiness[]; commit?: boolean; publishOnCommit?: boolean }

export function useBusinessImport() {
  return useMutation<AdminBusinessImportOutput, Error, ImportArgs>({
    mutationFn: ({ businesses, commit, publishOnCommit }) =>
      api.endpoints['admin.business.import'].invoke({
        businesses,
        commit: commit ?? false,
        publishOnCommit: publishOnCommit ?? false,
      }),
  })
}
