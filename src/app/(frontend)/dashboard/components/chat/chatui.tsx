'use client'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { Thread } from '@/components/assistant-ui/elements/thread.aui'

export default function Page() {
  const runtime = useChatRuntime()
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  )
}
