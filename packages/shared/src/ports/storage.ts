export interface StoragePort {
  upload(bucket: string, path: string, file: File | Blob): Promise<void>
  remove(bucket: string, paths: string[]): Promise<void>
  getPublicUrl(bucket: string, path: string): string
}
