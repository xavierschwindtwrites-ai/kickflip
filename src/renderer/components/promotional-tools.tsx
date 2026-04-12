import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CampaignData,
  PromotionalToolsData,
  OutreachContact,
  BookSetupData,
  ReadinessItem,
} from '../../types/campaign';
import {
  defaultPromotionalTools,
  createOutreachContact,
  DEFAULT_BOOK_SETUP,
} from '../../types/campaign';

interface PromotionalToolsProps {
  campaignId: number;
  onNavChange: (item: 'Book Setup') => void;
}

const READINESS_ITEMS: { key: string; label: string; helper: string }[] = [
  { key: 'email500', label: 'Email list is at least 500 subscribers', helper: 'Under 500 makes funding uncertain unless you have strong social presence' },
  { key: 'openRate', label: 'Email open rate is above 20%', helper: 'Below 20% suggests list engagement issues' },
  { key: 'arcReaders', label: 'Have at least 3 ARC readers lined up', helper: 'Early reviews build launch momentum' },
  { key: 'ksPage', label: 'Kickstarter page is fully written and proofread', helper: '' },
  { key: 'video', label: 'Campaign video is filmed and edited', helper: 'Campaigns with video fund at higher rates' },
  { key: 'socialPost', label: 'Social media announcement scheduled for launch day', helper: '' },
  { key: 'friends5', label: 'At least 5 author friends or colleagues notified to share on launch day', helper: '' },
  { key: 'preLaunchLink', label: 'Pre-launch landing page or Kickstarter preview link shared with email list', helper: '' },
];

