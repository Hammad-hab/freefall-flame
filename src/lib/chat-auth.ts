// src/lib/chat-auth.ts
import 'server-only'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

export async function getAuth() {
  const payload = await getPayload({ config })
  const h = await headers()
  const { user } = await payload.auth({ headers: h })
  console.log(
    '[chat-auth] user:', user?.id ?? null,
    '| cookies:', h.get('cookie')?.split(';').map((c) => c.trim().split('=')[0]),
  )
  return { payload, ownerId: user ? String(user.id) : null }
}
export async function ownThread(payload: Payload, id: string, ownerId: string) {
  const res = await payload.find({
    collection: 'chat-threads',
    where: { and: [{ id: { equals: id } }, { ownerId: { equals: ownerId } }] },
    limit: 1,
  })
  return res.docs[0] ?? null
}