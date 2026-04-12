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
}

const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onNavChange,
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  onNewCampaign,
}) => {
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
        <span className="sidebar-version">v0.1.0</span>
      </div>
    </aside>
  );
};

export default Sidebar;
