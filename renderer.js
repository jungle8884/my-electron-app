// Enhanced renderer.js with Vue 2 and Element UI
// 注册Element UI组件库
Vue.use(ELEMENT);

new Vue({
  el: '#app',
  data: {
    // 应用信息
    info: '',
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
    // 自动读取文件功能
    this.checkAutoRead();
    // 自动下载固件功能
    this.checkAutoDownload();
    // 自动测试指令功能
    this.checkAutoTestOrder();
  },
  methods: {
    // 初始化应用信息
    initInfo() {
      if (window.versions && typeof window.versions === 'object') {
        this.info = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`;
      } else {
        this.info = 'This app is running in a browser, cannot get Electron environment information';
      }
    },
    // 检查自动读取文件功能
    checkAutoRead() {
      const autoReadCheckbox = document.getElementById('autoReadCheckbox');
      if (autoReadCheckbox && autoReadCheckbox.checked) {
        setTimeout(() => {
          console.log('Auto-triggering readFile...');
          this.readFile();
        }, 2000);
      }
    },
    // 检查自动下载固件功能
    checkAutoDownload() {
      const autoDownloadCheckbox = document.getElementById('autoDownloadCheckbox');
      if (autoDownloadCheckbox && autoDownloadCheckbox.checked) {
        setTimeout(() => {
          console.log('Auto-triggering downloadFireWare...');
          this.downloadFireWare();
        }, 2000);
      }
    },
    // 检查自动测试指令功能
    checkAutoTestOrder() {
      const autoExecuteCheckbox = document.getElementById('autoExecuteCheckbox');
      if (autoExecuteCheckbox && autoExecuteCheckbox.checked) {
        setTimeout(() => {
          console.log('Auto-triggering testOrders...');
          this.testOrders();
        }, 2000);
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
          this.readResult = 'Error: Current environment does not support file reading function (please run in Electron app)';
          return;
        }
        
        const response = await window.electronAPI.readFile('./config.json');
        
        if (response.success) {
          this.readResult = `File content:\n${response.content}`;
        } else {
          this.readError = true;
          this.readResult = `Error: ${response.error}`;
        }
      } catch (err) {
        this.readError = true;
        this.readResult = `Communication error: ${err.message}`;
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
          this.downloadResult = 'Error: Current environment does not support firmware download function (please run in Electron app)';
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
          this.testResult = 'Error: Current environment does not support test command function (please run in Electron app)';
          return;
        }
        
        const response = await window.electronAPI.testOrders();
        
        if (response.success) {
          this.testResult = `Test result:\n${response.content}`;
          // 测试通过则显示PASS, 颜色为绿色
          this.testButtonVisible = true;
          this.testResultPass = true;
        } else {
          this.testError = true;
          this.testResult = `Error: ${response.error}`;
          // 测试失败则显示FAIL, 颜色为红色
          this.testButtonVisible = true;
          this.testResultPass = false;
        }
      } catch (err) {
        this.testError = true;
        this.testResult = `Communication error: ${err.message}`;
      } finally {
        this.testLoading = false;
      }
    }
  }
});
