import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  CampaignData,
  PrinterQuotesData,
  PodPrinter,
  OffsetPrinter,
  OffsetVolumeRow,
  Currency,
} from '../../types/campaign';
import {
  defaultPrinterQuotes,
  createPodPrinter,
  createOffsetPrinter,
  createOffsetVolumeRow,
} from '../../types/campaign';

const POD_PRINTERS = [
  'IngramSpark',
  'KDP Print',
  'Lulu',
  'Draft2Digital Print',
  'Bookvault',
  'Other',
];

const CURRENCIES: Currency[] = ['USD', 'GBP', 'EUR', 'CAD', 'AUD'];

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$',
};

interface PrinterQuotesProps {
  campaignId: number;
}

interface Warnings {
  podGlobal?: string;
  pod: Record<string, Record<string, string>>;
  offset: Record<string, Record<string, string>>;
  offsetRows: Record<string, Record<string, Record<string, string>>>;
}

function validate(data: PrinterQuotesData): Warnings {
  const w: Warnings = { pod: {}, offset: {}, offsetRows: {} };

  const hasAnyPodCost = data.podPrinters.some(p => p.unitCost !== null && p.unitCost > 0);
  if (!hasAnyPodCost) {
    w.podGlobal = 'Enter a unit cost for at least one POD printer before proceeding';
  }

  for (const p of data.podPrinters) {
    const pw: Record<string, string> = {};
    if (p.unitCost !== null && p.unitCost <= 0) pw.unitCost = 'Must be a positive number';
    if (p.domesticShipping !== null && p.domesticShipping < 0) pw.domesticShipping = 'Must be positive';
    if (p.internationalShipping !== null && p.internationalShipping < 0) pw.internationalShipping = 'Must be positive';
    if (Object.keys(pw).length) w.pod[p.id] = pw;
  }

  for (const o of data.offsetPrinters) {
    const ow: Record<string, string> = {};
    if (o.domesticShipping !== null && o.domesticShipping < 0) ow.domesticShipping = 'Must be positive';
    if (o.internationalShipping !== null && o.internationalShipping < 0) ow.internationalShipping = 'Must be positive';
    if (Object.keys(ow).length) w.offset[o.id] = ow;

    for (const row of o.volumeRows) {
      const rw: Record<string, string> = {};
      if (row.unitCost !== null && row.unitCost <= 0) rw.unitCost = 'Must be positive';
      if (row.unitCost !== null && row.quantity === null) rw.quantity = 'Enter a quantity';
      if (Object.keys(rw).length) {
        if (!w.offsetRows[o.id]) w.offsetRows[o.id] = {};
        w.offsetRows[o.id][row.id] = rw;
      }
    }
  }

  return w;
}

