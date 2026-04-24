'use client'

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  AdminBusinessImportOutput,
  ImportBusiness,
} from '@fyndstigen/shared/contracts/admin-business-import'

export function useBusinessImportDryRun() {
  return useMutation<AdminBusinessImportOutput, Error, ImportBusiness[]>({
    mutationFn: async (businesses) => {
      const { data, error } = await supabase.functions.invoke('admin-business-import', {
        body: { businesses },
      })
      if (error) throw new Error(error.message)
      return data as AdminBusinessImportOutput
    },
  })
}
