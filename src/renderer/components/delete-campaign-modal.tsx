import React, { useState, useCallback } from 'react';

interface DeleteCampaignModalProps {
  campaignName: string;
  campaignId: number;
  onDeleted: (id: number) => void;
  onCancel: () => void;
}

type Stage = 'first' | 'second';

const DeleteCampaignModal: React.FC<DeleteCampaignModalProps> = ({
  campaignName,
  campaignId,
  onDeleted,
  onCancel,
}) => {
  const [stage, setStage] = useState<Stage>('first');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const nameMatches = confirmText === campaignName;

  const handleDelete = useCallback(async () => {
    if (!nameMatches || deleting) return;
    setDeleting(true);
    await window.kickflip.deleteCampaign(campaignId);
    onDeleted(campaignId);
  }, [nameMatches, deleting, campaignId, onDeleted]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} onKeyDown={handleKeyDown}>
      <div className="modal-card">
        {stage === 'first' ? (
          <>
            <h2 className="modal-title">Delete campaign?</h2>
            <p className="modal-body">
              This will permanently delete &lsquo;{campaignName}&rsquo; and all its data. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={onCancel}>Cancel</button>
              <button className="modal-btn-delete" onClick={() => setStage('second')}>
                Yes, delete it
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="modal-title">Are you absolutely sure?</h2>
            <p className="modal-body">
              You are about to permanently delete &lsquo;{campaignName}&rsquo;. All your pricing, shipping, scenario, and fulfillment data will be lost forever. There is no way to recover it.
            </p>
            <div className="modal-field">
              <label className="form-label">Type the campaign name to confirm:</label>
              <input
                type="text"
                className="form-input"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={campaignName}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={onCancel}>Cancel</button>
              <button
                className="modal-btn-delete-final"
                onClick={handleDelete}
                disabled={!nameMatches || deleting}
              >
                {deleting ? 'Deleting\u2026' : 'Permanently Delete'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DeleteCampaignModal;
