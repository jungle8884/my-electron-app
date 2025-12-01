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
    outputMessages: ''
  },
  mounted() {
    // 初始化时刷新端口列表
    this.refreshPorts();
    
    // 监听来自主进程的串口数据
    window.electronAPI.onSerialData((event, data) => {
      this.outputMessages += `[${new Date().toLocaleTimeString()}] ${data}\n`;
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
        await window.electronAPI.sendSerialData(this.sendMessage);
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 发送: ${this.sendMessage}\n`;
        this.sendMessage = '';
      } catch (error) {
        console.error('发送失败:', error);
        this.outputMessages += `[${new Date().toLocaleTimeString()}] 发送失败: ${error.message}\n`;
      }
    },
    
    // 清空输出
    clearOutput() {
      this.outputMessages = '';
    }
  }
});