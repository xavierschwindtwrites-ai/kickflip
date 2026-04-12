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

  // Book Details
  bookTitle: string;
  genre: string;
  pageCount: number | null;
  trimSize: string;
  interior: 'bw' | 'color';
  coverFinish: 'matte' | 'glossy';
  coverType: 'paperback' | 'hardcover' | 'both';

  // Print Run Estimate
  conservativeEstimate: number | null;
  expectedEstimate: number | null;
  breakoutEstimate: number | null;
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
  campaignLength: 20 | 25 | 30;
  contacts: OutreachContact[];
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

export interface FulfillmentPlannerData {
  timeline: FulfillmentTimelineData;
  confirmedPrinterId: string;
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

export interface CampaignData {
  bookSetup?: BookSetupData;
  printerQuotes?: PrinterQuotesData;
  pricingTiers?: PricingTiersData;
  shippingPlanner?: ShippingPlannerData;
  stretchGoals?: StretchGoalsData;
  promotionalTools?: PromotionalToolsData;
  fulfillmentPlanner?: FulfillmentPlannerData;
  retrospective?: RetrospectiveData;
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
  bookTitle: '',
  genre: '',
  pageCount: null,
  trimSize: '',
  interior: 'bw',
  coverFinish: 'matte',
  coverType: 'paperback',
  conservativeEstimate: null,
  expectedEstimate: null,
  breakoutEstimate: null,
};
