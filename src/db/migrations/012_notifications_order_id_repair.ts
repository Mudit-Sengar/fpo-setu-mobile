/**
 * Migration 012 — repairs a missing `notifications.order_id` column.
 *
 * Migration 007 already declares `ALTER TABLE notifications ADD COLUMN order_id
 * ...`, and on a fresh install that statement runs and the column exists. On at
 * least one already-migrated install, `PRAGMA user_version` had already advanced
 * past 7 without that specific column present — the runner only tracks a single
 * version number per migration file, not which individual statement within it
 * ran, so a device that reached version 7 through any means never gets a second
 * chance at a statement that didn't take. Every write that raises a notification
 * (`networkRepository.ts` `notify()`) references this column unconditionally, so
 * its absence broke Accept/Decline everywhere: the surrounding write sits inside
 * the same transaction and the whole thing rolled back.
 *
 * This re-issues that one ALTER. `runMigrations` treats "duplicate column name"
 * from an ADD COLUMN as already-done rather than a failure, so this is a no-op
 * on any install where migration 007 already added the column correctly.
 */
export const MIGRATION_012: string[] = [
  `ALTER TABLE notifications ADD COLUMN order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE;`,
];
