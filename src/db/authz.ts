import type { ViewRole } from "./repositories/authRepository";

/**
 * Authorisation for writes.
 *
 * Until now every repository function took an id as a parameter and trusted it.
 * That was survivable while the app only read data, but a write has an author:
 * the moment one persona's action lands in another persona's data, "which entity
 * is this session allowed to act as?" has to be answered somewhere, once.
 *
 * The answer is this module, and the rule is that a mutation never accepts the
 * id of the thing it modifies — it derives that id from the session. A caller
 * cannot name another organisation because there is no parameter in which to
 * name one.
 *
 * The database is on-device, so this is application correctness rather than a
 * security boundary: a determined holder of the phone can edit the file directly.
 * The point is that the signatures are already the ones a server would enforce,
 * so moving enforcement behind an API later changes no call sites.
 */

/**
 * What a mutation needs to know about who is asking.
 *
 * Structurally satisfied by `Session` from src/services/authService, so screens
 * pass `session` straight through and there is no second object to keep in sync.
 */
export interface SessionContext {
  readonly userId: number;
  readonly partyId: number;
  readonly activeRole: ViewRole;
  readonly profileId: string;
  /**
   * Whether the session holds the admin role. Optional so a plain profile
   * context stays valid without it; absent means not an admin.
   */
  readonly isAdmin?: boolean;
}

/** Raised when a write is attempted without the standing to make it. */
export class AuthzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthzError";
  }
}

/**
 * Confirms the session is currently acting in `role`, and returns the entity id
 * it owns in that role — the only id a mutation should write to.
 *
 * Throws rather than returning null: a write that silently does nothing is the
 * failure mode this whole phase exists to remove.
 */
export function requireProfile(ctx: SessionContext | null | undefined, role: ViewRole): string {
  if (ctx == null) {
    throw new AuthzError("You are signed out. Sign in again to save changes.");
  }
  if (ctx.activeRole !== role) {
    throw new AuthzError(`This change can only be made from the ${role} view.`);
  }
  if (ctx.profileId === "") {
    throw new AuthzError("This account has no profile linked for this role.");
  }
  return ctx.profileId;
}

/**
 * Confirms the session is acting in ANY of `roles`, returning the entity id it
 * owns. For actions more than one persona legitimately performs — an FPO and a
 * large farmer can both offer produce; a buyer and an FPO can both want to buy it.
 */
export function requireAnyProfile(
  ctx: SessionContext | null | undefined, roles: ViewRole[],
): string {
  if (ctx == null) {
    throw new AuthzError("You are signed out. Sign in again to save changes.");
  }
  if (!roles.includes(ctx.activeRole)) {
    const names = roles.join(" or ");
    throw new AuthzError(`This can only be done from the ${names} view.`);
  }
  if (ctx.profileId === "") {
    throw new AuthzError("This account has no profile linked for this role.");
  }
  return ctx.profileId;
}

/**
 * Confirms the session holds the admin role.
 *
 * Admin is the one role that acts on other people's accounts, so it is checked
 * against the role itself rather than against a profile — an admin has no
 * farmer, FPO or buyer identity when acting as an admin, and should not need one
 * to disable an account.
 */
export function requireAdmin(ctx: SessionContext | null | undefined): number {
  if (ctx == null) {
    throw new AuthzError("You are signed out.");
  }
  if (ctx.isAdmin !== true) {
    throw new AuthzError("This action requires an administrator.");
  }
  return ctx.userId;
}

/**
 * Turns a failed write into something worth showing a user.
 *
 * An AuthzError already says what went wrong in plain words and is safe to show.
 * Anything else is a driver or SQL failure whose message would mean nothing to
 * the person holding the phone, so callers supply their own wording.
 */
export function describeWriteError(e: unknown, fallback: string): string {
  return e instanceof AuthzError ? e.message : fallback;
}
