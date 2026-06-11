import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { NavItem } from '../app';
import type {
  CampaignData,
  BookSetupData,
  PrinterQuotesData,
  PricingTiersData,
  ShippingPlannerData,
  ScenarioModelerData,
  RewardTier,
} from '../../types/campaign';
import {
  DEFAULT_BOOK_SETUP,
  totalFeeRate,
  defaultPrinterQuotes,
  defaultPricingTiers,
  defaultShippingPlanner,
  defaultScenarioModeler,
} from '../../types/campaign';

interface ScenarioModelerProps {
  campaignId: number;
  onNavChange: (item: NavItem) => void;
}

const ScenarioModeler: React.FC<ScenarioModelerProps> = ({ campaignId, onNavChange }) => {
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [printerQuotes, setPrinterQuotes] = useState<PrinterQuotesData>(defaultPrinterQuotes);
  const [pricingTiers, setPricingTiers] = useState<PricingTiersData>(defaultPricingTiers);
  const [shippingPlanner, setShippingPlanner] = useState<ShippingPlannerData>(defaultShippingPlanner);
  const [scenarioModeler, setScenarioModeler] = useState<ScenarioModelerData>(defaultScenarioModeler);
  const [loaded, setLoaded] = useState(false);

  const [backerShortfall, setBackerShortfall] = useState(0);
  const [shippingOverrun, setShippingOverrun] = useState(0);
  const [stressFailureRate, setStressFailureRate] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

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
          if (p.scenarioModeler) setScenarioModeler({ ...defaultScenarioModeler(), ...p.scenarioModeler });
        } catch { /* */ }
      }
      setLoaded(true);
      setTimeout(() => { isInitialLoad.current = false; }, 50);
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  // Autosave scenarioModeler data
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      let existing: CampaignData = {};
      try {
        const c = await window.kickflip.loadCampaign(campaignId);
        if (c && c.data) existing = JSON.parse(c.data);
      } catch { /* */ }
      existing.scenarioModeler = scenarioModeler;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [scenarioModeler, campaignId]);

  // KF-010: Weight edit handlers — hooks must run before any early returns
  const updateWeight = useCallback((tierId: string, value: number) => {
    setScenarioModeler(prev => ({
      ...prev,
      tierWeights: { ...prev.tierWeights, [tierId]: value },
    }));
  }, []);

  const resetWeights = useCallback(() => {
    setScenarioModeler(prev => ({ ...prev, tierWeights: {} }));
  }, []);

  // Missing data checks
  const missingScreens: { label: string; nav: NavItem }[] = [];
  const hasEstimates = bookSetup.conservativeEstimate !== null;
  const firstPod = printerQuotes.podPrinters.find(p => p.unitCost !== null && p.unitCost > 0);
  const hasTier = pricingTiers.tiers.some(t => t.pledgeAmount !== null && t.pledgeAmount > 0);
  const hasRegions = shippingPlanner.regions.some(r => r.enabled && r.costPerCopy !== null);
  if (!hasEstimates) missingScreens.push({ label: 'Project Setup', nav: 'Project Setup' });
  if (!firstPod) missingScreens.push({ label: 'Unit Costs', nav: 'Unit Costs' });
  if (!hasTier) missingScreens.push({ label: 'Pricing & Tiers', nav: 'Pricing & Tiers' });
  if (!hasRegions) missingScreens.push({ label: 'Shipping', nav: 'Shipping' });

  if (loaded && missingScreens.length > 0) {
    return (
      <div className="sm-screen">
        <div className="sm-header"><h1 className="sm-title">Scenarios</h1></div>
        <div className="form-scroll">
          <div className="sm-missing">
            <p>Complete these screens first to unlock Scenarios:</p>
            <ul>
              {missingScreens.map(s => (
                <li key={s.nav}>
                  <button className="sm-missing-link" onClick={() => onNavChange(s.nav)}>{s.label}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return <div className="sm-screen"><div className="sm-header"><h1 className="sm-title">Scenarios</h1></div></div>;
  }

  // Derived data
  const TOTAL_FEE = totalFeeRate(bookSetup);
  const feePctLabel = `${(TOTAL_FEE * 100).toFixed(TOTAL_FEE * 100 % 1 === 0 ? 0 : 1)}%`;
  const enabledRegions = shippingPlanner.regions.filter(r => r.enabled);
  const avgShippingCost = enabledRegions.reduce((sum, r) => {
    const pct = (r.backerPercent ?? 0) / 100;
    const cost = r.costPerCopy ?? 0;
    return sum + pct * cost;
  }, 0);

  const failureRate = stressFailureRate !== null ? stressFailureRate : shippingPlanner.paymentFailureRate;
  const bufferRate = shippingPlanner.bufferPercent / 100;

  // KF-010: Get active tiers with pledge amounts
  const activeTiers = pricingTiers.tiers.filter(t => t.pledgeAmount !== null && t.pledgeAmount > 0);

  // KF-010: Compute effective weights (user-set or equal distribution)
  const weights = computeTierWeights(activeTiers, scenarioModeler.tierWeights);
  const weightTotal = Object.values(weights).reduce((s, w) => s + w, 0);

  // KF-010: Weighted avg pledge and print cost
  const { weightedAvgPledge, weightedAvgPrintCost, weightedAvgShipping } = computeWeightedAverages(
    activeTiers, weights, weightTotal, printerQuotes, avgShippingCost
  );

  const pledgeAmount = weightedAvgPledge;
  const printCost = weightedAvgPrintCost;
  const weightedShipping = weightedAvgShipping;

  // Build scenarios
  const rawScenarios = [
    { label: 'Conservative', copies: bookSetup.conservativeEstimate ?? 0, accent: '#6b6b73' },
    { label: 'Expected', copies: bookSetup.expectedEstimate ?? 0, accent: '#E8622A' },
    { label: 'Breakout', copies: bookSetup.breakoutEstimate ?? 0, accent: '#1a7d3a' },
  ];

  const scenarios = rawScenarios.map(raw => {
    const backers = Math.round(raw.copies * (1 - backerShortfall / 100));
    const gross = backers * pledgeAmount;
    const fees = Math.round(gross * TOTAL_FEE * 100) / 100;
    const afterFees = gross - fees;
    const failures = Math.round(afterFees * (failureRate / 100) * 100) / 100;
    const afterFailures = afterFees - failures;
    const printing = Math.round(backers * printCost * 100) / 100;
    const shipping = Math.round(backers * weightedShipping * (1 + shippingOverrun / 100) * 100) / 100;
    const buffer = Math.round(afterFailures * bufferRate * 100) / 100;
    const net = Math.round((afterFailures - printing - shipping - buffer) * 100) / 100;

    const pctFees = gross > 0 ? (fees / gross) * 100 : 0;
    const pctFailures = gross > 0 ? (failures / gross) * 100 : 0;
    const pctPrinting = gross > 0 ? (printing / gross) * 100 : 0;
    const pctShipping = gross > 0 ? (shipping / gross) * 100 : 0;
    const pctBuffer = gross > 0 ? (buffer / gross) * 100 : 0;
    const pctNet = gross > 0 ? Math.max(0, (net / gross) * 100) : 0;

    // KF-010: Per-tier breakdown
    const tierBreakdown = activeTiers.map(t => {
      const tierWeight = (weights[t.id] ?? 0) / 100;
      const tierBackers = Math.round(backers * tierWeight);
      const tierRevenue = tierBackers * (t.pledgeAmount ?? 0);
      return { name: t.name || `$${t.pledgeAmount}`, backers: tierBackers, revenue: tierRevenue };
    });

    return {
      ...raw, backers, gross, fees, afterFees, failures, afterFailures,
      printing, shipping, buffer, net,
      pctFees, pctFailures, pctPrinting, pctShipping, pctBuffer, pctNet,
      tierBreakdown,
    };
  });

  const stressSummary = scenarios.map(s => {
    if (s.net > 0) return 'funds safely';
    if (Math.abs(s.net) < 50) return 'breaks even';
    return 'loses money';
  });

  const resetStress = () => {
    setBackerShortfall(0);
    setShippingOverrun(0);
    setStressFailureRate(null);
  };

  const isStressed = backerShortfall !== 0 || shippingOverrun !== 0 || stressFailureRate !== null;

  const hasCustomWeights = activeTiers.some(t => scenarioModeler.tierWeights[t.id] !== undefined);

  return (
    <div className="sm-screen">
      <div className="sm-header">
        <h1 className="sm-title">Scenarios</h1>
      </div>

      <div className="form-scroll">
        {/* 1. SCENARIO CARDS */}
        <section className="sm-cards">
          {scenarios.map(sc => (
            <div className="sm-card" key={sc.label}>
              <div className="sm-card-label" style={{ borderBottomColor: sc.accent }}>{sc.label}</div>
              <div className="sm-card-backers">{sc.backers.toLocaleString()} backers</div>

              <div className="sm-card-rows">
                <Row label="Gross raised" value={sc.gross} />
                <Row label={`KS + processing (${feePctLabel})`} value={-sc.fees} muted />
                <Row label={`Payment failures (${failureRate}%)`} value={-sc.failures} muted />
                <Row label="Printing costs" value={-sc.printing} muted />
                <Row label="Shipping costs" value={-sc.shipping} muted />
                <Row label={`Buffer reserve (${shippingPlanner.bufferPercent}%)`} value={-sc.buffer} muted />
                <div className="sm-card-divider" />
                <div className={`sm-card-net ${sc.net >= 0 ? 'positive' : 'negative'}`}>
                  <span>Final net</span>
                  <span>${sc.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {sc.gross > 0 && (
                <div className="sm-bar">
                  <div className="sm-bar-seg sm-bar-fees" style={{ width: `${sc.pctFees + sc.pctFailures}%` }} title={`Fees & failures: ${(sc.pctFees + sc.pctFailures).toFixed(1)}%`} />
                  <div className="sm-bar-seg sm-bar-print" style={{ width: `${sc.pctPrinting}%` }} title={`Printing: ${sc.pctPrinting.toFixed(1)}%`} />
                  <div className="sm-bar-seg sm-bar-ship" style={{ width: `${sc.pctShipping}%` }} title={`Shipping: ${sc.pctShipping.toFixed(1)}%`} />
                  <div className="sm-bar-seg sm-bar-buffer" style={{ width: `${sc.pctBuffer}%` }} title={`Buffer: ${sc.pctBuffer.toFixed(1)}%`} />
                  <div className="sm-bar-seg sm-bar-net" style={{ width: `${sc.pctNet}%` }} title={`Net: ${sc.pctNet.toFixed(1)}%`} />
                </div>
              )}
              {sc.gross > 0 && (
                <div className="sm-bar-legend">
                  <span><i className="sm-dot sm-bar-fees" />Fees</span>
                  <span><i className="sm-dot sm-bar-print" />Print</span>
                  <span><i className="sm-dot sm-bar-ship" />Ship</span>
                  <span><i className="sm-dot sm-bar-buffer" />Buffer</span>
                  <span><i className="sm-dot sm-bar-net" />Net</span>
                </div>
              )}

              {/* KF-010: Per-tier breakdown */}
              {activeTiers.length > 1 && sc.tierBreakdown.length > 0 && (
                <div className="sm-tier-breakdown">
                  <div className="sm-tier-breakdown-title">Tier breakdown</div>
                  {sc.tierBreakdown.map((tb, i) => (
                    <div key={i} className="sm-tier-breakdown-row">
                      <span className="sm-tier-breakdown-name">{tb.name}</span>
                      <span className="sm-tier-breakdown-stat">~{tb.backers.toLocaleString()} backers</span>
                      <span className="sm-tier-breakdown-stat">${tb.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* KF-010: TIER DISTRIBUTION */}
        {activeTiers.length > 1 && (
          <section className="form-section">
            <h2 className="form-section-label">Tier Distribution</h2>
            <p className="form-helper" style={{ marginBottom: 12 }}>
              Set the expected percentage of backers for each tier. This shapes the weighted averages used above.
              {!hasCustomWeights && ' Currently using equal distribution — customize below if you have prior campaign data.'}
            </p>

            <div className="sm-tier-weights">
              {activeTiers.map(t => {
                const w = weights[t.id] ?? 0;
                return (
                  <div key={t.id} className="sm-tier-weight-row">
                    <span className="sm-tier-weight-name">{t.name || `$${t.pledgeAmount} tier`}</span>
                    <input
                      type="number"
                      className="form-input sm-tier-weight-input"
                      value={scenarioModeler.tierWeights[t.id] ?? ''}
                      placeholder={String(Math.round(100 / activeTiers.length))}
                      min={0}
                      max={100}
                      step={1}
                      onChange={e => updateWeight(t.id, e.target.value === '' ? 0 : Number(e.target.value))}
                    />
                    <span className="sm-tier-weight-pct">%</span>
                    <span className="sm-tier-weight-effective">effective: {w.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>

            {hasCustomWeights && (
              <div className="sm-tier-weights-footer">
                <span className={`sm-tier-weights-total ${Math.abs(weightTotal - 100) > 1 ? 'warn' : 'ok'}`}>
                  Total: {weightTotal.toFixed(1)}%
                  {Math.abs(weightTotal - 100) > 1 && ' — must sum to 100%'}
                </span>
                <button className="sm-reset-btn" style={{ marginLeft: 12 }} onClick={resetWeights}>Reset to equal</button>
              </div>
            )}
          </section>
        )}

        {/* 2. STRESS TEST */}
        <section className="sm-stress">
          <h2 className="form-section-label">Stress Test Your Plan</h2>

          <div className="sm-slider-row">
            <label className="sm-slider-label">
              Backer shortfall
              <span className="sm-slider-val">{backerShortfall > 0 ? `−${backerShortfall}%` : '0%'}</span>
            </label>
            <input
              type="range" min={0} max={40} step={1}
              value={backerShortfall}
              onChange={e => setBackerShortfall(Number(e.target.value))}
              className="sm-range"
            />
          </div>

          <div className="sm-slider-row">
            <label className="sm-slider-label">
              Shipping cost overrun
              <span className="sm-slider-val">{shippingOverrun > 0 ? `+${shippingOverrun}%` : '0%'}</span>
            </label>
            <input
              type="range" min={0} max={50} step={1}
              value={shippingOverrun}
              onChange={e => setShippingOverrun(Number(e.target.value))}
              className="sm-range"
            />
          </div>

          <div className="sm-slider-row">
            <label className="sm-slider-label">
              Payment failure rate
              <span className="sm-slider-val">{failureRate}%</span>
            </label>
            <input
              type="range" min={0} max={15} step={0.5}
              value={failureRate}
              onChange={e => setStressFailureRate(Number(e.target.value))}
              className="sm-range"
            />
          </div>

          <div className="sm-stress-footer">
            <p className="sm-stress-summary">
              Under these conditions:
              {scenarios.map((s, i) => (
                <span key={s.label}>
                  {i > 0 && ', '}
                  <strong>{s.label}</strong>{' '}
                  <span className={stressSummary[i] === 'loses money' ? 'sm-stress-bad' : stressSummary[i] === 'funds safely' ? 'sm-stress-good' : ''}>
                    {stressSummary[i]}
                  </span>
                </span>
              ))}
            </p>
            {isStressed && (
              <button className="sm-reset-btn" onClick={resetStress}>Reset</button>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};

/* ---- Helpers ---- */

function computeTierWeights(
  tiers: RewardTier[],
  stored: Record<string, number>
): Record<string, number> {
  if (tiers.length === 0) return {};
  const hasAny = tiers.some(t => stored[t.id] !== undefined);
  if (!hasAny) {
    const equal = 100 / tiers.length;
    return Object.fromEntries(tiers.map(t => [t.id, equal]));
  }
  // Fill in missing tiers with 0 and normalize
  const rawWeights = Object.fromEntries(tiers.map(t => [t.id, stored[t.id] ?? 0]));
  const total = Object.values(rawWeights).reduce((s, w) => s + w, 0);
  if (total <= 0) {
    const equal = 100 / tiers.length;
    return Object.fromEntries(tiers.map(t => [t.id, equal]));
  }
  return Object.fromEntries(
    Object.entries(rawWeights).map(([id, w]) => [id, (w / total) * 100])
  );
}

function computeWeightedAverages(
  tiers: RewardTier[],
  weights: Record<string, number>,
  weightTotal: number,
  printerQuotes: PrinterQuotesData,
  avgShippingCost: number
) {
  if (tiers.length === 0 || weightTotal <= 0) {
    return { weightedAvgPledge: 0, weightedAvgPrintCost: 0, weightedAvgShipping: avgShippingCost };
  }

  let weightedAvgPledge = 0;
  let weightedAvgPrintCost = 0;
  let weightedAvgShipping = 0;

  for (const t of tiers) {
    const w = (weights[t.id] ?? 0) / 100;
    const pledge = t.pledgeAmount ?? 0;
    const isDigital = t.isDigitalOnly ?? false;
    const printer = isDigital ? null : printerQuotes.podPrinters.find(p => p.id === t.printerId);
    const pCost = isDigital ? 0 : (printer?.unitCost ?? 0);
    const shipCost = isDigital ? 0 : avgShippingCost;

    weightedAvgPledge += pledge * w;
    weightedAvgPrintCost += pCost * w;
    weightedAvgShipping += shipCost * w;
  }

  return { weightedAvgPledge, weightedAvgPrintCost, weightedAvgShipping };
}

const Row: React.FC<{ label: string; value: number; muted?: boolean }> = ({ label, value, muted }) => (
  <div className={`sm-card-row ${muted ? 'muted' : ''}`}>
    <span>{label}</span>
    <span>
      {value < 0 ? '−' : ''}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  </div>
);

export default ScenarioModeler;
