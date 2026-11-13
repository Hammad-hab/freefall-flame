'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
  ThreadListItemByIndexProvider,
  useAuiState,
} from '@assistant-ui/react'
import { Plus, Search, Trash2, X } from 'lucide-react'

/**
 * The chat's history panel (draft A): "New chat" button, search with a `/`
 * shortcut, and a list of previous chats with an amber bar on the active one.
 * Delete appears on hover. Built on the assistant-ui thread-list primitives.
 */
export default function ThreadListPanel() {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const threadIds = useAuiState((s) => s.threads.threadIds)
  // Reactive: re-renders when a thread's title changes (e.g. auto-titling).
  const threadItems = useAuiState((s) => s.threads.threadItems)

  // Press "/" anywhere (outside a text field) to jump to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const all = threadIds.map((id, index) => ({
      id,
      index,
      title: threadItems.find((t) => t.id === id)?.title ?? '',
    }))
    if (!needle) return all
    return all.filter((t) => t.title.toLowerCase().includes(needle))
  }, [threadIds, threadItems, query])

  return (
    <ThreadListPrimitive.Root className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-ink">
      {/* Header */}
      <div className="px-6 pb-3 pt-4">
        <span className="text-[13px] font-semibold tracking-[0.01em] text-fg">
          Chats
        </span>
      </div>

      {/* New chat */}
      <div className="px-3 pb-2.5">
        <ThreadListPrimitive.New
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-line/40 text-[13px] font-medium text-fg transition-colors hover:bg-line"
          aria-label="New chat"
        >
          <Plus className="-ml-0.5 h-4 w-4 text-amber" strokeWidth={2} />
          New chat
        </ThreadListPrimitive.New>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex h-[34px] items-center gap-2 rounded-lg border border-line bg-ink px-2.5 transition-colors focus-within:border-amber">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={2} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('')
                e.currentTarget.blur()
              }
            }}
            placeholder="Search chats"
            aria-label="Search chats"
            className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-muted"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded bg-line text-fg/80 transition-colors hover:text-fg"
            >
              <X className="h-3 w-3" strokeWidth={2} />
            </button>
          ) : (
            <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] font-medium leading-tight text-muted">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-muted">
            {threadIds.length === 0
              ? 'No chats yet'
              : `No chats match "${query.trim()}"`}
          </p>
        ) : (
          filtered.map((item) => (
            <ThreadListItemByIndexProvider
              key={item.id ?? `index:${item.index}`}
              index={item.index}
              archived={false}
            >
              <ThreadListItemPrimitive.Root
                className="group relative flex h-9 w-full items-center rounded-lg text-fg/80 transition-colors before:absolute before:left-0 before:top-2.5 before:h-4 before:w-[3px] before:rounded-r before:bg-transparent hover:bg-line/50 data-[active=true]:bg-line data-[active=true]:text-fg data-[active=true]:before:bg-amber"
              >
                <ThreadListItemPrimitive.Trigger className="h-full min-w-0 flex-1 pl-3 pr-2 text-left text-[13px] group-data-[active=true]:font-medium">
                  <span className="block truncate">
                    <ThreadListItemPrimitive.Title fallback="New chat" />
                  </span>
                </ThreadListItemPrimitive.Trigger>
                <ThreadListItemPrimitive.Delete
                  className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted opacity-0 transition-all hover:bg-line hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label="Delete chat"
                  title="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </ThreadListItemPrimitive.Delete>
              </ThreadListItemPrimitive.Root>
            </ThreadListItemByIndexProvider>
          ))
        )}
        <ThreadListPrimitive.LoadMore className="mx-1 my-2 rounded px-2 py-1 text-[11px] text-muted hover:bg-line" />
      </div>
    </ThreadListPrimitive.Root>
  )
}