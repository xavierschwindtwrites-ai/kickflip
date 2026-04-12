import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CampaignData,
  FulfillmentPlannerData,
  BookSetupData,
  PrinterQuotesData,
  PromotionalToolsData,
  PledgeManagerPlatform,
} from '../../types/campaign';
import {
  defaultFulfillmentPlanner,
  DEFAULT_BOOK_SETUP,
  defaultPrinterQuotes,
  defaultPromotionalTools,
} from '../../types/campaign';
import type { NavItem } from '../app';

interface FulfillmentPlannerProps {
  campaignId: number;
  onNavChange: (item: NavItem) => void;
}

function formatDate(iso: string): string {
  if (!iso) return 'Not set';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const BACKER_COMMS = [
  { key: 'thankYou', label: 'Campaign funded \u2014 send thank you update', timing: 'Day 0 after campaign ends', dateKey: 'endDate' as const },
  { key: 'pmOpen', label: 'Pledge manager open \u2014 notify all backers', timing: 'Week 1\u20132', dateKey: 'pledgeManagerOpenDate' as const },
  { key: 'pmClosing', label: 'Pledge manager closing soon \u2014 reminder email', timing: '3 days before close', dateKey: 'pledgeManagerCloseDate' as const },
  { key: 'filesSubmitted', label: 'Files submitted to printer \u2014 update backers', timing: 'On submission date', dateKey: 'printFileSubmissionDate' as const },
  { key: 'printDone', label: 'Printing complete \u2014 update backers', timing: 'On completion date', dateKey: 'expectedPrintCompletionDate' as const },
  { key: 'shippingBegun', label: 'Shipping has begun \u2014 update backers with tracking info plan', timing: 'On shipping start', dateKey: 'shippingStartDate' as const },
  { key: 'fulfilled', label: 'Fulfillment complete \u2014 final thank you update', timing: 'On completion', dateKey: 'estimatedFulfillmentCompleteDate' as const },
];

const HIDDEN_COSTS = [
  { key: 'packaging', label: 'Packaging materials (mailers, boxes, tissue paper, tape)' },
  { key: 'ink', label: 'Printer ink / label costs if self-shipping' },
  { key: 'customs', label: 'Customs / VAT for international orders' },
  { key: 'pmFees', label: 'Backerkit or pledge manager fees' },
  { key: 'addressCorrection', label: 'Address correction fees from returned packages' },
  { key: 'currencyConversion', label: 'Currency conversion fees if paying international printers' },
  { key: 'paypal', label: 'PayPal fees if backers use PayPal' },
  { key: 'inserts', label: 'Thank you card printing if including inserts' },
];

const PLATFORM_HELPERS: Record<PledgeManagerPlatform, string> = {
  'Backerkit': 'Most popular. ~$0.50\u20131.00 per backer + % of add-on revenue. Best for complex add-ons.',
  'Crowdox': 'Good for simpler campaigns. Flat monthly fee model.',
  'Kickstarter native': 'Free but limited. No add-ons, no address collection flexibility.',
  'Other': '',
};

const FulfillmentPlanner: React.FC<FulfillmentPlannerProps> = ({ campaignId, onNavChange }) => {
  const [form, setForm] = useState<FulfillmentPlannerData>(defaultFulfillmentPlanner);
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [printerQuotes, setPrinterQuotes] = useState<PrinterQuotesData>(defaultPrinterQuotes);
  const [promoTools, setPromoTools] = useState<PromotionalToolsData>(defaultPromotionalTools);
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
          if (p.fulfillmentPlanner) {
            const saved = p.fulfillmentPlanner;
            setForm({
              ...defaultFulfillmentPlanner(),
              ...saved,
              timeline: { ...defaultFulfillmentPlanner().timeline, ...saved.timeline },
            });
          }
          if (p.bookSetup) setBookSetup({ ...DEFAULT_BOOK_SETUP, ...p.bookSetup });
          if (p.printerQuotes) setPrinterQuotes(p.printerQuotes);
          if (p.promotionalTools) setPromoTools({ ...defaultPromotionalTools(), ...p.promotionalTools });
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
      existing.fulfillmentPlanner = form;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  const updateTimeline = useCallback((key: string, value: string) => {
    setForm(prev => ({ ...prev, timeline: { ...prev.timeline, [key]: value } }));
  }, []);

  const toggleBackerComm = useCallback((key: string) => {
    setForm(prev => {
      const has = prev.backerCommsChecks.includes(key);
      return {
        ...prev,
        backerCommsChecks: has
          ? prev.backerCommsChecks.filter(k => k !== key)
          : [...prev.backerCommsChecks, key],
      };
    });
  }, []);

  const toggleHiddenCost = useCallback((key: string) => {
    setForm(prev => {
      const has = prev.hiddenCostChecks.includes(key);
      return {
        ...prev,
        hiddenCostChecks: has
          ? prev.hiddenCostChecks.filter(k => k !== key)
          : [...prev.hiddenCostChecks, key],
      };
    });
  }, []);

  // --- Derived data ---
  const launchDate = bookSetup.targetLaunchDate;
  const campaignLength = promoTools.campaignLength;
  const campaignEndDate = launchDate ? addDays(launchDate, campaignLength) : '';

  // Crossover calc (same as shipping-planner)
  const firstPod = printerQuotes.podPrinters.find(p => p.unitCost !== null && p.unitCost > 0);
  const firstOffset = printerQuotes.offsetPrinters.find(o => o.volumeRows.some(r => r.quantity && r.unitCost));
  let crossoverCopies: number | null = null;

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
      }
    }
  }

  // Build printer dropdown options
  const allPrinters: { id: string; label: string; type: 'pod' | 'offset' }[] = [];
  printerQuotes.podPrinters.forEach(p => {
    const name = p.printerName === 'Other' ? (p.customName || 'Other POD') : (p.printerName || 'Unnamed POD');
    allPrinters.push({ id: p.id, label: `${name} (POD)`, type: 'pod' });
  });
  printerQuotes.offsetPrinters.forEach(p => {
    const name = p.printerName || 'Unnamed Offset';
    allPrinters.push({ id: p.id, label: `${name} (Offset)`, type: 'offset' });
  });

  const selectedPrinter = allPrinters.find(p => p.id === form.confirmedPrinterId);
  const printQty = form.printQuantity ?? 0;

  // Crossover advice
  let crossoverAdvice = '';
  let crossoverColor: 'green' | 'orange' | '' = '';
  if (crossoverCopies !== null && printQty > 0 && selectedPrinter) {
    if (selectedPrinter.type === 'pod' && printQty >= crossoverCopies) {
      crossoverAdvice = `Based on your quotes, offset becomes cost-effective at ${crossoverCopies.toLocaleString()} copies. Your planned quantity is ${printQty.toLocaleString()}. You might save money with offset printing.`;
      crossoverColor = 'orange';
    } else if (selectedPrinter.type === 'pod' && printQty < crossoverCopies) {
      crossoverAdvice = `Based on your quotes, offset becomes cost-effective at ${crossoverCopies.toLocaleString()} copies. Your planned quantity of ${printQty.toLocaleString()} is below that \u2014 POD is the right call.`;
      crossoverColor = 'green';
    } else if (selectedPrinter.type === 'offset' && printQty >= crossoverCopies) {
      crossoverAdvice = `Based on your quotes, offset becomes cost-effective at ${crossoverCopies.toLocaleString()} copies. Your planned quantity of ${printQty.toLocaleString()} is above that \u2014 offset is the right call.`;
      crossoverColor = 'green';
    } else if (selectedPrinter.type === 'offset' && printQty < crossoverCopies) {
      crossoverAdvice = `Based on your quotes, offset becomes cost-effective at ${crossoverCopies.toLocaleString()} copies. Your planned quantity is only ${printQty.toLocaleString()}. POD might be cheaper at this volume.`;
      crossoverColor = 'orange';
    }
  }

  // Validation warnings
  const tl = form.timeline;
  const warnings: Record<string, string> = {};
  if (tl.pledgeManagerCloseDate && tl.pledgeManagerOpenDate && tl.pledgeManagerCloseDate <= tl.pledgeManagerOpenDate) {
    warnings.pledgeManagerCloseDate = 'Close date must be after open date';
  }
  if (tl.printFileSubmissionDate && tl.expectedPrintCompletionDate && tl.printFileSubmissionDate >= tl.expectedPrintCompletionDate) {
    warnings.printFileSubmissionDate = 'File submission must be before print completion';
  }
  if (tl.shippingStartDate && tl.expectedPrintCompletionDate && tl.shippingStartDate < tl.expectedPrintCompletionDate) {
    warnings.shippingStartDate = 'Shipping start should be after print completion';
  }

  // Timeline milestones for visual
  const timelineMilestones = [
    { label: 'Campaign ends', date: campaignEndDate, set: !!campaignEndDate },
    { label: 'Pledge manager opens', date: tl.pledgeManagerOpenDate, set: !!tl.pledgeManagerOpenDate },
    { label: 'Pledge manager closes', date: tl.pledgeManagerCloseDate, set: !!tl.pledgeManagerCloseDate },
    { label: 'Print files submitted', date: tl.printFileSubmissionDate, set: !!tl.printFileSubmissionDate },
    { label: 'Printing complete', date: tl.expectedPrintCompletionDate, set: !!tl.expectedPrintCompletionDate },
    { label: 'Shipping begins', date: tl.shippingStartDate, set: !!tl.shippingStartDate },
    { label: 'All orders shipped', date: tl.estimatedFulfillmentCompleteDate, set: !!tl.estimatedFulfillmentCompleteDate },
  ];

  // Resolve suggested date for backer comms
  const getCommDate = (dateKey: string): string => {
    if (dateKey === 'endDate') return campaignEndDate;
    if (dateKey === 'pledgeManagerCloseDate' && tl.pledgeManagerCloseDate) {
      return addDays(tl.pledgeManagerCloseDate, -3);
    }
    return (tl as unknown as Record<string, string>)[dateKey] || '';
  };

  const hiddenCheckedCount = form.hiddenCostChecks.length;
  const hiddenTotal = HIDDEN_COSTS.length;

  return (
    <div className="fp-screen">
      <div className="fp-header">
        <h1 className="fp-title">Fulfillment Planner</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving\u2026'}
          {saveStatus === 'saved' && '\u2713 Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* 1. FULFILLMENT TIMELINE */}
        <section className="form-section fp-section-wide">
          <h2 className="form-section-label">Fulfillment Timeline</h2>

          <div className="fp-timeline-layout">
            {/* Visual timeline */}
            <div className="fp-timeline-visual">
              <div className="pt-timeline">
                <div className="pt-timeline-line" />
                {timelineMilestones.map((m, idx) => (
                  <div key={idx} className={`pt-timeline-item${idx === 0 ? ' first' : ''}${idx === timelineMilestones.length - 1 ? ' last' : ''}`}>
                    <div className={`pt-timeline-dot${!m.set ? ' unset' : ''}`} />
                    <div className="pt-timeline-content">
                      <span className="pt-timeline-label">{m.label}</span>
                      <span className={`pt-timeline-date${!m.set ? ' muted' : ''}`}>
                        {m.set ? formatDate(m.date) : 'Not set'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Date inputs */}
            <div className="fp-timeline-inputs">
              <div className="form-field">
                <label className="form-label">Campaign end date</label>
                <div className="fp-display-value">
                  {campaignEndDate ? formatDate(campaignEndDate) : 'Not available'}
                  {!campaignEndDate && (
                    <button className="pt-link-btn" onClick={() => onNavChange('Book Setup')}>
                      Set in Book Setup / Promotional Tools
                    </button>
                  )}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">When will you open your pledge manager?</label>
                <input
                  type="date"
                  className="form-input"
                  value={tl.pledgeManagerOpenDate}
                  onChange={e => updateTimeline('pledgeManagerOpenDate', e.target.value)}
                />
                <span className="form-helper">Typically 1{'\u2013'}2 weeks after campaign ends</span>
              </div>

              <div className="form-field">
                <label className="form-label">Pledge manager deadline for backers</label>
                <input
                  type="date"
                  className={`form-input${warnings.pledgeManagerCloseDate ? ' input-warn' : ''}`}
                  value={tl.pledgeManagerCloseDate}
                  onChange={e => updateTimeline('pledgeManagerCloseDate', e.target.value)}
                />
                {warnings.pledgeManagerCloseDate && (
                  <span className="form-warning">{warnings.pledgeManagerCloseDate}</span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">When will you submit final files to printer?</label>
                <input
                  type="date"
                  className={`form-input${warnings.printFileSubmissionDate ? ' input-warn' : ''}`}
                  value={tl.printFileSubmissionDate}
                  onChange={e => updateTimeline('printFileSubmissionDate', e.target.value)}
                />
                {warnings.printFileSubmissionDate && (
                  <span className="form-warning">{warnings.printFileSubmissionDate}</span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">Printer&apos;s estimated completion date</label>
                <input
                  type="date"
                  className="form-input"
                  value={tl.expectedPrintCompletionDate}
                  onChange={e => updateTimeline('expectedPrintCompletionDate', e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">When do you plan to start shipping?</label>
                <input
                  type="date"
                  className={`form-input${warnings.shippingStartDate ? ' input-warn' : ''}`}
                  value={tl.shippingStartDate}
                  onChange={e => updateTimeline('shippingStartDate', e.target.value)}
                />
                {warnings.shippingStartDate && (
                  <span className="form-warning">{warnings.shippingStartDate}</span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">When do you expect all orders shipped?</label>
                <input
                  type="date"
                  className="form-input"
                  value={tl.estimatedFulfillmentCompleteDate}
                  onChange={e => updateTimeline('estimatedFulfillmentCompleteDate', e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. PRINTER DECISION */}
        <section className="form-section">
          <h2 className="form-section-label">Confirmed Print Strategy</h2>

          <div className="form-field">
            <label className="form-label">Which printer will you use for fulfillment?</label>
            <select
              className="form-input"
              value={form.confirmedPrinterId}
              onChange={e => setForm(prev => ({ ...prev, confirmedPrinterId: e.target.value }))}
            >
              <option value="">Select a printer</option>
              {allPrinters.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            {allPrinters.length === 0 && (
              <span className="form-helper">
                No printers entered yet.{' '}
                <button className="pt-link-btn" onClick={() => onNavChange('Printer Quotes')}>Add in Printer Quotes</button>
              </span>
            )}
          </div>

          <div className="form-field">
            <label className="form-label">Print quantity</label>
            <input
              type="number"
              className="form-input"
              value={form.printQuantity ?? ''}
              onChange={e => setForm(prev => ({ ...prev, printQuantity: e.target.value === '' ? null : Number(e.target.value) }))}
              placeholder="e.g. 500"
              min={0}
              step={1}
              style={{ maxWidth: 200 }}
            />
          </div>

          {crossoverAdvice && (
            <div className={`fp-crossover-note ${crossoverColor}`}>
              {crossoverAdvice}
            </div>
          )}
        </section>

        {/* 3. PLEDGE MANAGER DECISION */}
        <section className="form-section">
          <h2 className="form-section-label">Pledge Manager</h2>

          <div className="form-field">
            <label className="form-label">Will you use a pledge manager?</label>
            <div className="radio-group">
              <label className={`radio-option${form.usePledgeManager === true ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="usePM"
                  checked={form.usePledgeManager === true}
                  onChange={() => setForm(prev => ({ ...prev, usePledgeManager: true }))}
                />
                Yes
              </label>
              <label className={`radio-option${form.usePledgeManager === false ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="usePM"
                  checked={form.usePledgeManager === false}
                  onChange={() => setForm(prev => ({ ...prev, usePledgeManager: false }))}
                />
                No
              </label>
            </div>
          </div>

          {form.usePledgeManager === true && (
            <>
              <div className="form-field">
                <label className="form-label">Which platform?</label>
                <select
                  className="form-input"
                  value={form.pledgeManagerPlatform}
                  onChange={e => setForm(prev => ({ ...prev, pledgeManagerPlatform: e.target.value as PledgeManagerPlatform }))}
                >
                  <option>Backerkit</option>
                  <option>Crowdox</option>
                  <option>Kickstarter native</option>
                  <option>Other</option>
                </select>
                {PLATFORM_HELPERS[form.pledgeManagerPlatform] && (
                  <span className="form-helper">{PLATFORM_HELPERS[form.pledgeManagerPlatform]}</span>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">Estimated pledge manager fee</label>
                <div className="fp-fee-row">
                  <input
                    type="number"
                    className="form-input"
                    value={form.pledgeManagerFee ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, pledgeManagerFee: e.target.value === '' ? null : Number(e.target.value) }))}
                    placeholder="0"
                    min={0}
                    step={0.01}
                    style={{ maxWidth: 120 }}
                  />
                  <div className="radio-group">
                    <label className={`radio-option${form.pledgeManagerFeeType === 'percent' ? ' active' : ''}`}>
                      <input
                        type="radio"
                        name="feeType"
                        checked={form.pledgeManagerFeeType === 'percent'}
                        onChange={() => setForm(prev => ({ ...prev, pledgeManagerFeeType: 'percent' }))}
                      />
                      %
                    </label>
                    <label className={`radio-option${form.pledgeManagerFeeType === 'flat' ? ' active' : ''}`}>
                      <input
                        type="radio"
                        name="feeType"
                        checked={form.pledgeManagerFeeType === 'flat'}
                        onChange={() => setForm(prev => ({ ...prev, pledgeManagerFeeType: 'flat' }))}
                      />
                      Flat ($)
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* 4. BACKER COMMUNICATION SCHEDULE */}
        <section className="form-section">
          <h2 className="form-section-label">Backer Communication Schedule</h2>

          <div className="pt-checklist">
            {BACKER_COMMS.map(item => {
              const checked = form.backerCommsChecks.includes(item.key);
              const suggestedDate = getCommDate(item.dateKey);
              return (
                <label key={item.key} className={`pt-check-item${checked ? ' checked' : ''}`}>
                  <span className={`pt-checkbox${checked ? ' checked' : ''}`}>
                    {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBackerComm(item.key)}
                    className="pt-check-hidden"
                  />
                  <div className="pt-check-content">
                    <span className="pt-check-label">{item.label}</span>
                    <span className="pt-check-helper">
                      {suggestedDate ? `${item.timing} \u2014 ${formatDate(suggestedDate)}` : item.timing}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* 5. HIDDEN COSTS REMINDER */}
        <section className="form-section">
          <h2 className="form-section-label">Don&apos;t Get Caught &mdash; Costs to Account For</h2>

          <div className="fp-hidden-costs-box">
            <div className="fp-hidden-costs-header">
              <span className="fp-hidden-costs-count">
                {hiddenCheckedCount} of {hiddenTotal} accounted for
              </span>
            </div>

            <div className="pt-checklist">
              {HIDDEN_COSTS.map(item => {
                const checked = form.hiddenCostChecks.includes(item.key);
                return (
                  <label key={item.key} className={`pt-check-item${checked ? ' checked' : ''}`}>
                    <span className={`pt-checkbox${checked ? ' checked' : ''}`}>
                      {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleHiddenCost(item.key)}
                      className="pt-check-hidden"
                    />
                    <div className="pt-check-content">
                      <span className="pt-check-label">{item.label}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FulfillmentPlanner;
