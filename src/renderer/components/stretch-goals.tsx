import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CampaignData,
  StretchGoalsData,
  StretchGoal,
  StretchGoalType,
  BookSetupData,
  PricingTiersData,
  PrinterQuotesData,
  ShippingPlannerData,
  PromotionalToolsData,
} from '../../types/campaign';
import {
  defaultStretchGoals,
  createStretchGoal,
  DEFAULT_BOOK_SETUP,
  defaultPricingTiers,
  defaultPrinterQuotes,
  defaultShippingPlanner,
  defaultPromotionalTools,
} from '../../types/campaign';

const TOTAL_FEE = 0.08;

const GOAL_TYPES: StretchGoalType[] = [
  'Interior illustrations',
  'Cover upgrade',
  'Additional book format',
  'Bookmarks / bookplates',
  'Art print',
  'Author note / letter',
  'Ebook extras',
  'Custom',
];

const COST_HINTS: Record<string, string> = {
  'Interior illustrations':
    'A typical chapter header commission from an indie artist runs $50\u2013200 per illustration. For 10 chapters that\u2019s $500\u20132,000 total.',
  'Cover upgrade':
    'Foil stamping setup fees typically run $300\u2013800 depending on the printer. Special edition covers with new art may cost $500\u20131,500.',
  'Additional book format':
    'Adding a hardcover edition to a paperback campaign typically adds $4\u20138 per unit in print costs.',
  'Bookmarks / bookplates':
    'Printing 500 bookmarks typically costs $80\u2013150 at Sticker Mule or similar. Bookplates run about the same.',
  'Art print':
    'A print run of 200 signed art prints typically costs $200\u2013400 depending on size and paper stock.',
  'Author note / letter':
    'A one-page author letter insert adds roughly $0.10\u20130.30 per copy in printing costs.',
  'Ebook extras':
    'Digital extras (bonus chapters, maps, art) have near-zero marginal cost \u2014 the main expense is creation time.',
};

const fmtDollar = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface StretchGoalsProps {
  campaignId: number;
}

