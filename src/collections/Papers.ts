import type { CollectionConfig } from 'payload'

const isAdmin = ({ req }: { req: { user?: unknown } }) => !!req.user

export const EXPERIMENTS = [
  'SAFFIRE',
  'FLEX',
  'FLEX-2',
  'ACME',
  'BASS-II',
  'SoFIE',
  'SLICE',
  'CFI',
  'SPICE',
  'SAME',
  'DAFT',
  'Other',
].map((v) => ({ label: v, value: v }))

export const Papers: CollectionConfig = {
  slug: 'papers',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'year', 'documentType', 'ntrsId', 'ingestStatus'],
  },
  versions: { drafts: true },
  access: {
    // Visitors see published papers only. Admins see drafts too.
    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  upload: {
    mimeTypes: ['application/pdf'],
    filesRequiredOnCreate: false, // allow link-only entries (e.g. journal papers you can't redistribute)
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        if (typeof data.ntrsId === 'string') data.ntrsId = data.ntrsId.trim()
        if (data.ntrsId && !data.sourceUrl) {
          data.sourceUrl = `https://ntrs.nasa.gov/citations/${data.ntrsId}`
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'authors',
      type: 'array',
      labels: { singular: 'Author', plural: 'Authors' },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      name: 'year',
      type: 'number',
      validate: (v: number | null | undefined) =>
        v == null || (Number.isInteger(v) && v >= 1950 && v <= 2100) ? true : 'Enter a four-digit year.',
    },
    {
      name: 'documentType',
      type: 'select',
      options: [
        { label: 'Journal article', value: 'journal-article' },
        { label: 'Technical memorandum', value: 'technical-memorandum' },
        { label: 'Technical publication', value: 'technical-publication' },
        { label: 'Conference paper', value: 'conference-paper' },
        { label: 'Presentation', value: 'presentation' },
        { label: 'Poster', value: 'poster' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'ntrsId',
          type: 'text',
          unique: true,
          index: true,
          admin: { description: 'NTRS document ID, e.g. 20210011385' },
        },
        { name: 'doi', type: 'text', admin: { description: 'e.g. 10.1007/s12217-014-9372-2' } },
      ],
    },
    {
      name: 'sourceUrl',
      type: 'text',
      admin: { description: 'Filled from the NTRS ID if left empty.' },
    },
    {
      name: 'license',
      type: 'text',
      admin: {
        description:
          'e.g. "NASA, public" or "Publisher copyright". For copyrighted papers, link to the source and don\u2019t upload the PDF.',
      },
    },
    {
      name: 'experiments',
      type: 'array',
      labels: { singular: 'Experiment link', plural: 'Experiment links' },
      admin: { description: 'Which experiments this paper covers, and whether you have confirmed the link.' },
      fields: [
        { name: 'experiment', type: 'select', required: true, options: EXPERIMENTS },
        {
          name: 'linkStatus',
          type: 'select',
          required: true,
          defaultValue: 'unconfirmed',
          options: [
            { label: 'Confirmed', value: 'confirmed' },
            { label: 'Unconfirmed', value: 'unconfirmed' },
          ],
        },
      ],
    },
    {
      name: 'datasets',
      type: 'join',
      collection: 'datasets',
      on: 'papers',
      admin: { description: 'Datasets that list this paper as a source.' },
    },
    { name: 'abstract', type: 'textarea' },
    {
      name: 'fullText',
      type: 'textarea',
      admin: { description: 'Extracted text used for AI summaries and search.' },
      access: { read: ({ req }) => !!req.user }, // hidden from the public API
    },
    {
      name: 'ingestStatus',
      type: 'select',
      defaultValue: 'pending',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Text extracted', value: 'extracted' },
        { label: 'Embedded', value: 'embedded' },
        { label: 'Failed', value: 'failed' },
      ],
    },
  ],
}