import React from 'react';
import type { NavItem } from '../app';
import Dashboard from './dashboard';
import BookSetup from './book-setup';
import PrinterQuotes from './printer-quotes';
import PricingTiers from './pricing-tiers';
import ShippingPlanner from './shipping-planner';
import ScenarioModeler from './scenario-modeler';
import StretchGoals from './stretch-goals';
import LaunchPlan from './launch-plan';
import FulfillmentPlanner from './fulfillment-planner';
import Retrospective from './retrospective';
import LiveTracker from './live-tracker';
import CampaignSummary from './campaign-summary';

interface ContentAreaProps {
  activeNav: NavItem;
  campaignId: number;
  onNavChange: (item: NavItem) => void;
}

const ContentArea: React.FC<ContentAreaProps> = ({ activeNav, campaignId, onNavChange }) => {
  if (activeNav === 'Dashboard') {
    return (
      <main className="content-area content-area--form">
        <Dashboard campaignId={campaignId} onNavChange={onNavChange} />
      </main>
    );
  }

  if (activeNav === 'Project Setup') {
    return (
      <main className="content-area content-area--form">
        <BookSetup campaignId={campaignId} />
      </main>
    );
  }

  if (activeNav === 'Unit Costs') {
    return (
      <main className="content-area content-area--form">
        <PrinterQuotes campaignId={campaignId} />
      </main>
    );
  }

  if (activeNav === 'Pricing & Tiers') {
    return (
      <main className="content-area content-area--form">
        <PricingTiers campaignId={campaignId} />
      </main>
    );
  }

  if (activeNav === 'Shipping') {
    return (
      <main className="content-area content-area--form">
        <ShippingPlanner campaignId={campaignId} />
      </main>
    );
  }

  if (activeNav === 'Scenarios') {
    return (
      <main className="content-area content-area--form">
        <ScenarioModeler campaignId={campaignId} onNavChange={onNavChange} />
      </main>
    );
  }

  if (activeNav === 'Stretch Goals') {
    return (
      <main className="content-area content-area--form">
        <StretchGoals campaignId={campaignId} />
      </main>
    );
  }

  if (activeNav === 'Launch Plan') {
    return (
      <main className="content-area content-area--form">
        <LaunchPlan campaignId={campaignId} onNavChange={onNavChange} />
      </main>
    );
  }

  if (activeNav === 'Fulfillment') {
    return (
      <main className="content-area content-area--form">
        <FulfillmentPlanner campaignId={campaignId} onNavChange={onNavChange} />
      </main>
    );
  }

  if (activeNav === 'Retrospective') {
    return (
      <main className="content-area content-area--form">
        <Retrospective campaignId={campaignId} />
      </main>
    );
  }

  if (activeNav === 'Live Tracker') {
    return (
      <main className="content-area content-area--form">
        <LiveTracker campaignId={campaignId} />
      </main>
    );
  }

  if (activeNav === 'Summary') {
    return (
      <main className="content-area content-area--form">
        <CampaignSummary campaignId={campaignId} />
      </main>
    );
  }

  return (
    <main className="content-area">
      <h1 className="content-title">{activeNav}</h1>
    </main>
  );
};

export default ContentArea;
