const store = require('./utils/store')
const backup = require('./utils/backup')

App({
  onLaunch() {
    store.ensureDefaults()
    this.runUpgradeBackup()
  },

  // 1.1.0 首次启动：升级前先自动生成一份完整 JSON 备份，文件名与时间写进设置
  runUpgradeBackup() {
    const s = store.getSettings()
    if (s.upgradeBackupAt) return

    const bk = backup.upgradeBackup()
    if (!bk.ok) return

    const next = store.getSettings()
    next.upgradeBackupAt = bk.at
    next.upgradeBackupFileName = bk.fileName || ''
    store.saveSettings(next)
  }
})
