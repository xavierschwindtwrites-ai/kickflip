import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { BookSetupData, CampaignData } from '../../types/campaign';
import { DEFAULT_BOOK_SETUP } from '../../types/campaign';

interface BookSetupProps {
  campaignId: number;
}

type Warnings = Partial<Record<keyof BookSetupData, string>>;

function validate(data: BookSetupData): Warnings {
  const w: Warnings = {};

  if (data.platformFeePercent < 0 || data.platformFeePercent > 25) {
    w.platformFeePercent = 'Platform fee should be between 0 and 25%';
  }
  if (data.paymentFeePercent < 0 || data.paymentFeePercent > 25) {
    w.paymentFeePercent = 'Payment fee should be between 0 and 25%';
  }

  const { conservativeEstimate: con, expectedEstimate: exp, breakoutEstimate: brk } = data;
  if (con !== null && exp !== null && con >= exp) {
    w.conservativeEstimate = 'Conservative should be less than Expected';
  }
  if (exp !== null && brk !== null && exp >= brk) {
    w.expectedEstimate = 'Expected should be less than Breakout';
  }

  return w;
}

const BookSetup: React.FC<BookSetupProps> = ({ campaignId }) => {
  const [form, setForm] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);
  const warnings = validate(form);

  // Load campaign data on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaign = await window.kickflip.loadCampaign(campaignId);
      if (cancelled) return;
      if (campaign && campaign.data) {
        try {
          const parsed: CampaignData = JSON.parse(campaign.data);
          if (parsed.bookSetup) {
            setForm({ ...DEFAULT_BOOK_SETUP, ...parsed.bookSetup });
          }
        } catch {
          // data column was empty or invalid JSON, keep defaults
        }
      }
      // Allow autosave after initial state is set
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
      // Merge with any existing campaign data to preserve other sections
      let existingData: CampaignData = {};
      try {
        const campaign = await window.kickflip.loadCampaign(campaignId);
        if (campaign && campaign.data) {
          existingData = JSON.parse(campaign.data);
        }
      } catch {
        // ignore
      }
      existingData.bookSetup = form;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existingData));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  const updateField = useCallback(<K extends keyof BookSetupData>(
    key: K,
    value: BookSetupData[K]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleText = (key: keyof BookSetupData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateField(key, e.target.value as any);
    };

  const handleNumber = (key: keyof BookSetupData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      updateField(key, val === '' ? null : Number(val) as any);
    };

  return (
    <div className="book-setup">
      <div className="book-setup-header">
        <h1 className="book-setup-title">Project Setup</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving\u2026'}
          {saveStatus === 'saved' && '\u2713 Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* CAMPAIGN BASICS */}
        <section className="form-section">
          <h2 className="form-section-label">Campaign Basics</h2>

          <Field label="Campaign title" warning={warnings.campaignTitle}>
            <input
              type="text"
              className="form-input"
              value={form.campaignTitle}
              onChange={handleText('campaignTitle')}
              placeholder="e.g. Everdarken — Special Edition"
            />
          </Field>

          <Field label="Target launch date">
            <input
              type="date"
              className="form-input"
              value={form.targetLaunchDate}
              onChange={handleText('targetLaunchDate')}
            />
          </Field>

          <Field label="Email list size" helper="Your single best funding predictor — direct reach you own" warning={warnings.emailListSize}>
            <input
              type="number"
              className="form-input"
              value={form.emailListSize ?? ''}
              onChange={handleNumber('emailListSize')}
              placeholder="0"
              min={0}
            />
          </Field>

        </section>

        {/* WHAT YOU'RE MAKING */}
        <section className="form-section">
          <h2 className="form-section-label">What You&rsquo;re Making</h2>

          <Field
            label="Project description"
            helper="Formats, editions, page counts, components — whatever you need on hand when requesting quotes. Optional."
          >
            <textarea
              className="form-input form-textarea"
              value={form.productNotes}
              onChange={e => updateField('productNotes', e.target.value)}
              placeholder="e.g. 320-page 6x9 hardcover + paperback, foil cover, ribbon bookmark"
              rows={3}
            />
          </Field>
        </section>

        {/* PRINT RUN ESTIMATE */}
        <section className="form-section">
          <h2 className="form-section-label">Print Run Estimate</h2>

          <Field label="Conservative estimate — copies" warning={warnings.conservativeEstimate}>
            <input
              type="number"
              className="form-input"
              value={form.conservativeEstimate ?? ''}
              onChange={handleNumber('conservativeEstimate')}
              placeholder="e.g. 500"
              min={0}
            />
          </Field>

          <Field label="Expected estimate — copies" warning={warnings.expectedEstimate}>
            <input
              type="number"
              className="form-input"
              value={form.expectedEstimate ?? ''}
              onChange={handleNumber('expectedEstimate')}
              placeholder="e.g. 1000"
              min={0}
            />
          </Field>

          <Field label="Breakout estimate — copies" warning={warnings.breakoutEstimate}>
            <input
              type="number"
              className="form-input"
              value={form.breakoutEstimate ?? ''}
              onChange={handleNumber('breakoutEstimate')}
              placeholder="e.g. 2500"
              min={0}
            />
          </Field>

          <p className="form-helper-block">
            These become your three planning scenarios throughout KickFlip.
            Conservative = safe floor. Expected = realistic target. Breakout = best case.
          </p>
        </section>

        {/* PLATFORM FEES */}
        <section className="form-section">
          <h2 className="form-section-label">Platform Fees</h2>

          <Field
            label="Platform fee %"
            helper="Kickstarter charges 5% in most countries"
            warning={warnings.platformFeePercent}
          >
            <input
              type="number"
              className="form-input"
              value={form.platformFeePercent}
              onChange={e => updateField('platformFeePercent', e.target.value === '' ? 0 : Number(e.target.value))}
              placeholder="5"
              min={0}
              max={25}
              step={0.1}
            />
          </Field>

          <Field
            label="Payment processing fee %"
            helper="Roughly 3% + per-pledge cents in the US; higher in some regions"
            warning={warnings.paymentFeePercent}
          >
            <input
              type="number"
              className="form-input"
              value={form.paymentFeePercent}
              onChange={e => updateField('paymentFeePercent', e.target.value === '' ? 0 : Number(e.target.value))}
              placeholder="3"
              min={0}
              max={25}
              step={0.1}
            />
          </Field>

          <p className="form-helper-block">
            These rates flow into every margin, scenario, and pricing calculation in KickFlip.
            Launching outside the US? Check Kickstarter&rsquo;s fee page for your country and adjust here.
          </p>
        </section>
      </div>
    </div>
  );
};

/* ---- Sub-components ---- */

interface FieldProps {
  label: string;
  helper?: string;
  warning?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, helper, warning, children }) => (
  <div className="form-field">
    <label className="form-label">{label}</label>
    {children}
    {helper && !warning && <span className="form-helper">{helper}</span>}
    {warning && <span className="form-warning">{warning}</span>}
  </div>
);

export default BookSetup;
