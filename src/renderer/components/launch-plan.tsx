import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { NavItem } from '../app';
import type {
  CampaignData,
  PromotionalToolsData,
  PrelaunchTrackerData,
  OutreachContact,
  BookSetupData,
} from '../../types/campaign';
import {
  defaultPromotionalTools,
  defaultPrelaunchTracker,
  createOutreachContact,
  DEFAULT_BOOK_SETUP,
} from '../../types/campaign';

const INDUSTRY_CONVERSION_RATE = 5; // percent of followers who back

interface LaunchPlanProps {
  campaignId: number;
  onNavChange: (item: NavItem) => void;
}

const READINESS_ITEMS: { key: string; label: string; helper: string }[] = [
  { key: 'email500', label: 'Email list is at least 500 subscribers', helper: 'Under 500 makes funding uncertain unless you have strong social presence' },
  { key: 'arcReaders', label: 'Early readers or reviewers lined up', helper: 'Early reviews build launch momentum' },
  { key: 'ksPage', label: 'Campaign page is fully written and proofread', helper: '' },
  { key: 'video', label: 'Campaign video is filmed and edited', helper: 'Campaigns with video fund at higher rates' },
  { key: 'socialPost', label: 'Social media announcement scheduled for launch day', helper: '' },
  { key: 'friends5', label: 'At least 5 friends or colleagues ready to share on launch day', helper: '' },
  { key: 'preLaunchLink', label: 'Pre-launch page link shared with your email list', helper: '' },
];

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const LaunchPlan: React.FC<LaunchPlanProps> = ({ campaignId, onNavChange }) => {
  const [form, setForm] = useState<PromotionalToolsData>(defaultPromotionalTools);
  const [prelaunch, setPrelaunch] = useState<PrelaunchTrackerData>(defaultPrelaunchTracker);
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
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
          if (p.promotionalTools) setForm({ ...defaultPromotionalTools(), ...p.promotionalTools });
          if (p.prelaunchTracker) setPrelaunch({ ...defaultPrelaunchTracker(), ...p.prelaunchTracker });
          if (p.bookSetup) setBookSetup({ ...DEFAULT_BOOK_SETUP, ...p.bookSetup });
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
      existing.promotionalTools = form;
      existing.prelaunchTracker = prelaunch;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, prelaunch, campaignId]);

  // --- Followers ---
  const setPrelaunchField = useCallback(<K extends keyof PrelaunchTrackerData>(
    key: K, value: PrelaunchTrackerData[K]
  ) => {
    setPrelaunch(prev => ({ ...prev, [key]: value }));
  }, []);

  const conversionRate = prelaunch.conversionRateOverride ?? INDUSTRY_CONVERSION_RATE;
  const conversionFactor = conversionRate / 100;
  const estimatedBackers =
    prelaunch.followerCount !== null ? Math.round(prelaunch.followerCount * conversionFactor) : null;
  const followerProgress =
    prelaunch.followerCount !== null && prelaunch.targetFollowerCount
      ? Math.min(100, Math.round((prelaunch.followerCount / prelaunch.targetFollowerCount) * 100))
      : null;

  const scenarioTargets = [
    { label: 'Conservative', backers: bookSetup.conservativeEstimate },
    { label: 'Expected', backers: bookSetup.expectedEstimate },
    { label: 'Breakout', backers: bookSetup.breakoutEstimate },
  ]
    .filter(s => s.backers !== null && conversionFactor > 0)
    .map(s => ({
      ...s,
      backers: s.backers!,
      followersNeeded: Math.ceil(s.backers! / conversionFactor),
    }));

  // --- Readiness ---
  const isItemChecked = (key: string): boolean => {
    const saved = form.readinessChecks.find(r => r.key === key);
    return saved ? saved.checked : false;
  };

  const toggleCheck = useCallback((key: string) => {
    setForm(prev => {
      const exists = prev.readinessChecks.find(r => r.key === key);
      const updated = exists
        ? prev.readinessChecks.map(r => r.key === key ? { ...r, checked: !r.checked } : r)
        : [...prev.readinessChecks, { key, checked: true }];
      return { ...prev, readinessChecks: updated };
    });
  }, []);

  const emailSize = bookSetup.emailListSize ?? 0;
  const autoEmail = emailSize >= 500;

  // --- Outreach ---
  const addContact = useCallback(() => {
    setForm(prev => ({ ...prev, contacts: [...prev.contacts, createOutreachContact()] }));
  }, []);

  const removeContact = useCallback((id: string) => {
    setForm(prev => ({ ...prev, contacts: prev.contacts.filter(c => c.id !== id) }));
  }, []);

  const updateContact = useCallback((id: string, patch: Partial<OutreachContact>) => {
    setForm(prev => ({
      ...prev,
      contacts: prev.contacts.map(c => c.id === id ? { ...c, ...patch } : c),
    }));
  }, []);

  // --- Timing ---
  const launchDate = bookSetup.targetLaunchDate;
  let campaignLength = form.campaignLength ?? 30;
  let effectiveEndDate = '';
  if (form.useEndDateOverride && form.overrideEndDate && launchDate) {
    const launch = new Date(launchDate + 'T00:00:00');
    const end = new Date(form.overrideEndDate + 'T00:00:00');
    const diffDays = Math.round((end.getTime() - launch.getTime()) / (1000 * 60 * 60 * 24));
    campaignLength = diffDays > 0 ? diffDays : 1;
    effectiveEndDate = form.overrideEndDate;
  } else if (launchDate) {
    effectiveEndDate = addDays(launchDate, campaignLength);
  }

  const milestones = launchDate ? [
    { label: 'Launch day', date: launchDate, dayNum: 0 },
    { label: 'First update due', date: addDays(launchDate, 3), dayNum: 3 },
    { label: 'Stretch goal tease', date: addDays(launchDate, 7), dayNum: 7 },
    { label: 'Midpoint community post', date: addDays(launchDate, Math.floor(campaignLength / 2)), dayNum: Math.floor(campaignLength / 2) },
    { label: 'Last push email', date: addDays(launchDate, campaignLength - 2), dayNum: campaignLength - 2 },
    { label: 'Campaign ends', date: effectiveEndDate || addDays(launchDate, campaignLength), dayNum: campaignLength },
  ] : [];

  return (
    <div className="pt-screen">
      <div className="pt-header">
        <h1 className="pt-title">Launch Plan</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && '✓ Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* 1. PRE-LAUNCH FOLLOWERS */}
        <section className="form-section">
          <h2 className="form-section-label">Pre-launch Followers</h2>
          <p className="form-helper-block">
            People who clicked &ldquo;Notify me on launch.&rdquo; Followers convert to backers far
            better than cold traffic, so this is your best launch predictor.
          </p>

          <div className="printer-card-costs" style={{ maxWidth: 640 }}>
            <div className="form-field">
              <label className="form-label">Current followers</label>
              <input
                type="number"
                className="form-input"
                value={prelaunch.followerCount ?? ''}
                onChange={e => setPrelaunchField('followerCount', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Target before launch</label>
              <input
                type="number"
                className="form-input"
                value={prelaunch.targetFollowerCount ?? ''}
                onChange={e => setPrelaunchField('targetFollowerCount', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="e.g. 500"
                min={0}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Conversion rate %</label>
              <input
                type="number"
                className="form-input"
                value={prelaunch.conversionRateOverride ?? ''}
                onChange={e => setPrelaunchField('conversionRateOverride', e.target.value === '' ? null : Number(e.target.value))}
                placeholder={`${INDUSTRY_CONVERSION_RATE}`}
                min={0}
                max={100}
                step={0.1}
              />
            </div>
          </div>

          {followerProgress !== null && (
            <div className="plt-progress-wrap">
              <div className="plt-progress-bar">
                <div className="plt-progress-fill" style={{ width: `${followerProgress}%` }} />
              </div>
              <span className="plt-progress-label">{followerProgress}% of target</span>
            </div>
          )}

          {estimatedBackers !== null && (
            <div className="plt-estimate-box">
              <span className="plt-estimate-label">Estimated backers at launch</span>
              <span className="plt-estimate-value">{estimatedBackers.toLocaleString()}</span>
              <span className="plt-estimate-basis">
                {prelaunch.followerCount?.toLocaleString()} followers &times; {conversionRate}% conversion
              </span>
            </div>
          )}

          {scenarioTargets.length > 0 && (
            <div className="plt-scenario-rows" style={{ marginTop: 14 }}>
              {scenarioTargets.map(s => {
                const met = prelaunch.followerCount !== null && prelaunch.followerCount >= s.followersNeeded;
                return (
                  <div key={s.label} className={`plt-scenario-row${met ? ' plt-scenario-row--met' : ''}`}>
                    <span className="plt-scenario-label">{s.label}</span>
                    <span className="plt-scenario-backers">{s.backers.toLocaleString()} backers</span>
                    <span className="plt-scenario-followers">{s.followersNeeded.toLocaleString()} followers needed</span>
                    {met && <span className="plt-scenario-check">&#10003; On track</span>}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. LAUNCH READINESS */}
        <section className="form-section">
          <h2 className="form-section-label">Launch Readiness</h2>

          <div className="pt-checklist">
            {READINESS_ITEMS.map((item, idx) => {
              const isAuto = idx === 0 && emailSize > 0;
              const checked = isAuto ? autoEmail : isItemChecked(item.key);
              const autoWarning = isAuto && !autoEmail
                ? `You have ${emailSize.toLocaleString()} subscriber${emailSize !== 1 ? 's' : ''}` : '';

              return (
                <label key={item.key} className={`pt-check-item${checked ? ' checked' : ''}${isAuto && checked ? ' auto-checked' : ''}`}>
                  <span className={`pt-checkbox${checked ? ' checked' : ''}${isAuto && checked ? ' auto' : ''}`}>
                    {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke={isAuto ? '#1a7d3a' : '#fff'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                  {!isAuto && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCheck(item.key)}
                      className="pt-check-hidden"
                    />
                  )}
                  <div className="pt-check-content">
                    <span className="pt-check-label">
                      {isAuto && checked ? '500+ subscribers ✓' : item.label}
                    </span>
                    {item.helper && !autoWarning && (
                      <span className="pt-check-helper">{item.helper}</span>
                    )}
                    {autoWarning && (
                      <span className="pt-check-warning">{autoWarning}</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* 3. CAMPAIGN TIMING */}
        <section className="form-section">
          <h2 className="form-section-label">Campaign Timing</h2>

          <div className="pt-timing-grid">
            <div className="form-field">
              {!form.useEndDateOverride ? (
                <>
                  <label className="form-label">Campaign length (days)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.campaignLength}
                    onChange={e => setForm(prev => ({ ...prev, campaignLength: Math.max(1, Number(e.target.value)) }))}
                    min={1}
                    max={60}
                  />
                  <span className="form-helper">
                    Shorter campaigns create urgency. 30 days is the most common choice.
                  </span>
                </>
              ) : (
                <>
                  <label className="form-label">Specific end date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.overrideEndDate}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(prev => ({ ...prev, overrideEndDate: val }));
                    }}
                  />
                  {launchDate && form.overrideEndDate && (
                    <span className="form-helper">
                      {campaignLength > 0
                        ? `${campaignLength} day campaign`
                        : 'End date must be after launch date'}
                    </span>
                  )}
                </>
              )}

              <label className="pt-override-toggle" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={!!form.useEndDateOverride}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    useEndDateOverride: e.target.checked,
                    overrideEndDate: e.target.checked && launchDate ? addDays(launchDate, prev.campaignLength) : '',
                  }))}
                />
                <span style={{ marginLeft: 8, fontSize: 13 }}>
                  Override with a specific end date
                </span>
              </label>
            </div>

            <div className="form-field">
              <label className="form-label">Target launch date</label>
              <div className="pt-launch-display">
                {launchDate ? formatDate(launchDate) : 'Not set'}
                <button className="pt-link-btn" onClick={() => onNavChange('Project Setup')}>
                  {launchDate ? 'Edit in Project Setup' : 'Set in Project Setup'}
                </button>
              </div>
            </div>
          </div>

          {launchDate && (
            <div className="pt-timeline">
              <div className="pt-timeline-line" />
              {milestones.map((m, idx) => (
                <div key={idx} className={`pt-timeline-item${idx === 0 ? ' first' : ''}${idx === milestones.length - 1 ? ' last' : ''}`}>
                  <div className="pt-timeline-dot" />
                  <div className="pt-timeline-content">
                    <span className="pt-timeline-label">{m.label}</span>
                    <span className="pt-timeline-date">{formatDate(m.date)}</span>
                    <span className="pt-timeline-day">Day {m.dayNum}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. OUTREACH TRACKER */}
        <section className="form-section pt-section-wide">
          <h2 className="form-section-label">Outreach Tracker</h2>

          {form.contacts.length > 0 && (
            <div className="pt-tracker-wrap">
              <table className="pt-tracker-table">
                <thead>
                  <tr>
                    <th className="pt-t-name">Name</th>
                    <th className="pt-t-type">Type</th>
                    <th className="pt-t-date">Contact date</th>
                    <th className="pt-t-status">Status</th>
                    <th className="pt-t-notes">Notes</th>
                    <th className="pt-t-action"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.contacts.map(contact => (
                    <tr key={contact.id}>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={contact.name}
                          onChange={e => updateContact(contact.id, { name: e.target.value })}
                          placeholder="Contact name"
                        />
                      </td>
                      <td>
                        <select
                          className="form-input"
                          value={contact.type}
                          onChange={e => updateContact(contact.id, { type: e.target.value as OutreachContact['type'] })}
                        >
                          <option>Fellow author</option>
                          <option>Book blogger</option>
                          <option>ARC reader</option>
                          <option>Podcast</option>
                          <option>Newsletter</option>
                          <option>Other</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          className="form-input"
                          value={contact.contactDate}
                          onChange={e => updateContact(contact.id, { contactDate: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className="form-input"
                          value={contact.status}
                          onChange={e => updateContact(contact.id, { status: e.target.value as OutreachContact['status'] })}
                        >
                          <option>Not contacted</option>
                          <option>Contacted</option>
                          <option>Responded</option>
                          <option>Confirmed support</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={contact.notes}
                          onChange={e => updateContact(contact.id, { notes: e.target.value })}
                          placeholder="Notes"
                        />
                      </td>
                      <td>
                        <button className="remove-btn" onClick={() => removeContact(contact.id)} title="Remove">&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="add-btn" onClick={addContact}>+ Add Contact</button>
        </section>
      </div>
    </div>
  );
};

export default LaunchPlan;
