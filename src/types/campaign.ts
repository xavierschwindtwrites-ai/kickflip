export interface Campaign {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  data: string; // JSON string
}

export interface BookSetupData {
  // Campaign Basics
  campaignTitle: string;
  targetLaunchDate: string;
  emailListSize: number | null;
  emailOpenRate: number | null;

  // What you're making — free text, works for books or any product
  productNotes: string;

  // Book Details (legacy — no longer shown in the UI, kept for old data)
  bookTitle: string;
  genre: string;
  pageCount: number | null;
  trimSize: string; // legacy global trim size
  trimSizePaperback: string; // KF-006: per-format trim sizes
  trimSizeHardcover: string;
  interior: 'bw' | 'color';
  coverFinish: 'matte' | 'glossy';
  coverType: 'paperback' | 'hardcover' | 'both';

  // Print Run Estimate
  conservativeEstimate: number | null;
  expectedEstimate: number | null;
  breakoutEstimate: number | null;

  // Platform fees (percentages; Kickstarter US default is 5 + 3)
  platformFeePercent: number;
  paymentFeePercent: number;
}

/** Combined platform + payment fee as a 0-1 rate, with US Kickstarter defaults. */
export function totalFeeRate(bs: Pick<BookSetupData, 'platformFeePercent' | 'paymentFeePercent'>): number {
  const platform = bs.platformFeePercent ?? 5;
  const payment = bs.paymentFeePercent ?? 3;
  return (platform + payment) / 100;
}

export type Currency = 'USD' | 'GBP' | 'EUR' | 'CAD' | 'AUD';

export interface PodPrinter {
  id: string;
  printerName: string;
  customName: string;
  currency: Currency;
  unitCost: number | null;
  domesticShipping: number | null;
  internationalShipping: number | null;
  notes: string;
}

export interface OffsetVolumeRow {
  id: string;
  quantity: number | null;
  unitCost: number | null;
  totalCost: number | null;
}

export interface OffsetPrinter {
  id: string;
  printerName: string;
  currency: Currency;
  volumeRows: OffsetVolumeRow[];
  domesticShipping: number | null;
  internationalShipping: number | null;
  leadTimeWeeks: number | null;
  notes: string;
}

export interface PrinterQuotesData {
  podPrinters: PodPrinter[];
  offsetPrinters: OffsetPrinter[];
}

export const TIER_INCLUDES_OPTIONS = [
  'Ebook',
  'Paperback',
  'Hardcover',
  'Signed copy',
  'Bookplate',
  'Bookmark',
  'Art print',
  'Custom',
] as const;

export type TierInclude = typeof TIER_INCLUDES_OPTIONS[number];

export interface RewardTier {
  id: string;
  name: string;
  pledgeAmount: number | null;
  includes: TierInclude[];
  customInclude: string;
  printerId: string; // POD printer id from PrinterQuotesData
  shippingType: 'domestic' | 'international' | 'both';
  isDigitalOnly: boolean; // KF-001: digital-only tiers have no printer/shipping
}

export interface PricingTiersData {
  goal: number | null;
  tiers: RewardTier[];
}

export function createRewardTier(): RewardTier {
  return {
    id: uid(),
    name: '',
    pledgeAmount: null,
    includes: [],
    customInclude: '',
    printerId: '',
    shippingType: 'both',
    isDigitalOnly: false,
  };
}

export function defaultPricingTiers(): PricingTiersData {
  return {
    goal: null,
    tiers: [createRewardTier()],
  };
}

export interface ShippingRegion {
  id: string;
  name: string;
  enabled: boolean;
  costPerCopy: number | null;
  basis: 'flat' | 'per_copy';
  backerPercent: number | null;
}

export interface ShippingPlannerData {
  currencyRates: Record<string, number | null>; // e.g. { GBP: 1.265, EUR: 1.08 }
  regions: ShippingRegion[];
  paymentFailureRate: number;
  bufferPercent: number;
}

export function createDefaultRegions(): ShippingRegion[] {
  const names = [
    'United States',
    'United Kingdom',
    'European Union',
    'Canada',
    'Australia',
    'Rest of World',
  ];
  return names.map(name => ({
    id: uid(),
    name,
    enabled: true,
    costPerCopy: null,
    basis: 'flat' as const,
    backerPercent: null,
  }));
}

export function defaultShippingPlanner(): ShippingPlannerData {
  return {
    currencyRates: {},
    regions: createDefaultRegions(),
    paymentFailureRate: 5,
    bufferPercent: 10,
  };
}

