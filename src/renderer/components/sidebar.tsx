import React from 'react';
import type { NavItem, CampaignListItem } from '../app';
import Logo from './logo';

const NAV_ITEMS: NavItem[] = [
  'Dashboard',
  'Book Setup',
  'Printer Quotes',
  'Pricing & Tiers',
  'Shipping Planner',
  'Scenario Modeler',
  'Stretch Goals',
  'Promotional Tools',
  'Fulfillment Planner',
  'Retrospective',
];

interface SidebarProps {
  activeNav: NavItem;
  onNavChange: (item: NavItem) => void;
  campaigns: CampaignListItem[];
  activeCampaignId: number;
  onSelectCampaign: (id: number) => void;
  onNewCampaign: () => void;
  onDeleteCampaign: (id: number, title: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavChange,
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  onNewCampaign,
  onDeleteCampaign,
}) => {
  const canDelete = campaigns.length > 1;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Logo />
        <span className="sidebar-logo-text">KickFlip</span>
      </div>

      <button className="sidebar-new-btn" onClick={onNewCampaign}>+ New Campaign</button>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Campaigns</div>
        {campaigns.map(c => (
          <div
            key={c.id}
            className={`campaign-item${c.id === activeCampaignId ? ' active' : ''}`}
            onClick={() => onSelectCampaign(c.id)}
          >
            <span className={`campaign-dot${c.id === activeCampaignId ? ' active' : ''}`} />
            <span className="campaign-item-title">{c.title}</span>
            {canDelete && (
              <button
                className="campaign-delete-btn"
                title="Delete campaign"
                onClick={e => {
                  e.stopPropagation();
                  onDeleteCampaign(c.id, c.title);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            className={`nav-item${activeNav === item ? ' active' : ''}`}
            onClick={() => onNavChange(item)}
          >
            <span className="nav-icon" />
            {item}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-version">v0.1.1</span>
      </div>
    </aside>
  );
};

export default Sidebar;
