import { getAuth, ownThread } from '@/lib/chat-auth'
type Ctx = { params: Promise<{ id: string }> }

async function guard(params: Ctx['params']) {
  const { id } = await params
  const { payload, ownerId } = await getAuth()
  if (!ownerId) return { err: new Response(null, { status: 401 }) } as const
  const thread = await ownThread(payload, id, ownerId)
  if (!thread) return { err: new Response(null, { status: 404 }) } as const
  return { payload, id, thread } as const
}

export async function GET(_: Request, { params }: Ctx) {
  const g = await guard(params)
  if ('err' in g) return g.err
  return Response.json({ id: String(g.thread.id), title: g.thread.title, status: g.thread.status })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await guard(params)
  if ('err' in g) return g.err
  const { title, status } = (await req.json()) as { title?: string; status?: 'regular' | 'archived' }
  await g.payload.update({ collection: 'chat-threads', id: g.id, data: { title, status } })
  return new Response(null, { status: 204 })
}

export async function DELETE(_: Request, { params }: Ctx) {
  const g = await guard(params)
  if ('err' in g) return g.err
  await g.payload.delete({ collection: 'chat-messages', where: { thread: { equals: g.id } } })
  await g.payload.delete({ collection: 'chat-threads', id: g.id })
  return new Response(null, { status: 204 })
}