export type StretchGoalType =
  | 'Interior illustrations'
  | 'Cover upgrade'
  | 'Additional book format'
  | 'Bookmarks / bookplates'
  | 'Art print'
  | 'Author note / letter'
  | 'Ebook extras'
  | 'Custom';

export interface StretchGoal {
  id: string;
  name: string;
  goalType: StretchGoalType;
  customType: string;
  costStructure: 'flat' | 'per_backer';
  flatCost: number | null;
  perBackerCost: number | null;
  sortOrder: number; // KF-002: drag-and-drop ordering
}

export interface StretchGoalsData {
  goals: StretchGoal[];
}

export function createStretchGoal(): StretchGoal {
  return {
    id: uid(),
    name: '',
    goalType: 'Interior illustrations',
    customType: '',
    costStructure: 'flat',
    flatCost: null,
    perBackerCost: null,
    sortOrder: 0,
  };
}

export function defaultStretchGoals(): StretchGoalsData {
  return { goals: [] };
}

export interface ReadinessItem {
  key: string;
  checked: boolean;
}

export interface OutreachContact {
  id: string;
  name: string;
  type: 'Fellow author' | 'Book blogger' | 'ARC reader' | 'Podcast' | 'Newsletter' | 'Other';
  contactDate: string;
  status: 'Not contacted' | 'Contacted' | 'Responded' | 'Confirmed support';
  notes: string;
}

export interface PromotionalToolsData {
  readinessChecks: ReadinessItem[];
  campaignLength: number; // KF-005: now any number, not just 20|25|30
  contacts: OutreachContact[];
  useEndDateOverride: boolean; // KF-005: manual end date override
  overrideEndDate: string;     // KF-005: specific end date when override is active
}

export function createOutreachContact(): OutreachContact {
  return {
    id: uid(),
    name: '',
    type: 'Fellow author',
    contactDate: '',
    status: 'Not contacted',
    notes: '',
  };
}

export function defaultPromotionalTools(): PromotionalToolsData {
  return {
    readinessChecks: [],
    campaignLength: 30,
    contacts: [],
    useEndDateOverride: false,
    overrideEndDate: '',
  };
}

export interface FulfillmentTimelineData {
  pledgeManagerOpenDate: string;
  pledgeManagerCloseDate: string;
  printFileSubmissionDate: string;
  expectedPrintCompletionDate: string;
  shippingStartDate: string;
  estimatedFulfillmentCompleteDate: string;
}

export type PledgeManagerPlatform = 'Backerkit' | 'Crowdox' | 'Kickstarter native' | 'Other';

// KF-012: Multi-printer entries in Fulfillment Planner
export interface FulfillmentPrinterEntry {
  id: string;
  printerId: string;
  tiersFullfilled: string;
  estimatedUnitCost: number | null;
  turnaroundWeeks: number | null;
  notes: string;
}

export function createFulfillmentPrinterEntry(): FulfillmentPrinterEntry {
  return {
    id: uid(),
    printerId: '',
    tiersFullfilled: '',
    estimatedUnitCost: null,
    turnaroundWeeks: null,
    notes: '',
  };
}

export interface FulfillmentPlannerData {
  timeline: FulfillmentTimelineData;
  confirmedPrinterId: string; // legacy single-printer field
  printerEntries: FulfillmentPrinterEntry[]; // KF-012: multi-printer entries
  printQuantity: number | null;
  usePledgeManager: boolean | null;
  pledgeManagerPlatform: PledgeManagerPlatform;
  pledgeManagerFee: number | null;
  pledgeManagerFeeType: 'percent' | 'flat';
  backerCommsChecks: string[];
  hiddenCostChecks: string[];
}

export function defaultFulfillmentPlanner(): FulfillmentPlannerData {
  return {
    timeline: {
      pledgeManagerOpenDate: '',
      pledgeManagerCloseDate: '',
      printFileSubmissionDate: '',
      expectedPrintCompletionDate: '',
      shippingStartDate: '',
      estimatedFulfillmentCompleteDate: '',
    },
    confirmedPrinterId: '',
    printerEntries: [createFulfillmentPrinterEntry()],
    printQuantity: null,
    usePledgeManager: null,
    pledgeManagerPlatform: 'Backerkit',
    pledgeManagerFee: null,
    pledgeManagerFeeType: 'percent',
    backerCommsChecks: [],
    hiddenCostChecks: [],
  };
}

export type CampaignStatus = 'Planning' | 'Live' | 'Complete';

export interface ActualCosts {
  printing: number | null;
  domesticShipping: number | null;
  internationalShipping: number | null;
  packaging: number | null;
  pledgeManagerFees: number | null;
  miscellaneous: number | null;
}

