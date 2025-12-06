// renderer.js - 应用前端逻辑

// 初始化Vue应用
const app = new Vue({
  el: '#app',
  data: {
    // 基本数据结构，可根据需要扩展
    message: 'Hello Electron + Vue!',
    
    // 版本信息
    versions: {
      node: '',
      chrome: '',
      electron: ''
    }
  },
  mounted() {
    // 初始化时获取版本信息
    this.initVersions();
  },
  methods: {
    // 获取版本信息
    initVersions() {
      this.versions.node = window.versions.node();
      this.versions.chrome = window.versions.chrome();
      this.versions.electron = window.versions.electron();
    }
  }
});