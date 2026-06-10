import type { Campaign } from './campaign';

interface CampaignListItem {
  id: number;
  title: string;
}

interface ExportResult {
  ok: boolean;
  error: string | null;
}

interface ImportResult {
  ok: boolean;
  error: string | null;
  campaign: Campaign | null;
}

interface KickflipAPI {
  saveCampaignData(id: number, data: string): Promise<void>;
  loadCampaign(id: number): Promise<Campaign | null>;
  ensureCampaign(): Promise<Campaign>;
  listCampaigns(): Promise<CampaignListItem[]>;
  createCampaign(title: string, data: string): Promise<Campaign>;
  deleteCampaign(id: number): Promise<void>;
  renameCampaign(id: number, newTitle: string): Promise<void>;
  duplicateCampaign(id: number): Promise<Campaign | null>;
  exportCampaign(id: number): Promise<ExportResult>;
  importCampaign(): Promise<ImportResult>;
}

declare global {
  interface Window {
    kickflip: KickflipAPI;
  }
}
