import React from 'react';
import type { NavItem } from '../app';
import Dashboard from './dashboard';
import BookSetup from './book-setup';
import PrinterQuotes from './printer-quotes';
import PricingTiers from './pricing-tiers';
import ShippingPlanner from './shipping-planner';
import ScenarioModeler from './scenario-modeler';
import StretchGoals from './stretch-goals';
import PromotionalTools from './promotional-tools';
import FulfillmentPlanner from './fulfillment-planner';
import Retrospective from './retrospective';

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

  if (activeNav === 'Book Setup') {
    return (
      <main className="content-area content-area--form">
        <BookSetup campaignId={campaignId} />
      </main>
    );
  }

  if (activeNav === 'Printer Quotes') {
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

  if (activeNav === 'Shipping Planner') {
    return (
      <main className="content-area content-area--form">
        <ShippingPlanner campaignId={campaignId} />
      </main>
    );
  }

  if (activeNav === 'Scenario Modeler') {
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

  if (activeNav === 'Promotional Tools') {
    return (
      <main className="content-area content-area--form">
        <PromotionalTools campaignId={campaignId} onNavChange={onNavChange} />
      </main>
    );
  }

  if (activeNav === 'Fulfillment Planner') {
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

  return (
    <main className="content-area">
      <h1 className="content-title">{activeNav}</h1>
    </main>
  );
};

export default ContentArea;
