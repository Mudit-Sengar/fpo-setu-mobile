import type { NotificationRow } from "../db/repositories/networkRepository";
import type { FarmerTabParamList } from "../navigation/types";

/**
 * Where tapping a notification on Farmer Home should navigate.
 *
 * Farmers don't have a screen per notification type — meetings, membership
 * decisions, replies and messages all resolve to one of the two farmer
 * surfaces that already show that kind of thing (My FPO or Connect → My
 * Network), rather than a one-off detail screen per notification `type`.
 */
export interface NotificationTarget {
  tab: keyof Pick<FarmerTabParamList, "MyFpo" | "Connect">;
  sub: string;
}

export function resolveNotificationTarget(n: NotificationRow): NotificationTarget {
  switch (n.type) {
    case "meeting_invitation":
      // Farmer's My FPO → FPO details renders an "Upcoming FPO meetings" card.
      return { tab: "MyFpo", sub: "fpo" };
    case "membership_active":
      return { tab: "MyFpo", sub: "fpo" };
    case "membership_rejected":
    case "membership_exited":
      return { tab: "MyFpo", sub: "near" };
    case "connection_request":
    case "connection_accepted":
    case "connection_rejected":
    case "connection_blocked":
    case "message":
    case "request_response":
    case "review_received":
    case "order_created":
    default:
      // The accepted-connection thread, or the pending request itself, lives
      // in My Network — the farmer's one surface for "someone acted on you".
      return { tab: "Connect", sub: "network" };
  }
}
