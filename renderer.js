// Enhanced renderer.js with Vue 2 and Element UI
// 注册Element UI组件库
Vue.use(ELEMENT);

new Vue({
  el: '#app',
  data: {
    // 应用信息
    info: '',
    // 当前激活的面板
    activePanel: '1',
    // 配置信息
    config: {
      Serial: '',
      BaudRate: '',
      DataBits: '',
      StopBits: '',
      Parity: '',
      Bin: '',
      TestOrders: ''
    },
    // 读取文件功能
    readLoading: false,
    readResult: '',
    readError: false,
    // 保存文件功能
    saveLoading: false,
    canSave: false,
    // 下载固件功能
    downloadLoading: false,
    downloadResult: '',
    downloadError: false,
    // 测试指令功能
    testLoading: false,
    testResult: '',
    testError: false,
    // 测试结果按钮
    testButtonVisible: false,
    testResultPass: false,
    // SCPI功能
    scpiLoading: false,
    scpiConnected: false,
    scpiError: false,
    scpiLog: '',
    // 校准功能
    calibLoading: false,
    calibError: false,
    frequencyCalibLog: '',
    powerCalibLog: '',
    // 测试功能
    txTestLog: '',
    rxTestLog: ''
  },
  mounted() {
    // 初始化应用信息
    this.initInfo();
    // 初始化配置信息
    this.initConfig();
  },
  methods: {
    // 初始化应用信息
    initInfo() {
      if (window.versions && typeof window.versions === 'object') {
        this.info = `当前使用: Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), Electron (v${window.versions.electron()})`;
      } else {
        this.info = '应用运行在浏览器环境，无法获取Electron信息';
      }
    },
    
    // 初始化配置信息
    async initConfig() {
      try {
        if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
          const response = await window.electronAPI.readFile('./config.json');
          if (response.success) {
            const configData = JSON.parse(response.content);
            this.config = configData;
          }
        }
      } catch (err) {
        console.error('初始化配置失败:', err);
      }
    },
    
    // 读取文件功能
    async readFile() {
      this.readLoading = true;
      this.readResult = '';
      this.readError = false;
      
      try {
        if (!window.electronAPI || typeof window.electronAPI.readFile !== 'function') {
          this.readError = true;
          this.readResult = '错误: 当前环境不支持文件读取功能（请在Electron应用中运行）';
          return;
        }
        
        const response = await window.electronAPI.readFile('./config.json');
        
        if (response.success) {
          this.readResult = `配置文件内容:\n${response.content}`;
          // 更新配置信息
          const configData = JSON.parse(response.content);
          this.config = configData;
          // 读取成功后可以保存
          this.canSave = true;
        } else {
          this.readError = true;
          this.readResult = `错误: ${response.error}`;
        }
      } catch (err) {
        this.readError = true;
        this.readResult = `通信错误: ${err.message}`;
      } finally {
        this.readLoading = false;
      }
    },
    
    // 保存文件功能
    async saveFile() {
      this.saveLoading = true;
      
      try {
        if (!window.electronAPI || typeof window.electronAPI.saveFile !== 'function') {
          this.$message.error('当前环境不支持文件保存功能（请在Electron应用中运行）');
          return;
        }
        
        const configContent = JSON.stringify(this.config, null, 2);
        const response = await window.electronAPI.saveFile('./config.json', configContent);
        
        if (response.success) {
          this.$message.success('配置文件保存成功！');
          // 更新读取结果显示
          this.readResult = `配置文件已保存:\n${configContent}`;
        } else {
          this.$message.error(`保存失败: ${response.error}`);
        }
      } catch (err) {
        this.$message.error(`通信错误: ${err.message}`);
      } finally {
        this.saveLoading = false;
      }
    },
    
    // 下载固件功能
    async downloadFireWare() {
      this.downloadLoading = true;
      this.downloadResult = '正在下载固件...\n';
      this.downloadError = false;
      
      try {
        if (!window.electronAPI || typeof window.electronAPI.downloadFireWare !== 'function') {
          this.downloadError = true;
          this.downloadResult = '错误: 当前环境不支持固件下载功能（请在Electron应用中运行）';
          return;
        }
        
        const response = await window.electronAPI.downloadFireWare('./res');
        
        if (response.success) {
          this.downloadResult = response.logs;
        } else {
          this.downloadError = true;
          this.downloadResult = response.logs + `\n下载失败: ${response.error}`;
        }
      } catch (err) {
        this.downloadError = true;
        this.downloadResult = `错误: ${err.message}`;
      } finally {
        this.downloadLoading = false;
      }
    },
    
    // 测试指令功能
    async testOrders() {
      this.testLoading = true;
      this.testResult = '';
      this.testError = false;
      
      try {
        if (!window.electronAPI || typeof window.electronAPI.testOrders !== 'function') {
          this.testError = true;
          this.testResult = '错误: 当前环境不支持测试指令功能（请在Electron应用中运行）';
          return;
        }
        
        const response = await window.electronAPI.testOrders();
        
        if (response.success) {
          this.testResult = `测试结果:\n${response.content}`;
          // 测试通过则显示PASS, 颜色为绿色
          this.testButtonVisible = true;
          this.testResultPass = true;
        } else {
          this.testError = true;
          this.testResult = `测试失败: ${response.error}`;
          // 测试失败则显示FAIL, 颜色为红色
          this.testButtonVisible = true;
          this.testResultPass = false;
        }
      } catch (err) {
        this.testError = true;
        this.testResult = `通信错误: ${err.message}`;
      } finally {
        this.testLoading = false;
      }
    },
    
    // 显示测试结果
    showTestResult() {
      if (this.testResultPass) {
        this.$message.success('测试通过！');
      } else {
        this.$message.error('测试失败！');
      }
    },
    
    // 清除所有日志
    clearLogs() {
      this.$confirm('确定要清除所有日志吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.readResult = '';
        this.downloadResult = '';
        this.testResult = '';
        this.$message.success('日志已清除');
      }).catch(() => {
        this.$message.info('已取消清除');
      });
    },
    
    // 处理菜单选择
    handleMenuSelect(key, keyPath) {
      this.activePanel = key;
    },
    
    // SCPI连接
    async connectSCPI() {
      this.scpiLoading = true;
      this.scpiLog = '';
      this.scpiError = false;
      
      try {
        this.scpiLog += '正在连接SCPI设备...\n';
        // 这里可以添加实际的SCPI连接逻辑
        // 例如：调用electronAPI的scpiConnect方法
        await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟连接延迟
        this.scpiConnected = true;
        this.scpiLog += 'SCPI设备连接成功！\n';
        this.$message.success('SCPI连接成功');
      } catch (err) {
        this.scpiError = true;
        this.scpiLog += `连接失败: ${err.message}\n`;
        this.$message.error(`SCPI连接失败: ${err.message}`);
      } finally {
        this.scpiLoading = false;
      }
    },
    
    // SCPI断开连接
    async disconnectSCPI() {
      this.scpiLoading = true;
      this.scpiLog += '正在断开SCPI设备连接...\n';
      
      try {
        // 这里可以添加实际的SCPI断开连接逻辑
        // 例如：调用electronAPI的scpiDisconnect方法
        await new Promise(resolve => setTimeout(resolve, 500)); // 模拟断开延迟
        this.scpiConnected = false;
        this.scpiLog += 'SCPI设备已断开连接\n';
        this.$message.success('SCPI已断开连接');
      } catch (err) {
        this.scpiError = true;
        this.scpiLog += `断开失败: ${err.message}\n`;
        this.$message.error(`SCPI断开失败: ${err.message}`);
      } finally {
        this.scpiLoading = false;
      }
    },
    
    // 频偏校准
    async calibrateFrequency() {
      this.calibLoading = true;
      this.frequencyCalibLog = '';
      this.calibError = false;
      
      try {
        this.frequencyCalibLog += '开始频偏校准...\n';
        // 这里可以添加实际的频偏校准逻辑
        // 例如：调用electronAPI的calibrateFrequency方法
        await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟校准延迟
        this.frequencyCalibLog += '频偏校准完成！\n';
        this.frequencyCalibLog += '校准结果：\n';
        this.frequencyCalibLog += '  频偏值: +0.5ppm\n';
        this.frequencyCalibLog += '  校准状态: 成功\n';
        this.$message.success('频偏校准完成');
      } catch (err) {
        this.calibError = true;
        this.frequencyCalibLog += `校准失败: ${err.message}\n`;
        this.$message.error(`频偏校准失败: ${err.message}`);
      } finally {
        this.calibLoading = false;
      }
    },
    
    // 功率校准
    async calibratePower() {
      this.calibLoading = true;
      this.powerCalibLog = '';
      this.calibError = false;
      
      try {
        this.powerCalibLog += '开始功率校准...\n';
        // 这里可以添加实际的功率校准逻辑
        // 例如：调用electronAPI的calibratePower方法
        await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟校准延迟
        this.powerCalibLog += '功率校准完成！\n';
        this.powerCalibLog += '校准结果：\n';
        this.powerCalibLog += '  功率偏差: -0.2dBm\n';
        this.powerCalibLog += '  校准状态: 成功\n';
        this.$message.success('功率校准完成');
      } catch (err) {
        this.calibError = true;
        this.powerCalibLog += `校准失败: ${err.message}\n`;
        this.$message.error(`功率校准失败: ${err.message}`);
      } finally {
        this.calibLoading = false;
      }
    },
    
    // TX测试
    async runTxTest() {
      this.testLoading = true;
      this.txTestLog = '';
      this.testError = false;
      
      try {
        this.txTestLog += '开始TX测试...\n';
        // 这里可以添加实际的TX测试逻辑
        // 例如：调用electronAPI的runTxTest方法
        await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟测试延迟
        this.txTestLog += 'TX测试完成！\n';
        this.txTestLog += '测试结果：\n';
        this.txTestLog += '  发射功率: 20.5dBm\n';
        this.txTestLog += '  频谱纯度: -55dBc\n';
        this.txTestLog += '  测试状态: PASS\n';
        this.$message.success('TX测试完成');
      } catch (err) {
        this.testError = true;
        this.txTestLog += `测试失败: ${err.message}\n`;
        this.$message.error(`TX测试失败: ${err.message}`);
      } finally {
        this.testLoading = false;
      }
    },
    
    // RX测试
    async runRxTest() {
      this.testLoading = true;
      this.rxTestLog = '';
      this.testError = false;
      
      try {
        this.rxTestLog += '开始RX测试...\n';
        // 这里可以添加实际的RX测试逻辑
        // 例如：调用electronAPI的runRxTest方法
        await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟测试延迟
        this.rxTestLog += 'RX测试完成！\n';
        this.rxTestLog += '测试结果：\n';
        this.rxTestLog += '  接收灵敏度: -95dBm\n';
        this.rxTestLog += '  误码率: 0.001%\n';
        this.rxTestLog += '  测试状态: PASS\n';
        this.$message.success('RX测试完成');
      } catch (err) {
        this.testError = true;
        this.rxTestLog += `测试失败: ${err.message}\n`;
        this.$message.error(`RX测试失败: ${err.message}`);
      } finally {
        this.testLoading = false;
      }
    }
  }
});
