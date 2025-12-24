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
    testResultPass: false
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
    }
  }
});
