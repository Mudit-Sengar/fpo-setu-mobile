import type { Thumb } from "../lib/mockData";

/**
 * Bundled-image registry.
 *
 * A `Thumb` is either a remote URL (string) or a bundled asset handle (a NUMBER
 * produced by require()). That number is a Metro module id — it is build-specific
 * and meaningless once written to disk, so bundled images cannot be stored in
 * SQLite directly. Instead the DB stores a stable text key and this registry maps
 * it back to the real handle at read time.
 *
 * Remote URLs are their own key and pass straight through.
 */
const BUNDLED: Record<string, number> = {
  "asset:fpo-meeting": require("../assets/fpo-meeting.jpg"),
  "asset:value-packaging": require("../assets/value-packaging.jpg"),
  "asset:value-storage": require("../assets/value-storage.jpg"),
  "asset:value-beekeeping": require("../assets/value-beekeeping.jpg"),
  "asset:value-mushroom": require("../assets/value-mushroom.jpg"),
  "asset:value-sericulture": require("../assets/value-sericulture.jpg"),
  "asset:value-turmeric": require("../assets/value-turmeric.jpg"),
  "asset:farmer-male": require("../assets/farmer-male.jpg"),
  "asset:farmer-female": require("../assets/farmer-female.jpg"),
};

/** Reverse map, so seeding can turn a require()'d handle back into its stable key. */
const KEY_BY_HANDLE = new Map<number, string>(
  Object.entries(BUNDLED).map(([key, handle]) => [handle, key]),
);

/** Seed-time: Thumb -> storable text key. */
export function thumbToKey(thumb: Thumb): string {
  if (typeof thumb === "string") return thumb;
  return KEY_BY_HANDLE.get(thumb) ?? "";
}

/** Read-time: stored text key -> Thumb usable by <Image source={imgSource(...)}>. */
export function keyToThumb(key: string): Thumb {
  return BUNDLED[key] ?? key;
}
