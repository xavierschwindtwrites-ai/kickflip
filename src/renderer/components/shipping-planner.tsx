import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CampaignData,
  ShippingPlannerData,
  ShippingRegion,
  BookSetupData,
  PrinterQuotesData,
  PricingTiersData,
  Currency,
} from '../../types/campaign';
import {
  defaultShippingPlanner,
  DEFAULT_BOOK_SETUP,
  defaultPrinterQuotes,
  defaultPricingTiers,
} from '../../types/campaign';

const TOTAL_FEE = 0.08;

interface ShippingPlannerProps {
  campaignId: number;
}

const ShippingPlanner: React.FC<ShippingPlannerProps> = ({ campaignId }) => {
  const [form, setForm] = useState<ShippingPlannerData>(defaultShippingPlanner);
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [printerQuotes, setPrinterQuotes] = useState<PrinterQuotesData>(defaultPrinterQuotes);
  const [pricingTiers, setPricingTiers] = useState<PricingTiersData>(defaultPricingTiers);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  // Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaign = await window.kickflip.loadCampaign(campaignId);
      if (cancelled) return;
      if (campaign && campaign.data) {
        try {
          const parsed: CampaignData = JSON.parse(campaign.data);
          if (parsed.shippingPlanner) {
            setForm(prev => ({ ...prev, ...parsed.shippingPlanner }));
          }
          if (parsed.bookSetup) setBookSetup({ ...DEFAULT_BOOK_SETUP, ...parsed.bookSetup });
          if (parsed.printerQuotes) setPrinterQuotes(parsed.printerQuotes);
          if (parsed.pricingTiers) setPricingTiers(parsed.pricingTiers);
        } catch { /* defaults */ }
      }
      setTimeout(() => { isInitialLoad.current = false; }, 50);
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  // Autosave
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (fadeRef.current) clearTimeout(fadeRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      let existing: CampaignData = {};
      try {
        const c = await window.kickflip.loadCampaign(campaignId);
        if (c && c.data) existing = JSON.parse(c.data);
      } catch { /* */ }
      existing.shippingPlanner = form;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  // Region helpers
  const updateRegion = useCallback((id: string, patch: Partial<ShippingRegion>) => {
    setForm(prev => ({
      ...prev,
      regions: prev.regions.map(r => r.id === id ? { ...r, ...patch } : r),
    }));
  }, []);

  const setRate = useCallback((cur: string, val: number | null) => {
    setForm(prev => ({ ...prev, currencyRates: { ...prev.currencyRates, [cur]: val } }));
  }, []);

  // --- Derived data ---

  // Non-USD currencies used in printer quotes
  const nonUsdCurrencies: Currency[] = [];
  const seen = new Set<Currency>();
  for (const p of printerQuotes.podPrinters) {
    if (p.currency !== 'USD' && !seen.has(p.currency)) { seen.add(p.currency); nonUsdCurrencies.push(p.currency); }
  }
  for (const o of printerQuotes.offsetPrinters) {
    if (o.currency !== 'USD' && !seen.has(o.currency)) { seen.add(o.currency); nonUsdCurrencies.push(o.currency); }
  }

  // Enabled regions
  const enabledRegions = form.regions.filter(r => r.enabled);
  const regionPercentSum = enabledRegions.reduce((s, r) => s + (r.backerPercent ?? 0), 0);

  // Scenarios
  const scenarios = [
    { label: 'Conservative', copies: bookSetup.conservativeEstimate },
    { label: 'Expected', copies: bookSetup.expectedEstimate },
    { label: 'Breakout', copies: bookSetup.breakoutEstimate },
  ];

  // Average pledge from first tier with a pledge
  const firstTierPledge = pricingTiers.tiers.find(t => t.pledgeAmount && t.pledgeAmount > 0)?.pledgeAmount ?? 0;

  // Scenario financials
  const scenarioData = scenarios.map(s => {
    const copies = s.copies ?? 0;
    const totalRaised = copies * firstTierPledge;
    const afterFailure = totalRaised * (1 - form.paymentFailureRate / 100);
    const bufferAmount = afterFailure * (form.bufferPercent / 100);
    const available = afterFailure - bufferAmount;
    return { ...s, copies, totalRaised, afterFailure, bufferAmount, available };
  });

  // Shipping exposure per region per scenario
  const exposureRows = enabledRegions.map(region => {
    const pct = (region.backerPercent ?? 0) / 100;
    const costPer = region.costPerCopy ?? 0;
    const cols = scenarioData.map(sc => {
      const backers = Math.round(sc.copies * pct);
      const cost = Math.round(backers * costPer * 100) / 100;
      return { backers, cost };
    });
    return { region, cols };
  });

  const totalShippingPerScenario = scenarioData.map((_, i) =>
    exposureRows.reduce((s, row) => s + row.cols[i].cost, 0)
  );

  // Crossover calculation
  const firstPod = printerQuotes.podPrinters.find(p => p.unitCost !== null && p.unitCost > 0);
  const firstOffset = printerQuotes.offsetPrinters.find(o => o.volumeRows.some(r => r.quantity && r.unitCost));
  let crossoverCopies: number | null = null;
  let crossoverMsg = 'Add offset printer quotes to see your crossover point.';

  if (firstPod && firstOffset) {
    const podUnit = firstPod.unitCost!;
    const lowestRow = firstOffset.volumeRows
      .filter(r => r.quantity && r.unitCost)
      .sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0))[0];
    if (lowestRow && lowestRow.unitCost !== null && lowestRow.quantity !== null) {
      const offsetUnit = lowestRow.unitCost;
      if (podUnit > offsetUnit) {
        const offsetTotal = lowestRow.totalCost ?? (lowestRow.quantity * offsetUnit);
        crossoverCopies = Math.ceil(offsetTotal / (podUnit - offsetUnit));
        crossoverMsg = `Based on your quotes, offset printing becomes more cost-effective at approximately ${crossoverCopies.toLocaleString()} copies.`;
      } else {
        crossoverMsg = 'Your POD unit cost is already lower than offset at this volume.';
      }
    }
  }

  // Validation
  const bufferWarn = form.bufferPercent < 0 || form.bufferPercent > 50
    ? 'Buffer must be between 0% and 50%' : undefined;
  const failureWarn = form.paymentFailureRate < 0 || form.paymentFailureRate > 20
    ? 'Failure rate must be between 0% and 20%' : undefined;

  return (
    <div className="sp-screen">
      <div className="sp-header">
        <h1 className="sp-title">Shipping Planner</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving\u2026'}
          {saveStatus === 'saved' && '\u2713 Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* 1. CURRENCY CONVERSION */}
        {nonUsdCurrencies.length > 0 && (
          <section className="form-section">
            <h2 className="form-section-label">Currency Conversion Rates</h2>
            <span className="form-helper" style={{ marginBottom: 12, display: 'block' }}>
              For quotes not in USD — enter today&apos;s rate from Google or XE.com
            </span>
            {nonUsdCurrencies.map(cur => (
              <div className="form-field" key={cur}>
                <label className="form-label">{cur} &rarr; USD</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.currencyRates[cur] ?? ''}
                  onChange={e => setRate(cur, e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="1.2650"
                  step={0.0001}
                  min={0}
                />
              </div>
            ))}
          </section>
        )}

        {/* 2. SHIPPING REGIONS */}
        <section className="form-section sp-section-wide">
          <h2 className="form-section-label">Shipping Regions</h2>

          <table className="sp-region-table">
            <thead>
              <tr>
                <th className="sp-rt-name">Region</th>
                <th className="sp-rt-toggle">Ship?</th>
                <th className="sp-rt-cost">Cost / copy ($)</th>
                <th className="sp-rt-basis">Basis</th>
                <th className="sp-rt-pct">% of backers</th>
              </tr>
            </thead>
            <tbody>
              {form.regions.map(region => {
                const costWarn = region.enabled && region.costPerCopy !== null && region.costPerCopy < 0;
                return (
                  <tr key={region.id} className={region.enabled ? '' : 'sp-region-disabled'}>
                    <td>
                      <input
                        type="text"
                        className="vol-input"
                        value={region.name}
                        onChange={e => updateRegion(region.id, { name: e.target.value })}
                      />
                    </td>
                    <td>
                      <label className="sp-toggle">
                        <input
                          type="checkbox"
                          checked={region.enabled}
                          onChange={e => updateRegion(region.id, { enabled: e.target.checked })}
                        />
                        <span className="sp-toggle-track"><span className="sp-toggle-thumb" /></span>
                      </label>
                    </td>
                    <td>
                      <input
                        type="number"
                        className={`vol-input${costWarn ? ' vol-input--warn' : ''}`}
                        value={region.costPerCopy ?? ''}
                        onChange={e => updateRegion(region.id, { costPerCopy: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="0.00"
                        step={0.01}
                        min={0}
                        disabled={!region.enabled}
                      />
                    </td>
                    <td>
                      <select
                        className="vol-input"
                        value={region.basis}
                        onChange={e => updateRegion(region.id, { basis: e.target.value as 'flat' | 'per_copy' })}
                        disabled={!region.enabled}
                      >
                        <option value="flat">Flat rate</option>
                        <option value="per_copy">Per copy</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="vol-input"
                        value={region.backerPercent ?? ''}
                        onChange={e => updateRegion(region.id, { backerPercent: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="0"
                        min={0}
                        max={100}
                        disabled={!region.enabled}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="sp-pct-total">
            <span>Total:</span>
            <span className={
              regionPercentSum === 100 ? 'sp-pct-ok' :
              regionPercentSum > 100 ? 'sp-pct-over' : 'sp-pct-under'
            }>
              {regionPercentSum}%
              {regionPercentSum === 100 && ' \u2713'}
              {regionPercentSum > 100 && ' — exceeds 100%'}
              {regionPercentSum > 0 && regionPercentSum < 100 && ` — ${100 - regionPercentSum}% unallocated`}
            </span>
          </div>
        </section>

        {/* 3. SHIPPING BUFFER CALCULATOR */}
        <section className="form-section">
          <h2 className="form-section-label">Fulfillment Buffer</h2>
          <p className="form-helper" style={{ marginBottom: 14 }}>
            Kickstarter campaigns typically see 3–8% of pledges fail at payment collection.
            A buffer protects you from absorbing unexpected costs.
          </p>

          <div className="printer-card-costs" style={{ maxWidth: 400 }}>
            <div className="form-field">
              <label className="form-label">Payment failure rate (%)</label>
              <input
                type="number"
                className="form-input"
                value={form.paymentFailureRate}
                onChange={e => setForm(prev => ({ ...prev, paymentFailureRate: Number(e.target.value) }))}
                min={0} max={20} step={0.5}
              />
              {failureWarn && <span className="form-warning">{failureWarn}</span>}
            </div>
            <div className="form-field">
              <label className="form-label">Reserve buffer (%)</label>
              <input
                type="number"
                className="form-input"
                value={form.bufferPercent}
                onChange={e => setForm(prev => ({ ...prev, bufferPercent: Number(e.target.value) }))}
                min={0} max={50} step={1}
              />
              {bufferWarn && <span className="form-warning">{bufferWarn}</span>}
            </div>
          </div>

          {/* 3-column scenario summary */}
          {firstTierPledge > 0 && (
            <div className="sp-buffer-grid">
              {scenarioData.map(sc => (
                <div className="sp-buffer-col" key={sc.label}>
                  <div className="sp-buffer-label">{sc.label}</div>
                  <div className="sp-buffer-row">
                    <span>Est. raised</span>
                    <span>${sc.totalRaised.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                  </div>
                  <div className="sp-buffer-row">
                    <span>After failures ({form.paymentFailureRate}%)</span>
                    <span>${Math.round(sc.afterFailure).toLocaleString()}</span>
                  </div>
                  <div className="sp-buffer-row sp-buffer-deduct">
                    <span>Buffer reserve</span>
                    <span>&minus; ${Math.round(sc.bufferAmount).toLocaleString()}</span>
                  </div>
                  <div className="sp-buffer-divider" />
                  <div className="sp-buffer-row sp-buffer-total">
                    <span>Available</span>
                    <span>${Math.round(sc.available).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {firstTierPledge <= 0 && (
            <p className="form-helper" style={{ marginTop: 12 }}>Add a reward tier with a pledge amount to see buffer calculations.</p>
          )}
        </section>

        {/* 4. SHIPPING EXPOSURE SUMMARY */}
        {enabledRegions.length > 0 && firstTierPledge > 0 && (
          <section className="form-section sp-section-wide">
            <h2 className="form-section-label">Shipping Exposure Summary</h2>

            <div className="sp-exposure-wrap">
              <table className="sp-exposure-table">
                <thead>
                  <tr>
                    <th>Region</th>
                    {scenarioData.map(sc => (
                      <th key={sc.label} colSpan={2}>{sc.label} ({sc.copies})</th>
                    ))}
                  </tr>
                  <tr className="sp-exposure-subhead">
                    <th></th>
                    {scenarioData.map(sc => (
                      <React.Fragment key={sc.label}>
                        <th>Backers</th>
                        <th>Ship cost</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exposureRows.map((row, ri) => (
                    <tr key={row.region.id} className={ri % 2 === 1 ? 'sp-exposure-alt' : ''}>
                      <td className="sp-exposure-name">{row.region.name}</td>
                      {row.cols.map((col, ci) => (
                        <React.Fragment key={ci}>
                          <td className="sp-exposure-num">{col.backers}</td>
                          <td className="sp-exposure-num">${col.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="sp-exposure-total-row">
                    <td><strong>Total shipping</strong></td>
                    {totalShippingPerScenario.map((total, i) => {
                      const sc = scenarioData[i];
                      const pctOfRaised = sc.totalRaised > 0 ? (total / sc.totalRaised) * 100 : 0;
                      const flag = pctOfRaised > 40 ? 'red' : pctOfRaised > 25 ? 'orange' : '';
                      return (
                        <td key={i} colSpan={2} className={`sp-exposure-num sp-exposure-total ${flag ? `sp-exposure-flag-${flag}` : ''}`}>
                          ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="sp-exposure-pct">({pctOfRaised.toFixed(1)}% of raised)</span>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* 5. POD VS OFFSET CROSSOVER */}
        <div className="sp-crossover-box">
          <h3 className="sp-crossover-title">POD vs Offset Crossover</h3>
          <p>{crossoverMsg}</p>
        </div>
      </div>
    </div>
  );
};

export default ShippingPlanner;
