// Shared seeded mock data for the FPO Setu prototype.
// Ported verbatim from the web app's src/lib/mockData.ts.
// ONLY CHANGE: Vite `import img from "@/assets/x.jpg"` (which yields a URL string)
// becomes RN `require("../assets/x.jpg")` (which yields a numeric asset handle).
// `Thumb` therefore unions both, and `imgSource()` normalises for <Image source={...}>.
import type { ImageSourcePropType } from "react-native";

const fpoMeeting = require("../assets/fpo-meeting.jpg");
const valuePackaging = require("../assets/value-packaging.jpg");
const valueStorage = require("../assets/value-storage.jpg");
const valueBeekeeping = require("../assets/value-beekeeping.jpg");
const valueMushroom = require("../assets/value-mushroom.jpg");
const valueSericulture = require("../assets/value-sericulture.jpg");
const valueTurmeric = require("../assets/value-turmeric.jpg");

/** A thumbnail is either a remote URL (string) or a bundled asset handle (number). */
export type Thumb = string | number;

/** Normalise a Thumb into something <Image source={...}> accepts. */
export function imgSource(t: Thumb): ImageSourcePropType {
  return typeof t === "string" ? { uri: t } : (t as ImageSourcePropType);
}

export type Tier = "Tier 1" | "Tier 2" | "Tier 3";

export interface FPOSupply {
  commodity: string;
  qty_mt: number;
  grade: string;
  harvest_window: string;
}

export interface FPO {
  id: string;
  name: string;
  district: string;
  block: string;
  regNo: string;
  commodities: string[];
  members: number;
  tier: Tier;
  tagline: string;
  warehouseMT: number;
  processing: { has: boolean; type?: string };
  grades: string[];
  avgPriceRealisation: number;
  apmcPrice: number;
  complianceScore: number;
  reputation: number;
  reviews: number;
  supply: FPOSupply[];
  incorporated: string;
}

