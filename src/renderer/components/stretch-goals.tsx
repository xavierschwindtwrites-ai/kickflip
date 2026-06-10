import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  totalFeeRate,
  defaultPricingTiers,
  defaultPrinterQuotes,
  defaultShippingPlanner,
  defaultPromotionalTools,
} from '../../types/campaign';

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
    'A typical chapter header commission from an indie artist runs $50–200 per illustration. For 10 chapters that’s $500–2,000 total.',
  'Cover upgrade':
    'Foil stamping setup fees typically run $300–800 depending on the printer. Special edition covers with new art may cost $500–1,500.',
  'Additional book format':
    'Adding a hardcover edition to a paperback campaign typically adds $4–8 per unit in print costs.',
  'Bookmarks / bookplates':
    'Printing 500 bookmarks typically costs $80–150 at Sticker Mule or similar. Bookplates run about the same.',
  'Art print':
    'A print run of 200 signed art prints typically costs $200–400 depending on size and paper stock.',
  'Author note / letter':
    'A one-page author letter insert adds roughly $0.10–0.30 per copy in printing costs.',
  'Ebook extras':
    'Digital extras (bonus chapters, maps, art) have near-zero marginal cost — the main expense is creation time.',
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaign = await window.kickflip.loadCampaign(campaignId);
      if (cancelled) return;
      if (campaign && campaign.data) {
        try {
          const p: CampaignData = JSON.parse(campaign.data);
          if (p.stretchGoals) {
            const goals = (p.stretchGoals.goals || []).map((g, idx) => ({
              ...createStretchGoal(),
              ...g,
              sortOrder: g.sortOrder ?? idx,
            }));
            goals.sort((a, b) => a.sortOrder - b.sortOrder);
            setForm({ goals });
          }
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

  const updateGoal = useCallback((id: string, patch: Partial<StretchGoal>) => {
    setForm(prev => ({
      ...prev,
      goals: prev.goals.map(g => g.id === id ? { ...g, ...patch } : g),
    }));
  }, []);

  const addGoal = useCallback(() => {
    setForm(prev => {
      const maxOrder = prev.goals.reduce((m, g) => Math.max(m, g.sortOrder ?? 0), -1);
      return { ...prev, goals: [...prev.goals, { ...createStretchGoal(), sortOrder: maxOrder + 1 }] };
    });
  }, []);

  const removeGoal = useCallback((id: string) => {
    setForm(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
  }, []);

  // KF-002: Handle drag end — reorder and update sortOrder
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setForm(prev => {
        const oldIdx = prev.goals.findIndex(g => g.id === active.id);
        const newIdx = prev.goals.findIndex(g => g.id === over.id);
        const reordered = arrayMove(prev.goals, oldIdx, newIdx).map((g, idx) => ({
          ...g,
          sortOrder: idx,
        }));
        return { ...prev, goals: reordered };
      });
    }
  }, []);

  /* Cross-screen data */
  const campaignGoal = pricingTiers.goal ?? 0;
  const enabledRegions = shippingPlanner.regions.filter(r => r.enabled);
  const avgShippingCost = enabledRegions.reduce((sum, r) =>
    sum + ((r.backerPercent ?? 0) / 100) * (r.costPerCopy ?? 0), 0);
  const bufferRate = (shippingPlanner.bufferPercent ?? 0) / 100;

  const TOTAL_FEE = totalFeeRate(bookSetup);
  const tierMargins = pricingTiers.tiers
    .filter(t => (t.pledgeAmount ?? 0) > 0)
    .map(t => {
      const isDigital = t.isDigitalOnly ?? false;
      const printer = printerQuotes.podPrinters.find(p => p.id === t.printerId);
      const pCost = isDigital ? 0 : (printer?.unitCost ?? 0);
      const shipCost = isDigital ? 0 : avgShippingCost;
      const net = (t.pledgeAmount! * (1 - TOTAL_FEE)) - pCost - shipCost - (t.pledgeAmount! * bufferRate);
      return net;
    });

  const positiveTierMargins = tierMargins.filter(m => m > 0);
  const avgNetPerBacker = positiveTierMargins.length > 0
    ? positiveTierMargins.reduce((a, b) => a + b, 0) / positiveTierMargins.length
    : 0;

  const bestTier = pricingTiers.tiers.find(t => (t.pledgeAmount ?? 0) > 0);
  const pledgeAmount = bestTier?.pledgeAmount ?? 0;

  const expectedBackers = bookSetup.expectedEstimate ?? 0;
  const breakoutBackers = bookSetup.breakoutEstimate ?? 0;
  const breakoutFunding = breakoutBackers * pledgeAmount;
  const campaignLength = promoTools.campaignLength ?? 30;

  /* Per-goal analysis */
  const goalAnalysis = form.goals.map((goal, idx) => {
    const isFlat = goal.costStructure === 'flat';
    const cost = isFlat ? (goal.flatCost ?? 0) : (goal.perBackerCost ?? 0);

    let safeThreshold = 0;
    let additionalBackers = 0;
    if (isFlat && avgNetPerBacker > 0) {
      const additionalFundingNeeded = cost / avgNetPerBacker;
      safeThreshold = campaignGoal + (additionalFundingNeeded * pledgeAmount);
      additionalBackers = Math.ceil(additionalFundingNeeded);
    } else if (!isFlat && pledgeAmount > 0) {
      const newNet = avgNetPerBacker - cost;
      safeThreshold = newNet > 0 ? campaignGoal : 0;
      additionalBackers = 0;
    }
    safeThreshold = Math.round(safeThreshold);

    let marginAfter = avgNetPerBacker;
    if (isFlat) {
      const backerEstimate = expectedBackers > 0 ? expectedBackers : (pledgeAmount > 0 ? Math.floor(campaignGoal / pledgeAmount) : 0);
      let cumulativeFlat = 0;
      for (let i = 0; i <= idx; i++) {
        if (form.goals[i].costStructure === 'flat') cumulativeFlat += (form.goals[i].flatCost ?? 0);
        else marginAfter -= (form.goals[i].perBackerCost ?? 0);
      }
      if (backerEstimate > 0) marginAfter -= cumulativeFlat / backerEstimate;
    } else {
      const backerEstimate = expectedBackers > 0 ? expectedBackers : (pledgeAmount > 0 ? Math.floor(campaignGoal / pledgeAmount) : 0);
      let cumulativeFlat = 0;
      for (let i = 0; i <= idx; i++) {
        if (form.goals[i].costStructure === 'per_backer') marginAfter -= (form.goals[i].perBackerCost ?? 0);
        else cumulativeFlat += (form.goals[i].flatCost ?? 0);
      }
      if (backerEstimate > 0) marginAfter -= cumulativeFlat / backerEstimate;
    }

    let marginLevel: 'ok' | 'thin' | 'negative' = 'ok';
    if (marginAfter < 0) marginLevel = 'negative';
    else if (marginAfter < 3) marginLevel = 'thin';

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

  /* Recommended thresholds */
  const rec1 = Math.round(campaignGoal * 1.5);
  const rec2 = Math.round(campaignGoal * 2);
  const rec3 = Math.round(campaignGoal * 3);
  const profitAt = (threshold: number): number => {
    if (pledgeAmount <= 0 || avgNetPerBacker <= 0) return 0;
    const backers = Math.floor(threshold / pledgeAmount);
    const goalBackers = Math.floor(campaignGoal / pledgeAmount);
    return (backers - goalBackers) * avgNetPerBacker;
  };

  /* Health check */
  const totalStretchCosts = form.goals.reduce((sum, g) => {
    if (g.costStructure === 'flat') return sum + (g.flatCost ?? 0);
    return sum + ((g.perBackerCost ?? 0) * expectedBackers);
  }, 0);

  // KF-003: Keep analysis paired with threshold for proximity warning
  const sortedAnalysis = [...goalAnalysis]
    .filter(a => a.safeThreshold > 0)
    .sort((a, b) => a.safeThreshold - b.safeThreshold);

  const sortedThresholds = sortedAnalysis.map(a => a.safeThreshold);

  // KF-003: Proximity warnings — suppress when both goals are 'Funded by threshold'
  const spacingIssues: string[] = [];
  for (let i = 1; i < sortedAnalysis.length; i++) {
    const prev = sortedAnalysis[i - 1];
    const curr = sortedAnalysis[i];
    if (curr.safeThreshold - prev.safeThreshold < 200) {
      const prevFunded = prev.marginLevel === 'ok';
      const currFunded = curr.marginLevel === 'ok';
      if (prevFunded && currFunded) {
        // Both goals are funded by their threshold — spacing warning suppressed
      } else if (prevFunded || currFunded) {
        spacingIssues.push(
          `Goals at ${fmtDollar(prev.safeThreshold)} and ${fmtDollar(curr.safeThreshold)} are within $200 — one uses threshold funding, but consider whether backers will feel momentum.`
        );
      } else {
        spacingIssues.push(
          `Goals at ${fmtDollar(prev.safeThreshold)} and ${fmtDollar(curr.safeThreshold)} are within $200 of each other — too close, backers won’t feel momentum.`
        );
      }
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

  const maxFunding = Math.max(
    breakoutFunding,
    campaignGoal * 3,
    ...sortedThresholds,
    1,
  );

  const barPercent = (val: number): number => Math.min(100, Math.max(0, (val / maxFunding) * 100));

  return (
    <div className="sg-screen">
      <div className="sg-header">
        <h1 className="sg-title">Stretch Goals</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && '✓ Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* SECTION 1: STRETCH GOAL BUILDER with DnD */}
        <section className="form-section">
          <h2 className="form-section-label">Stretch Goal Builder</h2>
          <p className="form-helper" style={{ marginBottom: 16 }}>
            Enter what each goal costs to produce. KickFlip will calculate the safe unlock threshold and check your margins.
            {form.goals.length > 1 && (
              <span style={{ display: 'block', marginTop: 4 }}>
                Drag the <span style={{ fontWeight: 600 }}>☰</span> handle to reorder.
              </span>
            )}
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={form.goals.map(g => g.id)}
              strategy={verticalListSortingStrategy}
            >
              {form.goals.map((goal, idx) => {
                const analysis = goalAnalysis[idx];
                const hasCost = analysis.isFlat ? (goal.flatCost ?? 0) > 0 : (goal.perBackerCost ?? 0) > 0;
                const showOutputs = hasCost && avgNetPerBacker > 0 && campaignGoal > 0;

                return (
                  <SortableGoalCard
                    key={goal.id}
                    goal={goal}
                    analysis={analysis}
                    showOutputs={showOutputs}
                    avgNetPerBacker={avgNetPerBacker}
                    breakoutFunding={breakoutFunding}
                    campaignGoal={campaignGoal}
                    maxFunding={maxFunding}
                    barPercent={barPercent}
                    fmtDollar={fmtDollar}
                    onUpdate={updateGoal}
                    onRemove={removeGoal}
                  />
                );
              })}
            </SortableContext>
          </DndContext>

          <button className="add-btn" onClick={addGoal}>+ Add Stretch Goal</button>
        </section>

        {/* SECTION 2: RECOMMENDED THRESHOLDS */}
        {campaignGoal > 0 && avgNetPerBacker > 0 && (
          <section className="form-section">
            <h2 className="form-section-label">Recommended Thresholds</h2>
            <div className="sg-recs">
              {[
                { label: 'First stretch goal', amount: rec1, mult: '1.5×' },
                { label: 'Second stretch goal', amount: rec2, mult: '2×' },
                { label: 'Third stretch goal', amount: rec3, mult: '3×' },
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
                Stretch goals work best when each threshold requires only 20–40% more backers than the previous milestone.
              </p>
            </div>
          </section>
        )}

        {/* SECTION 3: LADDER HEALTH CHECK */}
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
                      <span className="sg-health-threshold">{a.safeThreshold > 0 ? fmtDollar(a.safeThreshold) : '—'}</span>
                      <span className={`sg-health-status ${dotClass}`}>{statusText}</span>
                    </div>
                  );
                })}
              </div>

              {spacingIssues.map((issue, i) => (
                <div key={i} className="form-warning" style={{ marginBottom: 8 }}>{issue}</div>
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

/* =========================================
   Sortable Goal Card
   ========================================= */

interface GoalAnalysis {
  goal: StretchGoal;
  safeThreshold: number;
  additionalBackers: number;
  marginAfter: number;
  marginLevel: 'ok' | 'thin' | 'negative';
  timingText: string;
  cost: number;
  isFlat: boolean;
}

interface SortableGoalCardProps {
  goal: StretchGoal;
  analysis: GoalAnalysis;
  showOutputs: boolean;
  avgNetPerBacker: number;
  breakoutFunding: number;
  campaignGoal: number;
  maxFunding: number;
  barPercent: (val: number) => number;
  fmtDollar: (n: number) => string;
  onUpdate: (id: string, patch: Partial<StretchGoal>) => void;
  onRemove: (id: string) => void;
}

const SortableGoalCard: React.FC<SortableGoalCardProps> = ({
  goal, analysis, showOutputs, avgNetPerBacker, breakoutFunding, campaignGoal,
  maxFunding, barPercent, fmtDollar, onUpdate, onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="printer-card sg-card">
      <div className="printer-card-top">
        {/* KF-002: Drag handle */}
        <button
          className="sg-drag-handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          tabIndex={0}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8-16a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
          </svg>
        </button>

        <div className="printer-card-fields">
          <div className="form-field" style={{ flex: 2 }}>
            <label className="form-label">Goal name</label>
            <input
              type="text"
              className="form-input"
              value={goal.name}
              onChange={e => onUpdate(goal.id, { name: e.target.value })}
              placeholder="e.g. Illustrated chapter headers"
            />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label className="form-label">Goal type</label>
            <select
              className="form-input"
              value={goal.goalType}
              onChange={e => onUpdate(goal.id, { goalType: e.target.value as StretchGoalType })}
            >
              {GOAL_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="remove-btn" onClick={() => onRemove(goal.id)} title="Remove">&times;</button>
      </div>

      {goal.goalType === 'Custom' && (
        <div className="form-field" style={{ marginTop: 8 }}>
          <label className="form-label">Custom type</label>
          <input
            type="text"
            className="form-input"
            value={goal.customType}
            onChange={e => onUpdate(goal.id, { customType: e.target.value })}
            placeholder="Describe your stretch goal type"
          />
        </div>
      )}

      {COST_HINTS[goal.goalType] && (
        <div className="sg-cost-hint">
          {COST_HINTS[goal.goalType]}
        </div>
      )}

      <div className="printer-card-costs" style={{ marginTop: 8 }}>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label">Cost structure</label>
          <div className="radio-group">
            <label className={`radio-option${goal.costStructure === 'flat' ? ' active' : ''}`}>
              <input
                type="radio"
                name={`costStruct-${goal.id}`}
                checked={goal.costStructure === 'flat'}
                onChange={() => onUpdate(goal.id, { costStructure: 'flat' })}
              />
              One-time flat cost
            </label>
            <label className={`radio-option${goal.costStructure === 'per_backer' ? ' active' : ''}`}>
              <input
                type="radio"
                name={`costStruct-${goal.id}`}
                checked={goal.costStructure === 'per_backer'}
                onChange={() => onUpdate(goal.id, { costStructure: 'per_backer' })}
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
                onChange={e => onUpdate(goal.id, { flatCost: e.target.value === '' ? null : Number(e.target.value) })}
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
                onChange={e => onUpdate(goal.id, { perBackerCost: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="e.g. 2.50"
                min={0}
                step={0.01}
              />
            </>
          )}
        </div>
      </div>

      {showOutputs && (
        <div className="sg-outputs">
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

          <div className="sg-output-row">
            <div className="sg-output-label">Profit Buffer Check</div>
            <div className="sg-output-value">
              <span>Current avg net per backer: <strong>{fmtDollar(avgNetPerBacker)}</strong></span>
              <span style={{ margin: '0 6px' }}>{'→'}</span>
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

          {analysis.isFlat && analysis.safeThreshold > 0 && (
            <div className="sg-output-row">
              <div className="sg-output-label">Funding Progress</div>
              <div className="sg-funding-bar-wrap">
                <div className="sg-funding-bar">
                  <div className="sg-funding-bar-fill" style={{ width: `${barPercent(breakoutFunding > 0 ? breakoutFunding : campaignGoal * 2)}%` }} />
                  <div className="sg-bar-marker sg-bar-marker-goal" style={{ left: `${barPercent(campaignGoal)}%` }}>
                    <div className="sg-bar-marker-line" />
                    <div className="sg-bar-marker-label">Goal</div>
                  </div>
                  <div className="sg-bar-marker sg-bar-marker-threshold" style={{ left: `${barPercent(analysis.safeThreshold)}%` }}>
                    <div className="sg-bar-marker-line" />
                    <div className="sg-bar-marker-label">{goal.name || 'SG'}</div>
                  </div>
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
};

export default StretchGoals;
