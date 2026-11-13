import { getAuth } from '@/lib/chat-auth'

export async function GET() {
  const { payload, ownerId } = await getAuth()
  if (!ownerId) return new Response(null, { status: 401 })
  const res = await payload.find({
    collection: 'chat-threads',
    where: { ownerId: { equals: ownerId } },
    sort: '-updatedAt',
    pagination: false,
  })
  return Response.json(res.docs.map((t) => ({ id: String(t.id), title: t.title, status: t.status })))
}

export async function POST() {
  const { payload, ownerId } = await getAuth()
  if (!ownerId) return new Response(null, { status: 401 })
  const t = await payload.create({ collection: 'chat-threads', data: { ownerId } })
  return Response.json({ id: String(t.id) })
}