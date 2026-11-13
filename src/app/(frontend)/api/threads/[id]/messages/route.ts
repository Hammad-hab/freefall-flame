import { getAuth, ownThread } from '@/lib/chat-auth'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params
  const { payload, ownerId } = await getAuth()
  if (!ownerId) return new Response(null, { status: 401 })
  if (!(await ownThread(payload, id, ownerId))) return new Response(null, { status: 404 })
  const res = await payload.find({
    collection: 'chat-messages',
    where: { thread: { equals: id } },
    sort: 'createdAt',
    pagination: false,
  })
  return Response.json(
    res.docs.map((m) => ({ id: m.messageId, parentId: m.parentId, format: m.format, content: m.content })),
  )
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  const { payload, ownerId } = await getAuth()
  if (!ownerId) return new Response(null, { status: 401 })
  if (!(await ownThread(payload, id, ownerId))) return new Response(null, { status: 404 })
  const b = (await req.json()) as { id: string; parent_id: string | null; format: string; content: unknown }
  await payload.create({
    collection: 'chat-messages',
    data: { thread: Number(id), messageId: b.id, parentId: b.parent_id, format: b.format, content: b.content as any },
  })
  return new Response(null, { status: 204 })
}