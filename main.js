// app它负责您应用程序的事件生命周期，BrowserWindow，它负责创建和管理应用窗口
const { app, BrowserWindow } = require('electron')
const path = require('node:path')

// createWindow() 函数将您的页面加载到新的 BrowserWindow 实例中
const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    // 为了将脚本附在渲染进程上，在 BrowserWindow 构造器中使用 webPreferences.preload 传入脚本的路径。
    webPreferences: {
      // __dirname 字符串指向当前正在执行的脚本的路径(在本例中，它指向你的项目的根文件夹)。
      // path.join API 将多个路径联结在一起，创建一个跨平台的路径字符串
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}

// 在应用准备就绪时调用函数
// app 是 Electron 的主进程对象，代表整个应用程序。
app.whenReady().then(() => {
  createWindow()
  // 这段代码的作用是：当应用程序被激活（例如用户点击应用程序图标）时，如果没有打开的窗口，则创建一个新的窗口。
  app.on('activate', () => { // activate 事件在应用程序被激活时触发，通常是在用户点击应用程序的图标时。
    // BrowserWindow.getAllWindows() 返回一个包含所有打开的 BrowserWindow 实例的数组
    // length === 0 检查当前是否有任何窗口打开
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // 当所有窗口都被关闭时，如果不是在 macOS 上运行，则退出应用程序。
  // 在 macOS 上，应用程序通常不会在所有窗口关闭时自动退出，因此这段代码确保了在非 macOS 平台上正确地退出应用程序。
  // window-all-closed 事件在所有窗口都被关闭时触发
  app.on('window-all-closed', () => {
    // process.platform 是一个 Node.js 全局变量，表示当前的操作系统平台
    if (process.platform !== 'darwin') { // 'darwin' 是 macOS 的平台标识符，因为 macOS 不会自动关闭应用程序
      // app.quit() 是 Electron 的一个方法，用于退出应用程序
      app.quit()
    }
  })

})