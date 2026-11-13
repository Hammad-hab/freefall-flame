'use client'
import { useEffect, useState } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { ChatProvider } from './ChatProvider'
import { Thread } from '@/components/assistant-ui/elements/thread.aui'
import ThreadListPanel from './ThreadListPanel'
import { InvestigationListUI, InvestigationCardUI } from './InvestigationCard'
import { SandboxCardUI } from './SandboxCard'

/**
 * Ephemeral chat for visitors without an account: the model still answers, but
 * nothing is persisted (no threads, no history) because threads are owned by a
 * signed-in user.
 */
function SignedOutChat() {
  const runtime = useChatRuntime()
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <InvestigationListUI />
      <InvestigationCardUI />
      <SandboxCardUI />
      <Thread />
    </AssistantRuntimeProvider>
  )
}

/**
 * Persistent chat for signed-in users: threads are stored per user and can be
 * switched via the left-hand history panel.
 */
function SignedInChat() {
  return (
    <ChatProvider>
      <div className="flex h-full w-full min-h-0">
        <ThreadListPanel />
        <div className="min-w-0 flex-1">
          <InvestigationListUI />
          <InvestigationCardUI />
          <SandboxCardUI />
          <Thread />
        </div>
      </div>
    </ChatProvider>
  )
}

export default function Page() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/users/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return false
        const data = await res.json().catch(() => null)
        return !!(data && typeof data.user?.email === 'string')
      })
      .then((v) => { if (alive) setSignedIn(v) })
      .catch(() => { if (alive) setSignedIn(false) })
    return () => { alive = false }
  }, [])
  if (signedIn === null) return null
  return signedIn ? <SignedInChat /> : <SignedOutChat />
}