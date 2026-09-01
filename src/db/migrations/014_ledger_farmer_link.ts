/**
 * Migration 014 — link a manually-recorded farmer transaction to the ledger
 * entry that produced it, and let a ledger entry itself be deleted.
 *
 * `farmerRepository.recordFarmerTransaction` (the FPO's manual bookkeeping path,
 * called from `AddEntry` when an Expense is logged against a member farmer) used
 * to insert into `farmer_txns` with nothing tying the row back to the
 * `ledger_entries` row it was posted alongside — two independent inserts that
 * happened to agree, not a relationship the database could enforce or use.
 *
 * `ON DELETE CASCADE` means an FPO deleting that ledger entry now takes the
 * farmer's matching transaction row with it, instead of leaving a stale entry
 * on the farmer's "My FPO" transaction history that no longer has a bookkeeping
 * entry behind it. Order-settled farmer transactions are unaffected — they carry
 * `order_id` instead and are anchored to the order, not to either side's ledger.
 */
export const MIGRATION_014: string[] = [
  `ALTER TABLE farmer_txns ADD COLUMN ledger_entry_id INTEGER REFERENCES ledger_entries(id) ON DELETE CASCADE;`,
  `CREATE INDEX IF NOT EXISTS idx_farmer_txns_ledger ON farmer_txns(ledger_entry_id);`,
];
