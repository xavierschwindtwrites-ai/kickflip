import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CampaignData,
  RetrospectiveData,
  ActualCosts,
  CampaignStatus,
  BookSetupData,
  PrinterQuotesData,
  PricingTiersData,
  ShippingPlannerData,
} from '../../types/campaign';
import {
  defaultRetrospective,
  DEFAULT_BOOK_SETUP,
  defaultPrinterQuotes,
  defaultPricingTiers,
  defaultShippingPlanner,
} from '../../types/campaign';

const TOTAL_FEE = 0.08;

interface RetrospectiveProps {
  campaignId: number;
}

const COST_ROWS: { key: keyof ActualCosts; label: string }[] = [
  { key: 'printing', label: 'Printing costs' },
  { key: 'domesticShipping', label: 'Domestic shipping' },
  { key: 'internationalShipping', label: 'International shipping' },
  { key: 'packaging', label: 'Packaging materials' },
  { key: 'pledgeManagerFees', label: 'Pledge manager fees' },
  { key: 'miscellaneous', label: 'Miscellaneous / unexpected costs' },
];

const SEED_ITEMS = [
  { key: 'updateShipping', label: 'Update shipping estimates based on actuals' },
  { key: 'adjustBackers', label: 'Adjust backer count projections based on this campaign\u2019s performance' },
  { key: 'revisePricing', label: 'Revise tier pricing based on actual margins' },
];