const StretchGoals: React.FC<StretchGoalsProps> = ({ campaignId }) => {
  const [form, setForm] = useState<StretchGoalsData>(defaultStretchGoals);
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [pricingTiers, setPricingTiers] = useState<PricingTiersData>(defaultPricingTiers);
  const [printerQuotes, setPrinterQuotes] = useState<PrinterQuotesData>(defaultPrinterQuotes);
  const [shippingPlanner, setShippingPlanner] = useState<ShippingPlannerData>(defaultShippingPlanner);
  const [promoTools, setPromoTools] = useState<PromotionalToolsData>(defaultPromotionalTools);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  /* ---------- load ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaign = await window.kickflip.loadCampaign(campaignId);
      if (cancelled) return;
      if (campaign && campaign.data) {
        try {
          const p: CampaignData = JSON.parse(campaign.data);
          if (p.stretchGoals) setForm({ ...defaultStretchGoals(), ...p.stretchGoals });
          if (p.bookSetup) setBookSetup({ ...DEFAULT_BOOK_SETUP, ...p.bookSetup });
          if (p.pricingTiers) setPricingTiers(p.pricingTiers);
          if (p.printerQuotes) setPrinterQuotes(p.printerQuotes);
          if (p.shippingPlanner) setShippingPlanner(prev => ({ ...prev, ...p.shippingPlanner }));
          if (p.promotionalTools) setPromoTools(prev => ({ ...prev, ...p.promotionalTools }));
        } catch { /* */ }
      }
      setTimeout(() => { isInitialLoad.current = false; }, 50);
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  /* ---------- autosave ---------- */
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
      existing.stretchGoals = form;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  /* ---------- helpers ---------- */
  const updateGoal = useCallback((id: string, patch: Partial<StretchGoal>) => {
    setForm(prev => ({
      ...prev,
      goals: prev.goals.map(g => g.id === id ? { ...g, ...patch } : g),
    }));
  }, []);

  const addGoal = useCallback(() => {
    setForm(prev => ({ ...prev, goals: [...prev.goals, createStretchGoal()] }));
  }, []);

  const removeGoal = useCallback((id: string) => {
    setForm(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
  }, []);

  /* ---------- cross-screen data ---------- */
  const campaignGoal = pricingTiers.goal ?? 0;

  // Average net margin per backer across tiers with positive margins
  const enabledRegions = shippingPlanner.regions.filter(r => r.enabled);
  const avgShippingCost = enabledRegions.reduce((sum, r) =>
    sum + ((r.backerPercent ?? 0) / 100) * (r.costPerCopy ?? 0), 0);
  const bufferRate = (shippingPlanner.bufferPercent ?? 0) / 100;

  const tierMargins = pricingTiers.tiers
    .filter(t => (t.pledgeAmount ?? 0) > 0)
    .map(t => {
      const printer = printerQuotes.podPrinters.find(p => p.id === t.printerId);
      const pCost = printer?.unitCost ?? 0;
      const net = (t.pledgeAmount! * (1 - TOTAL_FEE)) - pCost - avgShippingCost - (t.pledgeAmount! * bufferRate);
      return net;
    });

  const positiveTierMargins = tierMargins.filter(m => m > 0);
  const avgNetPerBacker = positiveTierMargins.length > 0
    ? positiveTierMargins.reduce((a, b) => a + b, 0) / positiveTierMargins.length
    : 0;

  // Best guess pledge amount for backer count estimates
  const bestTier = pricingTiers.tiers.find(t => (t.pledgeAmount ?? 0) > 0);
  const pledgeAmount = bestTier?.pledgeAmount ?? 0;

  const expectedBackers = bookSetup.expectedEstimate ?? 0;
  const breakoutBackers = bookSetup.breakoutEstimate ?? 0;
  const breakoutFunding = breakoutBackers * pledgeAmount;
  const campaignLength = promoTools.campaignLength ?? 30;

  /* ---------- per-goal analysis ---------- */
  const goalAnalysis = form.goals.map((goal, idx) => {
    const isFlat = goal.costStructure === 'flat';
    const cost = isFlat ? (goal.flatCost ?? 0) : (goal.perBackerCost ?? 0);

    // Safe unlock threshold
    let safeThreshold = 0;
    let additionalBackers = 0;
    if (isFlat && avgNetPerBacker > 0) {
      const additionalFundingNeeded = cost / avgNetPerBacker;
      safeThreshold = campaignGoal + (additionalFundingNeeded * pledgeAmount);
      additionalBackers = Math.ceil(additionalFundingNeeded);
    } else if (!isFlat && pledgeAmount > 0) {
      // Per-backer: need enough margin to absorb the added cost
      // threshold is where new margin (avgNet - perBackerCost) still covers base
      const newNet = avgNetPerBacker - cost;
      if (newNet > 0) {
        safeThreshold = campaignGoal; // affordable from goal
      } else {
        safeThreshold = 0; // can't be covered
      }
      additionalBackers = 0;
    }
    safeThreshold = Math.round(safeThreshold);

    // Profit buffer check
    let marginAfter = avgNetPerBacker;
    if (isFlat) {
      const backerEstimate = expectedBackers > 0 ? expectedBackers : (pledgeAmount > 0 ? Math.floor(campaignGoal / pledgeAmount) : 0);
      // cumulative flat costs up to this goal
      let cumulativeFlat = 0;
      for (let i = 0; i <= idx; i++) {
        if (form.goals[i].costStructure === 'flat') cumulativeFlat += (form.goals[i].flatCost ?? 0);
        else marginAfter -= (form.goals[i].perBackerCost ?? 0);
      }
      if (backerEstimate > 0) marginAfter -= cumulativeFlat / backerEstimate;
    } else {
      // cumulative per-backer + flat spread
      const backerEstimate = expectedBackers > 0 ? expectedBackers : (pledgeAmount > 0 ? Math.floor(campaignGoal / pledgeAmount) : 0);
      let cumulativeFlat = 0;
      for (let i = 0; i <= idx; i++) {
        if (form.goals[i].costStructure === 'per_backer') marginAfter -= (form.goals[i].perBackerCost ?? 0);
        else cumulativeFlat += (form.goals[i].flatCost ?? 0);
      }
      if (backerEstimate > 0) marginAfter -= cumulativeFlat / backerEstimate;
    }

    // Margin warning level
    let marginLevel: 'ok' | 'thin' | 'negative' = 'ok';
    if (marginAfter < 0) marginLevel = 'negative';
    else if (marginAfter < 3) marginLevel = 'thin';

    // Timing recommendation
    let timingText = '';
    if (safeThreshold > 0 && campaignGoal > 0) {
      const expectedFunding = expectedBackers * pledgeAmount;
      const fundingTarget = expectedFunding > 0 ? expectedFunding : campaignGoal * 2;
      const ratio = safeThreshold / fundingTarget;
      if (ratio <= 0.4) {
        timingText = `If your campaign follows a typical funding curve, you'd expect to hit ${fmtDollar(safeThreshold)} likely within the first 2 days.`;
      } else if (ratio <= 0.8) {
        timingText = `If your campaign follows a typical funding curve, you'd expect to hit ${fmtDollar(safeThreshold)} around the midpoint of your ${campaignLength}-day campaign.`;
      } else {
        timingText = `This threshold at ${fmtDollar(safeThreshold)} would only unlock if your campaign significantly outperforms expectations.`;
      }
    }

    return {
      goal, safeThreshold, additionalBackers, marginAfter, marginLevel, timingText, cost, isFlat,
    };
  });

  /* ---------- recommended thresholds ---------- */
  const rec1 = Math.round(campaignGoal * 1.5);
  const rec2 = Math.round(campaignGoal * 2);
  const rec3 = Math.round(campaignGoal * 3);
  const profitAt = (threshold: number): number => {
    if (pledgeAmount <= 0 || avgNetPerBacker <= 0) return 0;
    const backers = Math.floor(threshold / pledgeAmount);
    const goalBackers = Math.floor(campaignGoal / pledgeAmount);
    return (backers - goalBackers) * avgNetPerBacker;
  };

  /* ---------- health check ---------- */
  const totalStretchCosts = form.goals.reduce((sum, g) => {
    if (g.costStructure === 'flat') return sum + (g.flatCost ?? 0);
    return sum + ((g.perBackerCost ?? 0) * expectedBackers);
  }, 0);

  const sortedThresholds = goalAnalysis
    .map(a => a.safeThreshold)
    .filter(t => t > 0)
    .sort((a, b) => a - b);

  // Spacing check: flag if two goals within $200
  const spacingIssues: string[] = [];
  for (let i = 1; i < sortedThresholds.length; i++) {
    if (sortedThresholds[i] - sortedThresholds[i - 1] < 200) {
      spacingIssues.push(`Goals at ${fmtDollar(sortedThresholds[i - 1])} and ${fmtDollar(sortedThresholds[i])} are within $200 of each other`);
    }
  }

  const underfundedCount = goalAnalysis.filter(a => a.marginLevel === 'negative').length;

  let ladderRating: 'green' | 'orange' | 'red' = 'green';
  let ladderLabel = 'Well spaced and fully funded';
  if (underfundedCount > 0) {
    ladderRating = 'red';
    ladderLabel = 'One or more goals are underfunded';
  } else if (spacingIssues.length > 0) {
    ladderRating = 'orange';
    ladderLabel = 'Some goals are too close together';
  }

  /* ---------- funding bar helpers ---------- */
  const maxFunding = Math.max(
    breakoutFunding,
    campaignGoal * 3,
    ...sortedThresholds,
    1, // prevent 0
  );

  const barPercent = (val: number): number => Math.min(100, Math.max(0, (val / maxFunding) * 100));

  return (
    <div className="sg-screen">
      <div className="sg-header">
        <h1 className="sg-title">Stretch Goals</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving\u2026'}
          {saveStatus === 'saved' && '\u2713 Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* ============ SECTION 1: STRETCH GOAL BUILDER ============ */}
        <section className="form-section">
          <h2 className="form-section-label">Stretch Goal Builder</h2>
          <p className="form-helper" style={{ marginBottom: 16 }}>
            Enter what each goal costs to produce. KickFlip will calculate the safe unlock threshold and check your margins.
          </p>

          {form.goals.length === 0 && (
            <p className="form-helper" style={{ marginBottom: 16, fontStyle: 'italic' }}>
              No stretch goals yet. Add your first one below.
            </p>
          )}

          {avgNetPerBacker <= 0 && form.goals.length > 0 && (
            <div className="form-warning" style={{ marginBottom: 16 }}>
              Set up your pricing tiers with positive margins first so KickFlip can calculate thresholds.
            </div>
          )}

          {form.goals.map((goal, idx) => {
            const analysis = goalAnalysis[idx];
            const hasCost = analysis.isFlat ? (goal.flatCost ?? 0) > 0 : (goal.perBackerCost ?? 0) > 0;
            const showOutputs = hasCost && avgNetPerBacker > 0 && campaignGoal > 0;

            return (
              <div key={goal.id} className="printer-card sg-card">
                <div className="printer-card-top">
                  <div className="printer-card-fields">
                    <div className="form-field" style={{ flex: 2 }}>
                      <label className="form-label">Goal name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={goal.name}
                        onChange={e => updateGoal(goal.id, { name: e.target.value })}
                        placeholder="e.g. Illustrated chapter headers"
                      />
                    </div>
                    <div className="form-field" style={{ flex: 1 }}>
                      <label className="form-label">Goal type</label>
                      <select
                        className="form-input"
                        value={goal.goalType}
                        onChange={e => updateGoal(goal.id, { goalType: e.target.value as StretchGoalType })}
                      >
                        {GOAL_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button className="remove-btn" onClick={() => removeGoal(goal.id)} title="Remove">&times;</button>
                </div>

                {/* Custom type input */}
                {goal.goalType === 'Custom' && (
                  <div className="form-field" style={{ marginTop: 8 }}>
                    <label className="form-label">Custom type</label>
                    <input
                      type="text"
                      className="form-input"
                      value={goal.customType}
                      onChange={e => updateGoal(goal.id, { customType: e.target.value })}
                      placeholder="Describe your stretch goal type"
                    />
                  </div>
                )}

                {/* Cost hint */}
                {COST_HINTS[goal.goalType] && (
                  <div className="sg-cost-hint">
                    {COST_HINTS[goal.goalType]}
                  </div>
                )}

                {/* Cost structure */}
                <div className="printer-card-costs" style={{ marginTop: 8 }}>
                  <div className="form-field" style={{ flex: 1 }}>
                    <label className="form-label">Cost structure</label>
                    <div className="radio-group">
                      <label className={`radio-option${goal.costStructure === 'flat' ? ' active' : ''}`}>
                        <input
                          type="radio"
                          name={`costStruct-${goal.id}`}
                          checked={goal.costStructure === 'flat'}
                          onChange={() => updateGoal(goal.id, { costStructure: 'flat' })}
                        />
                        One-time flat cost
                      </label>
                      <label className={`radio-option${goal.costStructure === 'per_backer' ? ' active' : ''}`}>
                        <input
                          type="radio"
                          name={`costStruct-${goal.id}`}
                          checked={goal.costStructure === 'per_backer'}
                          onChange={() => updateGoal(goal.id, { costStructure: 'per_backer' })}
                        />
                        Per-backer cost
                      </label>
                    </div>
                  </div>
                  <div className="form-field" style={{ flex: 1 }}>
                    {goal.costStructure === 'flat' ? (
                      <>
                        <label className="form-label">Total cost to produce ($)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={goal.flatCost ?? ''}
                          onChange={e => updateGoal(goal.id, { flatCost: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="e.g. 1200"
                          min={0}
                          step={1}
                        />
                      </>
                    ) : (
                      <>
                        <label className="form-label">Added cost per backer ($)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={goal.perBackerCost ?? ''}
                          onChange={e => updateGoal(goal.id, { perBackerCost: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="e.g. 2.50"
                          min={0}
                          step={0.01}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* ---- CALCULATED OUTPUTS ---- */}
                {showOutputs && (
                  <div className="sg-outputs">
                    {/* 1. Safe Unlock Threshold */}
                    <div className="sg-output-row">
                      <div className="sg-output-label">Safe Unlock Threshold</div>
                      {analysis.isFlat && analysis.safeThreshold > 0 ? (
                        <div className="sg-output-value">
                          <strong>{fmtDollar(analysis.safeThreshold)}</strong> in funding
                          <span className="sg-output-detail">
                            {analysis.additionalBackers > 0 && ` (~${analysis.additionalBackers} backers beyond your base goal)`}
                          </span>
                        </div>
                      ) : !analysis.isFlat && avgNetPerBacker > analysis.cost ? (
                        <div className="sg-output-value">
                          <strong>Affordable from your base goal</strong>
                          <span className="sg-output-detail"> (margin absorbs the per-backer cost)</span>
                        </div>
                      ) : (
                        <div className="sg-output-value sg-output-warn-red">
                          This cost exceeds your per-backer margin. Reduce the cost or raise your prices.
                        </div>
                      )}
                    </div>

                    {/* 2. Profit Buffer Check */}
                    <div className="sg-output-row">
                      <div className="sg-output-label">Profit Buffer Check</div>
                      <div className="sg-output-value">
                        <span>Current avg net per backer: <strong>{fmtDollar(avgNetPerBacker)}</strong></span>
                        <span style={{ margin: '0 6px' }}>{'\u2192'}</span>
                        <span>After this goal: <strong className={analysis.marginLevel === 'negative' ? 'sg-text-red' : analysis.marginLevel === 'thin' ? 'sg-text-orange' : ''}>{fmtDollar(analysis.marginAfter)}</strong></span>
                      </div>
                      {analysis.marginLevel === 'thin' && (
                        <div className="sg-output-warn-orange">
                          Thin margin after this goal. Consider a higher threshold.
                        </div>
                      )}
                      {analysis.marginLevel === 'negative' && (
                        <div className="sg-output-warn-red">
                          This goal wipes out your margin at expected backer count. Raise the threshold or reduce the cost.
                        </div>
                      )}
                    </div>

                    {/* 3. Funding Progress Indicator */}
                    {analysis.isFlat && analysis.safeThreshold > 0 && (
                      <div className="sg-output-row">
                        <div className="sg-output-label">Funding Progress</div>
                        <div className="sg-funding-bar-wrap">
                          <div className="sg-funding-bar">
                            <div className="sg-funding-bar-fill" style={{ width: `${barPercent(breakoutFunding > 0 ? breakoutFunding : campaignGoal * 2)}%` }} />
                            {/* Base goal marker */}
                            <div className="sg-bar-marker sg-bar-marker-goal" style={{ left: `${barPercent(campaignGoal)}%` }}>
                              <div className="sg-bar-marker-line" />
                              <div className="sg-bar-marker-label">Goal</div>
                            </div>
                            {/* This goal threshold */}
                            <div className="sg-bar-marker sg-bar-marker-threshold" style={{ left: `${barPercent(analysis.safeThreshold)}%` }}>
                              <div className="sg-bar-marker-line" />
                              <div className="sg-bar-marker-label">{goal.name || `SG${idx + 1}`}</div>
                            </div>
                            {/* Breakout marker */}
                            {breakoutFunding > 0 && (
                              <div className="sg-bar-marker sg-bar-marker-breakout" style={{ left: `${barPercent(breakoutFunding)}%` }}>
                                <div className="sg-bar-marker-line" />
                                <div className="sg-bar-marker-label">Breakout</div>
                              </div>
                            )}
                          </div>
                          <div className="sg-funding-bar-labels">
                            <span>{fmtDollar(campaignGoal)}</span>
                            <span>{fmtDollar(maxFunding)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. Timing Recommendation */}
                    {analysis.timingText && (
                      <div className="sg-output-row">
                        <div className="sg-output-label">Timing</div>
                        <div className="sg-output-value sg-output-timing">{analysis.timingText}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button className="add-btn" onClick={addGoal}>+ Add Stretch Goal</button>
        </section>

        {/* ============ SECTION 2: RECOMMENDED THRESHOLDS ============ */}
        {campaignGoal > 0 && avgNetPerBacker > 0 && (
          <section className="form-section">
            <h2 className="form-section-label">Recommended Thresholds</h2>
            <div className="sg-recs">
              {[
                { label: 'First stretch goal', amount: rec1, mult: '1.5\u00d7' },
                { label: 'Second stretch goal', amount: rec2, mult: '2\u00d7' },
                { label: 'Third stretch goal', amount: rec3, mult: '3\u00d7' },
              ].map(r => {
                const profit = profitAt(r.amount);
                return (
                  <div className="sg-rec-row" key={r.mult}>
                    <div className="sg-rec-label">{r.label} <span className="sg-rec-mult">{r.mult} goal</span></div>
                    <div className="sg-rec-amount">{fmtDollar(r.amount)}</div>
                    <div className="sg-rec-detail">~{fmtDollar(profit)} in profit above base goal</div>
                  </div>
                );
              })}
              <p className="form-helper" style={{ marginTop: 12 }}>
                Stretch goals work best when each threshold requires only 20{'\u2013'}40% more backers than the previous milestone.
              </p>
            </div>
          </section>
        )}

        {/* ============ SECTION 3: LADDER HEALTH CHECK ============ */}
        {form.goals.length > 0 && avgNetPerBacker > 0 && (
          <section className="form-section">
            <h2 className="form-section-label">Stretch Goal Ladder Health Check</h2>
            <div className="sg-health">
              <div className="sg-health-summary">
                <div className="sg-health-row">
                  <span>Total production budget if all goals fund</span>
                  <span><strong>{fmtDollar(totalStretchCosts)}</strong></span>
                </div>
              </div>

              <div className="sg-health-list">
                {goalAnalysis.map(a => {
                  const hasCost = a.isFlat ? (a.goal.flatCost ?? 0) > 0 : (a.goal.perBackerCost ?? 0) > 0;
                  if (!hasCost) return null;
                  const dotClass = a.marginLevel === 'negative' ? 'bad' : a.marginLevel === 'thin' ? 'warn' : 'ok';
                  const statusText = a.marginLevel === 'negative'
                    ? 'Underfunded at expected backer count'
                    : a.marginLevel === 'thin'
                      ? 'Thin margin'
                      : 'Funded by threshold';
                  return (
                    <div key={a.goal.id} className="sg-health-item">
                      <span className={`sg-health-dot ${dotClass}`} />
                      <span className="sg-health-name">{a.goal.name || 'Unnamed goal'}</span>
                      <span className="sg-health-threshold">{a.safeThreshold > 0 ? fmtDollar(a.safeThreshold) : '\u2014'}</span>
                      <span className={`sg-health-status ${dotClass}`}>{statusText}</span>
                    </div>
                  );
                })}
              </div>

              {/* Spacing warnings */}
              {spacingIssues.map((issue, i) => (
                <div key={i} className="form-warning" style={{ marginBottom: 8 }}>{issue} {'\u2014'} too close, backers won{'\u2019'}t feel momentum.</div>
              ))}

              <div className={`sg-health-verdict ${ladderRating === 'red' ? 'bad' : ladderRating === 'orange' ? 'warn' : 'ok'}`}>
                {ladderLabel}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default StretchGoals;
