import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { BookSetupData, CampaignData } from '../../types/campaign';
import { DEFAULT_BOOK_SETUP } from '../../types/campaign';

const GENRES = [
  'Fantasy',
  'Science Fiction',
  'Romance',
  'Thriller',
  'Mystery',
  'Literary Fiction',
  'Horror',
  'Historical Fiction',
  'Non-Fiction',
  'Other',
];

const TRIM_SIZES = [
  '5x8',
  '5.5x8.5',
  '6x9',
  '5.06x7.81',
  '4.25x6.87',
  '8x10',
  '8.5x11',
];

interface BookSetupProps {
  campaignId: number;
}

type Warnings = Partial<Record<keyof BookSetupData, string>>;

function validate(data: BookSetupData): Warnings {
  const w: Warnings = {};

  if (data.pageCount !== null) {
    if (data.pageCount < 24) w.pageCount = 'Page count must be at least 24';
    else if (data.pageCount > 1200) w.pageCount = 'Page count must be 1,200 or fewer';
  }

  if (data.emailOpenRate !== null) {
    if (data.emailOpenRate < 0) w.emailOpenRate = 'Open rate cannot be negative';
    else if (data.emailOpenRate > 100) w.emailOpenRate = 'Open rate cannot exceed 100%';
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

  const handleRadio = (key: keyof BookSetupData, value: string) => () => {
    updateField(key, value as any);
  };

  return (
    <div className="book-setup">
      <div className="book-setup-header">
        <h1 className="book-setup-title">Book Setup</h1>
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
              placeholder="e.g. My Awesome Book Launch"
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

          <Field label="Current subscribers" warning={warnings.emailListSize}>
            <input
              type="number"
              className="form-input"
              value={form.emailListSize ?? ''}
              onChange={handleNumber('emailListSize')}
              placeholder="0"
              min={0}
            />
          </Field>

          <Field
            label="Email open rate %"
            helper="Check your email platform dashboard for this"
            warning={warnings.emailOpenRate}
          >
            <input
              type="number"
              className="form-input"
              value={form.emailOpenRate ?? ''}
              onChange={handleNumber('emailOpenRate')}
              placeholder="0"
              min={0}
              max={100}
              step={0.1}
            />
          </Field>
        </section>

        {/* BOOK DETAILS */}
        <section className="form-section">
          <h2 className="form-section-label">Book Details</h2>

          <Field label="Book title">
            <input
              type="text"
              className="form-input"
              value={form.bookTitle}
              onChange={handleText('bookTitle')}
              placeholder="e.g. The Dragon's Gambit"
            />
          </Field>

          <Field label="Genre">
            <select
              className="form-input form-select"
              value={form.genre}
              onChange={handleText('genre')}
            >
              <option value="">Select a genre</option>
              {GENRES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </Field>

          <Field label="Page count" warning={warnings.pageCount}>
            <input
              type="number"
              className="form-input"
              value={form.pageCount ?? ''}
              onChange={handleNumber('pageCount')}
              placeholder="e.g. 320"
              min={24}
              max={1200}
            />
          </Field>

          <Field label="Trim size">
            <select
              className="form-input form-select"
              value={form.trimSize}
              onChange={handleText('trimSize')}
            >
              <option value="">Select a trim size</option>
              {TRIM_SIZES.map(s => (
                <option key={s} value={s}>{s}&quot;</option>
              ))}
            </select>
          </Field>

          <RadioGroup
            label="Interior"
            name="interior"
            options={[
              { value: 'bw', label: 'Black & White' },
              { value: 'color', label: 'Full Color' },
            ]}
            selected={form.interior}
            onChange={handleRadio}
            field="interior"
          />

          <RadioGroup
            label="Cover finish"
            name="coverFinish"
            options={[
              { value: 'matte', label: 'Matte' },
              { value: 'glossy', label: 'Glossy' },
            ]}
            selected={form.coverFinish}
            onChange={handleRadio}
            field="coverFinish"
          />

          <RadioGroup
            label="Cover type"
            name="coverType"
            options={[
              { value: 'paperback', label: 'Paperback' },
              { value: 'hardcover', label: 'Hardcover' },
              { value: 'both', label: 'Both' },
            ]}
            selected={form.coverType}
            onChange={handleRadio}
            field="coverType"
          />
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

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  label: string;
  name: string;
  options: RadioOption[];
  selected: string;
  onChange: (key: keyof BookSetupData, value: string) => () => void;
  field: keyof BookSetupData;
}

const RadioGroup: React.FC<RadioGroupProps> = ({ label, name, options, selected, onChange, field }) => (
  <div className="form-field">
    <label className="form-label">{label}</label>
    <div className="radio-group">
      {options.map(opt => (
        <label key={opt.value} className={`radio-option${selected === opt.value ? ' active' : ''}`}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={selected === opt.value}
            onChange={onChange(field, opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  </div>
);

export default BookSetup;