function fmtDollar(n: number): string {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctLabel(actual: number, projected: number): string {
  if (projected === 0) return '\u2014';
  const pct = ((actual - projected) / projected) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

const Retrospective: React.FC<RetrospectiveProps> = ({ campaignId }) => {
  const [form, setForm] = useState<RetrospectiveData>(defaultRetrospective);
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [printerQuotes, setPrinterQuotes] = useState<PrinterQuotesData>(defaultPrinterQuotes);
  const [pricingTiers, setPricingTiers] = useState<PricingTiersData>(defaultPricingTiers);
  const [shippingPlanner, setShippingPlanner] = useState<ShippingPlannerData>(defaultShippingPlanner);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaign = await window.kickflip.loadCampaign(campaignId);
      if (cancelled) return;
      if (campaign && campaign.data) {
        try {
          const p: CampaignData = JSON.parse(campaign.data);
          if (p.retrospective) {
            const saved = p.retrospective;
            setForm({
              ...defaultRetrospective(),
              ...saved,
              actualCosts: { ...defaultRetrospective().actualCosts, ...saved.actualCosts },
            });
          }
          if (p.bookSetup) setBookSetup({ ...DEFAULT_BOOK_SETUP, ...p.bookSetup });
          if (p.printerQuotes) setPrinterQuotes(p.printerQuotes);
          if (p.pricingTiers) setPricingTiers(p.pricingTiers);
          if (p.shippingPlanner) setShippingPlanner(prev => ({ ...prev, ...p.shippingPlanner }));
        } catch { /* */ }
      }
      setTimeout(() => { isInitialLoad.current = false; }, 50);
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

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
      existing.retrospective = form;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  const updateCost = useCallback((key: keyof ActualCosts, value: number | null) => {
    setForm(prev => ({ ...prev, actualCosts: { ...prev.actualCosts, [key]: value } }));
  }, []);

  const toggleSeed = useCallback((key: string) => {
    setForm(prev => {
      const has = prev.seedChecks.includes(key);
      return {
        ...prev,
        seedChecks: has ? prev.seedChecks.filter(k => k !== key) : [...prev.seedChecks, key],
      };
    });
  }, []);

  // --- Projected costs (expected scenario from Scenario Modeler logic) ---
  const firstPod = printerQuotes.podPrinters.find(p => p.unitCost !== null && p.unitCost > 0);
  const printCost = firstPod?.unitCost ?? 0;
  const bestTier = pricingTiers.tiers.find(t => t.pledgeAmount && t.pledgeAmount > 0);
  const pledgeAmount = bestTier?.pledgeAmount ?? 0;
  const expectedBackers = bookSetup.expectedEstimate ?? 0;
  const enabledRegions = shippingPlanner.regions.filter(r => r.enabled);

  // Weighted avg shipping
  const avgShippingCost = enabledRegions.reduce((sum, r) => {
    return sum + ((r.backerPercent ?? 0) / 100) * (r.costPerCopy ?? 0);
  }, 0);

  // Domestic vs international split
  const domesticRegion = enabledRegions.find(r => r.name === 'United States');
  const intlRegions = enabledRegions.filter(r => r.name !== 'United States');
  const domesticPct = (domesticRegion?.backerPercent ?? 0) / 100;
  const intlPct = intlRegions.reduce((s, r) => s + ((r.backerPercent ?? 0) / 100), 0);
  const domesticShipCost = (domesticRegion?.costPerCopy ?? 0) * domesticPct * expectedBackers;
  const intlAvgCost = intlPct > 0
    ? intlRegions.reduce((s, r) => s + ((r.backerPercent ?? 0) / 100) * (r.costPerCopy ?? 0), 0) * expectedBackers
    : 0;

  const projectedGross = expectedBackers * pledgeAmount;
  const projectedFees = projectedGross * TOTAL_FEE;

  const projected: Record<keyof ActualCosts | 'platformFees', number | null> = {
    printing: expectedBackers > 0 && printCost > 0 ? Math.round(expectedBackers * printCost * 100) / 100 : null,
    domesticShipping: domesticShipCost > 0 ? Math.round(domesticShipCost * 100) / 100 : null,
    internationalShipping: intlAvgCost > 0 ? Math.round(intlAvgCost * 100) / 100 : null,
    packaging: null, // not projected in earlier screens
    pledgeManagerFees: null,
    miscellaneous: null,
    platformFees: projectedFees > 0 ? Math.round(projectedFees * 100) / 100 : null,
  };

  // Actuals
  const totalRaised = form.totalRaised ?? 0;
  const actualPlatformFees = Math.round(totalRaised * TOTAL_FEE * 100) / 100;

  const actualTotal = Object.values(form.actualCosts).reduce((s, v) => s + (v ?? 0), 0) + actualPlatformFees;
  const projectedTotal = (Object.keys(projected) as (keyof typeof projected)[])
    .reduce((s, k) => s + (projected[k] ?? 0), 0);

  // --- Lessons learned ---
  const projectedRaised = projectedGross;
  const raisedDiff = projectedRaised > 0
    ? ((totalRaised - projectedRaised) / projectedRaised * 100)
    : 0;
  const raisedLabel = totalRaised > 0 && projectedRaised > 0
    ? (raisedDiff >= 0
      ? `${Math.abs(raisedDiff).toFixed(1)}% over projection`
      : `${Math.abs(raisedDiff).toFixed(1)}% under projection`)
    : null;

  const actualBackers = form.finalBackerCount ?? 0;
  const actualCostPerBacker = actualBackers > 0 ? actualTotal / actualBackers : 0;
  const projectedCostPerBacker = expectedBackers > 0 ? projectedTotal / expectedBackers : 0;

  // Largest unexpected cost
  const costDiffs = COST_ROWS.map(row => ({
    label: row.label,
    diff: (form.actualCosts[row.key] ?? 0) - (projected[row.key] ?? 0),
  })).filter(d => d.diff > 0).sort((a, b) => b.diff - a.diff);
  const largestUnexpected = costDiffs.length > 0 ? costDiffs[0] : null;

  const actualNet = totalRaised - actualTotal;

  const hasActualData = totalRaised > 0 || actualBackers > 0;

  return (
    <div className="rt-screen">
      <div className="rt-header">
        <h1 className="rt-title">Retrospective</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving\u2026'}
          {saveStatus === 'saved' && '\u2713 Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* Campaign Status Toggle */}
        <section className="form-section">
          <h2 className="form-section-label">Campaign Status</h2>
          <div className="rt-status-toggle">
            {(['Planning', 'Live', 'Complete'] as CampaignStatus[]).map(s => (
              <button
                key={s}
                className={`rt-status-btn${form.campaignStatus === s ? ' active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, campaignStatus: s }))}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {form.campaignStatus !== 'Complete' ? (
          <div className="rt-locked">
            <div className="rt-locked-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="23" stroke="#d0d0d6" strokeWidth="2" strokeDasharray="4 3"/>
                <path d="M18 28v-4a6 6 0 1 1 12 0v4" stroke="#b8b8c0" strokeWidth="2" strokeLinecap="round"/>
                <rect x="15" y="28" width="18" height="12" rx="3" stroke="#b8b8c0" strokeWidth="2"/>
                <circle cx="24" cy="34" r="2" fill="#b8b8c0"/>
              </svg>
            </div>
            <p className="rt-locked-text">
              This screen fills in after your campaign closes.<br />
              Come back when you&apos;re ready to reflect.
            </p>
          </div>
        ) : (
          <>
            {/* 1. ACTUAL RESULTS */}
            <section className="form-section">
              <h2 className="form-section-label">Actual Results</h2>

              <div className="rt-results-grid">
                <div className="form-field">
                  <label className="form-label">Final backer count</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.finalBackerCount ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, finalBackerCount: e.target.value === '' ? null : Number(e.target.value) }))}
                    placeholder="0"
                    min={0}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Total amount raised ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.totalRaised ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, totalRaised: e.target.value === '' ? null : Number(e.target.value) }))}
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Most popular tier</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.mostPopularTier}
                    onChange={e => setForm(prev => ({ ...prev, mostPopularTier: e.target.value }))}
                    placeholder="e.g. Paperback + Ebook"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">How many days did your campaign run?</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.campaignDaysUsed ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, campaignDaysUsed: e.target.value === '' ? null : Number(e.target.value) }))}
                    placeholder="30"
                    min={1}
                  />
                </div>
              </div>

              <div className="rt-radios-row">
                <div className="form-field">
                  <label className="form-label">Did you hit your funding goal?</label>
                  <div className="radio-group">
                    <label className={`radio-option${form.hitFundingGoal === true ? ' active' : ''}`}>
                      <input type="radio" name="hitGoal" checked={form.hitFundingGoal === true} onChange={() => setForm(prev => ({ ...prev, hitFundingGoal: true }))} />
                      Yes
                    </label>
                    <label className={`radio-option${form.hitFundingGoal === false ? ' active' : ''}`}>
                      <input type="radio" name="hitGoal" checked={form.hitFundingGoal === false} onChange={() => setForm(prev => ({ ...prev, hitFundingGoal: false }))} />
                      No
                    </label>
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label">Did you hit any stretch goals?</label>
                  <div className="radio-group">
                    {(['None', 'Some', 'All'] as const).map(v => (
                      <label key={v} className={`radio-option${form.stretchGoalsHit === v ? ' active' : ''}`}>
                        <input type="radio" name="sgHit" checked={form.stretchGoalsHit === v} onChange={() => setForm(prev => ({ ...prev, stretchGoalsHit: v }))} />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {(form.stretchGoalsHit === 'Some' || form.stretchGoalsHit === 'All') && (
                <div className="form-field" style={{ marginTop: 12 }}>
                  <label className="form-label">Which stretch goals were hit?</label>
                  <textarea
                    className="form-input rt-textarea"
                    value={form.stretchGoalsHitDetail}
                    onChange={e => setForm(prev => ({ ...prev, stretchGoalsHitDetail: e.target.value }))}
                    placeholder="List the stretch goals you unlocked"
                    rows={3}
                  />
                </div>
              )}
            </section>

            {/* 2. ACTUAL COSTS VS PROJECTED */}
            <section className="form-section rt-section-wide">
              <h2 className="form-section-label">Actual Costs vs Projected</h2>

              <div className="rt-cost-table-wrap">
                <table className="rt-cost-table">
                  <thead>
                    <tr>
                      <th className="rt-ct-label">Cost category</th>
                      <th className="rt-ct-proj">Projected</th>
                      <th className="rt-ct-actual">Actual</th>
                      <th className="rt-ct-diff">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COST_ROWS.map(row => {
                      const proj = projected[row.key];
                      const act = form.actualCosts[row.key];
                      const diff = (act !== null && act !== undefined) ? (act - (proj ?? 0)) : null;
                      return (
                        <tr key={row.key}>
                          <td className="rt-ct-label-cell">{row.label}</td>
                          <td className="rt-ct-proj-cell">{proj !== null ? fmtDollar(proj) : '\u2014'}</td>
                          <td className="rt-ct-actual-cell">
                            <input
                              type="number"
                              className="form-input"
                              value={act ?? ''}
                              onChange={e => updateCost(row.key, e.target.value === '' ? null : Number(e.target.value))}
                              placeholder="0.00"
                              min={0}
                              step={0.01}
                            />
                          </td>
                          <td className={`rt-ct-diff-cell${diff !== null ? (diff <= 0 ? ' good' : ' bad') : ''}`}>
                            {diff !== null ? (diff <= 0 ? '\u2212' : '+') + fmtDollar(Math.abs(diff)) : '\u2014'}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Platform fees row */}
                    <tr className="rt-ct-auto-row">
                      <td className="rt-ct-label-cell">Platform fees (8%)</td>
                      <td className="rt-ct-proj-cell">{projected.platformFees !== null ? fmtDollar(projected.platformFees) : '\u2014'}</td>
                      <td className="rt-ct-actual-cell rt-ct-auto-val">{totalRaised > 0 ? fmtDollar(actualPlatformFees) : '\u2014'}</td>
                      <td className={`rt-ct-diff-cell${projected.platformFees !== null && totalRaised > 0 ? (actualPlatformFees <= projected.platformFees ? ' good' : ' bad') : ''}`}>
                        {projected.platformFees !== null && totalRaised > 0
                          ? ((actualPlatformFees - projected.platformFees) <= 0 ? '\u2212' : '+') + fmtDollar(Math.abs(actualPlatformFees - projected.platformFees))
                          : '\u2014'}
                      </td>
                    </tr>
                    {/* Totals */}
                    <tr className="rt-ct-totals">
                      <td className="rt-ct-label-cell"><strong>Total</strong></td>
                      <td className="rt-ct-proj-cell"><strong>{projectedTotal > 0 ? fmtDollar(projectedTotal) : '\u2014'}</strong></td>
                      <td className="rt-ct-actual-cell"><strong>{actualTotal > 0 ? fmtDollar(actualTotal) : '\u2014'}</strong></td>
                      <td className={`rt-ct-diff-cell${actualTotal > 0 && projectedTotal > 0 ? ((actualTotal - projectedTotal) <= 0 ? ' good' : ' bad') : ''}`}>
                        <strong>
                          {actualTotal > 0 && projectedTotal > 0
                            ? ((actualTotal - projectedTotal) <= 0 ? '\u2212' : '+') + fmtDollar(Math.abs(actualTotal - projectedTotal))
                            : '\u2014'}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. WHAT WORKED / WHAT DIDN'T */}
            <section className="form-section">
              <h2 className="form-section-label">Reflections</h2>

              <div className="rt-reflect-grid">
                <div className="form-field">
                  <label className="form-label">What worked well</label>
                  <textarea
                    className="form-input rt-textarea"
                    value={form.whatWorked}
                    onChange={e => setForm(prev => ({ ...prev, whatWorked: e.target.value }))}
                    placeholder="e.g. The launch day email drove 40% of backers in the first 24 hours"
                    rows={5}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">What I&apos;d do differently</label>
                  <textarea
                    className="form-input rt-textarea"
                    value={form.whatWouldChange}
                    onChange={e => setForm(prev => ({ ...prev, whatWouldChange: e.target.value }))}
                    placeholder="e.g. I'd increase the international shipping estimate by 20%"
                    rows={5}
                  />
                </div>
              </div>
            </section>

            {/* 4. LESSONS LEARNED SUMMARY */}
            {hasActualData && (
              <section className="form-section">
                <h2 className="form-section-label">Lessons Learned Summary</h2>

                <div className="rt-lessons-card">
                  {totalRaised > 0 && projectedRaised > 0 && (
                    <div className="rt-lesson-row">
                      <span className="rt-lesson-label">Revenue vs projection</span>
                      <span className="rt-lesson-value">
                        You raised <strong>{fmtDollar(totalRaised)}</strong> against a projected <strong>{fmtDollar(projectedRaised)}</strong> &mdash; <span className={raisedDiff >= 0 ? 'rt-good' : 'rt-bad'}>{raisedLabel}</span>
                      </span>
                    </div>
                  )}

                  {actualBackers > 0 && (
                    <div className="rt-lesson-row">
                      <span className="rt-lesson-label">Cost per backer</span>
                      <span className="rt-lesson-value">
                        Your actual cost per backer was <strong>{fmtDollar(actualCostPerBacker)}</strong>
                        {projectedCostPerBacker > 0 && <> vs projected <strong>{fmtDollar(projectedCostPerBacker)}</strong></>}
                      </span>
                    </div>
                  )}

                  {largestUnexpected && (
                    <div className="rt-lesson-row">
                      <span className="rt-lesson-label">Largest overrun</span>
                      <span className="rt-lesson-value">
                        Your largest unexpected cost was <strong>{largestUnexpected.label.toLowerCase()}</strong> (+{fmtDollar(largestUnexpected.diff)} over projected)
                      </span>
                    </div>
                  )}

                  {totalRaised > 0 && (
                    <div className="rt-lesson-row rt-lesson-net">
                      <span className="rt-lesson-label">Final net</span>
                      <span className={`rt-lesson-value rt-lesson-big ${actualNet >= 0 ? 'rt-good' : 'rt-bad'}`}>
                        Approximately <strong>{fmtDollar(actualNet)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 5. NEXT CAMPAIGN SEED */}
            <section className="form-section">
              <h2 className="form-section-label">Carry Forward to Next Campaign</h2>

              <div className="pt-checklist">
                {SEED_ITEMS.map(item => {
                  const checked = form.seedChecks.includes(item.key);
                  return (
                    <label key={item.key} className={`pt-check-item${checked ? ' checked' : ''}`}>
                      <span className={`pt-checkbox${checked ? ' checked' : ''}`}>
                        {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      <input type="checkbox" checked={checked} onChange={() => toggleSeed(item.key)} className="pt-check-hidden" />
                      <div className="pt-check-content">
                        <span className="pt-check-label">{item.label}</span>
                      </div>
                    </label>
                  );
                })}

                <div className="rt-seed-field">
                  <label className="form-label">My list grew to</label>
                  <div className="rt-seed-inline">
                    <input
                      type="number"
                      className="form-input"
                      value={form.seedListSize ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, seedListSize: e.target.value === '' ? null : Number(e.target.value) }))}
                      placeholder="0"
                      min={0}
                      style={{ maxWidth: 140 }}
                    />
                    <span className="form-helper">subscribers</span>
                  </div>
                </div>

                <div className="form-field" style={{ marginTop: 12 }}>
                  <label className="form-label">Notes for next campaign</label>
                  <textarea
                    className="form-input rt-textarea"
                    value={form.seedNotes}
                    onChange={e => setForm(prev => ({ ...prev, seedNotes: e.target.value }))}
                    placeholder="Anything else you want to remember for next time"
                    rows={4}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Retrospective;
