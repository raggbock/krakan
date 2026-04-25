'use client'

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  AdminBusinessImportOutput,
  ImportBusiness,
} from '@fyndstigen/shared/contracts/admin-business-import'

type ImportArgs = { businesses: ImportBusiness[]; commit?: boolean; publishOnCommit?: boolean }

export function useBusinessImport() {
  return useMutation<AdminBusinessImportOutput, Error, ImportArgs>({
    mutationFn: async ({ businesses, commit, publishOnCommit }) => {
      const { data, error } = await supabase.functions.invoke('admin-business-import', {
        body: { businesses, commit: commit ?? false, publishOnCommit: publishOnCommit ?? false },
      })
      if (error) throw new Error(error.message)
      return data as AdminBusinessImportOutput
    },
  })
}
