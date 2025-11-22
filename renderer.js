// renderer.js 增强版
const readBtn = document.getElementById('readBtn');
const resultDiv = document.getElementById('result');

const information = document.getElementById('info')
information.innerText = `本应用正在使用 Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), 和 Electron (v${versions.electron()})`

// 加载状态处理
readBtn.addEventListener('click', async () => {
  // 禁用按钮，防止重复点击
  readBtn.disabled = true;
  readBtn.textContent = '读取中...';
  resultDiv.textContent = '';

  try {
    const response = await window.electronAPI.readFile('./test.txt');
    
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