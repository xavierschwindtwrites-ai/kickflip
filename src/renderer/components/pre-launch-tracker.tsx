import React, { useState, useEffect, useRef } from 'react';
import type { CampaignData, PrelaunchTrackerData, BookSetupData } from '../../types/campaign';
import { defaultPrelaunchTracker, DEFAULT_BOOK_SETUP } from '../../types/campaign';

const INDUSTRY_CONVERSION_RATE = 5; // percent

interface PrelaunchTrackerProps {
  campaignId: number;
}

const PrelaunchTracker: React.FC<PrelaunchTrackerProps> = ({ campaignId }) => {
  const [form, setForm] = useState<PrelaunchTrackerData>(defaultPrelaunchTracker());
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
      if (campaign?.data) {
        try {
          const p: CampaignData = JSON.parse(campaign.data);
          if (p.prelaunchTracker) setForm({ ...defaultPrelaunchTracker(), ...p.prelaunchTracker });
          if (p.bookSetup) setBookSetup({ ...DEFAULT_BOOK_SETUP, ...p.bookSetup });
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
      existing.prelaunchTracker = form;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  function setField<K extends keyof PrelaunchTrackerData>(key: K, value: PrelaunchTrackerData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const conversionRate = form.conversionRateOverride ?? INDUSTRY_CONVERSION_RATE;
  const estimatedBackers =
    form.followerCount !== null ? Math.round((form.followerCount * conversionRate) / 100) : null;
  const followerProgress =
    form.followerCount !== null && form.targetFollowerCount
      ? Math.min(100, Math.round((form.followerCount / form.targetFollowerCount) * 100))
      : null;

  const conversionFactor = conversionRate / 100;
  const conservativeNeeded =
    bookSetup.conservativeEstimate !== null && conversionFactor > 0
      ? Math.ceil(bookSetup.conservativeEstimate / conversionFactor)
      : null;
  const expectedNeeded =
    bookSetup.expectedEstimate !== null && conversionFactor > 0
      ? Math.ceil(bookSetup.expectedEstimate / conversionFactor)
      : null;
  const breakoutNeeded =
    bookSetup.breakoutEstimate !== null && conversionFactor > 0
      ? Math.ceil(bookSetup.breakoutEstimate / conversionFactor)
      : null;
  const hasScenarios = conservativeNeeded !== null || expectedNeeded !== null || breakoutNeeded !== null;

  return (
    <div className="book-setup">
      <div className="book-setup-header">
        <h1 className="book-setup-title">Pre-launch Tracker</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && '✓ Saved'}
        </span>
      </div>

      <div className="form-scroll">
        <section className="form-section">
          <h2 className="form-section-label">Kickstarter Followers</h2>
          <p className="form-helper-block">
            Track your pre-launch page followers — people who clicked &ldquo;Notify me on launch.&rdquo;
            Followers convert to backers at a much higher rate than cold traffic, so this number is
            one of your best launch predictors.
          </p>

          <div className="form-field">
            <label className="form-label">Current followers</label>
            <input
              type="number"
              className="form-input"
              value={form.followerCount ?? ''}
              onChange={e => setField('followerCount', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="0"
              min={0}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Target followers before launch</label>
            <input
              type="number"
              className="form-input"
              value={form.targetFollowerCount ?? ''}
              onChange={e =>
                setField('targetFollowerCount', e.target.value === '' ? null : Number(e.target.value))
              }
              placeholder="e.g. 500"
              min={0}
            />
          </div>

          {followerProgress !== null && (
            <div className="plt-progress-wrap">
              <div className="plt-progress-bar">
                <div
                  className="plt-progress-fill"
                  style={{ width: `${followerProgress}%` }}
                />
              </div>
              <span className="plt-progress-label">{followerProgress}% of target</span>
            </div>
          )}
        </section>

        <section className="form-section">
          <h2 className="form-section-label">Conversion Rate</h2>

          <div className="form-field">
            <label className="form-label">
              Override conversion rate %
              <span className="form-label-hint"> — leave blank to use the {INDUSTRY_CONVERSION_RATE}% industry default</span>
            </label>
            <input
              type="number"
              className="form-input"
              value={form.conversionRateOverride ?? ''}
              onChange={e =>
                setField('conversionRateOverride', e.target.value === '' ? null : Number(e.target.value))
              }
              placeholder={`${INDUSTRY_CONVERSION_RATE}`}
              min={0}
              max={100}
              step={0.1}
            />
            <span className="form-helper">
              {form.conversionRateOverride !== null
                ? `Using your custom rate of ${form.conversionRateOverride}%`
                : `Using the ${INDUSTRY_CONVERSION_RATE}% industry default. Successful campaigns often see 5–10%.`}
            </span>
          </div>

          {estimatedBackers !== null && (
            <div className="plt-estimate-box">
              <span className="plt-estimate-label">Estimated backers at launch</span>
              <span className="plt-estimate-value">{estimatedBackers.toLocaleString()}</span>
              <span className="plt-estimate-basis">
                {form.followerCount?.toLocaleString()} followers × {conversionRate}% conversion
              </span>
            </div>
          )}
        </section>

        {hasScenarios && (
          <section className="form-section">
            <h2 className="form-section-label">Follower Targets by Scenario</h2>
            <p className="form-helper-block">
              How many pre-launch followers you&rsquo;d need to hit each of your print run estimates
              at the current {conversionRate}% conversion rate.
            </p>
            <div className="plt-scenario-rows">
              {conservativeNeeded !== null && (
                <ScenarioRow
                  label="Conservative"
                  backers={bookSetup.conservativeEstimate!}
                  followersNeeded={conservativeNeeded}
                  current={form.followerCount}
                />
              )}
              {expectedNeeded !== null && (
                <ScenarioRow
                  label="Expected"
                  backers={bookSetup.expectedEstimate!}
                  followersNeeded={expectedNeeded}
                  current={form.followerCount}
                />
              )}
              {breakoutNeeded !== null && (
                <ScenarioRow
                  label="Breakout"
                  backers={bookSetup.breakoutEstimate!}
                  followersNeeded={breakoutNeeded}
                  current={form.followerCount}
                />
              )}
            </div>
          </section>
        )}

        <section className="form-section">
          <h2 className="form-section-label">Notes</h2>
          <div className="form-field">
            <textarea
              className="form-input form-textarea"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Promotional activities, milestones, audiences to target…"
              rows={4}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

interface ScenarioRowProps {
  label: string;
  backers: number;
  followersNeeded: number;
  current: number | null;
}

const ScenarioRow: React.FC<ScenarioRowProps> = ({ label, backers, followersNeeded, current }) => {
  const met = current !== null && current >= followersNeeded;
  return (
    <div className={`plt-scenario-row${met ? ' plt-scenario-row--met' : ''}`}>
      <span className="plt-scenario-label">{label}</span>
      <span className="plt-scenario-backers">{backers.toLocaleString()} backers</span>
      <span className="plt-scenario-followers">{followersNeeded.toLocaleString()} followers needed</span>
      {met && <span className="plt-scenario-check">✓ On track</span>}
    </div>
  );
};

export default PrelaunchTracker;
