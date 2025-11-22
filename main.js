const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises; // 用 Promise 风格的 fs

// 创建窗口
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true, // 开启上下文隔离（安全）
      nodeIntegration: false, // 关闭渲染进程的 Node.js 集成
      preload: path.join(__dirname, 'preload.js') // 指定预加载脚本
    }
  });

  mainWindow.loadFile('index.html'); // 加载渲染进程页面
}

// 监听渲染进程的「读取文件」请求（核心 IPC 处理）
ipcMain.handle('read-file-request', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content }; // 返回成功结果
  } catch (err) {
    return { success: false, error: err.message }; // 返回错误信息
  }
});

app.whenReady().then(createWindow);