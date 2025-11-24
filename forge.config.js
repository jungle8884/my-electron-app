const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const path = require('path'); // 需顶部引入 path 模块

module.exports = {
  packagerConfig: {
  asar: true,
  icon: path.resolve(__dirname, './assets/icon.ico'), // Windows 图标
  ignore: [
    /^\/\.git/, // 忽略 git 目录
    /^\/node_modules\/\.cache/, // 忽略 npm 缓存
    /^\/assets\/design/, // 忽略设计源文件（如有）
    /^\/forge.config.js/, // 配置文件无需打包到应用内
  ],
},
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: path.resolve(__dirname, './assets/icon.ico'), // Windows 安装程序图标
        authors: 'Your Name',
        description: 'Your App Description',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      config: {},
      platforms: ['darwin', 'linux', 'win32'], // 为所有平台生成zip包
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: path.resolve(__dirname, './assets/icon.icns'), // macOS 图标
        background: path.resolve(__dirname, './assets/dmg-background.png'), // DMG 背景图
      },
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        icon: path.resolve(__dirname, './assets/icon.png'), // Linux 图标
        maintainer: 'Your Name <your@email.com>',
        description: 'Your App Description',
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        icon: path.resolve(__dirname, './assets/icon.png'), // Linux 图标
        description: 'Your App Description',
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
