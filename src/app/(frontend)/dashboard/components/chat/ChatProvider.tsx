// src/app/(frontend)/dashboard/components/chat/chat-provider.tsx
'use client'
import {
  AssistantRuntimeProvider, useAui, useRemoteThreadListRuntime,
  type RemoteThreadListAdapter, type ThreadHistoryAdapter,
} from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk' // the docs use '@assistant-ui/ai-sdk'; keep whichever your generated code imports
import { createAssistantStream } from 'assistant-stream'
import { useEffect, useMemo, useState } from 'react'

const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

function useThreadListAdapters() {
  const aui = useAui()
  const history = useMemo<ThreadHistoryAdapter>(() => ({
    async load() { return { messages: [] } },
    async append() {},
    withFormat: (fmt) => ({
      async load() {
        const { remoteId } = aui.threadListItem.getState()
        if (!remoteId) return { messages: [] }
        const rows = await fetch(`/api/threads/${remoteId}/messages`).then((r) => r.json())
        return {
          messages: rows.map((r: any) =>
            fmt.decode({ id: r.id, parent_id: r.parentId, format: r.format, content: r.content }),
          ),
        }
      },
      async append(item) {
        const { remoteId } = await aui.threadListItem.initialize() // avoids the first-message race
        await fetch(`/api/threads/${remoteId}/messages`, json({
          id: fmt.getId(item.message), parent_id: item.parentId,
          format: fmt.format, content: fmt.encode(item),
        }))
      },
    }),
  }), [aui])
  return useMemo(() => ({ history }), [history])
}

const threadListAdapter: RemoteThreadListAdapter = {
  async list() {
    const res = await fetch('/api/threads')
    if (!res.ok) return { threads: [] }
    const rows = await res.json()
    return { threads: rows.map((t: any) => ({ status: t.status, remoteId: t.id, title: t.title ?? undefined })) }
  },
  async initialize() {
    const res = await fetch('/api/threads', { method: 'POST' })
    if (!res.ok) throw new Error(`Create thread failed: ${res.status}`)
    const { id } = await res.json()
    return { remoteId: id }
  },
  async rename(id, title) { await fetch(`/api/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }) },
  async archive(id) { await fetch(`/api/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) }) },
  async unarchive(id) { await fetch(`/api/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'regular' }) }) },
  async delete(id) { await fetch(`/api/threads/${id}`, { method: 'DELETE' }) },
  async fetch(id) {
    const t = await fetch(`/api/threads/${id}`).then((r) => r.json())
    return { status: t.status, remoteId: t.id, title: t.title }
  },
  async generateTitle(id, messages) {
    // cheap title: first user text, truncated. Persist it with a PATCH if you want it saved.
    const first: any = messages.find((m) => m.role === 'user')
    const text: string = first?.content?.find((p: any) => p.type === 'text')?.text ?? 'New chat'
    const title = text.slice(0, 40)
    await fetch(`/api/threads/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
    return createAssistantStream((c) => { c.appendText(title) })
  },
  unstable_useAdapters: useThreadListAdapters,
}

// export function ChatProvider({ children }: { children: React.ReactNode }) {
//   const runtime = useRemoteThreadListRuntime({
//     runtimeHook: () => useChatRuntime(),
//     adapter: threadListAdapter,
//   })
//   return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
// }

function PersistentChatProvider({ children }: { children: React.ReactNode }) {
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: () => useChatRuntime(),
    adapter: threadListAdapter,
  })
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
function GuestChatProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime()
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState<boolean | undefined>(undefined) // undefined = still checking

  useEffect(() => {
    fetch('/api/users/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d.user))
      .catch(() => setLoggedIn(false))
  }, [])

  if (loggedIn === undefined) return null
  return loggedIn
    ? <PersistentChatProvider>{children}</PersistentChatProvider>
    : <GuestChatProvider>{children}</GuestChatProvider>
}