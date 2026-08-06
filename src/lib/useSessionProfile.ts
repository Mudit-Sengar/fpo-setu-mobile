import { farmerRepo } from "../db";
import { useDbQuery } from "../db/useDbQuery";
import type { Farmer } from "../db/types";
import { useApp } from "./app-state";

/**
 * The farmer record belonging to the signed-in session.
 *
 * Replaces the former `DEFAULT_FARMER_ID` constant that every farmer screen
 * imported. That constant meant all logins shared one profile; the id now comes
 * from the authenticated session, so a different farmer account — or an admin
 * switched into the farmer view — loads its own linked record.
 */
export function useSessionFarmer(): Farmer | null {
  const { profileId } = useApp();
  const [farmer] = useDbQuery<Farmer | null>(
    () => (profileId == null ? Promise.resolve(null) : farmerRepo.getFarmerById(profileId)),
    [profileId],
    null,
  );
  return farmer;
}

/** The signed-in farmer's id, or null when signed out / in another role. */
export function useSessionFarmerId(): string | null {
  return useApp().profileId;
}
