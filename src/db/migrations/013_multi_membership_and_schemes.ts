/**
 * Migration 013 — multiple active FPO memberships, FPO scheme URLs.
 *
 * `ux_membership_one_active` (migration 006) enforced "a farmer belongs to
 * exactly one FPO." Farmers legitimately sell through more than one FPO
 * (different crops, different seasons), so that constraint is dropped in
 * favour of a plain index that keeps "active memberships for a farmer"
 * queries fast without capping the row count at one. The membership
 * lifecycle itself (pending/active/rejected/suspended/exited) and the
 * one-pending-per-FPO index are unchanged.
 *
 * `schemes_fpo` gets a `url` column, mirroring `schemes_farmer.url` (added in
 * 001) and its `getFarmerSchemeUrl` read path — the FPO Government Schemes
 * screen can now open an official portal the same way the farmer one already
 * does.
 */
export const MIGRATION_013: string[] = [
  `DROP INDEX IF EXISTS ux_membership_one_active;`,
  `CREATE INDEX IF NOT EXISTS idx_membership_active ON memberships(farmer_id) WHERE status = 'active';`,

  `ALTER TABLE schemes_fpo ADD COLUMN url TEXT;`,

  // Backfill for installs that seeded schemes_fpo before this column existed —
  // src/db/seed.ts only runs once, on an empty database, so an upgrading device
  // needs these set explicitly. Mirrors GOVT_SCHEME_URLS in src/lib/mockData.ts;
  // update both if a scheme's URL changes.
  `UPDATE schemes_fpo SET url = 'https://sfacindia.com/FPOScheme.aspx'
     WHERE name = 'Central Sector Scheme for Formation & Promotion of 10,000 FPOs (SFAC)' AND url IS NULL;`,
  `UPDATE schemes_fpo SET url = 'https://agriinfra.dac.gov.in/'
     WHERE name = 'Agriculture Infrastructure Fund (AIF)' AND url IS NULL;`,
  `UPDATE schemes_fpo SET url = 'https://www.nabard.org/content1.aspx?catid=8&id=25'
     WHERE name = 'NABARD PRODUCE Fund' AND url IS NULL;`,
  `UPDATE schemes_fpo SET url = 'https://sfacindia.com/EGCGscheme.aspx'
     WHERE name = 'Equity Grant & Credit Guarantee Scheme (SFAC)' AND url IS NULL;`,
  `UPDATE schemes_fpo SET url = 'https://krishi.maharashtra.gov.in/'
     WHERE name = 'Maharashtra State FPO Policy support' AND url IS NULL;`,
  `UPDATE schemes_fpo SET url = 'https://www.msamb.com/Site/SMART'
     WHERE name = 'SMART Project (MahaIT / World Bank)' AND url IS NULL;`,

  // A reply to a posting now opens a real thread (see requestRepository.respond),
  // not just a one-shot message field. One thread per request, same guarantee
  // migration 005 already gives connection-based threads.
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_request
     ON conversations(request_id) WHERE request_id IS NOT NULL;`,
];
