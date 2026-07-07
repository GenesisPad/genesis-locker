export type LockMetadata = {
  name?: string
  symbol?: string
  logo?: string
  banner?: string
  website?: string
  twitter?: string
  telegram?: string
  discord?: string
  description?: string
}

/** Decodes the on-chain `data:application/json;base64,...` metadataURI a lock was created with. */
export function parseMetadataURI(uri: string | null | undefined): LockMetadata | null {
  if (!uri || !uri.startsWith('data:application/json;base64,')) return null
  try {
    const b64 = uri.slice('data:application/json;base64,'.length)
    const json = decodeURIComponent(escape(atob(b64)))
    return JSON.parse(json)
  } catch {
    return null
  }
}