export const FPOS: FPO[] = [
  {
    id: "fpo-1", name: "Samruddha Adivasi Agro Farmers Producer Company Ltd",
    district: "Ahmednagar", block: "Akole", regNo: "U01110PN2021PTC201799",
    commodities: ["Onion", "Tomato", "Soybean"], members: 540, tier: "Tier 1",
    tagline: "Tribal-led, market-ready, kharif powerhouse.",
    warehouseMT: 1200, processing: { has: true, type: "Grading & sortex unit" },
    grades: ["A", "B", "Sortex"], avgPriceRealisation: 1820, apmcPrice: 1450,
    complianceScore: 88, reputation: 4.6, reviews: 47,
    supply: [
      { commodity: "Onion", qty_mt: 90, grade: "A", harvest_window: "Nov – Jan" },
      { commodity: "Tomato", qty_mt: 40, grade: "A", harvest_window: "Oct – Dec" },
      { commodity: "Soybean", qty_mt: 120, grade: "A", harvest_window: "Oct – Nov" },
    ],
    incorporated: "2021-06-14",
  },
  {
    id: "fpo-2", name: "Dattasai Farmer Producer Company Ltd",
    district: "Latur", block: "Ausa", regNo: "U01400MH2021PTC357655",
    commodities: ["Soybean", "Tur", "Gram"], members: 480, tier: "Tier 1",
    tagline: "Marathwada pulses, traceable & sortex graded.",
    warehouseMT: 950, processing: { has: true, type: "Dal mill" },
    grades: ["A", "Sortex"], avgPriceRealisation: 7250, apmcPrice: 6400,
    complianceScore: 84, reputation: 4.5, reviews: 38,
    supply: [
      { commodity: "Tur", qty_mt: 180, grade: "Sortex", harvest_window: "Dec – Feb" },
      { commodity: "Soybean", qty_mt: 140, grade: "A", harvest_window: "Oct – Nov" },
      { commodity: "Gram", qty_mt: 90, grade: "A", harvest_window: "Feb – Mar" },
    ],
    incorporated: "2021-04-22",
  },
  {
    id: "fpo-3", name: "Jai Matrubhumi Krushi Vikas FPC Ltd",
    district: "Jalgaon", block: "Bhusawal", regNo: "U01100MH2021PTC359399",
    commodities: ["Banana", "Cotton", "Maize"], members: 610, tier: "Tier 1",
    tagline: "Banana cluster of Khandesh, export-ready.",
    warehouseMT: 800, processing: { has: true, type: "Banana ripening & packing" },
    grades: ["Export", "A", "B"], avgPriceRealisation: 1650, apmcPrice: 1280,
    complianceScore: 86, reputation: 4.4, reviews: 52,
    supply: [
      { commodity: "Banana", qty_mt: 320, grade: "Export", harvest_window: "Year-round" },
      { commodity: "Cotton", qty_mt: 110, grade: "A", harvest_window: "Oct – Jan" },
      { commodity: "Maize", qty_mt: 80, grade: "A", harvest_window: "Sep – Oct" },
    ],
    incorporated: "2021-07-30",
  },
  {
    id: "fpo-4", name: "Sumangal Krushi Vikas FPC Ltd",
    district: "Buldhana", block: "Chikhli", regNo: "U01100MH2021PTC358276",
    commodities: ["Soybean", "Cotton", "Tur"], members: 320, tier: "Tier 2",
    tagline: "Vidarbha oilseeds, scaling to Tier-1.",
    warehouseMT: 450, processing: { has: false },
    grades: ["A", "B"], avgPriceRealisation: 4380, apmcPrice: 3950,
    complianceScore: 72, reputation: 4.1, reviews: 21,
    supply: [
      { commodity: "Soybean", qty_mt: 95, grade: "A", harvest_window: "Oct – Nov" },
      { commodity: "Cotton", qty_mt: 70, grade: "B", harvest_window: "Nov – Jan" },
      { commodity: "Tur", qty_mt: 60, grade: "A", harvest_window: "Dec – Feb" },
    ],
    incorporated: "2021-08-11",
  },
  {
    id: "fpo-5", name: "Agroliv Farmtech Producer Company Ltd",
    district: "Jalna", block: "Jalna", regNo: "U01100MH2021PTC357821",
    commodities: ["Mosambi", "Cotton"], members: 290, tier: "Tier 2",
    tagline: "Mosambi belt of Marathwada.",
    warehouseMT: 380, processing: { has: true, type: "Grading & waxing" },
    grades: ["A", "B"], avgPriceRealisation: 2240, apmcPrice: 1850,
    complianceScore: 70, reputation: 4.2, reviews: 19,
    supply: [
      { commodity: "Mosambi", qty_mt: 140, grade: "A", harvest_window: "Sep – Feb" },
      { commodity: "Cotton", qty_mt: 60, grade: "B", harvest_window: "Nov – Jan" },
    ],
    incorporated: "2021-05-09",
  },
  {
    id: "fpo-6", name: "Rushi Chakrapani Farmer Producer Company Ltd",
    district: "Beed", block: "Parli", regNo: "U01100MH2022PTC381429",
    commodities: ["Tur", "Gram", "Bajra"], members: 245, tier: "Tier 2",
    tagline: "Dryland pulses & millets specialist.",
    warehouseMT: 320, processing: { has: false },
    grades: ["A", "B"], avgPriceRealisation: 6800, apmcPrice: 6300,
    complianceScore: 68, reputation: 4.0, reviews: 14,
    supply: [
      { commodity: "Tur", qty_mt: 70, grade: "A", harvest_window: "Dec – Feb" },
      { commodity: "Bajra", qty_mt: 50, grade: "A", harvest_window: "Oct – Nov" },
    ],
    incorporated: "2022-02-18",
  },
  {
    id: "fpo-7", name: "Krushivishva Farmer Producer Company Ltd",
    district: "Hingoli", block: "Aundha", regNo: "U01100MH2021PTC369062",
    commodities: ["Turmeric", "Soybean"], members: 210, tier: "Tier 2",
    tagline: "Hingoli haldi — the GI heartland.",
    warehouseMT: 260, processing: { has: true, type: "Turmeric polishing" },
    grades: ["A", "B"], avgPriceRealisation: 11800, apmcPrice: 10200,
    complianceScore: 74, reputation: 4.3, reviews: 22,
    supply: [
      { commodity: "Turmeric", qty_mt: 95, grade: "A", harvest_window: "Feb – Apr" },
      { commodity: "Soybean", qty_mt: 60, grade: "A", harvest_window: "Oct – Nov" },
    ],
    incorporated: "2021-09-02",
  },
  {
    id: "fpo-8", name: "Ellichpura Satpuda FPC Ltd",
    district: "Amravati", block: "Achalpur", regNo: "U01100MH2021PTC360444",
    commodities: ["Cotton", "Soybean", "Orange"], members: 180, tier: "Tier 3",
    tagline: "Satpuda foothills — citrus & cotton.",
    warehouseMT: 180, processing: { has: false },
    grades: ["B"], avgPriceRealisation: 1900, apmcPrice: 1700,
    complianceScore: 58, reputation: 3.9, reviews: 9,
    supply: [
      { commodity: "Orange", qty_mt: 60, grade: "B", harvest_window: "Nov – Feb" },
      { commodity: "Cotton", qty_mt: 40, grade: "B", harvest_window: "Nov – Jan" },
    ],
    incorporated: "2021-10-12",
  },
  {
    id: "fpo-9", name: "Bandevi Farmer Producer Company Ltd",
    district: "Dhule", block: "Shindkhede", regNo: "U01409MH2021PTC360675",
    commodities: ["Cotton", "Maize", "Onion"], members: 150, tier: "Tier 3",
    tagline: "Khandesh onions & maize.",
    warehouseMT: 160, processing: { has: false },
    grades: ["A", "B"], avgPriceRealisation: 1700, apmcPrice: 1500,
    complianceScore: 55, reputation: 3.8, reviews: 7,
    supply: [
      { commodity: "Onion", qty_mt: 80, grade: "A", harvest_window: "Nov – Jan" },
      { commodity: "Maize", qty_mt: 40, grade: "A", harvest_window: "Sep – Oct" },
    ],
    incorporated: "2021-11-04",
  },
  {
    id: "fpo-10", name: "Naturenest Farmer Producer Company Ltd",
    district: "Kolhapur", block: "Ajra", regNo: "U01100PN2021PTC200151",
    commodities: ["Rice", "Sugarcane", "Vegetables"], members: 130, tier: "Tier 3",
    tagline: "Sahyadri ghats — paddy & veg.",
    warehouseMT: 140, processing: { has: false },
    grades: ["A"], avgPriceRealisation: 2150, apmcPrice: 1950,
    complianceScore: 60, reputation: 4.0, reviews: 11,
    supply: [
      { commodity: "Rice", qty_mt: 55, grade: "A", harvest_window: "Oct – Dec" },
    ],
    incorporated: "2021-03-19",
  },
  {
    id: "fpo-11", name: "Nagzira Farmer Producer Company Ltd",
    district: "Bhandara", block: "Bhandara", regNo: "U01400MH2021PTC362226",
    commodities: ["Rice", "Pulses"], members: 120, tier: "Tier 3",
    tagline: "Vidarbha paddy bowl.",
    warehouseMT: 130, processing: { has: false },
    grades: ["A", "B"], avgPriceRealisation: 2080, apmcPrice: 1900,
    complianceScore: 52, reputation: 3.7, reviews: 6,
    supply: [
      { commodity: "Rice", qty_mt: 65, grade: "A", harvest_window: "Oct – Dec" },
    ],
    incorporated: "2021-09-27",
  },
  {
    id: "fpo-12", name: "Andhari Vyaghra FPC Ltd",
    district: "Chandrapur", block: "Chandrapur", regNo: "U01100MH2021PTC365203",
    commodities: ["Rice", "Cotton", "Tur"], members: 110, tier: "Tier 3",
    tagline: "Tiger-corridor tribal FPO.",
    warehouseMT: 120, processing: { has: false },
    grades: ["B"], avgPriceRealisation: 1850, apmcPrice: 1700,
    complianceScore: 50, reputation: 3.6, reviews: 5,
    supply: [
      { commodity: "Rice", qty_mt: 40, grade: "B", harvest_window: "Oct – Dec" },
      { commodity: "Tur", qty_mt: 30, grade: "B", harvest_window: "Dec – Feb" },
    ],
    incorporated: "2021-12-01",
  },
];

export type BuyerType = "Processor" | "Modern Retail" | "Wholesaler" | "Exporter" | "Development" | "Spot";
export interface Buyer {
  id: string; name: string; type: BuyerType;
  category: "Spot" | "Relationship" | "Development";
  commodities: string[]; typicalVolumeMT: number; location: string;
  qualitySpecs: string;
  procurementWindow: string;
}

