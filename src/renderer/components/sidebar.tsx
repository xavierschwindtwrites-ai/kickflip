import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { NavItem, CampaignListItem } from '../app';
import Logo from './logo';

const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: ['Dashboard'] },
  { label: 'Plan', items: ['Project Setup', 'Unit Costs', 'Pricing & Tiers', 'Shipping', 'Scenarios', 'Stretch Goals'] },
  { label: 'Launch', items: ['Launch Plan', 'Live Tracker'] },
  { label: 'Wrap up', items: ['Fulfillment', 'Retrospective', 'Summary'] },
];

interface SidebarProps {
  activeNav: NavItem;
  onNavChange: (item: NavItem) => void;
  campaigns: CampaignListItem[];
  activeCampaignId: number;
  onSelectCampaign: (id: number) => void;
  onNewCampaign: () => void;
  onDeleteCampaign: (id: number, title: string) => void;
  onRenameCampaign: (id: number, newTitle: string) => void;
  onDuplicateCampaign: (id: number) => void;
  onExportCampaign: (id: number) => void;
  onImportCampaign: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavChange,
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  onNewCampaign,
  onDeleteCampaign,
  onRenameCampaign,
  onDuplicateCampaign,
  onExportCampaign,
  onImportCampaign,
}) => {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const startRename = useCallback((c: CampaignListItem) => {
    setOpenMenuId(null);
    setRenamingId(c.id);
    setRenameValue(c.title);
  }, []);

  const commitRename = useCallback(async () => {
    if (renamingId !== null && renameValue.trim()) {
      await onRenameCampaign(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, onRenameCampaign]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Logo />
        <span className="sidebar-logo-text">KickFlip</span>
      </div>

      <button className="sidebar-new-btn" onClick={onNewCampaign}>+ New Campaign</button>
      <button className="sidebar-import-btn" onClick={onImportCampaign}>Import Campaign&hellip;</button>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Campaigns</div>
        {campaigns.map(c => (
          <div
            key={c.id}
            className={`campaign-item${c.id === activeCampaignId ? ' active' : ''}`}
            onClick={() => {
              if (renamingId !== c.id) onSelectCampaign(c.id);
            }}
          >
            <span className={`campaign-dot${c.id === activeCampaignId ? ' active' : ''}`} />

            {renamingId === c.id ? (
              <input
                ref={renameInputRef}
                className="campaign-rename-input"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="campaign-item-title">{c.title}</span>
            )}

            <div className="campaign-menu-wrap" ref={openMenuId === c.id ? menuRef : undefined}>
              <button
                className="campaign-menu-btn"
                title="Campaign options"
                onClick={e => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === c.id ? null : c.id);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
              </button>

              {openMenuId === c.id && (
                <div className="campaign-dropdown">
                  <button
                    className="campaign-dropdown-item"
                    onClick={e => { e.stopPropagation(); startRename(c); }}
                  >
                    Rename
                  </button>
                  <button
                    className="campaign-dropdown-item"
                    onClick={e => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                      onDuplicateCampaign(c.id);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="campaign-dropdown-item"
                    onClick={e => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                      onExportCampaign(c.id);
                    }}
                  >
                    Export&hellip;
                  </button>
                  <div className="campaign-dropdown-divider" />
                  <button
                    className="campaign-dropdown-item campaign-dropdown-item--danger"
                    onClick={e => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                      onDeleteCampaign(c.id, c.title);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="nav-group">
            {group.label && <div className="nav-group-label">{group.label}</div>}
            {group.items.map(item => (
              <button
                key={item}
                className={`nav-item${activeNav === item ? ' active' : ''}`}
                onClick={() => onNavChange(item)}
              >
                <span className="nav-icon" />
                {item}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-version">v0.3.0</span>
      </div>
    </aside>
  );
};

export default Sidebar;