const EMAIL_TEMPLATES = [
  {
    title: 'Pre-launch announcement',
    subject: '[BOOK TITLE] is coming to Kickstarter \u2014 be first to know',
    body: `Hi [FIRST NAME],

I\u2019m thrilled to share that [BOOK TITLE] is coming to Kickstarter on [LAUNCH DATE]! This has been months in the making, and I can\u2019t wait to bring this story to life with your support.

As a subscriber, you\u2019re the first to hear about it. The campaign will feature [BRIEF DESCRIPTION OF WHAT\u2019S INCLUDED \u2014 e.g. signed copies, exclusive artwork, limited editions]. Early backers will get the best prices and first access to stretch goal rewards.

To make sure you don\u2019t miss launch day, click here to follow the Kickstarter pre-launch page: [LINK]. You\u2019ll get a notification the moment we go live.

Thank you for being part of this journey \u2014 it means more than you know.

[YOUR NAME]`,
  },
  {
    title: 'Launch day email',
    subject: 'We\u2019re LIVE \u2014 [BOOK TITLE] on Kickstarter right now',
    body: `Hi [FIRST NAME],

The day is here \u2014 [BOOK TITLE] is officially live on Kickstarter!

\ud83d\udc49 Back the campaign now: [CAMPAIGN LINK]

Here\u2019s what you can get as a backer:
\u2022 [MAIN TIER NAME] ($[PRICE]): [WHAT\u2019S INCLUDED]
\u2022 [OTHER TIER]: [BRIEF DESCRIPTION]

We need [NUMBER] backers to hit our funding goal, and the first 48 hours are critical. If this sounds like something you\u2019d enjoy, backing now makes a huge difference.

And if you know anyone who\u2019d love [GENRE/TOPIC], I\u2019d be incredibly grateful if you shared the link. Every share helps.

Thank you for being here from the start.

[YOUR NAME]`,
  },
  {
    title: 'Funding milestone',
    subject: '[X]% funded \u2014 thank you, and here\u2019s what\u2019s next',
    body: `Hi [FIRST NAME],

Incredible news \u2014 [BOOK TITLE] is now [X]% funded! We\u2019ve hit $[AMOUNT] with [NUMBER] backers, and I\u2019m overwhelmed by the support.

Here\u2019s what\u2019s coming next: our first stretch goal at $[THRESHOLD] will unlock [STRETCH GOAL DESCRIPTION]. We\u2019re only $[DIFFERENCE] away!

If you haven\u2019t backed yet, there\u2019s still time to grab your copy at the campaign price: [CAMPAIGN LINK]

If you\u2019re already a backer, the best thing you can do right now is share the campaign with one person who\u2019d enjoy it. Word of mouth is how book campaigns succeed.

Thank you for making this real.

[YOUR NAME]`,
  },
  {
    title: 'Final 48 hours',
    subject: '48 hours left \u2014 last chance to back [BOOK TITLE]',
    body: `Hi [FIRST NAME],

This is it \u2014 [BOOK TITLE] closes in 48 hours, and once it\u2019s done, these prices and editions won\u2019t be available again.

\ud83d\udc49 Back before it\u2019s too late: [CAMPAIGN LINK]

Here\u2019s what you get:
\u2022 [TIER 1]: $[PRICE] \u2014 [INCLUDES]
\u2022 [TIER 2]: $[PRICE] \u2014 [INCLUDES]

We\u2019ve unlocked [NUMBER] stretch goals so far, which means every backer gets [BONUS ITEMS].

If you\u2019re already a backer \u2014 thank you. If you can share the campaign link one more time in the next 48 hours, it could make all the difference.

Let\u2019s finish strong.

[YOUR NAME]`,
  },
  {
    title: 'Funded confirmation',
    subject: 'We did it \u2014 [BOOK TITLE] is fully funded',
    body: `Hi [FIRST NAME],

I\u2019m so happy to share that [BOOK TITLE] has been fully funded! We raised $[TOTAL] from [NUMBER] backers \u2014 I still can\u2019t quite believe it.

Here\u2019s what happens next:
\u2022 Kickstarter charges all backers when the campaign officially closes on [END DATE]
\u2022 I\u2019ll begin working with the printer in [MONTH] and expect to ship by [FULFILLMENT DATE]
\u2022 You\u2019ll receive regular updates right here and on Kickstarter

Thank you for believing in this project. Every pledge, every share, every kind word made this possible. I can\u2019t wait to get this book into your hands.

With gratitude,
[YOUR NAME]`,
  },
  {
    title: 'Fulfillment update',
    subject: 'Update on [BOOK TITLE] \u2014 here\u2019s where we are',
    body: `Hi [FIRST NAME],

I wanted to give you an honest update on where things stand with [BOOK TITLE].

Printing: [STATUS \u2014 e.g. "Files have been sent to the printer and proofs are expected by [DATE]"]
Shipping: [STATUS \u2014 e.g. "Domestic copies will ship first, starting around [DATE]. International shipments will follow about [X] weeks later."]
Timeline: [STATUS \u2014 e.g. "We\u2019re currently on track / running about [X] weeks behind the original estimate due to [REASON]."]

I know waiting is the hardest part, and I appreciate your patience. I\u2019m committed to keeping you in the loop every step of the way.

If you have any questions, just reply to this email.

Thank you for being part of this.

[YOUR NAME]`,
  },
];