export const BUYERS: Buyer[] = [
  { id: "b-1", name: "Sahyadri Foods Pvt Ltd", type: "Processor", category: "Relationship",
    commodities: ["Tomato", "Onion", "Mosambi"], typicalVolumeMT: 800, location: "Nashik",
    qualitySpecs: "Grade A, <5% moisture, traceable",
    procurementWindow: "Oct–Jan (Rabi onion), Jun–Aug (Kharif pulses)" },
  { id: "b-2", name: "FreshKart Retail", type: "Modern Retail", category: "Relationship",
    commodities: ["Onion", "Tomato", "Banana", "Vegetables"], typicalVolumeMT: 500, location: "Mumbai",
    qualitySpecs: "Grade A, uniform sizing, cold-chain",
    procurementWindow: "Year-round (peak Nov–Mar)" },
  { id: "b-3", name: "Pune Wholesale Mandi Traders", type: "Wholesaler", category: "Spot",
    commodities: ["Onion", "Tur", "Soybean"], typicalVolumeMT: 1500, location: "Pune",
    qualitySpecs: "Mixed, mandi-ready",
    procurementWindow: "Sep–Feb" },
  { id: "b-4", name: "AgriExport India", type: "Exporter", category: "Relationship",
    commodities: ["Banana", "Onion", "Turmeric"], typicalVolumeMT: 1200, location: "JNPT, Navi Mumbai",
    qualitySpecs: "Export grade, phyto-certified",
    procurementWindow: "Oct–Mar" },
  { id: "b-5", name: "Patanjali Procurement", type: "Development", category: "Development",
    commodities: ["Tur", "Gram", "Turmeric"], typicalVolumeMT: 2000, location: "Aurangabad",
    qualitySpecs: "Sortex / Grade A, contract farming",
    procurementWindow: "Dec–Apr" },
  { id: "b-6", name: "Local HORECA Supplies", type: "Spot", category: "Spot",
    commodities: ["Vegetables", "Rice", "Tomato"], typicalVolumeMT: 80, location: "Pune",
    qualitySpecs: "Daily fresh, Grade A",
    procurementWindow: "Year-round" },
];

export interface FarmerTxn { date: string; crop: string; qty_q: number; price: number; amount: number; refId?: string }
export interface Farmer {
  id: string; name: string; village: string; district: string; landAcres: number;
  crops: string[]; fpoId: string | null; sharePct: number; memberSince?: string;
  txns: FarmerTxn[];
}

export const FARMERS: Farmer[] = [
  { id: "MH-AH-2024-00831", name: "Suresh Patil", village: "Kotul", district: "Ahmednagar",
    landAcres: 3.2, crops: ["Onion", "Tomato", "Turmeric"], fpoId: "fpo-1", sharePct: 0.4, memberSince: "2022-08-12",
    txns: [
      { date: "2026-05-10", crop: "Onion", qty_q: 8, price: 900, amount: 7200, refId: "LG-2026-0512-ON" },
      { date: "2026-04-22", crop: "Tomato", qty_q: 5, price: 1100, amount: 5500, refId: "LG-2026-0422-TM" },
      { date: "2026-03-15", crop: "Onion", qty_q: 10, price: 950, amount: 9500, refId: "LG-2026-0315-ON" },
    ]},
  { id: "MH-LT-2024-01122", name: "Sunita Deshmukh", village: "Ausa", district: "Latur",
    landAcres: 4.5, crops: ["Soybean", "Tur"], fpoId: "fpo-2", sharePct: 0.5, memberSince: "2022-02-01",
    txns: [{ date: "2026-04-04", crop: "Tur", qty_q: 12, price: 7000, amount: 84000, refId: "LG-2026-0404-TR" }]},
  { id: "MH-JL-2024-00455", name: "Anil Patil", village: "Bhusawal", district: "Jalgaon",
    landAcres: 6.0, crops: ["Banana"], fpoId: "fpo-3", sharePct: 0.6, memberSince: "2021-09-10",
    txns: [{ date: "2026-05-01", crop: "Banana", qty_q: 60, price: 1600, amount: 96000 }]},
];

export const DEFAULT_FARMER_ID = "MH-AH-2024-00831";

export const PRICE_HISTORY = [
  { month: "Dec", fpo: 1620, apmc: 1300 },
  { month: "Jan", fpo: 1700, apmc: 1380 },
  { month: "Feb", fpo: 1720, apmc: 1400 },
  { month: "Mar", fpo: 1780, apmc: 1430 },
  { month: "Apr", fpo: 1810, apmc: 1440 },
  { month: "May", fpo: 1820, apmc: 1450 },
];

export const SCHEMES = [
  { name: "PM-KISAN", desc: "₹6,000/year direct benefit transfer to farmer accounts." },
  { name: "PMFBY Crop Insurance", desc: "Subsidised premium for kharif onion & soybean cover." },
  { name: "Maharashtra Drip Irrigation Subsidy", desc: "Up to 55% subsidy on micro-irrigation kits." },
];

