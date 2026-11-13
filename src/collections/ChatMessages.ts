// src/collections/ChatMessages.ts
import type { CollectionConfig } from 'payload'

const own = ({ req: { user } }: any) => (user ? { user: { equals: user.id } } : false)

export const ChatMessages: CollectionConfig = {
  slug: 'chat-messages',
  access: { create: ({ req }) => !!req.user, read: own, update: own, delete: own },
  fields: [
    { name: 'thread', type: 'relationship', relationTo: 'chat-threads', required: true, index: true },
    { name: 'messageId', type: 'text', required: true },
    { name: 'parentId', type: 'text' },
    { name: 'format', type: 'text', required: true },
    { name: 'content', type: 'json', required: true },
  ],
}
