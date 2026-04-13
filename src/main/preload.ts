import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('kickflip', {
  saveCampaignData: (id: number, data: string) =>
    ipcRenderer.invoke('campaign:save-data', id, data),
  loadCampaign: (id: number) =>
    ipcRenderer.invoke('campaign:load', id),
  ensureCampaign: () =>
    ipcRenderer.invoke('campaign:ensure'),
  listCampaigns: () =>
    ipcRenderer.invoke('campaign:list'),
  createCampaign: (title: string, data: string) =>
    ipcRenderer.invoke('campaign:create', title, data),
  deleteCampaign: (id: number) =>
    ipcRenderer.invoke('campaign:delete', id),
});
