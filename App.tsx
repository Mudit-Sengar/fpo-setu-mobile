import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStateProvider } from "./src/lib/app-state";
import { Toaster } from "./src/components/ui/Toast";
import { RootNavigator } from "./src/navigation";

/**
 * App root — the React Native counterpart of the web app's src/routes/__root.tsx.
 *
 * The web provider stack was:
 *   QueryClientProvider -> AppStateProvider -> DomTranslator -> <Outlet/> -> <Toaster/>
 *
 * Here:
 *  - QueryClientProvider is omitted: the web app wired it up but had ZERO
 *    useQuery/useMutation consumers (all data is local mock data). Add it back
 *    when a real backend lands.
 *  - DomTranslator is gone; translation now happens in components/ui/Text.tsx.
 *  - SafeAreaProvider replaces the SSR HTML document shell.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar barStyle="dark-content" />
        <RootNavigator />
        <Toaster />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
