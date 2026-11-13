// src/collections/ChatThreads.ts
import type { CollectionConfig } from 'payload'

const own = ({ req: { user } }: any) => (user ? { user: { equals: user.id } } : false)

export const ChatThreads: CollectionConfig = {
  slug: 'chat-threads',
  admin: { useAsTitle: 'title' },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'ownerId', type: 'text', required: true, index: true },
    { name: 'title', type: 'text' },
    { name: 'status', type: 'select', defaultValue: 'regular', options: ['regular', 'archived'] },
  ],
  
}
