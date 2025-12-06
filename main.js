const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises; // 用 Promise 风格的 fs

// 创建窗口
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: true, // 隐藏默认的标题栏和窗口框架
    autoHideMenuBar: true, // 自动隐藏菜单栏
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

ipcMain.handle('download-fireware', async (event, fileDir) => {
  try {
    // 读取 res\testmode20_2023_0718_1234.bin 固件并通过 XModem 下载固件
    /**
     * 步骤如下:
     * 1 读取 config.json 配置文件, 打开串口配置
     * 2 发送命令: x 160000 使设备进入XModem接收模式: 'Receiving XModem'
     * 3 开始发送固件文件: res/testmode20_2023_0718_1234.bin
     * 4 固件发送中在对应文本框中打印进度信息
     * 5 固件发送完成后, 发送执行命令: g 160000, 进入测试模式
     * 6 检测到: 'mac', 'set mac' 表示结束
    */
  } catch (error) {
    
  }
});

app.whenReady().then(createWindow);