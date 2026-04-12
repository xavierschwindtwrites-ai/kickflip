import React, { useState, useCallback } from 'react';
import type { CampaignData } from '../../types/campaign';
import { DEFAULT_BOOK_SETUP } from '../../types/campaign';

interface NewCampaignModalProps {
  onCreated: (id: number) => void;
  onCancel: () => void;
}

const NewCampaignModal: React.FC<NewCampaignModalProps> = ({ onCreated, onCancel }) => {
  const [title, setTitle] = useState('');
  const [launchDate, setLaunchDate] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || creating) return;
    setCreating(true);

    const initialData: CampaignData = {
      bookSetup: {
        ...DEFAULT_BOOK_SETUP,
        campaignTitle: trimmed,
        targetLaunchDate: launchDate,
      },
    };

    const campaign = await window.kickflip.createCampaign(
      trimmed,
      JSON.stringify(initialData),
    );
    onCreated(campaign.id);
  }, [title, launchDate, creating, onCreated]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && title.trim()) handleCreate();
  }, [onCancel, title, handleCreate]);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} onKeyDown={handleKeyDown}>
      <div className="modal-card">
        <h2 className="modal-title">New Campaign</h2>

        <div className="modal-field">
          <label className="form-label">Campaign name</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Everdarken — Kickstarter 2025"
            autoFocus
          />
        </div>

        <div className="modal-field">
          <label className="form-label">Target launch date <span className="modal-optional">(optional)</span></label>
          <input
            type="date"
            className="form-input"
            value={launchDate}
            onChange={e => setLaunchDate(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="modal-btn-create"
            onClick={handleCreate}
            disabled={!title.trim() || creating}
          >
            {creating ? 'Creating\u2026' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewCampaignModal;