export const VIDEOS: { title: string; duration: string; transcript: string; thumb: Thumb }[] = [
  { title: "Benefits of joining an FPO", duration: "3:42",
    transcript: "Joining an FPO means collective bargaining power, better prices and shared infrastructure...",
    thumb: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=600&q=70&auto=format" },
  { title: "How to register as an FPO member", duration: "2:15",
    transcript: "Bring your AgriStack Farmer ID, land 7/12 extract and a passport photo to the FPO office...",
    thumb: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600&q=70&auto=format" },
  { title: "Success story: Ravindra from Akole", duration: "4:08",
    transcript: "I earned ₹38,000 extra in one season by selling 80 quintals of onion through Samruddha FPO...",
    thumb: "https://images.unsplash.com/photo-1518972559570-7cc1309f3229?w=600&q=70&auto=format" },
  { title: "Turmeric processing & grading", duration: "5:50",
    transcript: "Curing, polishing, and color-sorting can raise turmeric realisation by 25–40%...",
    thumb: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=70&auto=format" },
];

// Farmer foundational courses (in logical sequence)
export const FARMER_COURSES: { title: string; duration: string; transcript: string; thumb: Thumb }[] = [
  { title: "What is an FPO", duration: "3:10",
    transcript: "A Farmer Producer Organisation (FPO) is a registered body of farmers who collectively own and run an agri-business — pooling produce, sharing infrastructure, negotiating better prices and reinvesting profits as equity dividends.",
    thumb: fpoMeeting },
  { title: "Benefits of an FPO", duration: "3:42",
    transcript: "Higher price realisation (15–35% over APMC), access to credit and storage, bulk input discounts, training, and equity profit share — all backed by your AgriStack Farmer ID.",
    thumb: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=600&q=70&auto=format" },
  { title: "How FPOs function", duration: "4:20",
    transcript: "Members elect a Board of Directors; a CEO runs day-to-day operations. Procurement, grading, sale and bookkeeping happen on the FPO Setu ledger so every member can trace their share.",
    thumb: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=70&auto=format" },
  { title: "How to become a member of an FPO", duration: "2:15",
    transcript: "Bring your AgriStack Farmer ID, your land 7/12 extract, a passport photo, and a one-time share contribution (₹500–₹2000) to the FPO office. Membership is approved by the Board.",
    thumb: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600&q=70&auto=format" },
  { title: "How to register as an FPO", duration: "5:05",
    transcript: "Form a producer group of 10+ farmers, register under the Companies Act (Producer Company) via SFAC/NABARD CBBO, open a current account, and apply for the equity grant & credit guarantee schemes.",
    thumb: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=70&auto=format" },
];

export const COMPLIANCE_PARTNERS = [
  { name: "Patil & Associates (CA)", svc: "Annual filings, audit", fee: "₹500" },
  { name: "LegalEase CS", svc: "ROC, board resolutions", fee: "₹300" },
  { name: "Marathwada Auditors", svc: "Statutory audit", fee: "₹450" },
  { name: "Deshmukh Tax Advisors (CA)", svc: "GST, TDS & income tax returns", fee: "₹200" },
];

export const LENDERS = [
  { name: "NABARD", eligibility: "Tier 1 & 2 FPOs", product: "Working capital up to ₹1 Cr" },
  { name: "NCDC", eligibility: "Registered FPCs", product: "Infrastructure loan up to ₹2 Cr" },
  { name: "Bank of Maharashtra", eligibility: "Compliance score ≥ 70", product: "Cash credit ₹25–75 L" },
  { name: "Samunnati", eligibility: "Tier 1–3 FPOs", product: "Trade finance, 10–14% p.a." },
];

export interface CourseItem { name: string; progress: number; by?: string; thumb: Thumb }

export const VALUE_COURSES: CourseItem[] = [
  { name: "Bee Keeping", progress: 10, thumb: valueBeekeeping },
  { name: "Mushroom Cultivation", progress: 35, thumb: valueMushroom },
  { name: "Sericulture (Silk Production)", progress: 5, thumb: valueSericulture },
  { name: "Turmeric processing & grading", progress: 30, thumb: valueTurmeric },
  { name: "Branding & packaging for retail", progress: 80, thumb: valuePackaging },
  { name: "Cold-chain basics for fresh produce", progress: 15, thumb: valueStorage },
];

export const MGMT_COURSES: CourseItem[] = [
  { name: "FPO leadership & governance", progress: 75, by: "Wadhwani Foundation",
    thumb: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&q=70&auto=format" },
  { name: "Financial management for FPOs", progress: 50, by: "Wadhwani Foundation",
    thumb: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=70&auto=format" },
  { name: "Business planning & buyer negotiation", progress: 40, by: "Wadhwani Foundation",
    thumb: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&q=70&auto=format" },
];

export const LOGISTICS_PROVIDERS = [
  { name: "Sahyadri Cold Storage", svc: "Storage / Warehousing", location: "Nashik", phone: "+91-9822-001-122", email: "ops@sahyadricold.in" },
  { name: "Marathwada Grain Godowns", svc: "Storage / Warehousing", location: "Latur", phone: "+91-9823-554-901", email: "warehouse@mgodowns.in" },
  { name: "AgriTrans Logistics", svc: "Transportation", location: "Pune", phone: "+91-9890-771-234", email: "dispatch@agritrans.in" },
  { name: "Khandesh Reefers Pvt Ltd", svc: "Transportation (reefer)", location: "Jalgaon", phone: "+91-9881-450-220", email: "fleet@khandeshreefers.in" },
  { name: "FarmEquip Rentals", svc: "Machinery Rental — tractors & harvesters", location: "Aurangabad", phone: "+91-9011-345-678", email: "rent@farmequip.in" },
  { name: "Krishi Yantra Rentals", svc: "Post-harvest grading & sortex rental", location: "Nashik", phone: "+91-9763-880-411", email: "hello@krishiyantra.in" },
];

export const EXPERTS = [
  { name: "Dr. R. Joshi", role: "Agribusiness mentor", note: "30+ yrs at NDDB. Open to monthly clinics.",
    phone: "+91-9820-112-340", email: "r.joshi@agriadvisor.in" },
  { name: "Sunita Deshmukh", role: "FPO Chairperson, Latur", note: "We grew turnover 3x in two seasons by following the buyer-match plan.",
    phone: "+91-9822-554-110", email: "sunita@dattasaifpc.in" },
  { name: "Anil Patil", role: "FPO Director, Jalgaon", note: "Wadhwani's governance course helped us pass our first audit.",
    phone: "+91-9881-220-901", email: "anil@matrubhumi.in" },
];

export const SELLER_FEEDBACK = [
  { buyer: "Sahyadri Foods Pvt Ltd", commodity: "Tomato", qty_mt: 35, date: "2026-04-10", stars: 5, note: "Excellent grading, on-time delivery." },
  { buyer: "FreshKart Retail", commodity: "Onion", qty_mt: 50, date: "2026-03-22", stars: 4, note: "Good quality, packing could improve." },
  { buyer: "Pune Wholesale Mandi Traders", commodity: "Soybean", qty_mt: 80, date: "2026-02-18", stars: 5, note: "Reliable supply, fair price." },
];

export interface MemberEngagement {
  name: string; village: string; status: "Active" | "At-risk" | "Dormant";
  soldThroughFPO: number; trainings: number; lastTxn: string;
}
export const MEMBER_ENGAGEMENT: MemberEngagement[] = [
  { name: "Suresh Patil", village: "Kotul", status: "Active", soldThroughFPO: 23, trainings: 4, lastTxn: "2026-05-10" },
  { name: "Sushila Kale", village: "Rajur", status: "Active", soldThroughFPO: 18, trainings: 3, lastTxn: "2026-05-02" },
  { name: "Nitin Bhor", village: "Akole", status: "At-risk", soldThroughFPO: 6, trainings: 1, lastTxn: "2026-02-14" },
  { name: "Geeta Salve", village: "Samsherpur", status: "At-risk", soldThroughFPO: 4, trainings: 0, lastTxn: "2026-01-30" },
  { name: "Mahesh Jadhav", village: "Kotul", status: "Dormant", soldThroughFPO: 0, trainings: 0, lastTxn: "2025-09-12" },
  { name: "Asha Lokhande", village: "Rajur", status: "Active", soldThroughFPO: 21, trainings: 5, lastTxn: "2026-05-08" },
  { name: "Pradeep Khade", village: "Akole", status: "Active", soldThroughFPO: 17, trainings: 4, lastTxn: "2026-05-06" },
  { name: "Rekha Pawar", village: "Kotul", status: "Active", soldThroughFPO: 19, trainings: 3, lastTxn: "2026-04-30" },
  { name: "Balasaheb Wagh", village: "Samsherpur", status: "At-risk", soldThroughFPO: 5, trainings: 1, lastTxn: "2026-02-22" },
  { name: "Madhuri Bhor", village: "Rajur", status: "Dormant", soldThroughFPO: 0, trainings: 0, lastTxn: "2025-08-04" },
  { name: "Santosh Salve", village: "Akole", status: "Active", soldThroughFPO: 22, trainings: 4, lastTxn: "2026-05-09" },
  { name: "Lata Jadhav", village: "Kotul", status: "At-risk", soldThroughFPO: 7, trainings: 2, lastTxn: "2026-03-01" },
  { name: "Kailas Mhaske", village: "Samsherpur", status: "Active", soldThroughFPO: 16, trainings: 3, lastTxn: "2026-04-28" },
  { name: "Manisha Lokhande", village: "Rajur", status: "Active", soldThroughFPO: 20, trainings: 5, lastTxn: "2026-05-11" },
  { name: "Vasant Pawar", village: "Kotul", status: "Dormant", soldThroughFPO: 0, trainings: 0, lastTxn: "2025-07-19" },
  { name: "Suresh Kale", village: "Akole", status: "Active", soldThroughFPO: 15, trainings: 2, lastTxn: "2026-04-25" },
];

export const TIER_SCORES: Record<Tier, { financial: number; operational: number; infra: number; governance: number; market: number }> = {
  "Tier 1": { financial: 85, operational: 88, infra: 82, governance: 86, market: 84 },
  "Tier 2": { financial: 65, operational: 70, infra: 60, governance: 68, market: 66 },
  "Tier 3": { financial: 45, operational: 50, infra: 38, governance: 48, market: 44 },
};

export interface OpportunityDetail {
  label: string; amount: string; action: string;
  steps: string[]; investment: string; outcome: string;
}
export function tierOpportunities(tier: Tier): OpportunityDetail[] {
  if (tier === "Tier 1") return [
    { label: "Immediate", amount: "₹18–22 L",
      action: "Link to 3 matched processors in Pune this kharif.",
      steps: [
        "Confirm 90 MT Grade-A onion availability in the FPO Setu supply ledger.",
        "Send digital sample lots to Sahyadri Foods, FreshKart and Patanjali via 'Connect'.",
        "Lock pricing with a 30-day forward contract and 50% advance.",
        "Use FPO's grading & sortex unit to meet processor specs.",
        "Dispatch in 5 weekly batches; settle payments through the digital ledger.",
      ],
      investment: "≈ ₹1.2 L (transport advance + packaging) — no capex.",
      outcome: "₹18–22 L additional realisation in 8 weeks; opens long-term processor relationship." },
    { label: "Near-Term", amount: "₹45–60 L",
      action: "Set up direct retail supply to FreshKart for tomato & onion.",
      steps: [
        "Get FSSAI category-license + barcoded packaging.",
        "Invest in a 10 MT pre-cooling chamber (NABARD subsidy 35%).",
        "Sign 6-month annual rate-contract with FreshKart for 50 MT/month.",
        "Train 25 members on harvest-window, sizing and cold-chain SOPs.",
        "Onboard a logistics partner for daily Mumbai dispatch.",
      ],
      investment: "≈ ₹18 L (pre-cooler, packaging line, working capital).",
      outcome: "₹45–60 L incremental revenue in season 1; predictable cashflow." },
    { label: "Aspirational", amount: "₹1.2–1.6 Cr",
      action: "Export onion via AgriExport India once phyto certification is renewed.",
      steps: [
        "Renew APEDA registration & GAP/GlobalG.A.P. certification.",
        "Upgrade sortex line to 2 TPH and add a residue-testing tie-up.",
        "Sign 12-month export contract for 600 MT with AgriExport India.",
        "Build a 500 MT bulk-onion storage with NCDC loan + 25% equity grant.",
        "Hire 1 export-ops manager + 1 QC head; run weekly compliance audits.",
      ],
      investment: "≈ ₹85 L (storage + sortex + certifications + working capital).",
      outcome: "₹1.2–1.6 Cr export turnover/year and a Tier-1+ export tag." },
  ];
  if (tier === "Tier 2") return [
    { label: "Immediate", amount: "₹6–9 L",
      action: "Aggregate 80 MT soybean for Pune wholesale buyers.",
      steps: [
        "Confirm 80 MT pool across 60 farmer members.",
        "Run a 3-day buyer auction with Pune Mandi Traders + 2 processors.",
        "Use shared transport pool to cut logistics by 18%.",
        "Settle members within 48 hours via the digital ledger.",
      ],
      investment: "≈ ₹40 K bridge finance for logistics.",
      outcome: "₹6–9 L extra over individual mandi sale; builds buyer trust." },
    { label: "Near-Term", amount: "₹20–28 L",
      action: "Add basic grading shed; unlock Grade A premium.",
      steps: [
        "Apply for AIF loan (3% interest subvention) for ₹15 L grading shed.",
        "Hire 1 supervisor + train 6 members on grading SOPs.",
        "Re-bid with processors at Grade-A pricing (+12–15%).",
        "Pursue compliance score uplift from 72 → 80 via Capacity Building courses.",
      ],
      investment: "≈ ₹15 L (AIF-financed) + ₹2 L working capital.",
      outcome: "₹20–28 L additional revenue per season; clears path to Tier 1." },
    { label: "Aspirational", amount: "₹55–70 L",
      action: "Become anchor in a regional cluster with two Tier-1 FPOs.",
      steps: [
        "Form a cluster MoU with Samruddha (fpo-1) and Dattasai (fpo-2).",
        "Pool 250 MT supply for retail/processor mandates.",
        "Co-invest in a 1,000 MT regional warehouse (NCDC + grants).",
        "Launch joint brand and B2B portal.",
      ],
      investment: "≈ ₹35 L equity share in cluster infra.",
      outcome: "₹55–70 L annual share of cluster turnover; jumps to Tier 1." },
  ];
  return [
    { label: "Immediate", amount: "₹1.5–3 L",
      action: "Onboard 40 new members; cross 175-member threshold.",
      steps: [
        "Run 4 village outreach camps + sign new shareholders.",
        "Pool 25 MT of best-graded produce for a spot sale.",
        "File ROC compliance to lift score from 50 → 60.",
      ],
      investment: "≈ ₹15 K outreach.",
      outcome: "₹1.5–3 L spot-sale revenue; unlocks Tier 2 eligibility." },
    { label: "Near-Term", amount: "₹8–12 L",
      action: "Apply for NABARD working capital after compliance uplift.",
      steps: [
        "Complete statutory audit + 2 board-resolution filings.",
        "Generate a bankable proposal from Compliance tab.",
        "Apply to NABARD for ₹25 L working capital.",
        "Aggregate 60 MT supply backed by buyer LoIs.",
      ],
      investment: "₹50 K audit + filings.",
      outcome: "₹8–12 L season-1 turnover bump; credit history built." },
    { label: "Aspirational", amount: "₹25–35 L",
      action: "Build a 200 MT warehouse with NCDC infrastructure loan.",
      steps: [
        "Acquire 0.5-acre site (lease or donate).",
        "Apply for NCDC infra loan + 25% equity grant.",
        "Construct 200 MT warehouse + small grading shed.",
        "Rent out spare capacity to neighbouring FPOs.",
      ],
      investment: "≈ ₹40 L (75% loan-financed).",
      outcome: "₹25–35 L annual revenue from storage + grading; Tier 2 unlocked." },
  ];
}

export interface LedgerEntry {
  date: string; desc: string; type: "Income" | "Expense";
  amount: number; balance: number; counterpartyId?: string; refId?: string;
}
export const LEDGER: LedgerEntry[] = [
  { date: "2026-03-15", desc: "Onion procurement from member — 10 q", type: "Expense",
    amount: 9500, balance: 370500, counterpartyId: "MH-AH-2024-00831", refId: "LG-2026-0315-ON" },
  { date: "2026-04-22", desc: "Tomato procurement from member — 5 q", type: "Expense",
    amount: 5500, balance: 365000, counterpartyId: "MH-AH-2024-00831", refId: "LG-2026-0422-TM" },
  { date: "2026-05-10", desc: "Onion procurement from member — 8 q", type: "Expense",
    amount: 7200, balance: 357800, counterpartyId: "MH-AH-2024-00831", refId: "LG-2026-0512-ON" },
  { date: "2026-05-12", desc: "Onion procurement — 90 MT pool", type: "Expense",
    amount: 1620000, balance: -1262200, counterpartyId: "FPO-POOL", refId: "LG-2026-0512-PL" },
  { date: "2026-05-14", desc: "Onion sale — Sahyadri Foods", type: "Income",
    amount: 1980000, balance: 717800, counterpartyId: "b-1", refId: "LG-2026-0514-SH" },
  { date: "2026-05-18", desc: "Logistics — Akole→Pune", type: "Expense",
    amount: 84000, balance: 633800, counterpartyId: "AgriTrans-LOG", refId: "LG-2026-0518-LG" },
  { date: "2026-05-22", desc: "Member dividend payout", type: "Expense",
    amount: 145000, balance: 488800, counterpartyId: "MEMBERS-ALL", refId: "LG-2026-0522-DV" },
  { date: "2026-05-28", desc: "Tomato sale — FreshKart", type: "Income",
    amount: 770000, balance: 1258800, counterpartyId: "b-2", refId: "LG-2026-0528-FK" },
];

export function fpoById(id: string): FPO | undefined {
  return FPOS.find((f) => f.id === id);
}

// FPO cumulative profile (aggregated)
export interface FpoCumulative {
  totalMembers: number;
  totalLandAcres: number;
  cropwise: { crop: string; acres: number }[];
}
export const FPO_CUMULATIVE: Record<string, FpoCumulative> = {
  "fpo-1": { totalMembers: 540, totalLandAcres: 1320,
    cropwise: [
      { crop: "Onion", acres: 460 },
      { crop: "Tomato", acres: 330 },
      { crop: "Soybean", acres: 320 },
      { crop: "Coriander", acres: 210 },
    ]},
  "fpo-2": { totalMembers: 480, totalLandAcres: 1240,
    cropwise: [
      { crop: "Soybean", acres: 480 },
      { crop: "Tur", acres: 420 },
      { crop: "Gram", acres: 220 },
      { crop: "Coriander", acres: 120 },
    ]},
};
export function cumulativeFor(fpoId: string): FpoCumulative {
  if (FPO_CUMULATIVE[fpoId]) return FPO_CUMULATIVE[fpoId];
  const fpo = fpoById(fpoId);
  const members = fpo?.members ?? 200;
  const acres = Math.round(members * 2.5);
  const crops = (fpo?.commodities ?? ["Mixed"]).slice(0, 4);
  const each = Math.round(acres / Math.max(1, crops.length));
  return { totalMembers: members, totalLandAcres: acres,
    cropwise: crops.map((c, i) => ({ crop: c, acres: each + (i === 0 ? acres - each * crops.length : 0) })) };
}

// Government schemes (Central + Maharashtra)
export interface Scheme {
  name: string; body: "Central" | "State (Maharashtra)";
  desc: string; eligibility: string;
  eligibleTiers: Tier[];
  minMembers?: number; minCompliance?: number;
}
export const GOVT_SCHEMES: Scheme[] = [
  { name: "Central Sector Scheme for Formation & Promotion of 10,000 FPOs (SFAC)",
    body: "Central",
    desc: "Equity grant up to ₹15 L matching member equity, plus CBBO hand-holding for 5 years.",
    eligibility: "Registered FPC with ≥ 100 members; compliant filings.",
    eligibleTiers: ["Tier 1", "Tier 2", "Tier 3"], minMembers: 100, minCompliance: 50 },
  { name: "Agriculture Infrastructure Fund (AIF)",
    body: "Central",
    desc: "Up to ₹2 Cr interest-subvention loan (3% p.a. for 7 yrs) for post-harvest infra.",
    eligibility: "Registered FPO with a viable infra DPR; compliance score ≥ 65.",
    eligibleTiers: ["Tier 1", "Tier 2"], minCompliance: 65 },
  { name: "NABARD PRODUCE Fund",
    body: "Central",
    desc: "Equity grant and credit-guarantee cover up to ₹85 L; CBBO support.",
    eligibility: "FPO promoted by NABARD CBBO; ≥ 250 members.",
    eligibleTiers: ["Tier 1", "Tier 2"], minMembers: 250 },
  { name: "Equity Grant & Credit Guarantee Scheme (SFAC)",
    body: "Central",
    desc: "Matching equity grant (up to ₹15 L) + 85% credit guarantee on loans up to ₹1 Cr.",
    eligibility: "FPC with audited accounts; compliance score ≥ 60.",
    eligibleTiers: ["Tier 1", "Tier 2", "Tier 3"], minCompliance: 60 },
  { name: "Maharashtra State FPO Policy support",
    body: "State (Maharashtra)",
    desc: "Branding, mandi-fee waiver and ₹5 L matching grant for State-supported FPOs.",
    eligibility: "Maharashtra-registered FPC with ≥ 150 members.",
    eligibleTiers: ["Tier 1", "Tier 2", "Tier 3"], minMembers: 150 },
  { name: "SMART Project (MahaIT / World Bank)",
    body: "State (Maharashtra)",
    desc: "Capex grant up to ₹50 L for value-chain infra; market linkage with retailers & exporters.",
    eligibility: "Maharashtra FPC; compliance score ≥ 70; value-chain proposal.",
    eligibleTiers: ["Tier 1", "Tier 2"], minCompliance: 70 },
];

export function isSchemeEligible(s: Scheme, fpo: FPO): boolean {
  if (!s.eligibleTiers.includes(fpo.tier)) return false;
  if (s.minMembers && fpo.members < s.minMembers) return false;
  if (s.minCompliance && fpo.complianceScore < s.minCompliance) return false;
  return true;
}

// === Daily APMC prices (per quintal, by crop) — last 30 days dummy series ===
export const DAILY_APMC_PRICES: Record<string, { date: string; price: number }[]> = (() => {
  const crops: Record<string, number> = { Onion: 1450, Tomato: 1100, Turmeric: 10200, Soybean: 4380, Tur: 6800, Banana: 1280 };
  const out: Record<string, { date: string; price: number }[]> = {};
  const today = new Date("2026-05-30");
  for (const [crop, base] of Object.entries(crops)) {
    const arr: { date: string; price: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const wiggle = Math.sin(i * 0.6) * base * 0.04 + (i % 5) * base * 0.005;
      arr.push({ date: d.toISOString().slice(5, 10), price: Math.round(base + wiggle) });
    }
    out[crop] = arr;
  }
  return out;
})();

// === Government Schemes for Farmers (Central + State) with requirements ===
export interface FarmerScheme {
  name: string; body: "Central" | "State (Maharashtra)";
  desc: string; benefit: string; requirements: string[];
}
export const FARMER_SCHEMES: FarmerScheme[] = [
  { name: "PM-KISAN", body: "Central",
    desc: "Income support to small/marginal farmer families.",
    benefit: "₹6,000 per year in three equal instalments (DBT).",
    requirements: ["AgriStack Farmer ID (or Aadhaar-linked land record)", "Land ownership 7/12 / 8A extract", "Active bank account linked to Aadhaar", "Not an income-tax payer / not a govt employee"] },
  { name: "PMFBY — Crop Insurance", body: "Central",
    desc: "Subsidised premium for kharif & rabi cover.",
    benefit: "Premium capped at 2% (kharif) / 1.5% (rabi); claim on yield loss.",
    requirements: ["Crop loan account or self-enrolment via CSC", "Sowing certificate from village officer", "Aadhaar + bank account", "Premium payment before cut-off date"] },
  { name: "Kisan Credit Card (KCC)", body: "Central",
    desc: "Short-term credit at 4% effective interest with timely repayment.",
    benefit: "Limit ₹3 L at 7% (3% interest subvention + 3% prompt repayment incentive).",
    requirements: ["Land record / tenancy proof", "Aadhaar + PAN", "Cropping plan for the season", "No default with any bank"] },
  { name: "Maharashtra Drip Irrigation Subsidy", body: "State (Maharashtra)",
    desc: "Per-mukhyamantri Krishi Sinchan Yojana subsidy on micro-irrigation.",
    benefit: "Up to 55% subsidy on drip/sprinkler kits (small/marginal).",
    requirements: ["Maharashtra resident farmer", "Land record (7/12)", "Quotation from approved dealer", "Water source on farm"] },
  { name: "Mahatma Phule Shetkari Karjmukti Yojana", body: "State (Maharashtra)",
    desc: "State crop-loan waiver for eligible farmers.",
    benefit: "Loan waiver up to ₹2 L on eligible crop loans.",
    requirements: ["Crop loan taken from a scheduled bank in MH", "Aadhaar seeded with loan account", "Loan within the eligible window"] },
  { name: "Magel Tyala Saur Krushi Pump Yojana", body: "State (Maharashtra)",
    desc: "Solar agriculture pump scheme.",
    benefit: "Up to 90–95% subsidy on solar pumps (3–7.5 HP).",
    requirements: ["Land 7/12 with water source", "No existing electric connection for pump", "Aadhaar + bank account", "Application via MSEDCL portal"] },
];

// === Input requirements (FPO buying inputs) ===
export interface InputNeed { item: string; category: string; qty: string; window: string; notes?: string }
export const INPUT_NEEDS: InputNeed[] = [
  { item: "Onion seed (Bhima Super)", category: "Seeds", qty: "120 kg", window: "Jul – Aug", notes: "Truthfully labelled" },
  { item: "NPK 19:19:19", category: "Fertilizer", qty: "8 MT", window: "Aug – Sep" },
  { item: "Bio-pesticide (Neem)", category: "Pesticide", qty: "600 L", window: "Aug – Oct" },
  { item: "Power tiller rental", category: "Equipment rental", qty: "12 units × 4 days", window: "Jun" },
];

// === Input Suppliers (for FPO supplier matching & Buyer/Supplier role) ===
export interface Supplier {
  id: string; name: string; brand: string; categories: string[]; products: string;
  priceRange: string; certifications: string; regions: string; minOrder: string; leadTimeDays: number; seasons: string; location: string;
}
export const SUPPLIERS: Supplier[] = [
  { id: "s-1", name: "Mahabeej Seeds Ltd", brand: "Mahabeej", categories: ["Seeds"],
    products: "Onion (Bhima Super), Tomato hybrids, Soybean JS-335, Pulses",
    priceRange: "₹180–₹2,200 / kg",
    certifications: "Truthfully labelled, MSCSCL certified",
    regions: "Maharashtra, Karnataka, Gujarat", minOrder: "25 kg", leadTimeDays: 5, seasons: "Year-round (kharif/rabi peaks)", location: "Akola" },
  { id: "s-2", name: "Coromandel International", brand: "Gromor", categories: ["Fertilizer"],
    products: "NPK 19:19:19, DAP, Urea, Micronutrients",
    priceRange: "₹28–₹65 / kg",
    certifications: "FCO licence, ISO 9001",
    regions: "Pan-India", minOrder: "2 MT", leadTimeDays: 7, seasons: "Year-round", location: "Pune depot" },
  { id: "s-3", name: "Dhanuka Agritech", brand: "Dhanuka", categories: ["Pesticide", "Bio-input"],
    products: "Neem oil, Bio-fungicide, Herbicides, Insecticides",
    priceRange: "₹220–₹1,800 / L",
    certifications: "CIB&RC registered, bio-pesticide licence",
    regions: "Maharashtra, MP, Telangana", minOrder: "100 L", leadTimeDays: 4, seasons: "Year-round (peak Jul–Oct)", location: "Aurangabad" },
  { id: "s-4", name: "Mahindra Farm Machinery", brand: "Mahindra", categories: ["Equipment rental", "Equipment sale"],
    products: "Tractors, Power tillers, Harvesters, Sprayers (rent & sale)",
    priceRange: "₹600–₹2,800 / day (rental)",
    certifications: "OEM authorised, AMC included",
    regions: "Maharashtra", minOrder: "1 unit", leadTimeDays: 2, seasons: "Year-round", location: "Nashik" },
  { id: "s-5", name: "Krishi Bio Solutions", brand: "BioKrishi", categories: ["Bio-input", "Seeds"],
    products: "Vermicompost, Trichoderma, Cover-crop seed mix",
    priceRange: "₹40–₹350 / kg",
    certifications: "Organic-input certified (NPOP)",
    regions: "Western Maharashtra", minOrder: "500 kg", leadTimeDays: 6, seasons: "Year-round", location: "Kolhapur" },
];

// === FPO Meetings (logged) ===
export interface FpoMeeting { date: string; time: string; agenda: string; venue: string }
export const FPO_MEETINGS: FpoMeeting[] = [
  { date: "2026-06-12", time: "10:30", agenda: "Kharif input pooling & pricing approval", venue: "FPO office, Akole" },
  { date: "2026-05-18", time: "11:00", agenda: "Quarterly board review + dividend declaration", venue: "FPO office, Akole" },
  { date: "2026-04-05", time: "09:30", agenda: "AGM — FY-end results, auditor presentation", venue: "Akole community hall" },
];

// === Mentor experts for expansion-plan scrutiny ===
export interface Mentor { name: string; expertise: string; org: string; phone: string; email: string }
export const MENTORS: Mentor[] = [
  { name: "Dr. Anita Rao", expertise: "FPO business strategy & buyer negotiation",
    org: "Wadhwani Foundation", phone: "+91-9810-220-441", email: "anita.rao@wadhwani.org" },
  { name: "Mr. Suresh Iyer", expertise: "Export readiness & APEDA certification",
    org: "Ex-APEDA, independent advisor", phone: "+91-9820-554-988", email: "s.iyer@agritrade.in" },
  { name: "Ms. Pratibha Joshi", expertise: "Value addition, packaging, retail branding",
    org: "NIFTEM-K alumna", phone: "+91-9930-110-332", email: "pratibha@valueadd.in" },
];

// === Buyer category groups (Spot / Relationship / Development) ===
export function buyersByCategory() {
  return {
    Spot: BUYERS.filter((b) => b.category === "Spot"),
    Relationship: BUYERS.filter((b) => b.category === "Relationship"),
    Development: BUYERS.filter((b) => b.category === "Development"),
  };
}

// === Compliance explainer (for FPO) ===
export const COMPLIANCE_EXPLAINER = [
  { title: "Annual ROC filing (Form AOC-4, MGT-7)", detail: "Producer companies must file annual financials and an annual return with the Registrar of Companies within 60/30 days of AGM." },
  { title: "Statutory audit", detail: "An external CA must audit accounts every year and sign the auditor's report before AGM." },
  { title: "GST returns", detail: "GSTR-1 (monthly/quarterly) and GSTR-3B (monthly) if turnover crosses ₹40 L; nil returns if below." },
  { title: "Income-tax return (ITR-6)", detail: "Producer companies file ITR-6 by 31 Oct (audit cases). TDS returns quarterly (Form 26Q)." },
  { title: "Board meetings & AGM", detail: "Minimum 4 board meetings/year and one AGM within 6 months of FY-end; resolutions recorded in minutes book." },
  { title: "FSSAI / licences (if applicable)", detail: "Food category licence for processing/branding; APEDA/phyto for exports; FCO/CIB&RC for input trading." },
];

// === Apply URLs for farmer schemes ===
export const FARMER_SCHEME_URLS: Record<string, string> = {
  "PM-KISAN": "https://pmkisan.gov.in/",
  "PMFBY — Crop Insurance": "https://pmfby.gov.in/",
  "Kisan Credit Card (KCC)": "https://www.myscheme.gov.in/schemes/kcc",
  "Maharashtra Drip Irrigation Subsidy": "https://mahadbtmahait.gov.in/",
  "Mahatma Phule Shetkari Karjmukti Yojana": "https://mjpsky.maharashtra.gov.in/",
  "Magel Tyala Saur Krushi Pump Yojana": "https://www.mahadiscom.in/solar/",
};

// === Direct buyers near farmer (for Connect with Buyers) ===
export interface FarmerBuyerMatch {
  id: string; buyer: string; crop: string; grade: string;
  qty: string; window: string; location: string; distanceKm: number;
}
export const FARMER_BUYER_MATCHES: FarmerBuyerMatch[] = [
  { id: "fb-1", buyer: "Sahyadri Foods Pvt Ltd", crop: "Tomato", grade: "A", qty: "20 MT", window: "Nov – Dec", location: "Nashik", distanceKm: 62 },
  { id: "fb-2", buyer: "FreshKart Retail", crop: "Onion", grade: "A", qty: "15 MT", window: "Dec – Jan", location: "Mumbai", distanceKm: 210 },
  { id: "fb-3", buyer: "Local HORECA Supplies", crop: "Tomato", grade: "A", qty: "6 MT", window: "Year-round", location: "Pune", distanceKm: 140 },
  { id: "fb-4", buyer: "Patanjali Procurement", crop: "Turmeric", grade: "A", qty: "8 MT", window: "Feb – Apr", location: "Aurangabad", distanceKm: 180 },
];

// === Similar farmers (for Connect with Similar Farmers) ===
export interface SimilarFarmer {
  id: string; name: string; village: string; district: string;
  crop: string; grade: string; quality: string; landAcres: number; distanceKm: number;
}
export const SIMILAR_FARMERS: SimilarFarmer[] = [
  { id: "sf-1", name: "Ramesh Jadhav", village: "Sangamner", district: "Ahmednagar", crop: "Onion", grade: "A", quality: "Export", landAcres: 5.0, distanceKm: 18 },
  { id: "sf-2", name: "Vikas More", village: "Akole", district: "Ahmednagar", crop: "Onion", grade: "A", quality: "Premium", landAcres: 3.5, distanceKm: 7 },
  { id: "sf-3", name: "Sunil Kale", village: "Rajur", district: "Ahmednagar", crop: "Tomato", grade: "A", quality: "Premium", landAcres: 4.2, distanceKm: 12 },
  { id: "sf-4", name: "Madhukar Shinde", village: "Sinnar", district: "Nashik", crop: "Onion", grade: "A", quality: "Export", landAcres: 6.8, distanceKm: 55 },
  { id: "sf-5", name: "Pratap Bhor", village: "Junnar", district: "Pune", crop: "Tomato", grade: "B", quality: "Standard", landAcres: 2.8, distanceKm: 95 },
  { id: "sf-6", name: "Ganpat Salve", village: "Kotul", district: "Ahmednagar", crop: "Turmeric", grade: "A", quality: "Premium", landAcres: 2.0, distanceKm: 3 },
];

// === Supplier supply postings (Supplier-side) ===
export interface SupplyPosting {
  id: string; item: string; category: string; qty: string; pricePerUnit: string;
  region: string; window: string;
}
export const SUPPLIER_POSTINGS: SupplyPosting[] = [
  { id: "sp-1", item: "Onion seed (Bhima Super)", category: "Seeds", qty: "2,000 kg", pricePerUnit: "₹2,200/kg", region: "Western Maharashtra", window: "Jul – Aug" },
  { id: "sp-2", item: "NPK 19:19:19", category: "Fertilizer", qty: "50 MT", pricePerUnit: "₹52/kg", region: "Pan-Maharashtra", window: "Aug – Sep" },
];
