'use strict';
const { contextBridge, ipcRenderer } = require('electron');
/** @type {import('../shared/qc-api').LicenseIssuerApi} Hợp đồng riêng của công cụ cấp mã. */
const api = {
  status: () => ipcRenderer.invoke('issuer:status'),
  chooseKey: () => ipcRenderer.invoke('issuer:chooseKey'),
  issue: (input) => ipcRenderer.invoke('issuer:issue', input),
  copy: () => ipcRenderer.invoke('issuer:copy'),
  save: () => ipcRenderer.invoke('issuer:save'),
  discard: () => ipcRenderer.invoke('issuer:discard'),
};
contextBridge.exposeInMainWorld('licenseIssuer', api);