export interface RetrospectiveData {
  campaignStatus: CampaignStatus;
  finalBackerCount: number | null;
  totalRaised: number | null;
  mostPopularTier: string;
  campaignDaysUsed: number | null;
  hitFundingGoal: boolean | null;
  stretchGoalsHit: 'None' | 'Some' | 'All' | null;
  stretchGoalsHitDetail: string;
  actualCosts: ActualCosts;
  whatWorked: string;
  whatWouldChange: string;
  seedChecks: string[];
  seedListSize: number | null;
  seedNotes: string;
}

export function defaultRetrospective(): RetrospectiveData {
  return {
    campaignStatus: 'Planning',
    finalBackerCount: null,
    totalRaised: null,
    mostPopularTier: '',
    campaignDaysUsed: null,
    hitFundingGoal: null,
    stretchGoalsHit: null,
    stretchGoalsHitDetail: '',
    actualCosts: {
      printing: null,
      domesticShipping: null,
      internationalShipping: null,
      packaging: null,
      pledgeManagerFees: null,
      miscellaneous: null,
    },
    whatWorked: '',
    whatWouldChange: '',
    seedChecks: [],
    seedListSize: null,
    seedNotes: '',
  };
}

// KF-010: Scenario Modeler per-tier weights
export interface ScenarioModelerData {
  tierWeights: Record<string, number>; // tierId -> 0-100 percentage
}

export function defaultScenarioModeler(): ScenarioModelerData {
  return { tierWeights: {} };
}

// KF-013: Pre-launch follower tracker
export interface PrelaunchTrackerData {
  followerCount: number | null;
  targetFollowerCount: number | null;
  conversionRateOverride: number | null; // percentage, overrides industry default
  notes: string;
}

export function defaultPrelaunchTracker(): PrelaunchTrackerData {
  return {
    followerCount: null,
    targetFollowerCount: null,
    conversionRateOverride: null,
    notes: '',
  };
}

// KF-014: Live campaign daily tracker
export interface LiveCampaignEntry {
  id: string;
  date: string;
  backers: number | null;
  funding: number | null;
}

export function createLiveCampaignEntry(): LiveCampaignEntry {
  return { id: uid(), date: '', backers: null, funding: null };
}

export interface LiveCampaignData {
  isActive: boolean;
  entries: LiveCampaignEntry[];
}

export function defaultLiveCampaign(): LiveCampaignData {
  return { isActive: false, entries: [] };
}

export interface CampaignData {
  bookSetup?: BookSetupData;
  printerQuotes?: PrinterQuotesData;
  pricingTiers?: PricingTiersData;
  shippingPlanner?: ShippingPlannerData;
  stretchGoals?: StretchGoalsData;
  promotionalTools?: PromotionalToolsData;
  fulfillmentPlanner?: FulfillmentPlannerData;
  retrospective?: RetrospectiveData;
  scenarioModeler?: ScenarioModelerData;     // KF-010
  prelaunchTracker?: PrelaunchTrackerData;   // KF-013
  liveCampaign?: LiveCampaignData;           // KF-014
}

let _idCounter = 0;
export function uid(): string {
  return `${Date.now()}-${++_idCounter}`;
}

export function createPodPrinter(): PodPrinter {
  return {
    id: uid(),
    printerName: '',
    customName: '',
    currency: 'USD',
    unitCost: null,
    domesticShipping: null,
    internationalShipping: null,
    notes: '',
  };
}

export function createOffsetVolumeRow(): OffsetVolumeRow {
  return { id: uid(), quantity: null, unitCost: null, totalCost: null };
}

export function createOffsetPrinter(): OffsetPrinter {
  return {
    id: uid(),
    printerName: '',
    currency: 'USD',
    volumeRows: [createOffsetVolumeRow()],
    domesticShipping: null,
    internationalShipping: null,
    leadTimeWeeks: null,
    notes: '',
  };
}

export function defaultPrinterQuotes(): PrinterQuotesData {
  return {
    podPrinters: [createPodPrinter(), createPodPrinter()],
    offsetPrinters: [createOffsetPrinter()],
  };
}

export const DEFAULT_BOOK_SETUP: BookSetupData = {
  campaignTitle: '',
  targetLaunchDate: '',
  emailListSize: null,
  emailOpenRate: null,
  productNotes: '',
  bookTitle: '',
  genre: '',
  pageCount: null,
  trimSize: '',
  trimSizePaperback: '',
  trimSizeHardcover: '',
  interior: 'bw',
  coverFinish: 'matte',
  coverType: 'paperback',
  conservativeEstimate: null,
  expectedEstimate: null,
  breakoutEstimate: null,
  platformFeePercent: 5,
  paymentFeePercent: 3,
};
