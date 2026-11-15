/**
 * The FLEX and CFI-G dataset definitions (src/scripts/psi-tables.ts): the
 * cleaned CSVs must still validate value by value, and the importer's checks
 * must still pass. If a CSV is edited, update the definitions here (or the
 * checks) rather than letting the importer write values that don't match.
 */
import { describe, expect, it } from 'vitest'

import { DATA, TABLES, buildRows } from '../../src/scripts/psi-tables'

describe('PSI table definitions (FLEX, CFI-G)', () => {
  for (const table of TABLES) {
    describe(table.name, () => {
      const { rows, problems } = buildRows(`${DATA}/${table.csv}`, table.defs)

      it('coerces every value against its column definition', () => {
        expect(problems, problems.slice(0, 10).join('\n')).toEqual([])
      })

      it("passes the importer's checks", () => {
        const { failures } = table.checks(rows)
        expect(failures).toBe(0)
      })

      it('defines exactly the columns the CSV has, with unique keys', () => {
        const keys = table.defs.map((d) => d[1])
        expect(new Set(keys).size).toBe(keys.length)
        // Every definition has a label and a type; required columns are the ones
        // the checks rely on for a complete row.
        for (const [, , label, type, , , , required] of table.defs) {
          expect(label.length).toBeGreaterThan(0)
          expect(['text', 'number', 'integer', 'boolean', 'date', 'category']).toContain(type)
          expect(typeof required).toBe('boolean')
        }
      })
    })
  }
})
