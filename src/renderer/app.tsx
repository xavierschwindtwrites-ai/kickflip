import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/sidebar';
import ContentArea from './components/content-area';
import NewCampaignModal from './components/new-campaign-modal';
import './styles/global.css';

export type NavItem =
  | 'Dashboard'
  | 'Book Setup'
  | 'Printer Quotes'
  | 'Pricing & Tiers'
  | 'Shipping Planner'
  | 'Scenario Modeler'
  | 'Stretch Goals'
  | 'Promotional Tools'
  | 'Fulfillment Planner'
  | 'Retrospective';

export interface CampaignListItem {
  id: number;
  title: string;
}

const App: React.FC = () => {
  const [activeNav, setActiveNav] = useState<NavItem>('Dashboard');
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);

  const refreshCampaigns = useCallback(async () => {
    const list = await window.kickflip.listCampaigns();
    setCampaigns(list);
  }, []);

  useEffect(() => {
    (async () => {
      const campaign = await window.kickflip.ensureCampaign();
      setCampaignId(campaign.id);
      await refreshCampaigns();
    })();
  }, [refreshCampaigns]);

  const handleSelectCampaign = useCallback((id: number) => {
    setCampaignId(id);
    setActiveNav('Dashboard');
  }, []);

  const handleCampaignCreated = useCallback(async (newId: number) => {
    await refreshCampaigns();
    setCampaignId(newId);
    setActiveNav('Book Setup');
    setShowNewModal(false);
  }, [refreshCampaigns]);

  if (campaignId === null) {
    return <div className="app-layout" />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeNav={activeNav}
        onNavChange={setActiveNav}
        campaigns={campaigns}
        activeCampaignId={campaignId}
        onSelectCampaign={handleSelectCampaign}
        onNewCampaign={() => setShowNewModal(true)}
      />
      <ContentArea activeNav={activeNav} campaignId={campaignId} onNavChange={setActiveNav} />
      {showNewModal && (
        <NewCampaignModal
          onCreated={handleCampaignCreated}
          onCancel={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
};

export default App;
