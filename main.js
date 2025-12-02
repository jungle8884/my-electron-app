const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises; // 用 Promise 风格的 fs

// 串口相关变量
let SerialPort;
let serialPortInstance = null;

// 创建窗口
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      contextIsolation: true, // 开启上下文隔离（安全）
      nodeIntegration: false, // 关闭渲染进程的 Node.js 集成
      preload: path.join(__dirname, 'preload.js') // 指定预加载脚本
    }
  });

  mainWindow.loadFile('index.html'); // 加载渲染进程页面
  
  // 开发模式下打开调试工具
  // mainWindow.webContents.openDevTools();
}

// 初始化串口模块
function initSerialPort() {
  try {
    SerialPort = require('serialport');
    return true;
  } catch (error) {
    console.error('Failed to load serialport:', error);
    return false;
  }
}

// 获取可用串口列表
/**
 * 获取可用的串口列表
 * 该函数首先初始化串口，然后尝试获取所有可用的串口路径
 * @returns {Promise<string[]>} 返回串口路径数组，如果初始化失败或获取串口列表失败则返回空数组
 */
async function getSerialPorts() {
  // 检查并初始化串口，如果初始化失败则直接返回空数组
  if (!initSerialPort()) {
    return [];
  }
  
  try {
    // 获取所有串口信息，并提取每个串口的路径
    const ports = await SerialPort.SerialPort.list();
    // 将串口信息映射为仅包含路径的数组
    return ports.map(port => port.path);
  } catch (error) {
    // 捕获并打印错误信息，返回空数组
    console.error('Failed to get serial ports:', error);
    return [];
  }
}

// 连接串口
function connectSerial(portConfig, window) {
  if (!initSerialPort()) {
    return false;
  }
  
  try {
    // 关闭已存在的连接
    if (serialPortInstance) {
      serialPortInstance.close();
    }
    
    // 创建新的串口实例
    serialPortInstance = new SerialPort.SerialPort({
      path: portConfig.port,
      baudRate: parseInt(portConfig.baudRate),
      dataBits: parseInt(portConfig.dataBits),
      stopBits: parseInt(portConfig.stopBits),
      parity: portConfig.parity,
      flowControl: portConfig.flowControl
    });
    
    // 监听数据接收
    serialPortInstance.on('data', (data) => {
      // 发送原始Buffer数据，让渲染进程根据选择的编码格式进行转换
      window.webContents.send('serial-data', data);
    });
    
    // 监听错误
    serialPortInstance.on('error', (error) => {
      console.error('Serial port error:', error);
      window.webContents.send('serial-data', `错误: ${error.message}`);
    });
    
    // 监听关闭
    serialPortInstance.on('close', () => {
      serialPortInstance = null;
      window.webContents.send('connection-status', false);
      window.webContents.send('serial-data', '串口已断开连接');
    });
    
    return true;
  } catch (error) {
    console.error('Failed to connect serial port:', error);
    return false;
  }
}

// 断开串口连接
function disconnectSerial() {
  if (serialPortInstance) {
    serialPortInstance.close();
    serialPortInstance = null;
    return true;
  }
  return false;
}

// 发送串口数据
function sendSerialData(data) {
  if (serialPortInstance && serialPortInstance.isOpen) {
    try {
      // 使用Promise处理异步write操作
      return new Promise((resolve) => {
        serialPortInstance.write(data + '\n', (error) => {
          if (error) {
            console.error('Failed to write data:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Error in sendSerialData:', error);
      return Promise.resolve(false);
    }
  }
  return Promise.resolve(false);
}

// 监听渲染进程的请求
ipcMain.handle('get-serial-ports', async () => {
  return await getSerialPorts();
});

ipcMain.handle('connect-serial', (event, portConfig) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return connectSerial(portConfig, window);
});

ipcMain.handle('disconnect-serial', () => {
  return disconnectSerial();
});

ipcMain.handle('send-serial-data', (event, data) => {
  return sendSerialData(data);
});

// 监听渲染进程的「读取文件」请求（保留原有功能）
ipcMain.handle('read-file-request', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content }; // 返回成功结果
  } catch (err) {
    return { success: false, error: err.message }; // 返回错误信息
  }
});

app.whenReady().then(createWindow);