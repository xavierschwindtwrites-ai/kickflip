import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CampaignData,
  PricingTiersData,
  RewardTier,
  TierInclude,
  BookSetupData,
  PodPrinter,
} from '../../types/campaign';
import {
  defaultPricingTiers,
  createRewardTier,
  TIER_INCLUDES_OPTIONS,
  DEFAULT_BOOK_SETUP,
} from '../../types/campaign';

const KS_FEE = 0.05;
const PROCESSING_FEE = 0.03;
const TOTAL_FEE = KS_FEE + PROCESSING_FEE;

interface PricingTiersProps {
  campaignId: number;
}

const PricingTiers: React.FC<PricingTiersProps> = ({ campaignId }) => {
  const [form, setForm] = useState<PricingTiersData>(defaultPricingTiers);
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [podPrinters, setPodPrinters] = useState<PodPrinter[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  // Load all data on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaign = await window.kickflip.loadCampaign(campaignId);
      if (cancelled) return;
      if (campaign && campaign.data) {
        try {
          const parsed: CampaignData = JSON.parse(campaign.data);
          if (parsed.pricingTiers) {
            setForm({ ...defaultPricingTiers(), ...parsed.pricingTiers });
          }
          if (parsed.bookSetup) {
            setBookSetup({ ...DEFAULT_BOOK_SETUP, ...parsed.bookSetup });
          }
          if (parsed.printerQuotes) {
            setPodPrinters(parsed.printerQuotes.podPrinters || []);
          }
        } catch { /* keep defaults */ }
      }
      setTimeout(() => { isInitialLoad.current = false; }, 50);
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  // Debounced autosave
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (fadeRef.current) clearTimeout(fadeRef.current);

    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      let existing: CampaignData = {};
      try {
        const campaign = await window.kickflip.loadCampaign(campaignId);
        if (campaign && campaign.data) existing = JSON.parse(campaign.data);
      } catch { /* ignore */ }
      existing.pricingTiers = form;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  // Tier helpers
  const updateTier = useCallback((id: string, patch: Partial<RewardTier>) => {
    setForm(prev => ({
      ...prev,
      tiers: prev.tiers.map(t => t.id === id ? { ...t, ...patch } : t),
    }));
  }, []);

  const addTier = useCallback(() => {
    setForm(prev => ({ ...prev, tiers: [...prev.tiers, createRewardTier()] }));
  }, []);

  const removeTier = useCallback((id: string) => {
    setForm(prev => ({ ...prev, tiers: prev.tiers.filter(t => t.id !== id) }));
  }, []);

  const toggleInclude = useCallback((tierId: string, item: TierInclude) => {
    setForm(prev => ({
      ...prev,
      tiers: prev.tiers.map(t => {
        if (t.id !== tierId) return t;
        const has = t.includes.includes(item);
        return {
          ...t,
          includes: has ? t.includes.filter(i => i !== item) : [...t.includes, item],
          customInclude: item === 'Custom' && has ? '' : t.customInclude,
        };
      }),
    }));
  }, []);

  // Printer lookup helper
  const getPrinter = (id: string): PodPrinter | undefined =>
    podPrinters.find(p => p.id === id);

  const printerLabel = (p: PodPrinter): string =>
    p.printerName === 'Other' ? (p.customName || 'Other') : (p.printerName || 'Unnamed');

  // Usable printers (ones with a cost entered)
  const usablePrinters = podPrinters.filter(p => p.unitCost !== null && p.unitCost > 0);

  // Goal warnings
  const goalWarnings: string[] = [];
  if (form.goal !== null && form.goal < 300) {
    goalWarnings.push('Goals below $300 are very difficult to fulfill safely.');
  }
  if (
    form.goal !== null && form.goal > 2000 &&
    (bookSetup.emailListSize === null || bookSetup.emailListSize < 500)
  ) {
    goalWarnings.push(
      'A goal over $2,000 typically requires a highly engaged list of 500+ subscribers.'
    );
  }

  // Sanity check
  const firstProfitableTier = form.tiers.find(t => {
    if (!t.pledgeAmount || t.pledgeAmount <= 0) return false;
    const printer = getPrinter(t.printerId);
    const unitCost = printer?.unitCost ?? 0;
    const domShip = printer?.domesticShipping ?? 0;
    const net = t.pledgeAmount * (1 - TOTAL_FEE) - unitCost - domShip;
    return net > 0;
  });

  let backersNeeded: number | null = null;
  if (form.goal && form.goal > 0 && firstProfitableTier && firstProfitableTier.pledgeAmount) {
    backersNeeded = Math.ceil(form.goal / firstProfitableTier.pledgeAmount);
  }

  return (
    <div className="pt-screen">
      <div className="pt-header">
        <h1 className="pt-title">Pricing &amp; Tiers</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving\u2026'}
          {saveStatus === 'saved' && '\u2713 Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* FEE EXPLAINER */}
        <div className="form-helper-block pt-fee-note" style={{ maxWidth: 640, marginBottom: 24 }}>
          <strong>Platform fees deducted from every pledge:</strong> Kickstarter 5% + Payment processing 3% = <strong>8% total</strong>.
          All margin calculations below already account for this.
        </div>

        {/* CAMPAIGN GOAL */}
        <section className="form-section">
          <h2 className="form-section-label">Campaign Goal</h2>

          <div className="form-field">
            <label className="form-label">Kickstarter goal ($)</label>
            <input
              type="number"
              className="form-input"
              value={form.goal ?? ''}
              onChange={e => setForm(prev => ({ ...prev, goal: e.target.value === '' ? null : Number(e.target.value) }))}
              placeholder="500"
              min={0}
              step={1}
            />
            <span className="form-helper">The minimum you need to fund. $500 is the recommended safe starting point for most authors.</span>
          </div>
          {goalWarnings.map((w, i) => (
            <div key={i} className="form-warning" style={{ marginTop: 4 }}>{w}</div>
          ))}
        </section>

        {/* REWARD TIERS */}
        <section className="form-section">
          <h2 className="form-section-label">Reward Tiers</h2>

          {form.tiers.length === 0 && (
            <div className="form-warning" style={{ marginBottom: 16 }}>Add at least one reward tier.</div>
          )}

          {form.tiers.map(tier => (
            <TierCard
              key={tier.id}
              tier={tier}
              canRemove={form.tiers.length > 1}
              printers={usablePrinters}
              printerLabel={printerLabel}
              getPrinter={getPrinter}
              onUpdate={updateTier}
              onRemove={removeTier}
              onToggleInclude={toggleInclude}
            />
          ))}

          <button className="add-btn" onClick={addTier}>+ Add Tier</button>
        </section>

        {/* GOAL SANITY CHECK */}
        {form.goal !== null && form.goal > 0 && (
          <div className="pt-sanity-box" style={{ maxWidth: 640 }}>
            {backersNeeded !== null && firstProfitableTier ? (
              <>
                <p>
                  To hit your goal of <strong>${form.goal.toLocaleString()}</strong>, you need approximately{' '}
                  <strong>{backersNeeded} backers</strong> at the{' '}
                  <strong>{firstProfitableTier.name || `$${firstProfitableTier.pledgeAmount}`}</strong> tier.
                </p>
                {bookSetup.conservativeEstimate !== null && backersNeeded > bookSetup.conservativeEstimate && (
                  <p className="pt-sanity-flag">
                    That exceeds your conservative estimate of {bookSetup.conservativeEstimate} copies.
                    Consider a lower goal or higher pledge amounts.
                  </p>
                )}
              </>
            ) : (
              <p>Add a tier with a positive margin to see your backer estimate.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================
   Tier Card
   ========================================= */

interface TierCardProps {
  tier: RewardTier;
  canRemove: boolean;
  printers: PodPrinter[];
  printerLabel: (p: PodPrinter) => string;
  getPrinter: (id: string) => PodPrinter | undefined;
  onUpdate: (id: string, patch: Partial<RewardTier>) => void;
  onRemove: (id: string) => void;
  onToggleInclude: (tierId: string, item: TierInclude) => void;
}

const TierCard: React.FC<TierCardProps> = ({
  tier, canRemove, printers, printerLabel, getPrinter,
  onUpdate, onRemove, onToggleInclude,
}) => {
  const printer = getPrinter(tier.printerId);
  const pledge = tier.pledgeAmount ?? 0;
  const fees = Math.round(pledge * TOTAL_FEE * 100) / 100;
  const afterFees = Math.round((pledge - fees) * 100) / 100;
  const printCost = printer?.unitCost ?? 0;
  const domShip = printer?.domesticShipping ?? 0;
  const intlShip = printer?.internationalShipping ?? 0;
  const netDomestic = Math.round((afterFees - printCost - domShip) * 100) / 100;
  const netIntl = Math.round((afterFees - printCost - intlShip) * 100) / 100;
  const showMargin = pledge > 0 && printer;

  // Validation
  const nameWarn = tier.name === '' ? 'Tier name is required' : undefined;
  const pledgeWarn = tier.pledgeAmount !== null && tier.pledgeAmount <= 0 ? 'Pledge must be greater than $0' : undefined;

  return (
    <div className="printer-card pt-tier-card">
      <div className="printer-card-top">
        <div className="printer-card-fields">
          <div className="form-field" style={{ flex: 2 }}>
            <label className="form-label">Tier name</label>
            <input
              type="text"
              className="form-input"
              value={tier.name}
              onChange={e => onUpdate(tier.id, { name: e.target.value })}
              placeholder="e.g. Signed Paperback"
            />
            {nameWarn && <span className="form-warning">{nameWarn}</span>}
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label className="form-label">Pledge amount ($)</label>
            <input
              type="number"
              className="form-input"
              value={tier.pledgeAmount ?? ''}
              onChange={e => onUpdate(tier.id, { pledgeAmount: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="25"
              min={0}
              step={1}
            />
            {pledgeWarn && <span className="form-warning">{pledgeWarn}</span>}
          </div>
        </div>
        {canRemove && (
          <button className="remove-btn" onClick={() => onRemove(tier.id)} title="Remove tier">&times;</button>
        )}
      </div>

      {/* Includes checklist */}
      <div className="form-field" style={{ marginTop: 4 }}>
        <label className="form-label">What&apos;s included</label>
        <div className="pt-includes-grid">
          {TIER_INCLUDES_OPTIONS.map(item => (
            <label key={item} className={`pt-check-item${tier.includes.includes(item) ? ' active' : ''}`}>
              <input
                type="checkbox"
                checked={tier.includes.includes(item)}
                onChange={() => onToggleInclude(tier.id, item)}
              />
              {item}
            </label>
          ))}
        </div>
        {tier.includes.includes('Custom') && (
          <input
            type="text"
            className="form-input"
            value={tier.customInclude}
            onChange={e => onUpdate(tier.id, { customInclude: e.target.value })}
            placeholder="Describe custom item"
            style={{ marginTop: 8 }}
          />
        )}
      </div>

      {/* Printer + shipping */}
      <div className="printer-card-costs" style={{ marginTop: 4 }}>
        <div className="form-field" style={{ flex: 2 }}>
          <label className="form-label">Print with</label>
          {printers.length > 0 ? (
            <select
              className="form-input form-select"
              value={tier.printerId}
              onChange={e => onUpdate(tier.id, { printerId: e.target.value })}
            >
              <option value="">Select a printer</option>
              {printers.map(p => (
                <option key={p.id} value={p.id}>{printerLabel(p)}</option>
              ))}
            </select>
          ) : (
            <span className="form-helper">No printers added yet — visit Printer Quotes first</span>
          )}
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <label className="form-label">Ships to</label>
          <select
            className="form-input form-select"
            value={tier.shippingType}
            onChange={e => onUpdate(tier.id, { shippingType: e.target.value as RewardTier['shippingType'] })}
          >
            <option value="domestic">Domestic only</option>
            <option value="international">International</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>

      {/* Margin breakdown */}
      {showMargin && (
        <div className="pt-margin">
          <div className="pt-margin-row">
            <span>Pledge amount</span>
            <span>${pledge.toFixed(2)}</span>
          </div>
          <div className="pt-margin-row pt-margin-deduct">
            <span>Kickstarter + processing (8%)</span>
            <span>&minus; ${fees.toFixed(2)}</span>
          </div>
          <div className="pt-margin-row pt-margin-deduct">
            <span>Print cost ({printerLabel(printer)})</span>
            <span>&minus; ${printCost.toFixed(2)}</span>
          </div>

          {(tier.shippingType === 'domestic' || tier.shippingType === 'both') && (
            <>
              <div className="pt-margin-row pt-margin-deduct">
                <span>Shipping — domestic</span>
                <span>&minus; ${domShip.toFixed(2)}</span>
              </div>
              <div className="pt-margin-divider" />
              <div className={`pt-margin-row pt-margin-total ${netDomestic < 0 ? 'negative' : 'positive'}`}>
                <span>Net margin (domestic)</span>
                <span>${netDomestic.toFixed(2)}</span>
              </div>
            </>
          )}

          {(tier.shippingType === 'international' || tier.shippingType === 'both') && (
            <>
              {tier.shippingType === 'both' && (
                <div className="pt-margin-row pt-margin-deduct" style={{ marginTop: 6 }}>
                  <span>Shipping — international</span>
                  <span>&minus; ${intlShip.toFixed(2)}</span>
                </div>
              )}
              {tier.shippingType === 'international' && (
                <div className="pt-margin-row pt-margin-deduct">
                  <span>Shipping — international</span>
                  <span>&minus; ${intlShip.toFixed(2)}</span>
                </div>
              )}
              {tier.shippingType === 'international' && <div className="pt-margin-divider" />}
              <div className={`pt-margin-row pt-margin-total ${netIntl < 0 ? 'negative' : 'positive'}`}>
                <span>Net margin (int&apos;l)</span>
                <span>${netIntl.toFixed(2)}</span>
              </div>
            </>
          )}

          {/* Warnings */}
          {(netDomestic < 0 || netIntl < 0) && (
            <div className="pt-margin-alert pt-margin-alert--red">
              This tier loses money. Increase the pledge amount or choose a cheaper printer.
            </div>
          )}
          {netDomestic >= 0 && netIntl >= 0 && (netDomestic < 2 || netIntl < 2) && (
            <div className="pt-margin-alert pt-margin-alert--orange">
              Thin margin. Consider adding $2–3 to this pledge.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PricingTiers;
