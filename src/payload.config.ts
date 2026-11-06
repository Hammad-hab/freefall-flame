import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { DatasetImports, DatasetRows, Datasets } from './collections/Dataset'
import { Papers } from './collections/Papers'
// import { Papers } from './collections/Papers'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, Media, Papers, Datasets, DatasetRows, DatasetImports],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
    // Schema push is OFF unless PAYLOAD_PUSH=true. Payload's default pushes
    // the schema to the database on every dev start and test run (and the
    // database is the shared Supabase one), so it must be asked for, never
    // implied. A production build (NODE_ENV=production) never pushes anyway.
    push: process.env.PAYLOAD_PUSH === 'true',
  }),
  sharp,
  // No anonymous usage data sent to Payload (on by default).
  telemetry: false,
  plugins: [
    s3Storage({
      collections: {
        media: true,
      },
      bucket: process.env.S3_BUCKET!,
      clientUploads: true, // browser uploads straight to S3, bypasses serverless body limits
      config: {
        region: process.env.S3_REGION,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        // Only for R2 / MinIO / other S3-compatible services:
        // endpoint: process.env.S3_ENDPOINT,
        // forcePathStyle: true,
      },
    }),
  ],
})
