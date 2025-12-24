const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
  // 除函数之外，我们也可以暴露变量
});

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath) => ipcRenderer.invoke('read-file-request', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file-request', filePath, content),
  downloadFireWare: (fileDir) => ipcRenderer.invoke('download-fireware', fileDir),
  testOrders: () => ipcRenderer.invoke('test-orders'),
});

