/**
 * Navigation contracts replacing the web app's file-based TanStack Router routes.
 * Each web route maps to exactly one screen here (see the migration report's
 * screen-mapping table).
 */

export type RootStackParamList = {
  RoleSelect: undefined;   // web "/"
  Farmer: undefined;       // web "/farmer"
  Fpo: undefined;          // web "/fpo"
  Buyer: undefined;        // web "/buyer"
};

export type FarmerStackParamList = {
  FarmerTabs: undefined;
  FarmerProfile: undefined; // web "/farmer/profile" (reached from the TopBar avatar)
};

export type FarmerTabParamList = {
  FarmerHome: undefined;                                   // web "/farmer/"
  MyFpo: { sub?: "market" | "fpo" | "near" } | undefined;  // web "/farmer/my-fpo" (+ ?sub= deep link)
  Learn: undefined;                                        // web "/farmer/learn"
  Connect: undefined;                                      // web "/farmer/connect"
  Schemes: undefined;                                      // web "/farmer/schemes"
};

export type FpoStackParamList = {
  FpoHome: undefined;      // web "/fpo/"
  FpoManage: undefined;    // web "/fpo/manage"
  FpoPartners: undefined;  // web "/fpo/partners"
  FpoHelp: undefined;      // web "/fpo/help"
  FpoCapacity: undefined;  // web "/fpo/capacity"
  FpoMy: undefined;        // web "/fpo/my"
};

export type BuyerTabParamList = {
  BuyerHome: undefined;      // web "/buyer/"
  BuyerMatching: undefined;  // web "/buyer/matching"
  BuyerReviews: undefined;   // web "/buyer/reviews"
};
