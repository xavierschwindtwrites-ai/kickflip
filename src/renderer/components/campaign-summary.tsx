import React, { useState, useEffect } from 'react';
import type {
  CampaignData,
  BookSetupData,
  PrinterQuotesData,
  PricingTiersData,
  ShippingPlannerData,
  StretchGoalsData,
  FulfillmentPlannerData,
  PromotionalToolsData,
} from '../../types/campaign';
import {
  DEFAULT_BOOK_SETUP,
  totalFeeRate,
  defaultPrinterQuotes,
  defaultPricingTiers,
  defaultShippingPlanner,
  defaultStretchGoals,
  defaultFulfillmentPlanner,
  defaultPromotionalTools,
} from '../../types/campaign';

interface CampaignSummaryProps {
  campaignId: number;
}

function fmt(n: number): string {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const CampaignSummary: React.FC<CampaignSummaryProps> = ({ campaignId }) => {
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [printerQuotes, setPrinterQuotes] = useState<PrinterQuotesData>(defaultPrinterQuotes);
  const [pricingTiers, setPricingTiers] = useState<PricingTiersData>(defaultPricingTiers);
  const [shippingPlanner, setShippingPlanner] = useState<ShippingPlannerData>(defaultShippingPlanner);
  const [stretchGoals, setStretchGoals] = useState<StretchGoalsData>(defaultStretchGoals);
  const [fulfillment, setFulfillment] = useState<FulfillmentPlannerData>(defaultFulfillmentPlanner);
  const [promoTools, setPromoTools] = useState<PromotionalToolsData>(defaultPromotionalTools);
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
          if (p.fulfillmentPlanner) setFulfillment({ ...defaultFulfillmentPlanner(), ...p.fulfillmentPlanner, timeline: { ...defaultFulfillmentPlanner().timeline, ...(p.fulfillmentPlanner?.timeline ?? {}) } });
          if (p.promotionalTools) setPromoTools({ ...defaultPromotionalTools(), ...p.promotionalTools });
        } catch { /* */ }
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  if (!loaded) {
    return (
      <div className="cs-screen">
        <div className="cs-header"><h1 className="cs-title">Campaign Summary</h1></div>
      </div>
    );
  }

  const TOTAL_FEE = totalFeeRate(bookSetup);
  const goal = pricingTiers.goal ?? 0;

  // Shipping
  const enabledRegions = shippingPlanner.regions.filter(r => r.enabled);
  const avgShippingCost = enabledRegions.reduce(
    (sum, r) => sum + ((r.backerPercent ?? 0) / 100) * (r.costPerCopy ?? 0), 0
  );

  // Tiers with margin
  const activeTiers = pricingTiers.tiers.filter(t => t.pledgeAmount !== null && t.pledgeAmount > 0);
  const tierRows = activeTiers.map(t => {
    const isDigital = t.isDigitalOnly ?? false;
    const printer = isDigital ? undefined : printerQuotes.podPrinters.find(p => p.id === t.printerId);
    const printCost = isDigital ? 0 : (printer?.unitCost ?? 0);
    const ship = isDigital ? 0 : (printer?.domesticShipping ?? 0);
    const net = (t.pledgeAmount! * (1 - TOTAL_FEE)) - printCost - ship;
    return { name: t.name || `$${t.pledgeAmount} tier`, pledge: t.pledgeAmount!, net, isDigital };
  });

  // Scenarios (simple equal-weight summary)
  const avgPledge = tierRows.length > 0 ? tierRows.reduce((s, t) => s + t.pledge, 0) / tierRows.length : 0;
  const firstPod = printerQuotes.podPrinters.find(p => p.unitCost !== null && p.unitCost > 0);
  const printCost = firstPod?.unitCost ?? 0;
  const bufferRate = shippingPlanner.bufferPercent / 100;
  const failureRate = shippingPlanner.paymentFailureRate / 100;

  const scenarios = [
    { label: 'Conservative', copies: bookSetup.conservativeEstimate ?? 0 },
    { label: 'Expected', copies: bookSetup.expectedEstimate ?? 0 },
    { label: 'Breakout', copies: bookSetup.breakoutEstimate ?? 0 },
  ].map(sc => {
    const gross = sc.copies * avgPledge;
    const afterFees = gross * (1 - TOTAL_FEE);
    const afterFailures = afterFees * (1 - failureRate);
    const costs = sc.copies * (printCost + avgShippingCost);
    const buffer = afterFailures * bufferRate;
    const net = afterFailures - costs - buffer;
    return { ...sc, gross, net };
  });

  // Timeline
  const tl = fulfillment.timeline;
  const timelineRows = [
    { label: 'Target launch', date: bookSetup.targetLaunchDate },
    { label: 'Pledge manager opens', date: tl.pledgeManagerOpenDate },
    { label: 'Pledge manager closes', date: tl.pledgeManagerCloseDate },
    { label: 'Print files submitted', date: tl.printFileSubmissionDate },
    { label: 'Print run complete', date: tl.expectedPrintCompletionDate },
    { label: 'Shipping starts', date: tl.shippingStartDate },
    { label: 'Fulfillment complete', date: tl.estimatedFulfillmentCompleteDate },
  ].filter(r => r.date);

  // Outreach
  const confirmedContacts = promoTools.contacts.filter(c => c.status === 'Confirmed support');

  const sortedStretch = [...stretchGoals.goals].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="cs-screen">
      <div className="cs-header">
        <h1 className="cs-title">Campaign Summary</h1>
        <button className="cs-print-btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="form-scroll">
        <div className="cs-sheet" id="print-sheet">
          <div className="cs-sheet-header">
            <div>
              <h2 className="cs-campaign-name">{bookSetup.campaignTitle || 'Untitled Campaign'}</h2>
              <p className="cs-book-line">
                {bookSetup.bookTitle || 'Untitled book'}
                {bookSetup.genre ? ` — ${bookSetup.genre}` : ''}
                {bookSetup.pageCount ? ` — ${bookSetup.pageCount} pages` : ''}
              </p>
            </div>
            <div className="cs-key-numbers">
              <div className="cs-key-num">
                <span className="cs-key-label">Goal</span>
                <span className="cs-key-value">{goal > 0 ? `$${goal.toLocaleString()}` : '—'}</span>
              </div>
              <div className="cs-key-num">
                <span className="cs-key-label">Launch</span>
                <span className="cs-key-value">{fmtDate(bookSetup.targetLaunchDate)}</span>
              </div>
            </div>
          </div>

          {/* Scenarios */}
          <section className="cs-section">
            <h3 className="cs-section-title">Funding scenarios</h3>
            <table className="cs-table">
              <thead>
                <tr><th>Scenario</th><th>Backers</th><th>Gross</th><th>Projected net</th></tr>
              </thead>
              <tbody>
                {scenarios.map(sc => (
                  <tr key={sc.label}>
                    <td>{sc.label}</td>
                    <td>{sc.copies.toLocaleString()}</td>
                    <td>{fmt(sc.gross)}</td>
                    <td className={sc.net >= 0 ? 'cs-pos' : 'cs-neg'}>{fmt(sc.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="cs-footnote">
              Net after {(TOTAL_FEE * 100).toFixed(0)}% fees, {shippingPlanner.paymentFailureRate}% payment failures,
              printing, weighted shipping, and {shippingPlanner.bufferPercent}% buffer. Equal tier weighting —
              see Scenario Modeler for the full model.
            </p>
          </section>

          {/* Tiers */}
          {tierRows.length > 0 && (
            <section className="cs-section">
              <h3 className="cs-section-title">Reward tiers</h3>
              <table className="cs-table">
                <thead>
                  <tr><th>Tier</th><th>Pledge</th><th>Net per backer</th></tr>
                </thead>
                <tbody>
                  {tierRows.map((t, i) => (
                    <tr key={i}>
                      <td>{t.name}{t.isDigital ? ' (digital)' : ''}</td>
                      <td>{fmt(t.pledge)}</td>
                      <td className={t.net >= 0 ? 'cs-pos' : 'cs-neg'}>{fmt(t.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Stretch goals */}
          {sortedStretch.length > 0 && (
            <section className="cs-section">
              <h3 className="cs-section-title">Stretch goals</h3>
              <ol className="cs-list">
                {sortedStretch.map(g => (
                  <li key={g.id}>
                    {g.name || (g.goalType === 'Custom' ? g.customType : g.goalType)}
                    {g.costStructure === 'flat' && g.flatCost !== null && ` — ${fmt(g.flatCost)} flat`}
                    {g.costStructure === 'per_backer' && g.perBackerCost !== null && ` — ${fmt(g.perBackerCost)}/backer`}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Timeline */}
          {timelineRows.length > 0 && (
            <section className="cs-section">
              <h3 className="cs-section-title">Fulfillment timeline</h3>
              <table className="cs-table">
                <tbody>
                  {timelineRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.label}</td>
                      <td>{fmtDate(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Confirmed support */}
          {confirmedContacts.length > 0 && (
            <section className="cs-section">
              <h3 className="cs-section-title">Confirmed support ({confirmedContacts.length})</h3>
              <ul className="cs-list">
                {confirmedContacts.map(c => (
                  <li key={c.id}>{c.name} — {c.type}</li>
                ))}
              </ul>
            </section>
          )}

          <p className="cs-generated">
            Generated by KickFlip on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CampaignSummary;
