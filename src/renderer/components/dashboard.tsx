import React, { useState, useEffect } from 'react';
import type { NavItem } from '../app';
import type {
  CampaignData,
  BookSetupData,
  PrinterQuotesData,
  PricingTiersData,
  ShippingPlannerData,
  StretchGoalsData,
  PromotionalToolsData,
  FulfillmentPlannerData,
  RetrospectiveData,
  CampaignStatus,
} from '../../types/campaign';
import {
  DEFAULT_BOOK_SETUP,
  defaultPrinterQuotes,
  defaultPricingTiers,
  defaultShippingPlanner,
  defaultStretchGoals,
  defaultPromotionalTools,
  defaultFulfillmentPlanner,
  defaultRetrospective,
} from '../../types/campaign';

const TOTAL_FEE = 0.08;

interface DashboardProps {
  campaignId: number;
  onNavChange: (item: NavItem) => void;
}

function formatDate(iso: string): string {
  if (!iso) return 'No date set';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDollar(n: number): string {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const Dashboard: React.FC<DashboardProps> = ({ campaignId, onNavChange }) => {
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [printerQuotes, setPrinterQuotes] = useState<PrinterQuotesData>(defaultPrinterQuotes);
  const [pricingTiers, setPricingTiers] = useState<PricingTiersData>(defaultPricingTiers);
  const [shippingPlanner, setShippingPlanner] = useState<ShippingPlannerData>(defaultShippingPlanner);
  const [stretchGoals, setStretchGoals] = useState<StretchGoalsData>(defaultStretchGoals);
  const [promoTools, setPromoTools] = useState<PromotionalToolsData>(defaultPromotionalTools);
  const [fulfillment, setFulfillment] = useState<FulfillmentPlannerData>(defaultFulfillmentPlanner);
  const [retrospective, setRetrospective] = useState<RetrospectiveData>(defaultRetrospective);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaign = await window.kickflip.loadCampaign(campaignId);
      if (cancelled) return;
      if (campaign && campaign.data) {
        try {
          const p: CampaignData = JSON.parse(campaign.data);
          if (p.bookSetup) setBookSetup({ ...DEFAULT_BOOK_SETUP, ...p.bookSetup });
          if (p.printerQuotes) setPrinterQuotes(p.printerQuotes);
          if (p.pricingTiers) setPricingTiers(p.pricingTiers);
          if (p.shippingPlanner) setShippingPlanner(prev => ({ ...prev, ...p.shippingPlanner }));
          if (p.stretchGoals) setStretchGoals({ ...defaultStretchGoals(), ...p.stretchGoals });
          if (p.promotionalTools) setPromoTools({ ...defaultPromotionalTools(), ...p.promotionalTools });
          if (p.fulfillmentPlanner) setFulfillment({ ...defaultFulfillmentPlanner(), ...p.fulfillmentPlanner, timeline: { ...defaultFulfillmentPlanner().timeline, ...(p.fulfillmentPlanner?.timeline ?? {}) } });
          if (p.retrospective) setRetrospective({ ...defaultRetrospective(), ...p.retrospective });
        } catch { /* */ }
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  if (!loaded) {
    return (
      <div className="db-screen">
        <div className="db-header-bar"><h1 className="db-page-title">Dashboard</h1></div>
      </div>
    );
  }

  // ===== DERIVED DATA =====

  // Campaign header
  const campaignTitle = bookSetup.campaignTitle || 'Untitled Campaign';
  const launchDate = bookSetup.targetLaunchDate;
  const campaignStatus: CampaignStatus = retrospective.campaignStatus;
  const emailSize = bookSetup.emailListSize ?? 0;
  const emailRate = bookSetup.emailOpenRate ?? 0;

  // Scenario modeler inputs
  const firstPod = printerQuotes.podPrinters.find(p => p.unitCost !== null && p.unitCost > 0);
  const printCost = firstPod?.unitCost ?? 0;
  const bestTier = pricingTiers.tiers.find(t => t.pledgeAmount && t.pledgeAmount > 0);
  const pledgeAmount = bestTier?.pledgeAmount ?? 0;
  const enabledRegions = shippingPlanner.regions.filter(r => r.enabled);
  const avgShippingCost = enabledRegions.reduce((sum, r) => sum + ((r.backerPercent ?? 0) / 100) * (r.costPerCopy ?? 0), 0);
  const failureRate = shippingPlanner.paymentFailureRate;
  const bufferRate = shippingPlanner.bufferPercent / 100;
  const goal = pricingTiers.goal ?? 0;

  // Cost floor
  const conservativeBackers = bookSetup.conservativeEstimate ?? 0;
  const costFloorPerBacker = (1 - TOTAL_FEE - bufferRate) > 0 ? (printCost + avgShippingCost) / (1 - TOTAL_FEE - bufferRate) : 0;
  const costFloor = Math.round(conservativeBackers * costFloorPerBacker * 100) / 100;

  // Backer percent total
  const backerPctTotal = enabledRegions.reduce((s, r) => s + (r.backerPercent ?? 0), 0);

  // ===== COMPLETION PROGRESS =====
  const sections: { label: string; nav: NavItem; complete: boolean; optional?: boolean }[] = [
    { label: 'Book Setup', nav: 'Book Setup', complete: !!(bookSetup.bookTitle && bookSetup.pageCount) },
    { label: 'Printer Quotes', nav: 'Printer Quotes', complete: !!firstPod },
    { label: 'Pricing & Tiers', nav: 'Pricing & Tiers', complete: pricingTiers.tiers.some(t => t.pledgeAmount !== null && t.pledgeAmount > 0) },
    { label: 'Shipping Planner', nav: 'Shipping Planner', complete: enabledRegions.some(r => r.costPerCopy !== null) && Math.abs(backerPctTotal - 100) < 1 },
    { label: 'Scenario Modeler', nav: 'Scenario Modeler', complete: !!(bookSetup.bookTitle && bookSetup.pageCount && firstPod && bestTier && enabledRegions.some(r => r.costPerCopy !== null)) },
    { label: 'Stretch Goals', nav: 'Stretch Goals', complete: stretchGoals.goals.length > 0, optional: true },
    { label: 'Promotional Tools', nav: 'Promotional Tools', complete: promoTools.readinessChecks.filter(r => r.checked).length >= 3 },
    { label: 'Fulfillment Planner', nav: 'Fulfillment Planner', complete: Object.values(fulfillment.timeline).filter(v => !!v).length >= 3 },
  ];
  const completedCount = sections.filter(s => s.complete).length;
  const totalSections = sections.length;
  const completionPct = Math.round((completedCount / totalSections) * 100);

  // ===== CONFIDENCE SCORE =====
  let confidence = 0;
  const scoreBreakdown: { label: string; points: number; earned: boolean }[] = [];

  // 40 pts: cost floor covered
  const costFloorCovered = goal > 0 && costFloor > 0 && goal >= costFloor;
  scoreBreakdown.push({ label: 'Goal covers cost floor', points: 40, earned: costFloorCovered });
  if (costFloorCovered) confidence += 40;

  // 10 pts: email 500+
  const email500 = emailSize >= 500;
  scoreBreakdown.push({ label: 'Email list 500+ subscribers', points: 10, earned: email500 });
  if (email500) confidence += 10;

  // 10 pts: open rate 20%+
  const rate20 = emailRate >= 20;
  scoreBreakdown.push({ label: 'Email open rate 20%+', points: 10, earned: rate20 });
  if (rate20) confidence += 10;

  // 10 pts: all tiers positive margin
  const tiersWithPledge = pricingTiers.tiers.filter(t => t.pledgeAmount && t.pledgeAmount > 0);
  const allTiersPositive = tiersWithPledge.length > 0 && tiersWithPledge.every(t => {
    const printer = printerQuotes.podPrinters.find(p => p.id === t.printerId);
    const pCost = printer?.unitCost ?? printCost;
    return (t.pledgeAmount! * (1 - TOTAL_FEE) - pCost - avgShippingCost) > 0;
  });
  scoreBreakdown.push({ label: 'All tiers have positive margins', points: 10, earned: allTiersPositive });
  if (allTiersPositive) confidence += 10;

  // 10 pts: shipping buffer set
  const bufferSet = shippingPlanner.bufferPercent > 0;
  scoreBreakdown.push({ label: 'Shipping buffer is set', points: 10, earned: bufferSet });
  if (bufferSet) confidence += 10;

  // 10 pts: at least one stretch goal
  const hasStretch = stretchGoals.goals.length > 0;
  scoreBreakdown.push({ label: 'At least one stretch goal planned', points: 10, earned: hasStretch });
  if (hasStretch) confidence += 10;

  // 10 pts: readiness 50%+
  const readinessChecked = promoTools.readinessChecks.filter(r => r.checked).length;
  const readiness50 = readinessChecked >= 4; // 4 of 8 = 50%
  scoreBreakdown.push({ label: 'Launch readiness 50%+ complete', points: 10, earned: readiness50 });
  if (readiness50) confidence += 10;

  const confidenceColor = confidence <= 40 ? 'red' : confidence <= 70 ? 'orange' : 'green';

  // ===== ACTIVE FLAGS =====
  const flags: { severity: 'red' | 'orange'; message: string; nav: NavItem }[] = [];

  // Red flags
  tiersWithPledge.forEach(t => {
    const printer = printerQuotes.podPrinters.find(p => p.id === t.printerId);
    const pCost = printer?.unitCost ?? printCost;
    const net = (t.pledgeAmount! * (1 - TOTAL_FEE)) - pCost - avgShippingCost;
    if (net < 0) flags.push({ severity: 'red', message: `Tier "${t.name || 'Unnamed'}" loses money (net ${fmtDollar(net)}/backer)`, nav: 'Pricing & Tiers' });
  });
  if (goal > 0 && costFloor > 0 && goal < costFloor) {
    flags.push({ severity: 'red', message: `Campaign goal (${fmtDollar(goal)}) is below cost floor (${fmtDollar(costFloor)})`, nav: 'Pricing & Tiers' });
  }
  if (goal > 0 && goal < 300) {
    flags.push({ severity: 'orange', message: 'Campaign goal is under $300', nav: 'Pricing & Tiers' });
  }

  // Shipping % of raised (expected scenario)
  const expectedBackers = bookSetup.expectedEstimate ?? 0;
  const expectedGross = expectedBackers * pledgeAmount;
  const expectedShipping = expectedBackers * avgShippingCost;
  const shipPct = expectedGross > 0 ? (expectedShipping / expectedGross) * 100 : 0;
  if (shipPct > 40) flags.push({ severity: 'red', message: `Shipping costs are ${shipPct.toFixed(0)}% of projected revenue`, nav: 'Shipping Planner' });
  else if (shipPct > 25) flags.push({ severity: 'orange', message: `Shipping costs are ${shipPct.toFixed(0)}% of projected revenue`, nav: 'Shipping Planner' });

  if (emailSize > 0 && emailSize < 500) flags.push({ severity: 'orange', message: `Email list is only ${emailSize.toLocaleString()} subscribers`, nav: 'Book Setup' });
  if (emailRate > 0 && emailRate < 20) flags.push({ severity: 'orange', message: `Email open rate is ${emailRate}% (below 20% target)`, nav: 'Book Setup' });

  // Thin margins
  tiersWithPledge.forEach(t => {
    const printer = printerQuotes.podPrinters.find(p => p.id === t.printerId);
    const pCost = printer?.unitCost ?? printCost;
    const net = (t.pledgeAmount! * (1 - TOTAL_FEE)) - pCost - avgShippingCost;
    if (net > 0 && net < 2) flags.push({ severity: 'orange', message: `Tier "${t.name || 'Unnamed'}" has thin margin (${fmtDollar(net)}/backer)`, nav: 'Pricing & Tiers' });
  });

  if (backerPctTotal > 0 && Math.abs(backerPctTotal - 100) >= 1) {
    flags.push({ severity: 'orange', message: `Shipping region backer percentages total ${backerPctTotal}% (should be 100%)`, nav: 'Shipping Planner' });
  }

  // ===== SCENARIO SNAPSHOT =====
  const canScenario = firstPod && bestTier && enabledRegions.some(r => r.costPerCopy !== null) && conservativeBackers > 0;
  const scenarioData = canScenario ? [
    { label: 'Conservative', copies: bookSetup.conservativeEstimate ?? 0, accent: '#6b6b73' },
    { label: 'Expected', copies: bookSetup.expectedEstimate ?? 0, accent: '#E8622A' },
    { label: 'Breakout', copies: bookSetup.breakoutEstimate ?? 0, accent: '#1a7d3a' },
  ].map(raw => {
    const backers = raw.copies;
    const gross = backers * pledgeAmount;
    const fees = Math.round(gross * TOTAL_FEE * 100) / 100;
    const afterFees = gross - fees;
    const failures = Math.round(afterFees * (failureRate / 100) * 100) / 100;
    const afterFailures = afterFees - failures;
    const printing = Math.round(backers * printCost * 100) / 100;
    const shipping = Math.round(backers * avgShippingCost * 100) / 100;
    const buffer = Math.round(afterFailures * bufferRate * 100) / 100;
    const net = Math.round((afterFailures - printing - shipping - buffer) * 100) / 100;
    const status = net > 0 ? 'Funds safely' : Math.abs(net) < 50 ? 'Breaks even' : 'At risk';
    return { ...raw, backers, gross, net, status };
  }) : null;

  // ===== NEXT ACTIONS =====
  const actions: { message: string; nav: NavItem }[] = [];
  if (!bookSetup.bookTitle || !bookSetup.pageCount) actions.push({ message: 'Complete your book details in Book Setup', nav: 'Book Setup' });
  if (!firstPod) actions.push({ message: 'Add printer quotes in Printer Quotes', nav: 'Printer Quotes' });
  if (!bestTier) actions.push({ message: 'Set up your reward tiers in Pricing & Tiers', nav: 'Pricing & Tiers' });
  if (tiersWithPledge.some(t => {
    const printer = printerQuotes.podPrinters.find(p => p.id === t.printerId);
    const pCost = printer?.unitCost ?? printCost;
    return (t.pledgeAmount! * (1 - TOTAL_FEE)) - pCost - avgShippingCost < 0;
  })) actions.push({ message: 'Fix negative-margin tiers in Pricing & Tiers', nav: 'Pricing & Tiers' });
  if (goal > 0 && costFloor > 0 && goal < costFloor) actions.push({ message: 'Increase your campaign goal in Pricing & Tiers', nav: 'Pricing & Tiers' });
  if (backerPctTotal > 0 && Math.abs(backerPctTotal - 100) >= 1) actions.push({ message: 'Complete your shipping region breakdown', nav: 'Shipping Planner' });
  if (confidence < 50) actions.push({ message: 'Review your launch readiness checklist', nav: 'Promotional Tools' });

  // Launch date within 30 days
  if (launchDate) {
    const daysUntil = Math.ceil((new Date(launchDate + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 30 && daysUntil > 0 && confidence < 70) {
      actions.push({ message: 'Your launch is soon \u2014 address warnings before going live', nav: 'Promotional Tools' });
    }
  }

  const topActions = actions.slice(0, 5);

  // ===== STATUS BADGE =====
  const statusColors: Record<CampaignStatus, string> = { Planning: '#8c8c94', Live: '#E8622A', Complete: '#34a853' };

  return (
    <div className="db-screen">
      <div className="db-header-bar">
        <h1 className="db-page-title">Dashboard</h1>
      </div>

      <div className="db-scroll">
        {/* 1. CAMPAIGN HEADER */}
        <div className="db-campaign-header">
          <div className="db-campaign-info">
            <h2 className="db-campaign-title">{campaignTitle}</h2>
            <div className="db-campaign-meta">
              <span className="db-launch-date">{launchDate ? formatDate(launchDate) : 'No date set'}</span>
              <span className="db-status-badge" style={{ background: statusColors[campaignStatus] }}>
                {campaignStatus}
              </span>
            </div>
          </div>
          <div className="db-stat-chips">
            {emailSize > 0 && (
              <span className="db-chip">
                <span className="db-chip-num">{emailSize.toLocaleString()}</span> subscribers
              </span>
            )}
            {emailRate > 0 && (
              <span className="db-chip">
                <span className="db-chip-num">{emailRate}%</span> open rate
              </span>
            )}
          </div>
        </div>

        {/* TOP ROW: Confidence + Completion + Flags */}
        <div className="db-top-row">
          {/* 3. CONFIDENCE SCORE */}
          <div className="db-confidence-card">
            <div className="db-conf-label">Confidence Score</div>
            <div className={`db-conf-number ${confidenceColor}`}>{confidence}</div>
            <div className="db-conf-bar">
              <div className={`db-conf-fill ${confidenceColor}`} style={{ width: `${confidence}%` }} />
            </div>
            <div className="db-conf-breakdown">
              {scoreBreakdown.map((item, idx) => (
                <div key={idx} className={`db-conf-item ${item.earned ? 'earned' : 'missed'}`}>
                  <span className="db-conf-dot" />
                  <span>{item.label}</span>
                  <span className="db-conf-pts">{item.earned ? `+${item.points}` : `0/${item.points}`}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. COMPLETION PROGRESS */}
          <div className="db-completion-card">
            <div className="db-comp-top">
              <span className="db-comp-label">Plan Completion</span>
              <span className="db-comp-pct">{completionPct}%</span>
            </div>
            <div className="db-comp-sections">
              {sections.map(s => (
                <button key={s.label} className="db-comp-section" onClick={() => onNavChange(s.nav)}>
                  <span className={`db-comp-dot${s.complete ? ' done' : ''}${s.optional && !s.complete ? ' optional' : ''}`} />
                  <span className={`db-comp-name${s.complete ? ' done' : ''}`}>{s.label}</span>
                  {s.optional && !s.complete && <span className="db-comp-opt">optional</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 4. ACTIVE FLAGS */}
          <div className={`db-flags-card${flags.length > 0 ? ' has-flags' : ''}`}>
            <div className="db-flags-label">Active Flags</div>
            {flags.length === 0 ? (
              <div className="db-flags-clear">
                <span className="db-flags-clear-dot" />
                No critical issues found
              </div>
            ) : (
              <div className="db-flags-list">
                {flags.map((f, idx) => (
                  <button key={idx} className="db-flag-item" onClick={() => onNavChange(f.nav)}>
                    <span className={`db-flag-dot ${f.severity}`} />
                    <span className="db-flag-msg">{f.message}</span>
                    <span className="db-flag-arrow">&rsaquo;</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM ROW: Scenarios + Next Actions */}
        <div className="db-bottom-row">
          {/* 5. SCENARIO SNAPSHOT */}
          <div className="db-scenarios-card">
            <div className="db-scenarios-label">Scenario Snapshot</div>
            {scenarioData ? (
              <div className="db-scenarios-grid">
                {scenarioData.map(s => (
                  <div key={s.label} className="db-scenario-item" style={{ borderTopColor: s.accent }}>
                    <div className="db-scenario-name" style={{ color: s.accent }}>{s.label}</div>
                    <div className="db-scenario-row">
                      <span className="db-scenario-key">Backers</span>
                      <span className="db-scenario-val">{s.backers.toLocaleString()}</span>
                    </div>
                    <div className="db-scenario-row">
                      <span className="db-scenario-key">Raised</span>
                      <span className="db-scenario-val">{fmtDollar(s.gross)}</span>
                    </div>
                    <div className="db-scenario-row">
                      <span className="db-scenario-key">Net</span>
                      <span className={`db-scenario-val ${s.net >= 0 ? 'good' : 'bad'}`}>{fmtDollar(s.net)}</span>
                    </div>
                    <div className={`db-scenario-status ${s.status === 'Funds safely' ? 'good' : s.status === 'At risk' ? 'bad' : 'neutral'}`}>
                      {s.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="db-scenarios-empty">
                Complete Book Setup, Printer Quotes, Pricing &amp; Tiers, and Shipping Planner to see scenario projections.
              </div>
            )}
          </div>

          {/* 6. NEXT ACTIONS */}
          <div className="db-actions-card">
            <div className="db-actions-label">Next Actions</div>
            {topActions.length === 0 ? (
              <div className="db-actions-empty">
                Your campaign plan is looking great. No urgent actions needed.
              </div>
            ) : (
              <div className="db-actions-list">
                {topActions.map((a, idx) => (
                  <button key={idx} className="db-action-item" onClick={() => onNavChange(a.nav)}>
                    <span className="db-action-num">{idx + 1}</span>
                    <span className="db-action-msg">{a.message}</span>
                    <span className="db-action-arrow">&rsaquo;</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
