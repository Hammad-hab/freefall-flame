import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}

// fetch('https://openrouter.ai/api/v1/chat/completions', {
//   method: 'POST',
//   headers: {
//     Authorization: 'Bearer ',
//     'HTTP-Referer': '<YOUR_SITE_URL>',
//     'X-Title': '<YOUR_SITE_NAME>',
//     'Content-Type': 'application/json',
//   },
//   body: JSON.stringify({
//     model: 'openai/gpt-4o',
//     messages: [
//       {
//         role: 'user',
//         content: 'What is the meaning of life?',
//       },
//     ],
//   }),
// });