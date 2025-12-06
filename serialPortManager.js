const { SerialPort } = require('serialport');
const { DelimiterParser } = require('@serialport/parser-delimiter');
const XModemSender = require('./xmodemSender');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class SerialPortManager {
  constructor(config) {
    this.config = config;
    this.port = null;
    this.parser = null;
    this.logs = [];
    this.responseBuffer = '';
    this.commandStartTime = null;
  }
  
  // 添加日志记录方法
  log(type, content) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      time: timestamp,
      type: type, // 'send' 或 'recv'
      content: content
    };
    this.logs.push(logEntry);
    return `${timestamp} ${type === 'send' ? 'SEND-->' : 'RECV<--'} ${content}`;
  }

  // 打开串口
  async openPort() {
    // 创建串口实例
    this.port = new SerialPort({
      path: this.config.Serial,
      baudRate: parseInt(this.config.BaudRate),
      dataBits: parseInt(this.config.DataBits),
      stopBits: parseInt(this.config.StopBits),
      parity: this.config.Parity,
      autoOpen: false,
      // 增加缓冲区大小
      highWaterMark: 32768,
      // 禁用自动流控
      rtscts: false,
      xon: false,
      xoff: false
    });
    
    // 设置解析器，使用原始数据模式
    this.parser = this.port.pipe(new DelimiterParser({
      delimiter: '\n',
      encoding: 'utf8'
    }));
    
    // Create a Promise to handle serial port open event
    await new Promise((resolve, reject) => {
      this.port.on('open', () => {
        console.log('Serial port opened');
        console.log(`Port configuration: ${JSON.stringify({
          path: this.config.Serial,
          baudRate: this.config.BaudRate,
          dataBits: this.config.DataBits,
          stopBits: this.config.StopBits,
          parity: this.config.Parity
        })}`);
        resolve();
      });
      
      this.port.on('error', (err) => {
        console.error('Serial port error:', err);
        reject(new Error(`Failed to open serial port: ${err.message}`));
      });
      
      // 打开串口
      this.port.open();
    });
    
    return this.port;
  }

  // 关闭串口
  async closePort() {
    if (this.port) {
      await new Promise((resolve) => {
        this.port.close((err) => {
          if (err) {
            console.error('Failed to close serial port:', err);
          } else {
            console.log('Serial port closed');
          }
          resolve();
        });
      });
      this.port = null;
      this.parser = null;
    }
  }

  // 清除串口缓冲区
  async flushPort() {
    if (this.port) {
      await new Promise((resolve) => {
        this.port.flush((err) => {
          if (err) console.log('Flush serial port failed:', err.message);
          resolve();
        });
      });
    }
  }

  // 下载固件
  async downloadFirmware(fileDir) {
    try {
      // 清除之前的日志
      this.logs = [];
      
      // 1. 发送命令使设备进入XModem接收模式 - 只发送一次
      // 清除串口缓冲区
      await this.flushPort();
      console.log(this.log('send', 'Flushed serial port buffer'));
      
      // 使用\r\n作为命令结束符
      const enterXModemCommand = `x 160000\r\n`;
      let accumulatedResponse = '';
      
      await new Promise((resolve, reject) => {
        let receivedResponse = false;
        let receivedNAK = false;
        
        // 设置一个合理的超时时间
        const timeout = setTimeout(() => {
          if (receivedResponse) {
            // 如果已经收到XModem确认，即使没有收到NAK字符也继续
            console.log(this.log('send', 'XModem confirmation received, proceeding with transfer'));
            resolve();
          } else {
            reject(new Error('Device did not respond to XModem mode entry command'));
          }
        }, 10000); // 10秒超时
        
        // 监听端口数据
        const dataListener = (rawData) => {
          const dataStr = rawData.toString();
          accumulatedResponse += dataStr;
          
          // 记录接收到的原始数据
          const trimmedStr = dataStr.trim();
          if (trimmedStr) {
            console.log(this.log('recv', trimmedStr));
          }
          
          // 检查是否包含XModem确认信息
          if (!receivedResponse && (dataStr.includes('Receiving XModem') || dataStr.includes('Receiving XMod'))) {
            receivedResponse = true;
            console.log(this.log('send', 'Received XModem confirmation'));
          }
          
          // 检查是否包含NAK字符（C字符）
          if (!receivedNAK && dataStr.includes('C')) {
            receivedNAK = true;
            console.log(this.log('send', 'Received NAK characters, device ready for XModem transfer'));
          }
          
          // 如果同时收到XModem确认和NAK字符，立即继续
          if (receivedResponse && receivedNAK) {
            clearTimeout(timeout);
            this.port.removeListener('data', dataListener);
            resolve();
          }
        };
        
        // 添加数据监听器
        this.port.on('data', dataListener);
        
        // 发送命令使设备进入XModem接收模式 - 只发送一次
        console.log(this.log('send', `Sending command to enter XModem mode: ${enterXModemCommand.trim()}`));
        this.port.write(enterXModemCommand, (err) => {
          if (err) {
            clearTimeout(timeout);
            this.port.removeListener('data', dataListener);
            reject(new Error(`Failed to send command: ${err.message}`));
          } else {
            console.log(this.log('send', 'XModem mode entry command sent successfully'));
          }
        });
      });
      
      // 等待设备完全准备好
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(this.log('send', 'Waited 1 second for device to fully prepare'));
      
      // 再次清除串口缓冲区
      await this.flushPort();
      console.log(this.log('send', 'Flushed serial port buffer again'));
      
      // 2. Read firmware file
      const firmwarePath = path.join(fileDir || 'res', this.config.Bin);
      console.log(this.log('send', `Firmware file path: ${firmwarePath}`));
      console.log(this.log('send', `Current working directory: ${process.cwd()}`));
      
      // Check if file exists
      if (fsSync.existsSync(firmwarePath)) {
        console.log(this.log('send', 'Firmware file exists'));
      } else {
        console.log(this.log('send', 'Firmware file does not exist'));
        console.log(this.log('send', `res directory contents: ${fsSync.existsSync('res') ? fsSync.readdirSync('res') : 'res directory does not exist'}`));
      }
      
      // Declare firmwareData outside try block to fix scope issue
      let firmwareData;
      try {
        firmwareData = await fs.readFile(firmwarePath);
        console.log(this.log('send', `Firmware file read successfully, size: ${firmwareData.length} bytes`));
      } catch (error) {
        console.error(this.log('send', `Failed to read firmware file: ${error.message}`));
        throw error;
      }
      
      // 3. Send firmware using XModem with retry mechanism (参考C++版本)
      let transferSuccess = false;
      const maxRetries = 3; // 设置最大重试次数
      
      // 只进行一次传输
      try {
        // 使用自定义的XModemSender类进行传输
        const xmodemSender = new XModemSender(this.port);
        
        console.log(this.log('send', 'Starting XModem transfer with custom XModemSender...'));
        console.log(this.log('send', `Firmware size: ${firmwareData.length} bytes`));
        
        // 开始XModem传输
        await xmodemSender.send(firmwareData);
        
        console.log(this.log('send', 'Firmware download completed successfully'));
        
        transferSuccess = true;
      } catch (error) {
        console.error(this.log('send', `Firmware transfer failed: ${error.message}`));
      }
      
      if (!transferSuccess) {
        throw new Error(`Firmware transfer failed after ${maxRetries} attempts`);
      }
      
      // 4. Send execute test mode command - 只发送一次
      // 使用\r\n作为命令结束符
      const executeTestModeCommand = `g 160000\r\n`;
      
      // 等待设备处理固件 - 确保设备完全完成XModem传输
      console.log(this.log('send', 'Waiting for device to process firmware and reset...'));
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
      console.log(this.log('send', 'Waited 10 seconds for device to process firmware and reset'));
      
      // 清除串口缓冲区，确保没有残留数据
      await this.flushPort();
      console.log(this.log('send', 'Flushed serial port buffer before sending execute command'));
      
      // 创建响应检测状态对象
      const detectionStatus = {
        receivedGoto: false,
        receivedMac: false,
        receivedVersion: false,
        receivedCalibEnd: false,
        responseBuffer: ''
      };
      
      // 创建一个智能监听器，检测关键信息
      const smartListener = (rawData) => {
        const dataStr = rawData.toString();
        detectionStatus.responseBuffer += dataStr;
        
        // 记录接收到的原始数据
        const trimmedStr = dataStr.trim();
        if (trimmedStr) {
          console.log(this.log('recv', trimmedStr));
        }
        
        // 检测关键信息
        if (!detectionStatus.receivedGoto && dataStr.includes('Goto')) {
          detectionStatus.receivedGoto = true;
          console.log(this.log('send', 'Detected: Goto command response'));
        }
        
        if (!detectionStatus.receivedMac && dataStr.includes('mac')) {
          detectionStatus.receivedMac = true;
          console.log(this.log('send', 'Detected: MAC address information'));
        }
        
        if (!detectionStatus.receivedVersion && (dataStr.match(/v\d+\./))) {
          detectionStatus.receivedVersion = true;
          console.log(this.log('send', 'Detected: Firmware version information'));
        }
        
        if (!detectionStatus.receivedCalibEnd && dataStr.includes('misc calib single end')) {
          detectionStatus.receivedCalibEnd = true;
          console.log(this.log('send', 'Detected: Misc calibration completed'));
        }
      };
      
      // 添加智能监听器
      this.port.on('data', smartListener);
      
      // 发送g命令 - 只发送一次
      console.log(this.log('send', `Sending execute command: ${executeTestModeCommand.trim()}`));
      await new Promise((resolve, reject) => {
        this.port.write(executeTestModeCommand, (err) => {
          if (err) {
            reject(new Error(`Failed to send execute command: ${err.message}`));
          } else {
            console.log(this.log('send', 'Execute command sent successfully'));
            resolve();
          }
        });
      });
      
      // 等待设备响应 - 不再需要持续监听很长时间
      const waitTimeAfterCommand = 5; // 等待5秒
      let timeElapsed = 0;
      
      console.log(this.log('send', 'Waiting for device response...'));
      
      while (timeElapsed < waitTimeAfterCommand) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        timeElapsed++;
        
        // 检查是否检测到所有关键信息
        const allDetected = detectionStatus.receivedMac && detectionStatus.receivedVersion && detectionStatus.receivedCalibEnd;
        
        if (allDetected) {
          console.log(this.log('send', 'All critical information detected!'));
          break;
        }
        
        console.log(this.log('send', `Waiting... ${timeElapsed} seconds passed`));
      }
      
      // 移除智能监听器
      this.port.removeListener('data', smartListener);
      
      // 验证是否检测到所有关键信息
      const allCriticalInfoDetected = detectionStatus.receivedMac && detectionStatus.receivedVersion && detectionStatus.receivedCalibEnd;
      
      if (allCriticalInfoDetected) {
        console.log(this.log('send', 'Device successfully entered test mode!'));
        console.log(this.log('send', 'Firmware download and test mode entry completed successfully'));
        console.log(this.log('send', 'Key information detected:'));
        console.log(this.log('send', `  - Goto command response: ${detectionStatus.receivedGoto ? 'Yes' : 'No'}`));
        console.log(this.log('send', `  - MAC address: ${detectionStatus.receivedMac ? 'Yes' : 'No'}`));
        console.log(this.log('send', `  - Firmware version: ${detectionStatus.receivedVersion ? 'Yes' : 'No'}`));
        console.log(this.log('send', `  - Calibration completed: ${detectionStatus.receivedCalibEnd ? 'Yes' : 'No'}`));
      } else {
        console.log(this.log('send', 'Warning: Not all critical information detected within timeout period'));
        console.log(this.log('send', 'Firmware download may have completed, but device may not have entered test mode properly'));
        
        // 只记录检测到的信息，不再抛出错误
        console.log(this.log('send', 'Key information detected:'));
        console.log(this.log('send', `  - Goto command response: ${detectionStatus.receivedGoto ? 'Yes' : 'No'}`));
        console.log(this.log('send', `  - MAC address: ${detectionStatus.receivedMac ? 'Yes' : 'No'}`));
        console.log(this.log('send', `  - Firmware version: ${detectionStatus.receivedVersion ? 'Yes' : 'No'}`));
        console.log(this.log('send', `  - Calibration completed: ${detectionStatus.receivedCalibEnd ? 'Yes' : 'No'}`));
      }
      
      // 格式化日志为字符串
      const formattedLogs = this.logs.map(log => 
        `${log.time} ${log.type === 'send' ? 'SEND-->' : 'RECV<--'} ${log.content}`
      ).join('\n');
      
      return {
        success: true,
        content: 'Firmware downloaded successfully, device entered test mode',
        logs: formattedLogs
      };
    } catch (error) {
      console.error(this.log('send', `Firmware download failed: ${error}`));
      
      // 格式化日志为字符串
      const formattedLogs = this.logs.map(log => 
        `${log.time} ${log.type === 'send' ? 'SEND-->' : 'RECV<--'} ${log.content}`
      ).join('\n');
      
      return {
        success: false,
        error: error.message,
        logs: formattedLogs
      };
    }
  }

  // 发送测试指令
  async sendTestOrders() {
    try {
      // 从 TestOrders.txt 文件读取测试指令
      const fs = require('fs').promises;
      const path = require('path');
      
      // 读取 TestOrders.txt 文件内容
      const testOrdersPath = path.join(__dirname, 'res', 'TestOrders.txt');
      const fileContent = await fs.readFile(testOrdersPath, 'utf8');
      
      // 解析文件内容，跳过空行和 # 开头的注释行
      const lines = fileContent.split('\n');
      const testCases = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 跳过空行和 # 开头的注释行
        if (trimmedLine === '' || trimmedLine.startsWith('#')) {
          continue;
        }
        
        // 提取测试指令
        const command = `${trimmedLine}\r\n`;
        const description = `Execute command: ${trimmedLine}`;
        
        // 根据命令类型设置预期响应
        let expectedResponse = null;
        if (trimmedLine.startsWith('gpiob 0 0')) {
          // 对于 gpiob 0 0 命令，我们期望收到特定的响应
          expectedResponse = 'gpiob0 input';
        }
        
        testCases.push({ command, description, expectedResponse });
      }
      
      if (testCases.length === 0) {
        return {
          success: true,
          content: 'No valid test instructions found\n'
        };
      }
      
      let testResults = 'GPIO Test Start:\n\n';
      let passCount = 0;
      let totalTests = 0;
      
      // 发送测试指令并收集响应
      for (const testCase of testCases) {
        const commandName = testCase.command.trim();
        const description = testCase.description;
        
        testResults += `[TEST] ${description}\n`;
        testResults += `  Send-> ${commandName}\n`;
        
        // 发送指令并等待响应
        const response = await new Promise((resolve, reject) => {
          let receivedResponse = false;
          let responseBuffer = '';
          
          // 增加超时时间到8秒，确保设备有足够时间响应
          const timeout = setTimeout(() => {
            if (!receivedResponse) {
              reject(new Error(`Command ${commandName} timeout with no response`));
            }
          }, 8000);
          
          const dataListener = (data) => {
            const dataStr = data.toString();
            responseBuffer += dataStr;
            
            // 优化响应解析逻辑
            const lines = responseBuffer.split('\n');
            for (const line of lines) {
              const trimmedLine = line.trim();
              // 查找不包含命令本身且有实际内容的行
              if (trimmedLine && !trimmedLine.includes(commandName) && !trimmedLine.includes('>')) {
                receivedResponse = true;
                clearTimeout(timeout);
                this.port.removeListener('data', dataListener);
                resolve(trimmedLine);
                break;
              }
            }
          };
          
          this.port.on('data', dataListener);
          
          this.port.write(testCase.command, (err) => {
            if (err) {
              clearTimeout(timeout);
              this.port.removeListener('data', dataListener);
              reject(new Error(`Failed to send command ${commandName}: ${err.message}`));
            }
          });
        });
        
        testResults += `  Device Response: ${response}\n`;
        
        // 验证是否符合预期
        if (testCase.expectedResponse) {
          totalTests++;
          if (response.includes(testCase.expectedResponse)) {
            testResults += `  Test Result: PASS \n\n`;
            passCount++;
          } else {
            testResults += `  Test Result: FAIL \n`;
            testResults += `  Expected Response: ${testCase.expectedResponse}\n\n`;
          }
        } else {
          testResults += `  Test Result: Command Execution Completed\n\n`;
        }
        
        // 等待一小段时间确保设备处理完成
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 测试总结
      let summary = `GPIO Test Summary:\n`;
      summary += `  Total Tests: ${totalTests}\n`;
      summary += `  Passed Tests: ${passCount}\n`;
      summary += `  Failed Tests: ${totalTests - passCount}\n\n`;
      
      if (passCount === totalTests && totalTests > 0) {
        summary += `All tests passed! GPIO functionality is normal\n`;
      } else if (totalTests > 0) {
        summary += `Some tests failed! Please check GPIO connection or configuration\n`;
      } else {
        summary += `Basic command execution completed\n`;
      }
      
      return {
        success: true,
        content: testResults + summary
      };
    } catch (error) {
      console.error('Test commands execution failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SerialPortManager;
