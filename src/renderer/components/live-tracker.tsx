import React, { useState, useEffect, useRef, useMemo } from 'react';
import type {
  CampaignData,
  LiveCampaignData,
  LiveCampaignEntry,
  PricingTiersData,
  PromotionalToolsData,
} from '../../types/campaign';
import {
  defaultLiveCampaign,
  createLiveCampaignEntry,
  defaultPricingTiers,
  defaultPromotionalTools,
  uid,
} from '../../types/campaign';

interface LiveTrackerProps {
  campaignId: number;
}

const LiveTracker: React.FC<LiveTrackerProps> = ({ campaignId }) => {
  const [form, setForm] = useState<LiveCampaignData>(defaultLiveCampaign());
  const [pricingTiers, setPricingTiers] = useState<PricingTiersData>(defaultPricingTiers());
  const [promoTools, setPromoTools] = useState<PromotionalToolsData>(defaultPromotionalTools());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaign = await window.kickflip.loadCampaign(campaignId);
      if (cancelled) return;
      if (campaign?.data) {
        try {
          const p: CampaignData = JSON.parse(campaign.data);
          if (p.liveCampaign) setForm({ ...defaultLiveCampaign(), ...p.liveCampaign });
          if (p.pricingTiers) setPricingTiers(p.pricingTiers);
          if (p.promotionalTools) setPromoTools({ ...defaultPromotionalTools(), ...p.promotionalTools });
        } catch { /* ignore */ }
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
        if (c?.data) existing = JSON.parse(c.data);
      } catch { /* ignore */ }
      existing.liveCampaign = form;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  const sortedEntries = useMemo(
    () => [...form.entries].sort((a, b) => a.date.localeCompare(b.date)),
    [form.entries]
  );

  const goal = pricingTiers.goal;
  const campaignDays = promoTools.campaignLength || 30;

  const stats = useMemo(() => {
    const funded = sortedEntries.filter(e => e.funding !== null);
    if (funded.length === 0) return null;
    const latest = funded[funded.length - 1];
    const totalRaised = latest.funding ?? 0;
    const totalBackers = latest.backers ?? 0;
    const daysElapsed = funded.length;
    const dailyAvg = daysElapsed > 0 ? totalRaised / daysElapsed : 0;
    const daysRemaining = Math.max(0, campaignDays - daysElapsed);
    const projected = totalRaised + dailyAvg * daysRemaining;
    const pctFunded = goal ? Math.round((totalRaised / goal) * 100) : null;
    const onTrack = goal ? projected >= goal : null;
    return { totalRaised, totalBackers, daysElapsed, dailyAvg, daysRemaining, projected, pctFunded, onTrack };
  }, [sortedEntries, goal, campaignDays]);

  function updateEntry(id: string, field: keyof LiveCampaignEntry, raw: string) {
    setForm(prev => ({
      ...prev,
      entries: prev.entries.map(e =>
        e.id === id
          ? { ...e, [field]: field === 'date' ? raw : raw === '' ? null : Number(raw) }
          : e
      ),
    }));
  }

  function addEntry() {
    const today = new Date().toISOString().slice(0, 10);
    const newEntry: LiveCampaignEntry = { id: uid(), date: today, backers: null, funding: null };
    setForm(prev => ({ ...prev, entries: [...prev.entries, newEntry] }));
  }

  function removeEntry(id: string) {
    setForm(prev => ({ ...prev, entries: prev.entries.filter(e => e.id !== id) }));
  }

  return (
    <div className="book-setup">
      <div className="book-setup-header">
        <h1 className="book-setup-title">Live Tracker</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && '✓ Saved'}
        </span>
      </div>

      <div className="form-scroll">
        <section className="form-section">
          <h2 className="form-section-label">Campaign Status</h2>
          <label className="lt-active-toggle">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
            />
            <span>Campaign is live</span>
          </label>
          {!form.isActive && (
            <p className="form-helper-block" style={{ marginTop: 10 }}>
              Enable this when your Kickstarter campaign goes live to start logging daily updates.
            </p>
          )}
        </section>

        {form.isActive && (
          <>
            {stats && (
              <section className="form-section">
                <h2 className="form-section-label">Today&rsquo;s Snapshot</h2>
                <div className="lt-hero-stats">
                  <StatCard
                    label="Total raised"
                    value={`$${stats.totalRaised.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    sub={stats.pctFunded !== null ? `${stats.pctFunded}% funded` : undefined}
                    tone={stats.onTrack === true ? 'good' : stats.onTrack === false ? 'warn' : 'neutral'}
                  />
                  <StatCard
                    label="Total backers"
                    value={stats.totalBackers.toLocaleString()}
                  />
                  <StatCard
                    label="Daily average"
                    value={`$${Math.round(stats.dailyAvg).toLocaleString()}/day`}
                    sub={`day ${stats.daysElapsed} of ${campaignDays}`}
                  />
                  <StatCard
                    label="Projected final"
                    value={`$${Math.round(stats.projected).toLocaleString()}`}
                    sub={goal ? (stats.onTrack ? '✓ On track to fund' : '⚠ Below goal pace') : undefined}
                    tone={stats.onTrack === true ? 'good' : stats.onTrack === false ? 'warn' : 'neutral'}
                  />
                </div>
              </section>
            )}

            {sortedEntries.filter(e => e.funding !== null).length >= 2 && (
              <section className="form-section">
                <h2 className="form-section-label">Funding Chart</h2>
                <FundingChart entries={sortedEntries} goal={goal} campaignDays={campaignDays} />
              </section>
            )}

            <section className="form-section">
              <h2 className="form-section-label">Daily Entries</h2>
              <p className="form-helper-block">
                Log cumulative backers and funding at the end of each day. Kickstarter shows these
                on your campaign dashboard.
              </p>

              {form.entries.length > 0 && (
                <div className="lt-table-wrap">
                  <table className="lt-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Total backers</th>
                        <th>Total raised ($)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.entries.map(entry => (
                        <tr key={entry.id}>
                          <td>
                            <input
                              type="date"
                              className="form-input"
                              value={entry.date}
                              onChange={e => updateEntry(entry.id, 'date', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              value={entry.backers ?? ''}
                              onChange={e => updateEntry(entry.id, 'backers', e.target.value)}
                              placeholder="0"
                              min={0}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              value={entry.funding ?? ''}
                              onChange={e => updateEntry(entry.id, 'funding', e.target.value)}
                              placeholder="0"
                              min={0}
                              step={0.01}
                            />
                          </td>
                          <td>
                            <button
                              className="lt-remove-btn"
                              onClick={() => removeEntry(entry.id)}
                              aria-label="Remove entry"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button className="lt-add-btn" onClick={addEntry}>
                + Add day
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

/* ---- Sub-components ---- */

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn' | 'neutral';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, tone = 'neutral' }) => (
  <div className={`lt-stat lt-stat--${tone}`}>
    <span className="lt-stat-value">{value}</span>
    <span className="lt-stat-label">{label}</span>
    {sub && <span className="lt-stat-sub">{sub}</span>}
  </div>
);

interface FundingChartProps {
  entries: LiveCampaignEntry[];
  goal: number | null;
  campaignDays: number;
}

const FundingChart: React.FC<FundingChartProps> = ({ entries, goal, campaignDays }) => {
  const funded = entries.filter(e => e.funding !== null);
  if (funded.length < 2) return null;

  const W = 560;
  const H = 200;
  const pad = { top: 16, right: 20, bottom: 32, left: 64 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const fundingValues = funded.map(e => e.funding as number);
  const maxY = Math.max(goal ?? 0, ...fundingValues) * 1.05 || 1;
  const n = funded.length;

  const xS = (i: number) => pad.left + (i / Math.max(n - 1, 1)) * innerW;
  const yS = (v: number) => pad.top + innerH - (v / maxY) * innerH;

  const pts = funded.map((e, i) => `${xS(i)},${yS(e.funding as number)}`).join(' ');

  const goalY = goal ? yS(goal) : null;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    v: Math.round(maxY * f),
    y: yS(maxY * f),
  }));

  return (
    <div className="lt-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="lt-chart">
        {/* Grid lines */}
        {yTicks.map(t => (
          <g key={t.v}>
            <line x1={pad.left} y1={t.y} x2={W - pad.right} y2={t.y} className="lt-chart-grid" />
            <text x={pad.left - 6} y={t.y + 4} className="lt-chart-tick">
              ${t.v >= 1000 ? `${(t.v / 1000).toFixed(0)}k` : t.v}
            </text>
          </g>
        ))}

        {/* Goal line */}
        {goalY !== null && (
          <>
            <line
              x1={pad.left}
              y1={goalY}
              x2={W - pad.right}
              y2={goalY}
              className="lt-chart-goal-line"
            />
            <text x={W - pad.right + 4} y={goalY + 4} className="lt-chart-goal-label">
              Goal
            </text>
          </>
        )}

        {/* Funding line */}
        <polyline points={pts} className="lt-chart-line" fill="none" />

        {/* Dots */}
        {funded.map((e, i) => (
          <circle
            key={e.id}
            cx={xS(i)}
            cy={yS(e.funding as number)}
            r={3.5}
            className="lt-chart-dot"
          />
        ))}

        {/* X-axis day labels */}
        {funded.map((e, i) => {
          if (i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null;
          return (
            <text key={e.id} x={xS(i)} y={H - 4} className="lt-chart-x-label">
              {e.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default LiveTracker;
