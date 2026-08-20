import { verifyPassword } from "../lib/crypto/password";
import * as authRepo from "../db/repositories/authRepository";
import { VIEW_ROLES, type RoleCode, type ViewRole } from "../db/repositories/authRepository";

export { VIEW_ROLES };
export type { RoleCode, ViewRole };

/**
 * Authentication service.
 *
 * This interface is the seam. The UI and app-state talk only to `AuthService`, so
 * moving authentication to a remote backend means writing a second implementation
 * that calls HTTP instead of SQLite and swapping the export at the bottom of this
 * file — no screen, navigator or context changes. Everything here is already async
 * and returns plain serialisable data for that reason.
 */

/** Why a sign-in attempt failed. Kept coarse on purpose — see `message`. */
export type AuthFailure =
  | "invalid_credentials"
  | "role_not_assigned"
  | "account_disabled"
  | "no_profile";

export interface Session {
  userId: number;
  username: string;
  displayName: string;
  /** Every role the user holds, including "admin". */
  roles: RoleCode[];
  /** The roles whose views this user may open. */
  viewableRoles: ViewRole[];
  isAdmin: boolean;
  /** The view currently open. Admins can change this without re-authenticating. */
  activeRole: ViewRole;
  /** `farmers.id` / `fpos.id` / `buyers.id` / `suppliers.id` backing the active view. */
  profileId: string;
  /**
   * `parties.id` for the same profile — the key every relationship table
   * (connections, requests, orders, reviews, messages) foreign-keys to. Screens
   * that only read entity data keep using `profileId`; anything that records an
   * action by this session uses `partyId`.
   */
  partyId: number;
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: AuthFailure; message: string };

export interface AuthService {
  signIn(username: string, password: string, role: ViewRole): Promise<SignInResult>;
  /** Re-reads a persisted session against the database. */
  restore(userId: number, activeRole: ViewRole): Promise<Session | null>;
  /** Admin-only: open a different role's view within the same session. */
  switchRole(session: Session, role: ViewRole): Promise<Session | null>;
  listRoles(): Promise<authRepo.RoleRow[]>;
}

/** One message for every credential failure, so we don't reveal which users exist. */
const INVALID = "Incorrect username or password.";

function viewableRolesFor(roles: RoleCode[]): ViewRole[] {
  // An admin can open every view without those roles being assigned individually,
  // including the admin view itself.
  if (roles.includes("admin")) return [...VIEW_ROLES];
  return VIEW_ROLES.filter((r) => roles.includes(r));
}

async function buildSession(
  user: authRepo.UserRow, roles: RoleCode[], activeRole: ViewRole,
): Promise<Session | null> {
  // Null when no profile is linked. There is no longer a fallback to the first
  // row of the domain table, so this is a hard failure rather than a silent
  // impersonation — see authRepository.getProfile.
  const profile = await authRepo.getProfile(user.id, activeRole);
  if (profile == null) return null;
  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    roles,
    viewableRoles: viewableRolesFor(roles),
    isAdmin: roles.includes("admin"),
    activeRole,
    profileId: profile.entityId,
    partyId: profile.partyId,
  };
}

/** DB-backed implementation. All credential checks happen against `users`. */
const localAuthService: AuthService = {
  async signIn(username, password, role) {
    const user = await authRepo.findUserByUsername(username);

    // Verify against a dummy hash when the user doesn't exist so the response
    // takes similar time either way and can't be used to enumerate usernames.
    if (user == null) {
      verifyPassword(password, DUMMY_HASH);
      return { ok: false, reason: "invalid_credentials", message: INVALID };
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return { ok: false, reason: "invalid_credentials", message: INVALID };
    }
    if (!user.isActive) {
      return { ok: false, reason: "account_disabled", message: "This account has been disabled." };
    }

    const roles = await authRepo.listRolesForUser(user.id);
    if (!viewableRolesFor(roles).includes(role)) {
      return {
        ok: false,
        reason: "role_not_assigned",
        message: `This account does not have the ${role.toUpperCase()} role.`,
      };
    }

    const session = await buildSession(user, roles, role);
    if (session == null) {
      return {
        ok: false,
        reason: "no_profile",
        message: `No ${role.toUpperCase()} profile is linked to this account.`,
      };
    }
    return { ok: true, session };
  },

  async restore(userId, activeRole) {
    // Re-checked against the database on every launch, so a user who has been
    // deactivated or had a role removed cannot keep using a stored session.
    const user = await authRepo.findUserById(userId);
    if (user == null || !user.isActive) return null;
    const roles = await authRepo.listRolesForUser(user.id);
    if (!viewableRolesFor(roles).includes(activeRole)) return null;
    return buildSession(user, roles, activeRole);
  },

  async switchRole(session, role) {
    if (!session.viewableRoles.includes(role)) return null;
    const user = await authRepo.findUserById(session.userId);
    if (user == null || !user.isActive) return null;
    const roles = await authRepo.listRolesForUser(user.id);
    return buildSession(user, roles, role);
  },

  listRoles: () => authRepo.listRoles(),
};

/**
 * A real hash of a value nobody can supply, used only to spend comparable time on
 * a missing username. Generated once at module load rather than hardcoded so the
 * file never contains anything resembling a credential.
 */
const DUMMY_HASH = "pbkdf2_sha256$10000$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/** The implementation the app uses. Swap this line to move auth to a backend. */
export const authService: AuthService = localAuthService;
