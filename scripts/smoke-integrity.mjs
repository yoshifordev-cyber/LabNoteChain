import { createHash } from 'crypto'
import assert from 'assert'

const GENESIS = '0'.repeat(64)

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

function payload(entry) {
  return JSON.stringify({
    id: entry.id,
    kind: entry.kind,
    createdAt: entry.createdAt,
    title: entry.title,
    body: entry.body,
    tags: entry.tags,
    attachments: entry.attachments,
    correctsEntryId: entry.correctsEntryId ?? null,
    correctionReason: entry.correctionReason ?? null,
    prevHash: entry.prevHash
  })
}

function hashEntry(entry) {
  return sha256Hex(payload(entry))
}

function verify(entries) {
  const issues = []
  let prev = GENESIS
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (e.prevHash !== prev) issues.push(`chain:${i}`)
    const { hash, ...rest } = e
    if (hash !== hashEntry(rest)) issues.push(`hash:${i}`)
    prev = hash
  }
  return issues
}

const e1base = {
  id: '1',
  kind: 'note',
  createdAt: '2026-01-01T00:00:00.000Z',
  title: '測定1',
  body: 'OD=0.42',
  tags: ['assay'],
  attachments: [],
  prevHash: GENESIS
}
const e1 = { ...e1base, hash: hashEntry(e1base) }

const e2base = {
  id: '2',
  kind: 'note',
  createdAt: '2026-01-02T00:00:00.000Z',
  title: '測定2',
  body: 'OD=0.55',
  tags: [],
  attachments: [],
  prevHash: e1.hash
}
const e2 = { ...e2base, hash: hashEntry(e2base) }

assert.deepEqual(verify([e1, e2]), [])

const tampered = structuredClone([e1, e2])
tampered[0].body = 'OD=0.99'
assert.ok(verify(tampered).includes('hash:0'))

const broken = structuredClone([e1, e2])
broken[1].prevHash = 'deadbeef'
assert.ok(verify(broken).includes('chain:1'))

console.log('smoke-integrity: OK')
