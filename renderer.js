// renderer.js - 串口工具前端逻辑

// 初始化Vue应用
const app = new Vue({
  el: '#app',
  data: {
    // 串口设置
    port: '',
    selectedPort: '',
    customPort: '',
    baudRate: '115200',
    selectedBaudRate: '115200',
    customBaudRate: '',
    dataBits: '8',
    stopBits: '1',
    parity: 'none',
    flowControl: 'none',
    
    // 端口列表
    ports: [],
    
    // 连接状态
    isConnected: false,
    
    // 消息
    sendMessage: '',
    outputMessages: '',
    
    // 指令序列发送
    sequenceMode: false,
    sequenceCommands: '',
    selectedFilePath: '',
    
    // 接收编码设置
    encoding: 'utf8'
  },
  mounted() {
    // 初始化时刷新端口列表
    this.refreshPorts();
    
    // 监听来自主进程的串口数据
    window.electronAPI.onSerialData((event, data) => {
      let formattedData = data;
      // 根据选择的编码格式处理数据
      if (typeof data === 'string') {
        // 如果数据已经是字符串，直接使用
        formattedData = data;
      } else if (Buffer.isBuffer(data)) {
        // 如果是Buffer对象，根据选择的编码格式转换
        switch (this.encoding) {
          case 'utf8':
            formattedData = data.toString('utf8');
            break;
          case 'ascii':
            formattedData = data.toString('ascii');
            break;
          case 'latin1':
            formattedData = data.toString('latin1');
            break;
          case 'hex':
            formattedData = data.toString('hex').toUpperCase();
            // 每2个字符添加一个空格，方便阅读
            formattedData = formattedData.replace(/(..)/g, '$1 ').trim();
            break;
          default:
            formattedData = data.toString('utf8');
        }
      }
      this.outputMessages += `[${new Date().toLocaleTimeString()}] ${formattedData}\n`;
    });
    
    // 监听端口更新
    window.electronAPI.onPortsUpdated((event, ports) => {
      this.ports = ports;
      if (ports.length > 0 && !this.port && !this.selectedPort) {
        this.port = ports[0];
        this.selectedPort = ports[0];
      }
    });
    
    // 监听连接状态变化
    window.electronAPI.onConnectionStatus((event, status) => {
      this.isConnected = status;
    });
  },
  methods: {
    // 刷新端口列表
    async refreshPorts() {
      try {
        const ports = await window.electronAPI.getSerialPorts();
        this.ports = ports;
        if (ports.length > 0) {
          // 如果当前没有选中的端口，或者当前选中的端口不在列表中且不是自定义端口
          if (!this.port || (this.selectedPort !== 'custom' && !ports.includes(this.selectedPort))) {
            this.port = ports[0];
            this.selectedPort = ports[0];
          }
        }
      } catch (error) {
        console.error('刷新端口失败:', error);
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 刷新端口失败: ${error.message}\n`;
      }
    },
    
    // 处理端口选择变化
    handlePortChange() {
      if (this.selectedPort === 'custom') {
        // 如果选择自定义，使用当前的customPort值
        this.port = this.customPort || '';
      } else {
        // 否则使用选择的预设值
        this.port = this.selectedPort;
      }
    },
    
    // 处理自定义端口输入变化
    handleCustomPortChange() {
      // 直接使用输入的端口值
      this.port = this.customPort;
    },
    
    // 处理波特率选择变化
    handleBaudRateChange() {
      if (this.selectedBaudRate === 'custom') {
        // 如果选择自定义，使用当前的customBaudRate值
        this.baudRate = this.customBaudRate || '115200';
      } else {
        // 否则使用选择的预设值
        this.baudRate = this.selectedBaudRate;
      }
    },
    
    // 处理自定义波特率输入变化
    handleCustomBaudRateChange() {
      // 确保输入是有效的数字
      if (this.customBaudRate && !isNaN(this.customBaudRate) && parseInt(this.customBaudRate) > 0) {
        this.baudRate = this.customBaudRate;
      }
    },
    
    // 连接串口
    async connect() {
      try {
        const success = await window.electronAPI.connectSerial({
          port: this.port,
          baudRate: parseInt(this.baudRate),
          dataBits: parseInt(this.dataBits),
          stopBits: parseInt(this.stopBits),
          parity: this.parity,
          flowControl: this.flowControl
        });
        
        if (success) {
          this.isConnected = true;
          this.outputMessages += `[${new Date().toLocaleTimeString()}] 成功连接到 ${this.port}\n`;
        } else {
          this.outputMessages += `[${new Date().toLocaleTimeString()}] 连接失败\n`;
        }
      } catch (error) {
        console.error('连接失败:', error);
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 连接失败: ${error.message}\n`;
      }
    },
    
    // 断开串口连接
    async disconnect() {
      try {
        await window.electronAPI.disconnectSerial();
        this.isConnected = false;
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 已断开连接\n`;
      } catch (error) {
        console.error('断开连接失败:', error);
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 断开连接失败: ${error.message}\n`;
      }
    },
    
    // 发送消息
    async send() {
      if (!this.isConnected || !this.sendMessage.trim()) {
        return;
      }
      
      try {
        const success = await window.electronAPI.sendSerialData(this.sendMessage);
        if (success) {
          this.outputMessages += `[${new Date().toLocaleTimeString()}] 发送: ${this.sendMessage}\n`;
          this.outputMessages += `[${new Date().toLocaleTimeString()}] 指令发送成功，等待设备返回数据...\n`;
          this.sendMessage = '';
        } else {
          this.outputMessages += `[${new Date().toLocaleTimeString()}] 发送失败: 指令发送失败\n`;
        }
      } catch (error) {
        console.error('发送失败:', error);
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 发送失败: ${error.message}\n`;
      }
    },
    
    // 清空输出
    clearOutput() {
      this.outputMessages = '';
    },
    
    // 处理文件选择
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.sequenceCommands = e.target.result;
          this.selectedFilePath = file.name;
          this.outputMessages += `[${new Date().toLocaleTimeString()}] 已加载指令文件：${file.name}\n`;
        };
        reader.readAsText(file);
      }
    },
    
    // 更新编码设置
    updateEncoding() {
      // 编码设置通过Vue双向绑定自动更新，此方法用于扩展功能
    },
    
    // 发送指令序列
    async sendSequence() {
      if (!this.isConnected || !this.sequenceMode) {
        return;
      }
      
      try {
        // 分割指令列表，过滤空行和注释行
        const commands = this.sequenceCommands
          .split('\n')
          .map(cmd => cmd.trim())
          .filter(cmd => {
            // 过滤空行和以#开头的注释行
            return cmd.length > 0 && !cmd.startsWith('#');
          });
        
        if (commands.length === 0) {
          this.outputMessages += `[${new Date().toLocaleTimeString()}] 没有可发送的指令\n`;
          return;
        }
        
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 开始发送指令序列，共 ${commands.length} 条指令\n`;
        
        // 逐条发送指令
        for (let i = 0; i < commands.length; i++) {
          const cmd = commands[i];
          
          // 记录发送时间
          const sendTime = new Date();
          this.outputMessages += `[${sendTime.toLocaleTimeString()}] 发送序列指令 ${i + 1}/${commands.length}：${cmd}\n`;
          
          // 发送指令
          const success = await window.electronAPI.sendSerialData(cmd);
          
          if (success) {
            this.outputMessages += `[${new Date().toLocaleTimeString()}] 指令发送成功，等待设备返回数据...\n`;
          } else {
            this.outputMessages += `[${new Date().toLocaleTimeString()}] 指令发送失败\n`;
          }
          
          // 增加发送间隔时间，给设备足够的时间处理和返回数据
          // 从100ms增加到500ms
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 指令序列发送完成\n`;
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 提示：如果没有接收到返回数据，请检查：\n`;
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 1. 设备是否正常工作\n`;
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 2. 指令格式是否正确\n`;
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 3. 串口连接是否稳定\n`;
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 4. 编码格式是否正确\n`;
      } catch (error) {
        console.error('发送序列失败:', error);
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 发送序列失败: ${error.message}\n`;
      }
    }
  }
});