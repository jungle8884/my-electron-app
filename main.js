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
const { SerialPort } = require('serialport');
const { DelimiterParser } = require('@serialport/parser-delimiter');
const XModem = require('xmodem.js');

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
    
    // 2. 打开串口
    const port = new SerialPort({
      path: config.Serial,
      baudRate: parseInt(config.BaudRate),
      dataBits: parseInt(config.DataBits),
      stopBits: parseInt(config.StopBits),
      parity: config.Parity
    });
    
    // 设置解析器，用于处理串口数据
    const parser = port.pipe(new DelimiterParser({ delimiter: '\n' }));
    
    // Create a Promise to handle serial port open event
    await new Promise((resolve, reject) => {
      port.on('open', () => {
        console.log('Serial port opened');
        resolve();
      });
      
      port.on('error', (err) => {
        console.error('Serial port error:', err);
        reject(new Error(`Failed to open serial port: ${err.message}`));
      });
    });
    
    // 3. 发送命令使设备进入XModem接收模式
    // 清除串口缓冲区
    await new Promise((resolve) => {
      port.flush((err) => {
        if (err) console.log('Flush serial port failed:', err.message);
        resolve();
      });
    });
    
    // 使用\r\n作为命令结束符（与C++版本一致）
    const enterXModemCommand = `x 160000\r\n`;
    let accumulatedResponse = '';
    
    await new Promise((resolve, reject) => {
      let receivedResponse = false;
      let receivedNAK = false;
      
      // 设置一个较长的超时时间
      const timeout = setTimeout(() => {
        if (receivedResponse) {
          // 如果已经收到XModem确认，即使没有收到NAK字符也继续
          console.log('XModem confirmation received, proceeding with transfer without NAK');
          resolve();
        } else {
          reject(new Error('Device did not respond to XModem mode entry command'));
        }
      }, 20000); // 20秒超时
      
      // 同时监听解析器和直接的数据事件，以便捕获NAK字符
      port.on('data', (rawData) => {
        accumulatedResponse += rawData.toString();
        
        // 检查是否包含XModem确认信息
        if (!receivedResponse && accumulatedResponse.includes('Receiving XModem')) {
          receivedResponse = true;
          console.log('Received XModem confirmation');
        }
        
        // 检查是否包含NAK字符（CCCC）
        if (!receivedNAK && accumulatedResponse.includes('CCCC')) {
          receivedNAK = true;
          console.log('Received NAK characters, device ready for XModem transfer');
        }
        
        // 如果同时收到XModem确认和NAK字符，立即继续
        if (receivedResponse && receivedNAK) {
          clearTimeout(timeout);
          resolve();
        } else if (receivedResponse) {
          console.log('XModem confirmation received, waiting for NAK characters or timeout...');
        }
      });
      
      port.write(enterXModemCommand, (err) => {
        if (err) {
          clearTimeout(timeout);
          reject(new Error(`Failed to send command: ${err.message}`));
        }
      });
    });
    
    // 等待设备完全准备好
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 再次清除串口缓冲区
    await new Promise((resolve) => {
      port.flush((err) => {
        if (err) console.log('Flush serial port failed:', err.message);
        resolve();
      });
    });
    
    // 4. Read firmware file
    const firmwarePath = path.join(fileDir || 'res', config.Bin);
    console.log('Firmware file path:', firmwarePath);
    console.log('Current working directory:', process.cwd());
    
    // Check if file exists
    const fsSync = require('fs');
    if (fsSync.existsSync(firmwarePath)) {
      console.log('Firmware file exists');
    } else {
      console.log('Firmware file does not exist');
      console.log('res directory contents:', fsSync.existsSync('res') ? fsSync.readdirSync('res') : 'res directory does not exist');
    }
    
    // Declare firmwareData outside try block to fix scope issue
    let firmwareData;
    try {
      firmwareData = await fs.readFile(firmwarePath);
      console.log('Firmware file read successfully, size:', firmwareData.length, 'bytes');
    } catch (error) {
      console.error('Failed to read firmware file:', error.message);
      throw error;
    }
    
    // 5. Send firmware using XModem with retry mechanism (参考C++版本)
    let transferSuccess = false;
    const maxRetries = 3; // 设置最大重试次数
    
    for (let retry = 0; retry < maxRetries && !transferSuccess; retry++) {
      if (retry > 0) {
        console.log(`Retrying firmware transfer... Attempt ${retry + 1}/${maxRetries}`);
        // 重试前清除串口缓冲区
        await new Promise((resolve) => {
          port.flush((err) => {
            if (err) console.log('Flush serial port failed:', err.message);
            resolve();
          });
        });
        // 等待设备重新准备
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      try {
        console.log('Starting XModem transfer...');
        console.log('Firmware size:', firmwareData.length, 'bytes');
        console.log('XModem configuration: CRC mode, retries=10');
        
        // 确保没有残留的监听器
        port.removeAllListeners('data');
        
        // 使用XModem.js库的正确方式
        const XModem = require('xmodem.js');
        const xmodem = new XModem({ crc: true, retries: 10 });
        
        console.log('XModem instance created successfully');
        console.log('XModem options:');
        console.log('- CRC:', xmodem.crc);
        console.log('- Retries:', xmodem.retries);
        
        // 创建一个简单的读取函数来提供固件数据
        let dataOffset = 0;
        const readFirmwareChunk = (size) => {
          if (dataOffset >= firmwareData.length) {
            return null; // 没有更多数据
          }
          
          const chunk = firmwareData.slice(dataOffset, dataOffset + size);
          dataOffset += chunk.length;
          return chunk;
        };
        
        console.log('Starting XModem transfer with custom read function...');
        
        // 开始XModem传输
        await new Promise((resolve, reject) => {
          let transferComplete = false;
          let progress = 0;
          
          // 配置XModem发送器
          const options = {
            // 发送数据的回调函数
            write(data) {
              console.log(`Sending XModem packet: ${data.length} bytes`);
              return new Promise((resolve, reject) => {
                port.write(data, (err) => {
                  if (err) {
                    console.error('Error writing to port:', err.message);
                    reject(err);
                  } else {
                    resolve();
                  }
                });
              });
            },
            // 接收数据的回调函数
            read(size) {
              console.log(`Waiting for ${size} bytes of XModem response...`);
              return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  console.error('XModem read timeout');
                  reject(new Error('Read timeout'));
                }, 5000);
                
                port.once('data', (data) => {
                  clearTimeout(timeout);
                  console.log(`Received XModem response: ${data.length} bytes`);
                  resolve(data);
                });
              });
            }
          };
          
          // 启动传输
          xmodem.send(readFirmwareChunk, options)
            .then(() => {
              transferComplete = true;
              console.log('XModem transfer completed successfully');
              resolve();
            })
            .catch((err) => {
              console.error('XModem transfer error:', err.message);
              console.error('Error stack:', err.stack);
              reject(new Error(`XModem transfer failed: ${err.message}`));
            });
          
          // 设置总超时时间
          const timeout = setTimeout(() => {
            if (!transferComplete) {
              console.error('XModem transfer timeout after 120 seconds');
              reject(new Error('Firmware sending timeout'));
            }
          }, 120000);
        });
        
        console.log('Firmware download completed successfully');
        
        transferSuccess = true;
      } catch (error) {
        console.error(`Firmware transfer attempt ${retry + 1} failed:`, error.message);
      }
    }
    
    if (!transferSuccess) {
      throw new Error(`Firmware transfer failed after ${maxRetries} attempts`);
    }
    
    // 6. Send execute command
    // 发送命令前清除串口缓冲区
    await new Promise((resolve) => {
      port.flush((err) => {
        if (err) console.log('Flush serial port failed:', err.message);
        resolve();
      });
    });
    
    // 使用\r\n作为命令结束符
    const executeCommand = `g 160000\r\n`;
    
    // 等待设备处理固件
    console.log('Waiting for device to process firmware...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await new Promise((resolve, reject) => {
      let receivedMac = false;
      let receivedSetMac = false;
      let receivedVersion = false;
      
      const timeout = setTimeout(() => {
        // 输出缺失的信息以便调试
        const missingInfo = [];
        if (!receivedMac) missingInfo.push('MAC info');
        if (!receivedSetMac) missingInfo.push('Set MAC info');
        if (!receivedVersion) missingInfo.push('Version info');
        
        reject(new Error(`Device did not complete execute command. Missing: ${missingInfo.join(', ')}`));
      }, 60000); // 增加超时时间到60秒
      
      parser.on('data', (data) => {
        const response = data.toString().trim();
        console.log('Device response:', response);
        
        // 检查MAC信息
        if (!receivedMac && response.includes('mac is:')) {
          receivedMac = true;
          console.log('Detected MAC info');
        }
        
        // 检查Set MAC信息
        if (!receivedSetMac && response.includes('set mac:')) {
          receivedSetMac = true;
          console.log('Detected Set MAC info');
        }
        
        // 检查版本信息
        if (!receivedVersion && /v\d+\.\d+\.\d+/.test(response)) {
          receivedVersion = true;
          console.log('Detected Version info');
        }
        
        // 所有关键信息都已检测到，认为测试模式已完全启动
        if (receivedMac && receivedSetMac && receivedVersion) {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      port.write(executeCommand, (err) => {
        if (err) {
          clearTimeout(timeout);
          reject(new Error(`Failed to send execute command: ${err.message}`));
        }
      });
    });
    
    // Close serial port
    port.close((err) => {
      if (err) {
        console.error('Failed to close serial port:', err);
      } else {
        console.log('Serial port closed');
      }
    });
    
    return { 
      success: true, 
      content: 'Firmware downloaded successfully, device entered test mode' 
    };
    
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
    
    // 2. 打开串口
    const port = new SerialPort({
      path: config.Serial,
      baudRate: parseInt(config.BaudRate),
      dataBits: parseInt(config.DataBits),
      stopBits: parseInt(config.StopBits),
      parity: config.Parity
    });
    
    // 设置解析器，用于处理串口数据
    const parser = port.pipe(new DelimiterParser({ delimiter: '\n' }));
    
    // 创建一个Promise，用于处理串口打开事件
    await new Promise((resolve, reject) => {
      port.on('open', () => {
        console.log('串口已打开');
        resolve();
      });
      
      port.on('error', (err) => {
        console.error('串口错误:', err);
        reject(new Error(`串口打开失败: ${err.message}`));
      });
    });
    
    // 3. 定义测试指令列表
    const testOrders = [
      'version\n',  // 版本信息
      'status\n',    // 状态信息
      'mac\n'       // MAC地址信息
    ];
    
    let testResults = '';
    
    // 4. Send test commands sequentially and collect responses
    for (const order of testOrders) {
      const orderName = order.trim();
      testResults += `Send command: ${orderName}\n`;
      
      // 发送指令并等待响应
      await new Promise((resolve, reject) => {
        let receivedResponse = false;
        let responseData = '';
        
        const timeout = setTimeout(() => {
          if (!receivedResponse) {
            reject(new Error(`Command ${orderName} timeout with no response`));
          }
        }, 3000);
        
        const dataListener = (data) => {
          const response = data.toString().trim();
          responseData += response + '\n';
          
          // 简单的响应判断，实际应用中可能需要根据具体设备协议调整
          if (response.length > 0 && !response.startsWith('>')) {
            receivedResponse = true;
            clearTimeout(timeout);
            parser.removeListener('data', dataListener);
            
            testResults += `Response: ${response}\n\n`;
            resolve();
          }
        };
        
        parser.on('data', dataListener);
        
        port.write(order, (err) => {
          if (err) {
            clearTimeout(timeout);
            parser.removeListener('data', dataListener);
            reject(new Error(`Failed to send command ${orderName}: ${err.message}`));
          }
        });
      });
    }
    
    // 5. Close serial port
    port.close((err) => {
      if (err) {
        console.error('Failed to close serial port:', err);
      } else {
        console.log('Serial port closed');
      }
    });
    
    return { 
      success: true, 
      content: 'Test commands executed successfully\n\n' + testResults 
    };
    
  } catch (error) {
    console.error('Test commands execution failed:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

app.whenReady().then(createWindow);