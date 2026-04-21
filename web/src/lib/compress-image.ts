const DEFAULTS = {
  maxDimension: 1920,
  quality: 0.85,
  // Skip work if the file is already small — modern phone shots under
  // ~500 KB are almost certainly pre-compressed social-share versions.
  skipIfSmallerThanBytes: 500 * 1024,
}

export type CompressOptions = Partial<typeof DEFAULTS>

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const { maxDimension, quality, skipIfSmallerThanBytes } = { ...DEFAULTS, ...opts }

  if (!file.type.startsWith('image/')) return file
  // Animated GIFs, HEIC, etc — leave as-is; the canvas path would strip
  // animation and browser decoding of HEIC is inconsistent.
  if (file.type === 'image/gif' || file.type === 'image/heic' || file.type === 'image/heif') {
    return file
  }
  if (file.size <= skipIfSmallerThanBytes) return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap

    const scale = Math.min(1, maxDimension / Math.max(width, height))
    const targetWidth = Math.round(width * scale)
    const targetHeight = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    bitmap.close()

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) return file

    // If compression made the file larger (tiny source, low-entropy content),
    // keep the original.
    if (blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // createImageBitmap / toBlob can fail on obscure formats — fall back
    // to the original file and let the upload proceed unchanged.
    return file
  }
}

export async function compressImages(
  files: File[],
  opts: CompressOptions = {},
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, opts)))
}
