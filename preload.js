const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
  // 除函数之外，我们也可以暴露变量
});

contextBridge.exposeInMainWorld('electronAPI', {
  // 原有文件读取功能
  readFile: (filePath) => ipcRenderer.invoke('read-file-request', filePath),
  
  // 串口相关功能
  getSerialPorts: () => ipcRenderer.invoke('get-serial-ports'),
  connectSerial: (portConfig) => ipcRenderer.invoke('connect-serial', portConfig),
  disconnectSerial: () => ipcRenderer.invoke('disconnect-serial'),
  sendSerialData: (data) => ipcRenderer.invoke('send-serial-data', data),
  
  // 事件监听
  onSerialData: (callback) => ipcRenderer.on('serial-data', callback),
  onPortsUpdated: (callback) => ipcRenderer.on('ports-updated', callback),
  onConnectionStatus: (callback) => ipcRenderer.on('connection-status', callback)
});

