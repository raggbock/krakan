'use client'

import { useMutation } from '@tanstack/react-query'
import { endpoints } from '@/lib/edge'
import type {
  AdminBusinessImportOutput,
  ImportBusiness,
} from '@fyndstigen/shared/contracts/admin-business-import'

type ImportArgs = { businesses: ImportBusiness[]; commit?: boolean; publishOnCommit?: boolean }

export function useBusinessImport() {
  return useMutation<AdminBusinessImportOutput, Error, ImportArgs>({
    mutationFn: ({ businesses, commit, publishOnCommit }) =>
      endpoints['admin.business.import'].invoke({
        businesses,
        commit: commit ?? false,
        publishOnCommit: publishOnCommit ?? false,
      }),
  })
}
