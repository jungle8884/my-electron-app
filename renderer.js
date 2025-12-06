// renderer.js 增强版
const readBtn = document.getElementById('readBtn');
const resultDiv = document.getElementById('result');
const downloadFireWareBtn = document.getElementById('downloadFireWareBtn');
const downloadFireWareResultDiv = document.getElementById('downloadFireWareResult');
const testOrdersBtn = document.getElementById('testOrdersBtn');
const testOrdersResultDiv = document.getElementById('testOrdersResult');

const information = document.getElementById('info')
// 添加安全检查，确保versions对象存在
if (window.versions && typeof window.versions === 'object') {
  information.innerText = `本应用正在使用 Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), 和 Electron (v${window.versions.electron()})`
} else {
  information.innerText = '本应用正在浏览器中运行，无法获取Electron环境信息'
}

// 加载状态处理
readBtn.addEventListener('click', async () => {
  // 禁用按钮，防止重复点击
  readBtn.disabled = true;
  readBtn.textContent = '读取中...';
  resultDiv.textContent = '';

  try {
    // 添加安全检查，确保electronAPI存在
    if (!window.electronAPI || typeof window.electronAPI.readFile !== 'function') {
      resultDiv.style.color = 'red';
      resultDiv.textContent = '错误：当前环境不支持文件读取功能（请在Electron应用中运行）';
      return;
    }
    
    const response = await window.electronAPI.readFile('./config.json');
    
    if (response.success) {
      // 格式化显示文本（保留换行）
      resultDiv.style.whiteSpace = 'pre-wrap';
      resultDiv.textContent = `文件内容：\n${response.content}`;
    } else {
      // 错误样式提示
      resultDiv.style.color = 'red';
      resultDiv.textContent = `错误：${response.error}`;
    }
  } catch (err) {
    // 捕获通信过程中的异常
    resultDiv.style.color = 'red';
    resultDiv.textContent = `通信错误：${err.message}`;
  } finally {
    // 恢复按钮状态
    readBtn.disabled = false;
    readBtn.textContent = '读取文件';
  }
});

downloadFireWareBtn.addEventListener('click', async () => {
  // 禁用按钮，防止重复点击
  downloadFireWareBtn.disabled = true;
  downloadFireWareBtn.textContent = '下载中...';
  downloadFireWareResultDiv.textContent = '';

  try {
    // 添加安全检查，确保electronAPI存在
    if (!window.electronAPI || typeof window.electronAPI.downloadFireWare !== 'function') {
      downloadFireWareResultDiv.style.color = 'red';
      downloadFireWareResultDiv.textContent = '错误：当前环境不支持固件下载功能（请在Electron应用中运行）';
      return;
    }
    
    const response = await window.electronAPI.downloadFireWare('./res');
    
    if (response.success) {
      // 格式化显示文本（保留换行）
      downloadFireWareResultDiv.style.whiteSpace = 'pre-wrap';
      downloadFireWareResultDiv.textContent = `下载结果：\n${response.content}`;
    } else {
      // 错误样式提示
      downloadFireWareResultDiv.style.color = 'red';
      downloadFireWareResultDiv.textContent = `错误：${response.error}`;
    }
  } catch (err) {
    // 捕获通信过程中的异常
    downloadFireWareResultDiv.style.color = 'red';
    downloadFireWareResultDiv.textContent = `通信错误：${err.message}`;
  } finally {
    // 恢复按钮状态
    downloadFireWareBtn.disabled = false;
    downloadFireWareBtn.textContent = '下载固件';
  }
});