const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises; // 用 Promise 风格的 fs

// For Windows systems, set console code page to UTF-8
if (process.platform === 'win32') {
  const cp = require('child_process');
  try {
    cp.execSync('chcp 65001 >nul 2>&1');
  } catch (error) {
    console.log('Failed to set console encoding:', error.message);
  }
}

// 导入串口管理模块
const SerialPortManager = require('./serialPortManager');

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

/** Read res\testmode20_2023_0718_1234.bin firmware and download via XModem
 * Steps:
 * 1 Read config.json configuration file, open serial port configuration
 * 2 Send command: x 160000 to make device enter XModem receiving mode: 'Receiving XModem'
 * 3 Start sending firmware file: res/testmode20_2023_0718_1234.bin
 * 4 Print progress information in the corresponding text box during firmware sending
 * 5 After firmware sending is complete, send execute command: g 160000, enter test mode
 * 6 Detect: 'mac', 'set mac' indicates end
*/
ipcMain.handle('download-fireware', async (event, fileDir) => {
  try {
    // 1. 读取 config.json 配置文件
    const configContent = await fs.readFile('config.json', 'utf8');
    const config = JSON.parse(configContent);
    
    // 2. 创建串口管理器实例并打开串口
    const serialManager = new SerialPortManager(config);
    await serialManager.openPort();
    
    // 3. 下载固件
    const result = await serialManager.downloadFirmware(fileDir);
    
    // 4. 关闭串口
    await serialManager.closePort();
    
    return result;
    
  } catch (error) {
    console.error('Firmware download failed:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// 测试指令处理函数
ipcMain.handle('test-orders', async (event) => {
  try {
    // 1. 读取 config.json 配置文件
    const configContent = await fs.readFile('config.json', 'utf8');
    const config = JSON.parse(configContent);
    
    // 2. 创建串口管理器实例并打开串口
    const serialManager = new SerialPortManager(config);
    await serialManager.openPort();
    
    // 3. 发送测试命令并等待响应
    const testResults = await serialManager.sendTestOrders();
    
    // 4. 关闭串口
    await serialManager.closePort();
    
    // 5. 返回测试结果
    return testResults;
    
  } catch (error) {
    console.error('Test commands execution failed:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

app.whenReady().then(createWindow);