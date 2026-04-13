import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/sidebar';
import ContentArea from './components/content-area';
import NewCampaignModal from './components/new-campaign-modal';
import DeleteCampaignModal from './components/delete-campaign-modal';
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  const refreshCampaigns = useCallback(async () => {
    const list = await window.kickflip.listCampaigns();
    setCampaigns(list);
    return list;
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

  const handleDeleteCampaign = useCallback((id: number, title: string) => {
    setDeleteTarget({ id, title });
  }, []);

  const handleCampaignDeleted = useCallback(async (deletedId: number) => {
    setDeleteTarget(null);
    const list = await refreshCampaigns();
    if (campaignId === deletedId) {
      if (list.length > 0) {
        setCampaignId(list[0].id);
        setActiveNav('Dashboard');
      } else {
        setCampaignId(null);
      }
    }
  }, [refreshCampaigns, campaignId]);

  // No campaigns — prompt to create one
  if (campaignId === null && campaigns.length === 0) {
    return (
      <div className="app-layout">
        <div className="empty-state">
          <h2>No campaigns yet</h2>
          <p>Create your first campaign to get started.</p>
          <button className="modal-btn-create" onClick={() => setShowNewModal(true)}>
            + New Campaign
          </button>
        </div>
        {showNewModal && (
          <NewCampaignModal
            onCreated={handleCampaignCreated}
            onCancel={() => setShowNewModal(false)}
          />
        )}
      </div>
    );
  }

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
        onDeleteCampaign={handleDeleteCampaign}
      />
      <ContentArea activeNav={activeNav} campaignId={campaignId} onNavChange={setActiveNav} />
      {showNewModal && (
        <NewCampaignModal
          onCreated={handleCampaignCreated}
          onCancel={() => setShowNewModal(false)}
        />
      )}
      {deleteTarget && (
        <DeleteCampaignModal
          campaignId={deleteTarget.id}
          campaignName={deleteTarget.title}
          onDeleted={handleCampaignDeleted}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default App;