const PrinterQuotes: React.FC<PrinterQuotesProps> = ({ campaignId }) => {
  const [form, setForm] = useState<PrinterQuotesData>(defaultPrinterQuotes);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);
  const warnings = validate(form);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaign = await window.kickflip.loadCampaign(campaignId);
      if (cancelled) return;
      if (campaign && campaign.data) {
        try {
          const parsed: CampaignData = JSON.parse(campaign.data);
          if (parsed.printerQuotes) {
            setForm({ ...defaultPrinterQuotes(), ...parsed.printerQuotes });
          }
        } catch { /* keep defaults */ }
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
        const campaign = await window.kickflip.loadCampaign(campaignId);
        if (campaign && campaign.data) existing = JSON.parse(campaign.data);
      } catch { /* ignore */ }
      existing.printerQuotes = form;
      await window.kickflip.saveCampaignData(campaignId, JSON.stringify(existing));
      setSaveStatus('saved');
      fadeRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [form, campaignId]);

  // --- POD helpers ---
  const updatePod = useCallback((id: string, patch: Partial<PodPrinter>) => {
    setForm(prev => ({
      ...prev,
      podPrinters: prev.podPrinters.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  }, []);

  const addPod = useCallback(() => {
    setForm(prev => ({ ...prev, podPrinters: [...prev.podPrinters, createPodPrinter()] }));
  }, []);

  const removePod = useCallback((id: string) => {
    setForm(prev => ({ ...prev, podPrinters: prev.podPrinters.filter(p => p.id !== id) }));
  }, []);

  // --- Offset helpers ---
  const updateOffset = useCallback((id: string, patch: Partial<OffsetPrinter>) => {
    setForm(prev => ({
      ...prev,
      offsetPrinters: prev.offsetPrinters.map(o => o.id === id ? { ...o, ...patch } : o),
    }));
  }, []);

  const addOffset = useCallback(() => {
    setForm(prev => ({ ...prev, offsetPrinters: [...prev.offsetPrinters, createOffsetPrinter()] }));
  }, []);

  const removeOffset = useCallback((id: string) => {
    setForm(prev => ({ ...prev, offsetPrinters: prev.offsetPrinters.filter(o => o.id !== id) }));
  }, []);

  const updateVolumeRow = useCallback((printerId: string, rowId: string, patch: Partial<OffsetVolumeRow>) => {
    setForm(prev => ({
      ...prev,
      offsetPrinters: prev.offsetPrinters.map(o => {
        if (o.id !== printerId) return o;
        return {
          ...o,
          volumeRows: o.volumeRows.map(r => {
            if (r.id !== rowId) return r;
            const updated = { ...r, ...patch };
            // Auto-calculate total if both quantity and unit cost present and total wasn't directly set
            if (patch.quantity !== undefined || patch.unitCost !== undefined) {
              if (updated.quantity !== null && updated.unitCost !== null) {
                updated.totalCost = Math.round(updated.quantity * updated.unitCost * 100) / 100;
              }
            }
            return updated;
          }),
        };
      }),
    }));
  }, []);

  const setVolumeTotalOverride = useCallback((printerId: string, rowId: string, total: number | null) => {
    setForm(prev => ({
      ...prev,
      offsetPrinters: prev.offsetPrinters.map(o => {
        if (o.id !== printerId) return o;
        return {
          ...o,
          volumeRows: o.volumeRows.map(r => r.id === rowId ? { ...r, totalCost: total } : r),
        };
      }),
    }));
  }, []);

  const addVolumeRow = useCallback((printerId: string) => {
    setForm(prev => ({
      ...prev,
      offsetPrinters: prev.offsetPrinters.map(o => {
        if (o.id !== printerId) return o;
        if (o.volumeRows.length >= 6) return o;
        return { ...o, volumeRows: [...o.volumeRows, createOffsetVolumeRow()] };
      }),
    }));
  }, []);

  const removeVolumeRow = useCallback((printerId: string, rowId: string) => {
    setForm(prev => ({
      ...prev,
      offsetPrinters: prev.offsetPrinters.map(o => {
        if (o.id !== printerId) return o;
        if (o.volumeRows.length <= 1) return o;
        return { ...o, volumeRows: o.volumeRows.filter(r => r.id !== rowId) };
      }),
    }));
  }, []);

  return (
    <div className="pq-screen">
      <div className="pq-header">
        <h1 className="pq-title">Printer Quotes</h1>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' && 'Saving\u2026'}
          {saveStatus === 'saved' && '\u2713 Saved'}
        </span>
      </div>

      <div className="form-scroll">
        {/* POD SECTION */}
        <section className="form-section">
          <h2 className="form-section-label">Print on Demand Quotes</h2>
          {warnings.podGlobal && (
            <div className="form-warning" style={{ marginBottom: 16 }}>{warnings.podGlobal}</div>
          )}

          {form.podPrinters.map((pod) => (
            <PodCard
              key={pod.id}
              printer={pod}
              canRemove={form.podPrinters.length > 1}
              warnings={warnings.pod[pod.id] || {}}
              onUpdate={updatePod}
              onRemove={removePod}
            />
          ))}

          <button className="add-btn" onClick={addPod}>+ Add POD Printer</button>
        </section>

        {/* OFFSET SECTION */}
        <section className="form-section">
          <h2 className="form-section-label">Offset Printing Quotes</h2>

          {form.offsetPrinters.map((offset) => (
            <OffsetCard
              key={offset.id}
              printer={offset}
              canRemove={form.offsetPrinters.length > 1}
              warnings={warnings.offset[offset.id] || {}}
              rowWarnings={warnings.offsetRows[offset.id] || {}}
              onUpdate={updateOffset}
              onRemove={removeOffset}
              onUpdateRow={updateVolumeRow}
              onOverrideTotal={setVolumeTotalOverride}
              onAddRow={addVolumeRow}
              onRemoveRow={removeVolumeRow}
            />
          ))}

          <button className="add-btn" onClick={addOffset}>+ Add Offset Printer</button>
        </section>

        {/* CURRENCY NOTE */}
        <div className="form-helper-block" style={{ maxWidth: 640 }}>
          If your quote is in GBP or another currency, enter the amount as quoted.
          KickFlip will ask for your conversion rate on the Shipping Planner screen.
        </div>
      </div>
    </div>
  );
};

/* =========================================
   POD Printer Card
   ========================================= */

interface PodCardProps {
  printer: PodPrinter;
  canRemove: boolean;
  warnings: Record<string, string>;
  onUpdate: (id: string, patch: Partial<PodPrinter>) => void;
  onRemove: (id: string) => void;
}

const PodCard: React.FC<PodCardProps> = ({ printer, canRemove, warnings, onUpdate, onRemove }) => {
  const sym = CURRENCY_SYMBOLS[printer.currency];

  return (
    <div className="printer-card">
      <div className="printer-card-top">
        <div className="printer-card-fields">
          <div className="form-field">
            <label className="form-label">Printer</label>
            <select
              className="form-input form-select"
              value={printer.printerName}
              onChange={e => onUpdate(printer.id, { printerName: e.target.value, customName: '' })}
            >
              <option value="">Select a printer</option>
              {POD_PRINTERS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {printer.printerName === 'Other' && (
            <div className="form-field">
              <label className="form-label">Custom name</label>
              <input
                type="text"
                className="form-input"
                value={printer.customName}
                onChange={e => onUpdate(printer.id, { customName: e.target.value })}
                placeholder="Printer name"
              />
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Currency</label>
            <select
              className="form-input form-select"
              value={printer.currency}
              onChange={e => onUpdate(printer.id, { currency: e.target.value as Currency })}
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}
            </select>
          </div>
        </div>
        {canRemove && (
          <button className="remove-btn" onClick={() => onRemove(printer.id)} title="Remove printer">&times;</button>
        )}
      </div>

      <div className="printer-card-costs">
        <NumField
          label={`Unit cost per copy (${sym})`}
          value={printer.unitCost}
          warning={warnings.unitCost}
          onChange={v => onUpdate(printer.id, { unitCost: v })}
          step={0.01}
          placeholder="0.00"
        />
        <NumField
          label={`Domestic shipping / copy (${sym})`}
          value={printer.domesticShipping}
          warning={warnings.domesticShipping}
          onChange={v => onUpdate(printer.id, { domesticShipping: v })}
          step={0.01}
          placeholder="0.00"
        />
        <NumField
          label={`Int'l shipping / copy (${sym})`}
          value={printer.internationalShipping}
          warning={warnings.internationalShipping}
          onChange={v => onUpdate(printer.id, { internationalShipping: v })}
          step={0.01}
          placeholder="0.00"
        />
      </div>

      <div className="form-field">
        <label className="form-label">Notes</label>
        <input
          type="text"
          className="form-input"
          value={printer.notes}
          onChange={e => onUpdate(printer.id, { notes: e.target.value })}
          placeholder="e.g. quote valid until June 2025"
        />
      </div>
    </div>
  );
};

/* =========================================
   Offset Printer Card
   ========================================= */

interface OffsetCardProps {
  printer: OffsetPrinter;
  canRemove: boolean;
  warnings: Record<string, string>;
  rowWarnings: Record<string, Record<string, string>>;
  onUpdate: (id: string, patch: Partial<OffsetPrinter>) => void;
  onRemove: (id: string) => void;
  onUpdateRow: (printerId: string, rowId: string, patch: Partial<OffsetVolumeRow>) => void;
  onOverrideTotal: (printerId: string, rowId: string, total: number | null) => void;
  onAddRow: (printerId: string) => void;
  onRemoveRow: (printerId: string, rowId: string) => void;
}

const OffsetCard: React.FC<OffsetCardProps> = ({
  printer, canRemove, warnings, rowWarnings,
  onUpdate, onRemove, onUpdateRow, onOverrideTotal, onAddRow, onRemoveRow,
}) => {
  const sym = CURRENCY_SYMBOLS[printer.currency];

  return (
    <div className="printer-card">
      <div className="printer-card-top">
        <div className="printer-card-fields">
          <div className="form-field">
            <label className="form-label">Printer name</label>
            <input
              type="text"
              className="form-input"
              value={printer.printerName}
              onChange={e => onUpdate(printer.id, { printerName: e.target.value })}
              placeholder="e.g. Sheridan, Thomson-Shore"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Currency</label>
            <select
              className="form-input form-select"
              value={printer.currency}
              onChange={e => onUpdate(printer.id, { currency: e.target.value as Currency })}
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}
            </select>
          </div>
        </div>
        {canRemove && (
          <button className="remove-btn" onClick={() => onRemove(printer.id)} title="Remove printer">&times;</button>
        )}
      </div>

      {/* Volume quote table */}
      <div className="volume-table-wrap">
        <label className="form-label" style={{ marginBottom: 8 }}>Volume quotes</label>
        <table className="volume-table">
          <thead>
            <tr>
              <th>Quantity</th>
              <th>Unit cost ({sym})</th>
              <th>Total ({sym})</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {printer.volumeRows.map((row) => {
              const rw = rowWarnings[row.id] || {};
              return (
                <tr key={row.id}>
                  <td>
                    <input
                      type="number"
                      className={`vol-input${rw.quantity ? ' vol-input--warn' : ''}`}
                      value={row.quantity ?? ''}
                      onChange={e => onUpdateRow(printer.id, row.id, { quantity: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="500"
                      min={1}
                    />
                    {rw.quantity && <span className="vol-warn">{rw.quantity}</span>}
                  </td>
                  <td>
                    <input
                      type="number"
                      className={`vol-input${rw.unitCost ? ' vol-input--warn' : ''}`}
                      value={row.unitCost ?? ''}
                      onChange={e => onUpdateRow(printer.id, row.id, { unitCost: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="0.00"
                      step={0.01}
                      min={0}
                    />
                    {rw.unitCost && <span className="vol-warn">{rw.unitCost}</span>}
                  </td>
                  <td>
                    <input
                      type="number"
                      className="vol-input"
                      value={row.totalCost ?? ''}
                      onChange={e => onOverrideTotal(printer.id, row.id, e.target.value === '' ? null : Number(e.target.value))}
                      placeholder="0.00"
                      step={0.01}
                      min={0}
                    />
                  </td>
                  <td>
                    {printer.volumeRows.length > 1 && (
                      <button className="vol-remove" onClick={() => onRemoveRow(printer.id, row.id)}>&times;</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {printer.volumeRows.length < 6 && (
          <button className="add-row-btn" onClick={() => onAddRow(printer.id)}>+ Add row</button>
        )}
      </div>

      <div className="printer-card-costs">
        <NumField
          label={`Domestic shipping / copy (${sym})`}
          value={printer.domesticShipping}
          warning={warnings.domesticShipping}
          onChange={v => onUpdate(printer.id, { domesticShipping: v })}
          step={0.01}
          placeholder="0.00"
        />
        <NumField
          label={`Int'l shipping / copy (${sym})`}
          value={printer.internationalShipping}
          warning={warnings.internationalShipping}
          onChange={v => onUpdate(printer.id, { internationalShipping: v })}
          step={0.01}
          placeholder="0.00"
        />
        <NumField
          label="Estimated lead time (weeks)"
          value={printer.leadTimeWeeks}
          onChange={v => onUpdate(printer.id, { leadTimeWeeks: v })}
          step={1}
          placeholder="e.g. 8"
        />
      </div>

      <div className="form-field">
        <label className="form-label">Notes</label>
        <input
          type="text"
          className="form-input"
          value={printer.notes}
          onChange={e => onUpdate(printer.id, { notes: e.target.value })}
          placeholder="e.g. quote valid until June 2025"
        />
      </div>
    </div>
  );
};

/* =========================================
   Shared sub-components
   ========================================= */

interface NumFieldProps {
  label: string;
  value: number | null;
  warning?: string;
  onChange: (v: number | null) => void;
  step?: number;
  placeholder?: string;
}

const NumField: React.FC<NumFieldProps> = ({ label, value, warning, onChange, step, placeholder }) => (
  <div className="form-field">
    <label className="form-label">{label}</label>
    <input
      type="number"
      className="form-input"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      step={step}
      placeholder={placeholder}
      min={0}
    />
    {warning && <span className="form-warning">{warning}</span>}
  </div>
);

export default PrinterQuotes;
