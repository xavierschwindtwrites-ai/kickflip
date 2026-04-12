import React, { useState, useEffect, useRef } from 'react';
import type { NavItem } from '../app';
import type {
  CampaignData,
  BookSetupData,
  PrinterQuotesData,
  PricingTiersData,
  ShippingPlannerData,
  PodPrinter,
  ShippingRegion,
} from '../../types/campaign';
import {
  DEFAULT_BOOK_SETUP,
  defaultPrinterQuotes,
  defaultPricingTiers,
  defaultShippingPlanner,
} from '../../types/campaign';

const TOTAL_FEE = 0.08;

interface ScenarioModelerProps {
  campaignId: number;
  onNavChange: (item: NavItem) => void;
}

const ScenarioModeler: React.FC<ScenarioModelerProps> = ({ campaignId, onNavChange }) => {
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [printerQuotes, setPrinterQuotes] = useState<PrinterQuotesData>(defaultPrinterQuotes);
  const [pricingTiers, setPricingTiers] = useState<PricingTiersData>(defaultPricingTiers);
  const [shippingPlanner, setShippingPlanner] = useState<ShippingPlannerData>(defaultShippingPlanner);
  const [loaded, setLoaded] = useState(false);

  // Stress test state
  const [backerShortfall, setBackerShortfall] = useState(0);
  const [shippingOverrun, setShippingOverrun] = useState(0);
  const [stressFailureRate, setStressFailureRate] = useState<number | null>(null); // null = use shipping planner value

  // Reverse pricing state
  const [targetNet, setTargetNet] = useState<number | null>(null);
  const [reversePrinterId, setReversePrinterId] = useState('');
  const [reverseRegionId, setReverseRegionId] = useState('');

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
        } catch { /* */ }
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  // --- Missing data checks ---
  const missingScreens: { label: string; nav: NavItem }[] = [];
  const hasEstimates = bookSetup.conservativeEstimate !== null;
  const firstPod = printerQuotes.podPrinters.find(p => p.unitCost !== null && p.unitCost > 0);
  const hasTier = pricingTiers.tiers.some(t => t.pledgeAmount !== null && t.pledgeAmount > 0);
  const hasRegions = shippingPlanner.regions.some(r => r.enabled && r.costPerCopy !== null);
  if (!hasEstimates) missingScreens.push({ label: 'Book Setup', nav: 'Book Setup' });
  if (!firstPod) missingScreens.push({ label: 'Printer Quotes', nav: 'Printer Quotes' });
  if (!hasTier) missingScreens.push({ label: 'Pricing & Tiers', nav: 'Pricing & Tiers' });
  if (!hasRegions) missingScreens.push({ label: 'Shipping Planner', nav: 'Shipping Planner' });

  if (loaded && missingScreens.length > 0) {
    return (
      <div className="sm-screen">
        <div className="sm-header"><h1 className="sm-title">Scenario Modeler</h1></div>
        <div className="form-scroll">
          <div className="sm-missing">
            <p>Complete the following screens first to unlock the Scenario Modeler:</p>
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
    return <div className="sm-screen"><div className="sm-header"><h1 className="sm-title">Scenario Modeler</h1></div></div>;
  }

  // --- Derived data ---
  const podPrinters = printerQuotes.podPrinters.filter(p => p.unitCost !== null && p.unitCost > 0);
  const primaryPod = firstPod!;
  const printCost = primaryPod.unitCost!;

  // Best tier
  const bestTier = pricingTiers.tiers.find(t => {
    if (!t.pledgeAmount || t.pledgeAmount <= 0) return false;
    const net = t.pledgeAmount * (1 - TOTAL_FEE) - printCost;
    return net > 0;
  }) || pricingTiers.tiers.find(t => t.pledgeAmount !== null && t.pledgeAmount > 0);
  const pledgeAmount = bestTier?.pledgeAmount ?? 0;

  // Enabled regions
  const enabledRegions = shippingPlanner.regions.filter(r => r.enabled);

  // Weighted avg shipping cost
  const avgShippingCost = enabledRegions.reduce((sum, r) => {
    const pct = (r.backerPercent ?? 0) / 100;
    const cost = r.costPerCopy ?? 0;
    return sum + pct * cost;
  }, 0);

  // Active failure rate (stress or shipping planner)
  const failureRate = stressFailureRate !== null ? stressFailureRate : shippingPlanner.paymentFailureRate;
  const bufferRate = shippingPlanner.bufferPercent / 100;

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
    const shipping = Math.round(backers * avgShippingCost * (1 + shippingOverrun / 100) * 100) / 100;
    const buffer = Math.round(afterFailures * bufferRate * 100) / 100;
    const net = Math.round((afterFailures - printing - shipping - buffer) * 100) / 100;

    // Bar segments (as % of gross)
    const pctFees = gross > 0 ? (fees / gross) * 100 : 0;
    const pctFailures = gross > 0 ? (failures / gross) * 100 : 0;
    const pctPrinting = gross > 0 ? (printing / gross) * 100 : 0;
    const pctShipping = gross > 0 ? (shipping / gross) * 100 : 0;
    const pctBuffer = gross > 0 ? (buffer / gross) * 100 : 0;
    const pctNet = gross > 0 ? Math.max(0, (net / gross) * 100) : 0;

    return {
      ...raw, backers, gross, fees, afterFees, failures, afterFailures,
      printing, shipping, buffer, net,
      pctFees, pctFailures, pctPrinting, pctShipping, pctBuffer, pctNet,
    };
  });

  // Stress summary
  const stressSummary = scenarios.map(s => {
    if (s.net > 0) return 'funds safely';
    if (Math.abs(s.net) < 50) return 'breaks even';
    return 'loses money';
  });

  // Reset stress
  const resetStress = () => {
    setBackerShortfall(0);
    setShippingOverrun(0);
    setStressFailureRate(null);
  };

  const isStressed = backerShortfall !== 0 || shippingOverrun !== 0 || stressFailureRate !== null;

  // --- Reverse pricing engine ---
  const reversePrinter = podPrinters.find(p => p.id === reversePrinterId) || primaryPod;
  const reverseRegion = enabledRegions.find(r => r.id === reverseRegionId) || enabledRegions[0];
  const revPrintCost = reversePrinter?.unitCost ?? 0;
  const revShipCost = reverseRegion?.costPerCopy ?? 0;
  const revTarget = targetNet ?? 0;
  const minPledge = revTarget > 0 ? Math.ceil(((revTarget + revPrintCost + revShipCost) / (1 - TOTAL_FEE)) * 100) / 100 : null;

  // --- Cost floor ---
  const conservativeBackers = bookSetup.conservativeEstimate ?? 0;
  const costFloorDenom = 1 - TOTAL_FEE - bufferRate;
  const costFloorPerBacker = costFloorDenom > 0 ? (printCost + avgShippingCost) / costFloorDenom : 0;
  const costFloor = Math.round(conservativeBackers * costFloorPerBacker * 100) / 100;
  const goal = pricingTiers.goal ?? 0;

  // --- Crossover ---
  const firstOffset = printerQuotes.offsetPrinters.find(o => o.volumeRows.some(r => r.quantity && r.unitCost));
  let crossoverCopies: number | null = null;
  if (firstPod && firstOffset) {
    const lowestRow = firstOffset.volumeRows
      .filter(r => r.quantity && r.unitCost)
      .sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0))[0];
    if (lowestRow && lowestRow.unitCost !== null && lowestRow.quantity !== null && printCost > lowestRow.unitCost) {
      const offsetTotal = lowestRow.totalCost ?? (lowestRow.quantity * lowestRow.unitCost);
      crossoverCopies = Math.ceil(offsetTotal / (printCost - lowestRow.unitCost));
    }
  }

  const printerLabel = (p: PodPrinter) =>
    p.printerName === 'Other' ? (p.customName || 'Other') : (p.printerName || 'Unnamed');

  return (
    <div className="sm-screen">
      <div className="sm-header">
        <h1 className="sm-title">Scenario Modeler</h1>
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
                <Row label="KS + processing (8%)" value={-sc.fees} muted />
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

              {/* Cost bar */}
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
            </div>
          ))}
        </section>

        {/* 2. STRESS TEST */}
        <section className="sm-stress">
          <h2 className="form-section-label">Stress Test Your Plan</h2>

          <div className="sm-slider-row">
            <label className="sm-slider-label">
              Backer shortfall
              <span className="sm-slider-val">{backerShortfall > 0 ? `\u2212${backerShortfall}%` : '0%'}</span>
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

        {/* 3. REVERSE PRICING ENGINE */}
        <section className="form-section">
          <h2 className="form-section-label">What Do I Need to Charge?</h2>

          <div className="printer-card-costs" style={{ maxWidth: 640 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Target net per backer ($)</label>
              <input
                type="number"
                className="form-input"
                value={targetNet ?? ''}
                onChange={e => setTargetNet(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="5.00"
                min={0}
                step={0.5}
              />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Printer</label>
              <select
                className="form-input form-select"
                value={reversePrinterId || primaryPod.id}
                onChange={e => setReversePrinterId(e.target.value)}
              >
                {podPrinters.map(p => <option key={p.id} value={p.id}>{printerLabel(p)}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Shipping region</label>
              <select
                className="form-input form-select"
                value={reverseRegionId || enabledRegions[0]?.id || ''}
                onChange={e => setReverseRegionId(e.target.value)}
              >
                {enabledRegions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          {minPledge !== null && revTarget > 0 && (
            <div className="sm-reverse-result">
              <div className="sm-reverse-answer">
                You need to charge at least <strong>${minPledge.toFixed(2)}</strong>
              </div>
              <div className="pt-margin" style={{ marginTop: 10 }}>
                <div className="pt-margin-row">
                  <span>Target net per backer</span>
                  <span>${revTarget.toFixed(2)}</span>
                </div>
                <div className="pt-margin-row pt-margin-deduct">
                  <span>Print cost ({printerLabel(reversePrinter)})</span>
                  <span>+ ${revPrintCost.toFixed(2)}</span>
                </div>
                <div className="pt-margin-row pt-margin-deduct">
                  <span>Shipping ({reverseRegion?.name})</span>
                  <span>+ ${revShipCost.toFixed(2)}</span>
                </div>
                <div className="pt-margin-row pt-margin-deduct">
                  <span>Subtotal before fees</span>
                  <span>${(revTarget + revPrintCost + revShipCost).toFixed(2)}</span>
                </div>
                <div className="pt-margin-divider" />
                <div className="pt-margin-row pt-margin-deduct">
                  <span>Divided by (1 &minus; 8% fees)</span>
                  <span>&divide; {(1 - TOTAL_FEE).toFixed(2)}</span>
                </div>
                <div className="pt-margin-divider" />
                <div className="pt-margin-row pt-margin-total positive">
                  <span>Minimum pledge</span>
                  <span>${minPledge.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 4. COST FLOOR */}
        <section className="form-section">
          <h2 className="form-section-label">Your Cost Floor</h2>
          <div className="sm-floor-box">
            <p>
              Your cost floor is approximately <strong>${costFloor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> —
              this is the minimum raise where you break even on a conservative scenario
              ({conservativeBackers} backers) with your current shipping plan.
            </p>
            {goal > 0 && goal < costFloor && (
              <p className="sm-floor-warn">
                Your goal (${goal.toLocaleString()}) is below your cost floor.
                You could fund and still lose money.
              </p>
            )}
            {goal > 0 && goal >= costFloor && (
              <p className="sm-floor-ok">
                Your goal (${goal.toLocaleString()}) covers your cost floor with
                ${(goal - costFloor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to spare.
              </p>
            )}
          </div>
        </section>

        {/* 5. POD VS OFFSET */}
        <section className="form-section" style={{ maxWidth: 'none' }}>
          <h2 className="form-section-label">POD vs Offset Decision</h2>

          {!firstOffset ? (
            <div className="sp-crossover-box" style={{ marginTop: 0 }}>
              <p>Add offset printer quotes on the Printer Quotes screen to see a comparison.</p>
            </div>
          ) : (
            <>
              <table className="sm-offset-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Copies</th>
                    <th>POD total</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map(sc => {
                    const podTotal = sc.backers * printCost;
                    const recommend = crossoverCopies !== null && sc.backers >= crossoverCopies;
                    return (
                      <tr key={sc.label}>
                        <td className="sp-exposure-name">{sc.label}</td>
                        <td className="sp-exposure-num">{sc.backers.toLocaleString()}</td>
                        <td className="sp-exposure-num">${podTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          <span className={`sm-offset-tag ${recommend ? 'offset' : 'pod'}`}>
                            {recommend ? 'Consider offset' : 'POD recommended'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {crossoverCopies !== null && (
                <p className="form-helper" style={{ marginTop: 10 }}>
                  Crossover point: offset becomes cheaper at ~{crossoverCopies.toLocaleString()} copies.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

/* ---- Sub-components ---- */

const Row: React.FC<{ label: string; value: number; muted?: boolean }> = ({ label, value, muted }) => (
  <div className={`sm-card-row ${muted ? 'muted' : ''}`}>
    <span>{label}</span>
    <span>
      {value < 0 ? '\u2212' : ''}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  </div>
);

export default ScenarioModeler;
