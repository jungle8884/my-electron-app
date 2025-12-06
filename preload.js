const { contextBridge } = require('electron');

// 暴露基本的版本信息给渲染进程
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

// 暴露自定义API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 这里可以添加自定义的API方法
});