function formatDate(iso: string): string {
  if (!iso) return '\u2014';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const PromotionalTools: React.FC<PromotionalToolsProps> = ({ campaignId, onNavChange }) => {
  const [form, setForm] = useState<PromotionalToolsData>(defaultPromotionalTools);
  const [bookSetup, setBookSetup] = useState<BookSetupData>({ ...DEFAULT_BOOK_SETUP });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
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
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  // --- Readiness check helpers ---
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

  // Auto-check logic for first two items
  const emailSize = bookSetup.emailListSize ?? 0;
  const emailRate = bookSetup.emailOpenRate ?? 0;
  const autoEmail = emailSize >= 500;
  const autoRate = emailRate >= 20;

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

  // --- Copy template ---
  const copyTemplate = useCallback((idx: number) => {
    const t = EMAIL_TEMPLATES[idx];
    const text = `Subject: ${t.subject}\n\n${t.body}`;
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  // --- Campaign timeline ---
  const launchDate = bookSetup.targetLaunchDate;
  const campaignLength = form.campaignLength;

  const milestones = launchDate ? [
    { label: 'Launch day', date: launchDate, dayNum: 0 },
    { label: 'First update due', date: addDays(launchDate, 3), dayNum: 3 },
    { label: 'Stretch goal tease', date: addDays(launchDate, 7), dayNum: 7 },
    { label: 'Midpoint community post', date: addDays(launchDate, Math.floor(campaignLength / 2)), dayNum: Math.floor(campaignLength / 2) },
    { label: 'Last push email', date: addDays(launchDate, campaignLength - 2), dayNum: campaignLength - 2 },
    { label: 'Campaign ends', date: addDays(launchDate, campaignLength), dayNum: campaignLength },
  ] : [];

  return (
    <div className="pt-screen">
      <div className="pt-header">
        <h1 className="pt-title">Promotional Tools</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving\u2026'}
          {saveStatus === 'saved' && '\u2713 Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* 1. LAUNCH READINESS CHECK */}
        <section className="form-section">
          <h2 className="form-section-label">Launch Readiness Check</h2>

          <div className="pt-checklist">
            {READINESS_ITEMS.map((item, idx) => {
              // First two items have auto-check behavior
              const isAuto = idx === 0 || idx === 1;
              let autoChecked = false;
              let autoLabel = '';
              let autoWarning = '';

              if (idx === 0 && emailSize > 0) {
                autoChecked = autoEmail;
                autoLabel = autoEmail ? `500+ subscribers \u2713` : '';
                autoWarning = !autoEmail ? `You have ${emailSize.toLocaleString()} subscriber${emailSize !== 1 ? 's' : ''}` : '';
              }
              if (idx === 1 && emailRate > 0) {
                autoChecked = autoRate;
                autoLabel = autoRate ? `${emailRate}% open rate \u2713` : '';
                autoWarning = !autoRate ? `Your open rate is ${emailRate}%` : '';
              }

              const checked = isAuto && (emailSize > 0 || emailRate > 0)
                ? (idx === 0 ? autoChecked : (idx === 1 ? autoChecked : isItemChecked(item.key)))
                : isItemChecked(item.key);

              return (
                <label key={item.key} className={`pt-check-item${checked ? ' checked' : ''}${isAuto && autoChecked ? ' auto-checked' : ''}`}>
                  <span className={`pt-checkbox${checked ? ' checked' : ''}${isAuto && autoChecked ? ' auto' : ''}`}>
                    {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke={isAuto && autoChecked ? '#1a7d3a' : '#fff'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
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
                      {isAuto && autoLabel ? autoLabel : item.label}
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

        {/* 2. CAMPAIGN TIMING ADVISOR */}
        <section className="form-section">
          <h2 className="form-section-label">Campaign Timing Advisor</h2>

          <div className="pt-timing-grid">
            <div className="form-field">
              <label className="form-label">Campaign length</label>
              <select
                className="form-input"
                value={campaignLength}
                onChange={e => setForm(prev => ({ ...prev, campaignLength: Number(e.target.value) as 20 | 25 | 30 }))}
              >
                <option value={20}>20 days</option>
                <option value={25}>25 days</option>
                <option value={30}>30 days</option>
              </select>
              <span className="form-helper">
                Shorter campaigns create urgency. 30 days is standard for books. Avoid launching on major US holidays.
              </span>
            </div>

            <div className="form-field">
              <label className="form-label">Target launch date</label>
              <div className="pt-launch-display">
                {launchDate ? formatDate(launchDate) : 'Not set'}
                <button className="pt-link-btn" onClick={() => onNavChange('Book Setup')}>
                  {launchDate ? 'Edit in Book Setup' : 'Set in Book Setup'}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-day-rec">
            Tuesday and Wednesday launches historically perform best for book campaigns.
          </div>

          {/* Timeline */}
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

        {/* 3. EMAIL TEMPLATE LIBRARY */}
        <section className="form-section pt-section-wide">
          <h2 className="form-section-label">Email Template Library</h2>

          <div className="pt-templates">
            {EMAIL_TEMPLATES.map((tpl, idx) => (
              <div key={idx} className="pt-template-card">
                <div className="pt-template-top">
                  <div className="pt-template-title">{tpl.title}</div>
                  <button
                    className={`pt-copy-btn${copiedIdx === idx ? ' copied' : ''}`}
                    onClick={() => copyTemplate(idx)}
                  >
                    {copiedIdx === idx ? 'Copied!' : 'Copy to clipboard'}
                  </button>
                </div>
                <div className="pt-template-subject">Subject: {tpl.subject}</div>
                <pre className="pt-template-body">{tpl.body}</pre>
              </div>
            ))}
          </div>
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

export default PromotionalTools;
