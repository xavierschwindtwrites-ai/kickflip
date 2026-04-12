import type { Campaign } from './campaign';

interface CampaignListItem {
  id: number;
  title: string;
}

interface KickflipAPI {
  saveCampaignData(id: number, data: string): Promise<void>;
  loadCampaign(id: number): Promise<Campaign | null>;
  ensureCampaign(): Promise<Campaign>;
  listCampaigns(): Promise<CampaignListItem[]>;
  createCampaign(title: string, data: string): Promise<Campaign>;
}

declare global {
  interface Window {
    kickflip: KickflipAPI;
  }
}
