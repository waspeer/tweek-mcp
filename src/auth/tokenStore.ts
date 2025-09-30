import type { AppConfig } from '../config/index.js'
import type { AuthTokens } from './types.js'
import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { chmodSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { TokensNotFoundError } from './types.js'

interface EncryptedEnvelopeV1 {
  v: 1
  nonce: string
  tag: string
  ciphertext: string
}

function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
}

function toBase64(input: Buffer): string {
  return input.toString('base64')
}

function fromBase64(input: string): Buffer {
  return Buffer.from(input, 'base64')
}

function deriveKeyBytesFromString(key: string): Buffer {
  // Use SHA-256 to create a 32-byte key; avoids external deps
  return createHash('sha256').update(key, 'utf8').digest()
}

function encryptAesGcm(plaintext: Buffer, keyString: string): EncryptedEnvelopeV1 {
  const key = deriveKeyBytesFromString(keyString)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    v: 1,
    nonce: toBase64(iv),
    tag: toBase64(tag),
    ciphertext: toBase64(ciphertext),
  }
}

function decryptAesGcm(envelope: EncryptedEnvelopeV1, keyString: string): Buffer {
  const key = deriveKeyBytesFromString(keyString)
  const iv = fromBase64(envelope.nonce)
  const tag = fromBase64(envelope.tag)
  const ciphertext = fromBase64(envelope.ciphertext)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext
}

export class TokenStore {
  private readonly path: string
  private readonly encryptionKey?: string

  constructor(config: AppConfig) {
    this.path = config.tokensPath
    this.encryptionKey = config.encryptionKey
  }

  read(): AuthTokens {
    try {
      this.assertSecureFile()
      const data = readFileSync(this.path)
      const jsonText = typeof this.encryptionKey === 'string' && this.encryptionKey.length > 0
        ? this.decryptEnvelopeToJson(data)
        : data.toString('utf8')
      const parsed = JSON.parse(jsonText) as AuthTokens
      return parsed
    }
    catch (err: unknown) {
      const e = err as NodeJS.ErrnoException
      if (e?.code === 'ENOENT') {
        throw new TokensNotFoundError(`Tokens file not found at ${this.path}`)
      }
      throw err
    }
  }

  write(tokens: AuthTokens): void {
    ensureParentDir(this.path)
    const jsonText = JSON.stringify(tokens, null, 2)
    const encryptionKey = this.encryptionKey
    const bytes = typeof encryptionKey === 'string' && encryptionKey.length > 0
      ? Buffer.from(JSON.stringify(encryptAesGcm(Buffer.from(jsonText, 'utf8'), encryptionKey)))
      : Buffer.from(jsonText, 'utf8')
    writeFileSync(this.path, bytes, { mode: 0o600 })
    // Ensure mode is 0600 even if FS umask interfered
    chmodSync(this.path, 0o600)
  }

  private decryptEnvelopeToJson(data: Buffer): string {
    const envelope = JSON.parse(data.toString('utf8')) as EncryptedEnvelopeV1
    if (envelope?.v !== 1)
      throw new Error('Unsupported tokens encryption format')
    const plaintext = decryptAesGcm(envelope, this.encryptionKey as string)
    return plaintext.toString('utf8')
  }

  private assertSecureFile(): void {
    try {
      const st = lstatSync(this.path)
      if (!st.isFile() || st.isSymbolicLink()) {
        throw new Error('Tokens path must be a regular file')
      }
      // mask regular file permissions
      const mode = st.mode & 0o777
      if (mode !== 0o600) {
        // Fix permissions proactively
        chmodSync(this.path, 0o600)
      }
    }
    catch {
      // ignore; read() caller will surface meaningful errors
    }
  }
}
