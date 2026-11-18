import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject
} from 'crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import type { EntrySignature, SignerIdentityPublic } from '../shared/types'
import { verifyDeviceUser, type DeviceAuthMethod } from './deviceAuth'

type IdentityStore = {
  signerName: string
  publicKey: string
  createdAt: string
  /** safeStorage で暗号化した PKCS8 PEM */
  encryptedPrivateKey: string
}

function identityPath(): string {
  const dir = join(app.getPath('userData'), 'identity')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'signer.json')
}

function loadStore(): IdentityStore | null {
  const path = identityPath()
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, 'utf8')) as IdentityStore & {
    credentialId?: string
  }
  // 旧 WebAuthn 形式からも公開情報は読める
  return {
    signerName: raw.signerName,
    publicKey: raw.publicKey,
    createdAt: raw.createdAt,
    encryptedPrivateKey: raw.encryptedPrivateKey
  }
}

function saveStore(store: IdentityStore): void {
  writeFileSync(identityPath(), JSON.stringify(store, null, 2), 'utf8')
}

function requireSafeStorage(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('この端末では安全な鍵保管が利用できません。')
  }
}

function decryptPrivateKey(store: IdentityStore): KeyObject {
  requireSafeStorage()
  const pem = safeStorage.decryptString(Buffer.from(store.encryptedPrivateKey, 'base64'))
  return createPrivateKey(pem)
}

function authMethodLabel(method: DeviceAuthMethod): EntrySignature['userVerification'] {
  if (method === 'touch-id') return 'touch-id'
  return 'windows-hello'
}

export function getIdentityPublic(): SignerIdentityPublic | null {
  const store = loadStore()
  if (!store) return null
  return {
    signerName: store.signerName,
    publicKey: store.publicKey,
    createdAt: store.createdAt
  }
}

/** 署名者名を登録。端末の本人確認のあと Ed25519 鍵を作成して保管する */
export async function enrollIdentity(input: { signerName: string }): Promise<SignerIdentityPublic> {
  requireSafeStorage()
  const name = input.signerName.trim()
  if (!name) throw new Error('署名者名を入力してください。')

  await verifyDeviceUser('研究ノートの署名者を登録します')

  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const publicDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  const rawPublic = publicDer.subarray(publicDer.length - 32)

  const store: IdentityStore = {
    signerName: name,
    publicKey: rawPublic.toString('hex'),
    createdAt: new Date().toISOString(),
    encryptedPrivateKey: safeStorage.encryptString(privatePem).toString('base64')
  }
  saveStore(store)
  return getIdentityPublic()!
}

export function clearIdentity(): void {
  const path = identityPath()
  if (existsSync(path)) unlinkSync(path)
}

/** 端末本人確認のあと、ページハッシュに署名する */
export async function signEntryHash(entryHash: string): Promise<EntrySignature> {
  const store = loadStore()
  if (!store) throw new Error('署名者が未登録です。')
  if (!/^[0-9a-f]{64}$/i.test(entryHash)) {
    throw new Error('ページハッシュの形式が不正です。')
  }

  const method = await verifyDeviceUser('研究ノートのページに署名します')
  const key = decryptPrivateKey(store)
  const sig = sign(null, Buffer.from(entryHash, 'hex'), key)
  return {
    alg: 'Ed25519',
    publicKey: store.publicKey,
    signature: sig.toString('hex'),
    signerName: store.signerName,
    signedAt: new Date().toISOString(),
    userVerification: authMethodLabel(method)
  }
}

export function verifyEntrySignature(entryHash: string, signature: EntrySignature): boolean {
  try {
    if (signature.alg !== 'Ed25519') return false
    if (!/^[0-9a-f]{64}$/i.test(entryHash)) return false
    if (!/^[0-9a-f]{64}$/i.test(signature.publicKey)) return false
    if (!/^[0-9a-f]{128}$/i.test(signature.signature)) return false

    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')
    const spki = Buffer.concat([spkiPrefix, Buffer.from(signature.publicKey, 'hex')])
    const pub = createPublicKey({ key: spki, format: 'der', type: 'spki' })
    return verify(null, Buffer.from(entryHash, 'hex'), pub, Buffer.from(signature.signature, 'hex'))
  } catch {
    return false
  }
}
