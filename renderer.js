// Enhanced renderer.js
// Add auto-download feature for testing purposes
window.addEventListener('load', () => {
  // Auto-trigger firmware download after 2 seconds
  setTimeout(() => {
    console.log('Auto-triggering firmware download...');
    document.getElementById('downloadFireWareBtn').click();
  }, 2000);
});

const readBtn = document.getElementById('readBtn');
const resultDiv = document.getElementById('result');
const downloadFireWareBtn = document.getElementById('downloadFireWareBtn');
const downloadFireWareResultDiv = document.getElementById('downloadFireWareResult');
const testOrdersBtn = document.getElementById('testOrdersBtn');
const testOrdersResultDiv = document.getElementById('testOrdersResult');

const information = document.getElementById('info')
// Add security check to ensure versions object exists
if (window.versions && typeof window.versions === 'object') {
  information.innerText = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`
} else {
  information.innerText = 'This app is running in a browser, cannot get Electron environment information'
}

// Loading state handling
readBtn.addEventListener('click', async () => {
  // Disable button to prevent duplicate clicks
  readBtn.disabled = true;
  readBtn.textContent = 'Reading...';
  resultDiv.textContent = '';

  try {
    // Add security check to ensure electronAPI exists
    if (!window.electronAPI || typeof window.electronAPI.readFile !== 'function') {
      resultDiv.style.color = 'red';
      resultDiv.textContent = 'Error: Current environment does not support file reading function (please run in Electron app)';
      return;
    }
    
    const response = await window.electronAPI.readFile('./config.json');
    
    if (response.success) {
      // Format display text (preserve line breaks)
      resultDiv.style.whiteSpace = 'pre-wrap';
      resultDiv.textContent = `File content:\n${response.content}`;
    } else {
      // Error style prompt
      resultDiv.style.color = 'red';
      resultDiv.textContent = `Error: ${response.error}`;
    }
  } catch (err) {
    // Catch communication exceptions
    resultDiv.style.color = 'red';
    resultDiv.textContent = `Communication error: ${err.message}`;
  } finally {
    // Restore button state
    readBtn.disabled = false;
    readBtn.textContent = 'Read File';
  }
});

downloadFireWareBtn.addEventListener('click', async () => {
  // Disable button to prevent duplicate clicks
  downloadFireWareBtn.disabled = true;
  downloadFireWareBtn.textContent = 'Downloading...';
  downloadFireWareResultDiv.textContent = '正在下载固件...\n';

  try {
    // Add security check to ensure electronAPI exists
    if (!window.electronAPI || typeof window.electronAPI.downloadFireWare !== 'function') {
      downloadFireWareResultDiv.style.color = 'red';
      downloadFireWareResultDiv.textContent = 'Error: Current environment does not support firmware download function (please run in Electron app)';
      return;
    }
    
    const response = await window.electronAPI.downloadFireWare('./res');
    
    if (response.success) {
      // Format display text (preserve line breaks)
      downloadFireWareResultDiv.style.whiteSpace = 'pre-wrap';
      downloadFireWareResultDiv.textContent = response.logs;
    } else {
      // Error style prompt
      downloadFireWareResultDiv.style.color = 'red';
      downloadFireWareResultDiv.style.whiteSpace = 'pre-wrap';
      downloadFireWareResultDiv.textContent = response.logs + `\n下载失败: ${response.error}`;
    }
  } catch (err) {
    // Catch communication exceptions
    downloadFireWareResultDiv.style.color = 'red';
    downloadFireWareResultDiv.textContent = `错误: ${err.message}`;
  } finally {
    // Restore button state
    downloadFireWareBtn.disabled = false;
    downloadFireWareBtn.textContent = 'Download Firmware';
  }
});

// Test command button click event
testOrdersBtn.addEventListener('click', async () => {
  // Disable button to prevent duplicate clicks
  testOrdersBtn.disabled = true;
  testOrdersBtn.textContent = 'Testing...';
  testOrdersResultDiv.textContent = '';

  try {
    // Add security check to ensure electronAPI exists
    if (!window.electronAPI || typeof window.electronAPI.testOrders !== 'function') {
      testOrdersResultDiv.style.color = 'red';
      testOrdersResultDiv.textContent = 'Error: Current environment does not support test command function (please run in Electron app)';
      return;
    }
    
    const response = await window.electronAPI.testOrders();
    
    if (response.success) {
      // Format display text (preserve line breaks)
      testOrdersResultDiv.style.whiteSpace = 'pre-wrap';
      testOrdersResultDiv.textContent = `Test result:\n${response.content}`;
    } else {
      // Error style prompt
      testOrdersResultDiv.style.color = 'red';
      testOrdersResultDiv.textContent = `Error: ${response.error}`;
    }
  } catch (err) {
    // Catch communication exceptions
    testOrdersResultDiv.style.color = 'red';
    testOrdersResultDiv.textContent = `Communication error: ${err.message}`;
  } finally {
    // Restore button state
    testOrdersBtn.disabled = false;
    testOrdersBtn.textContent = 'Test Commands';
  }
});