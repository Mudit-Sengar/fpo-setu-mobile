import React from "react";
import { colors } from "../../theme";
import { RoleShell } from "../../components/layout/RoleShell";
import { ActiveConversationsPanel } from "../../features/connections";

/**
 * Buyer/Supplier's Messages tab.
 *
 * Everything that used to sit inside the Connect tab's combined
 * ConnectionsPanel is now split in two (see src/features/connections.tsx):
 * pending connection requests stay on Connect (discovery + decisions), and
 * accepted connections with their real message threads — both ordinary
 * connection chats and the threads a request reply now opens (see
 * requestRepository.respond) — live here.
 */
export function BuyerMessagesScreen() {
  return (
    <RoleShell accent="buyer" screenName="Messages">
      <ActiveConversationsPanel accent={colors.buyer} />
    </RoleShell>
  );
}
