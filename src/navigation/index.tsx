import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Building2, GraduationCap, Handshake, Home, Landmark, ShoppingBag, Star, Users,
} from "lucide-react-native";
import { useApp } from "../lib/app-state";
import { colors } from "../theme";
import type {
  BuyerTabParamList, FarmerStackParamList, FarmerTabParamList, FpoStackParamList, RootStackParamList,
} from "./types";

import { LoginScreen } from "../screens/LoginScreen";
import { FarmerHomeScreen } from "../screens/farmer/FarmerHomeScreen";
import { MyFpoScreen } from "../screens/farmer/MyFpoScreen";
import { LearnScreen } from "../screens/farmer/LearnScreen";
import { ConnectScreen } from "../screens/farmer/ConnectScreen";
import { SchemesScreen } from "../screens/farmer/SchemesScreen";
import { FarmerProfileScreen } from "../screens/farmer/FarmerProfileScreen";
import { FpoHomeScreen } from "../screens/fpo/FpoHomeScreen";
import { FpoManageScreen } from "../screens/fpo/FpoManageScreen";
import { FpoPartnersScreen } from "../screens/fpo/FpoPartnersScreen";
import { FpoHelpScreen } from "../screens/fpo/FpoHelpScreen";
import { FpoCapacityScreen } from "../screens/fpo/FpoCapacityScreen";
import { FpoMyScreen } from "../screens/fpo/FpoMyScreen";
import { BuyerHomeScreen } from "../screens/buyer/BuyerHomeScreen";
import { BuyerMatchingScreen } from "../screens/buyer/BuyerMatchingScreen";
import { BuyerReviewsScreen } from "../screens/buyer/BuyerReviewsScreen";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const FarmerStack = createNativeStackNavigator<FarmerStackParamList>();
const FarmerTabs = createBottomTabNavigator<FarmerTabParamList>();
const FpoStack = createNativeStackNavigator<FpoStackParamList>();
const BuyerTabs = createBottomTabNavigator<BuyerTabParamList>();

const tabLabelStyle = { fontSize: 10, fontWeight: "600" as const };

/**
 * Tab bar height must account for the bottom safe-area inset, otherwise the
 * labels sit underneath Android's gesture-navigation pill (and the iOS home
 * indicator). Hardcoding height/paddingBottom overrides React Navigation's
 * built-in inset handling, so we add it back explicitly.
 */
function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  return {
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    height: 58 + insets.bottom,
    paddingBottom: insets.bottom + 6,
    paddingTop: 6,
  };
}

/**
 * Farmer bottom tabs — the direct successor to the web app's RoleShell mobile
 * bottom bar (My FPO / Learn / Connect / Gov Schemes), plus a Home tab that
 * replaces the web's "← Home" back-link on every sub-page.
 */
function FarmerTabNavigator() {
  const tabBarStyle = useTabBarStyle();
  return (
    <FarmerTabs.Navigator
      // "history" so the header Back button (and hardware back) return to the
      // previously visited tab instead of always jumping to the first tab.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.farmer,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle,
        tabBarLabelStyle: tabLabelStyle,
      }}
    >
      <FarmerTabs.Screen name="FarmerHome" component={FarmerHomeScreen}
        options={{ title: "Home", tabBarIcon: ({ color }) => <Home size={20} color={color} /> }} />
      <FarmerTabs.Screen name="MyFpo" component={MyFpoScreen}
        options={{ title: "My FPO", tabBarIcon: ({ color }) => <Building2 size={20} color={color} /> }} />
      <FarmerTabs.Screen name="Learn" component={LearnScreen}
        options={{ title: "Learn", tabBarIcon: ({ color }) => <GraduationCap size={20} color={color} /> }} />
      <FarmerTabs.Screen name="Connect" component={ConnectScreen}
        options={{ title: "Connect", tabBarIcon: ({ color }) => <Users size={20} color={color} /> }} />
      <FarmerTabs.Screen name="Schemes" component={SchemesScreen}
        options={{ title: "Schemes", tabBarIcon: ({ color }) => <Landmark size={20} color={color} /> }} />
    </FarmerTabs.Navigator>
  );
}

function FarmerNavigator() {
  return (
    <FarmerStack.Navigator screenOptions={{ headerShown: false }}>
      <FarmerStack.Screen name="FarmerTabs" component={FarmerTabNavigator} />
      <FarmerStack.Screen name="FarmerProfile" component={FarmerProfileScreen} />
    </FarmerStack.Navigator>
  );
}

/**
 * FPO stack — the web app's /fpo layout passed `nav={[]}` (no sidebar/tab bar);
 * navigation was tile + chip + back only. A stack preserves that exactly.
 */
function FpoNavigator() {
  return (
    <FpoStack.Navigator screenOptions={{ headerShown: false }}>
      <FpoStack.Screen name="FpoHome" component={FpoHomeScreen} />
      <FpoStack.Screen name="FpoManage" component={FpoManageScreen} />
      <FpoStack.Screen name="FpoPartners" component={FpoPartnersScreen} />
      <FpoStack.Screen name="FpoHelp" component={FpoHelpScreen} />
      <FpoStack.Screen name="FpoCapacity" component={FpoCapacityScreen} />
      <FpoStack.Screen name="FpoMy" component={FpoMyScreen} />
    </FpoStack.Navigator>
  );
}

/** Buyer bottom tabs — mirrors the web RoleShell nav for /buyer. */
function BuyerNavigator() {
  const tabBarStyle = useTabBarStyle();
  return (
    <BuyerTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.buyer,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle,
        tabBarLabelStyle: tabLabelStyle,
      }}
    >
      <BuyerTabs.Screen name="BuyerHome" component={BuyerHomeScreen}
        options={{ title: "Profile & Order", tabBarIcon: ({ color }) => <ShoppingBag size={20} color={color} /> }} />
      <BuyerTabs.Screen name="BuyerMatching" component={BuyerMatchingScreen}
        options={{ title: "Connect", tabBarIcon: ({ color }) => <Handshake size={20} color={color} /> }} />
      <BuyerTabs.Screen name="BuyerReviews" component={BuyerReviewsScreen}
        options={{ title: "Reviews", tabBarIcon: ({ color }) => <Star size={20} color={color} /> }} />
    </BuyerTabs.Navigator>
  );
}

/**
 * Root navigator. Mounting only the stack matching the persisted role replaces the
 * web app's client-side `useEffect` role guard in RoleShell — a mismatched screen
 * can never render, so no redirect flash is possible.
 */
export function RootNavigator() {
  const { role, ready } = useApp();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {role == null ? (
          <RootStack.Screen name="RoleSelect" component={LoginScreen} />
        ) : role === "farmer" ? (
          <RootStack.Screen name="Farmer" component={FarmerNavigator} />
        ) : role === "fpo" ? (
          <RootStack.Screen name="Fpo" component={FpoNavigator} />
        ) : (
          <RootStack.Screen name="Buyer" component={BuyerNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
