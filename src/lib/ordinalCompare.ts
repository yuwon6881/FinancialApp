/**
 * Ordinal string comparison, matching .NET's `StringComparer.Ordinal` and Postgres' `COLLATE "C"`.
 *
 * Both compare UTF-16 code units, and so does this. `localeCompare` does not: it applies ICU
 * collation, which folds case and gives punctuation little or no weight, so `tx-1-split-Growth`
 * and `tx-11` order differently under the two rules.
 *
 * Every ordering the server also computes must use this, not `localeCompare`:
 *  - ledger paging, where a disagreement can render a row on two pages or neither;
 *  - the stability reload FIFO queue, where it decides which obligation is repaid first;
 *  - loan replay, where it decides the order interest and principal are applied in.
 */
export function compareIdsOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
