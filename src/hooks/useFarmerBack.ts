import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";

/**
 * Back handler for Farmer screens.
 *
 * Uses normal navigation history (`goBack`). The Farmer tab navigator is
 * configured with `backBehavior: "history"`, so going back from a tab returns
 * to the previously visited tab rather than jumping to the first one.
 *
 * If there is genuinely nothing to go back to — e.g. the app was opened
 * directly onto a tab and no history exists yet — fall back to Farmer Home so
 * the button is never a dead control.
 */
export function useFarmerBack() {
  const nav = useNavigation();
  return useCallback(() => {
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate("FarmerHome" as never);
  }, [nav]);
}
