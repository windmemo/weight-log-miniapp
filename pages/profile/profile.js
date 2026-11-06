const store = require('../../utils/store')
const unitUtil = require('../../utils/unit')
const dateUtil = require('../../utils/date')
const stats = require('../../utils/stats')
const bmiUtil = require('../../utils/bmi')
const backup = require('../../utils/backup')

Page({
  data: {
    settings: {},
    unit: 'jin',
    unitLabel: '斤',
    targetInput: '',
    targetPlaceholder: '比如 120.0',
    targetText: '未设置目标',
    heightInput: '',
    ageInput: '',
    gender: '',
    bmiText: '',
    bmiClass: '',
    bmiRangeText: '',
    bmiDistance: '',
    bmiLatestText: '',
    bmiTip: '',
    basisOpen: false,
    upgradeBackupText: '',
    recordCount: 0,
    lastExportText: '还没有导出过',
    dialog: {
      visible: false,
      fileCount: 0,
      dupCount: 0,
      badCount: 0,
      backupName: '',
      backupOk: true
    }
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const s = store.getSettings()
    const records = store.getRecords()
    const unit = s.unit
    const unitText = unitUtil.unitLabel(unit)
    const latest = stats.latestRecord(records)

    // BMI：用最近一条体重记录 + 身高，按保留 1 位小数后的值分类
    let bmiText = ''
    let bmiClass = ''
    let bmiRangeText = ''
    let bmiDistance = ''
    let bmiLatestText = ''
    let bmiTip = ''
    const range = bmiUtil.bestRange(s.age)

    if (!s.heightCm) {
      bmiTip = '填入身高（厘米）后就能计算 BMI。'
    } else if (!latest) {
      bmiTip = '还没有体重记录，先在「今天」记一笔。'
    } else {
      const rawBmi = bmiUtil.calc(latest.weightKg, s.heightCm)
      if (rawBmi === null) {
        bmiTip = '最近一条记录缺少有效体重，暂时算不出 BMI。'
      } else {
        const bmi = bmiUtil.round1(rawBmi)
        bmiText = bmi.toFixed(1)
        bmiClass = bmiUtil.classify(bmi)
        if (!range) {
          bmiRangeText = '填写年龄后显示对应年龄段的参考区间'
        } else if (!range.applicable) {
          bmiRangeText = '未满 18 岁：成人标准不适用，仅供参考'
        } else if (s.age >= 65) {
          bmiRangeText = '参考区间 ' + bmiUtil.rangeLabel(range) + '（65 岁及以上）'
        } else {
          bmiRangeText = '参考区间 ' + bmiUtil.rangeLabel(range) + '（18–64 岁）'
        }
        bmiDistance = range ? bmiUtil.distanceText(bmi, range) : ''
        bmiLatestText = '按最近一次记录：' + dateUtil.formatDateTime(latest.ts) + ' · ' + unitUtil.displayText(latest.weightKg, unit) + ' ' + unitText
      }
    }

    let upgradeBackupText = ''
    if (s.upgradeBackupAt) {
      upgradeBackupText = s.upgradeBackupFileName
        ? '升级前自动备份：' + s.upgradeBackupFileName + '（' + dateUtil.formatDateTime(s.upgradeBackupAt) + '）'
        : '升级时本机还没有记录，未生成备份文件（' + dateUtil.formatDateTime(s.upgradeBackupAt) + '）'
    }

    this.setData({
      settings: s,
      unit: unit,
      unitLabel: unitText,
      gender: s.gender || '',
      ageInput: s.age ? String(s.age) : '',
      targetInput: s.targetWeightKg ? unitUtil.displayText(s.targetWeightKg, unit) : '',
      targetPlaceholder: unit === 'kg' ? '比如 60.00' : '比如 120.0',
      targetText: s.targetWeightKg ? '当前目标 ' + unitUtil.displayText(s.targetWeightKg, unit) + ' ' + unitText : '尚未设置目标',
      heightInput: s.heightCm ? String(s.heightCm) : '',
      bmiText: bmiText,
      bmiClass: bmiClass,
      bmiRangeText: bmiRangeText,
      bmiDistance: bmiDistance,
      bmiLatestText: bmiLatestText,
      bmiTip: bmiTip,
      upgradeBackupText: upgradeBackupText,
      recordCount: records.length,
      lastExportText: s.lastExportAt ? dateUtil.formatDateTime(s.lastExportAt) : '还没有导出过'
    })
  },

  onUnit(e) {
    const unit = e.currentTarget.dataset.unit
    const s = store.getSettings()
    if (s.unit === unit) return
    s.unit = unit
    store.saveSettings(s)
    this.refresh()
    wx.showToast({ title: '已切换为' + unitUtil.unitLabel(unit), icon: 'none' })
  },

  onTargetInput(e) {
    this.setData({ targetInput: e.detail.value })
  },

  onSaveTarget() {
    const s = store.getSettings()
    const unit = s.unit
    const raw = String(this.data.targetInput || '').trim()

    if (!raw) {
      wx.showToast({ title: '请先输入目标体重', icon: 'none' })
      return
    }
    const places = unitUtil.decimals(unit)
    const targetRe = new RegExp('^\\d{1,3}(\\.\\d{1,' + places + '})?$')
    if (!targetRe.test(raw)) {
      wx.showToast({ title: '请输入数字，最多 ' + places + ' 位小数', icon: 'none' })
      return
    }

    const kg = unitUtil.fromDisplay(Number(raw), unit)
    if (!unitUtil.isValidKg(kg)) {
      wx.showToast({ title: '目标需在 ' + unitUtil.rangeText(unit) + ' 之间', icon: 'none' })
      return
    }

    s.targetWeightKg = kg
    store.saveSettings(s)
    this.refresh()
    wx.showToast({ title: '目标已保存', icon: 'success' })
  },

  onClearTarget() {
    if (!this.data.settings.targetWeightKg) return
    const that = this
    wx.showModal({
      title: '清除目标体重？',
      content: '首页就不再显示「距目标还差多少」，随时可以重新设置。',
      confirmText: '清除',
      success(res) {
        if (!res.confirm) return
        const s = store.getSettings()
        s.targetWeightKg = null
        store.saveSettings(s)
        that.refresh()
      }
    })
  },

  onHeightInput(e) {
    this.setData({ heightInput: e.detail.value })
  },

  onSaveHeight() {
    const s = store.getSettings()
    const raw = String(this.data.heightInput || '').trim()

    if (!raw) {
      s.heightCm = null
      store.saveSettings(s)
      this.refresh()
      wx.showToast({ title: '已清除身高', icon: 'none' })
      return
    }
    if (!/^\d{2,3}$/.test(raw)) {
      wx.showToast({ title: '请输入 100–250 的整数（厘米）', icon: 'none' })
      return
    }
    const h = Number(raw)
    if (h < 100 || h > 250) {
      wx.showToast({ title: '身高需在 100–250 厘米之间', icon: 'none' })
      return
    }

    s.heightCm = h
    store.saveSettings(s)
    this.refresh()
    wx.showToast({ title: '身高已保存', icon: 'success' })
  },

  onAgeInput(e) {
    this.setData({ ageInput: e.detail.value })
  },

  onGender(e) {
    const gender = e.currentTarget.dataset.gender
    const s = store.getSettings()
    if (s.gender === gender) return
    s.gender = gender
    store.saveSettings(s)
    this.refresh()
  },

  onSaveAge() {
    const s = store.getSettings()
    const raw = String(this.data.ageInput || '').trim()

    if (!raw) {
      s.age = null
      store.saveSettings(s)
      this.refresh()
      wx.showToast({ title: '已清除年龄', icon: 'none' })
      return
    }
    if (!/^\d{1,3}$/.test(raw)) {
      wx.showToast({ title: '年龄请填 1–120 的整数', icon: 'none' })
      return
    }
    const age = Number(raw)
    if (age < 1 || age > 120) {
      wx.showToast({ title: '年龄需在 1–120 岁之间', icon: 'none' })
      return
    }

    s.age = age
    store.saveSettings(s)
    this.refresh()
    wx.showToast({ title: '年龄已保存', icon: 'success' })
  },

  onToggleBasis() {
    this.setData({ basisOpen: !this.data.basisOpen })
  },

  onExportJson() {
    this.doExport('json')
  },

  onExportCsv() {
    this.doExport('csv')
  },

  doExport(kind) {
    const that = this
    wx.showLoading({ title: '正在生成文件', mask: true })

    backup.exportData(kind).then(function (res) {
      wx.hideLoading()
      backup.shareFile(res.filePath, res.fileName).then(function (r) {
        that.refresh()
        wx.showToast({ title: r.mode === 'share' ? '已发送到聊天' : '已保存到电脑', icon: 'success' })
      }).catch(function (err) {
        that.refresh()
        wx.showModal({
          title: '文件已生成，但没能自动导出',
          content: '文件位置：' + err.filePath + '\n\n电脑上请用「保存到电脑」重试；手机上可以把文件先发给「文件传输助手」，再从聊天里转发或保存。',
          showCancel: false
        })
      })
    }).catch(function () {
      wx.hideLoading()
      wx.showModal({
        title: '导出失败',
        content: '写入文件失败，可能是手机存储空间不足。清理一些空间后再试。',
        showCancel: false
      })
    })
  },

  onImport() {
    const that = this

    if (!wx.chooseMessageFile) {
      wx.showModal({
        title: '当前环境不支持选文件',
        content: '从聊天选择文件只在手机微信里可用，请用真机预览后操作。',
        showCancel: false
      })
      return
    }

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success(res) {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file) return

        wx.showLoading({ title: '正在读取', mask: true })
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success(r) {
            wx.hideLoading()
            let raw = null
            try {
              raw = JSON.parse(r.data)
            } catch (e) {
              raw = null
            }
            if (!raw) {
              wx.showModal({
                title: '文件读不懂',
                content: '这个文件不是有效的 JSON。请选择本小程序导出的「体重备份-xxx.json」。',
                showCancel: false
              })
              return
            }

            const parsed = backup.parseBackup(raw)
            if (!parsed.ok) {
              wx.showModal({ title: '不能导入', content: parsed.message, showCancel: false })
              return
            }

            that.pendingImport = parsed
            that.openImportDialog(parsed)
          },
          fail() {
            wx.hideLoading()
            wx.showModal({
              title: '读取失败',
              content: '读不到这个文件。可以在聊天里重新发一次文件，再点「用其他应用打开」重试。',
              showCancel: false
            })
          }
        })
      },
      fail(err) {
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('cancel') !== -1) return
        wx.showModal({
          title: '没法选择文件',
          content: '开发者工具可能不支持从聊天选文件，请用手机真机预览后再试。',
          showCancel: false
        })
      }
    })
  },

  // 导入前先自动备份当前数据，再弹窗让用户三选一
  openImportDialog(parsed) {
    const localIds = {}
    store.getRecords().forEach(function (r) {
      localIds[r.id] = true
    })
    let dupCount = 0
    parsed.records.forEach(function (r) {
      if (localIds[r.id]) dupCount++
    })

    const bk = backup.autoBackup()

    this.setData({
      dialog: {
        visible: true,
        fileCount: parsed.records.length,
        dupCount: dupCount,
        badCount: parsed.badCount || 0,
        backupName: bk.fileName,
        backupOk: bk.ok
      }
    })
  },

  onDialogSkip() {
    const parsed = this.pendingImport
    if (!parsed) {
      this.closeDialog()
      return
    }

    const local = store.getRecords()
    const ids = {}
    local.forEach(function (r) {
      ids[r.id] = true
    })
    const added = parsed.records.filter(function (r) {
      return !ids[r.id]
    })

    store.saveRecords(local.concat(added))
    this.closeDialog()
    this.refresh()
    wx.showToast({ title: '新增 ' + added.length + ' 条，跳过 ' + (parsed.records.length - added.length) + ' 条', icon: 'none' })
  },

  onDialogOverwrite() {
    const parsed = this.pendingImport
    if (!parsed) {
      this.closeDialog()
      return
    }

    store.saveRecords(parsed.records)
    const merged = Object.assign({}, store.getSettings(), parsed.settings)
    store.saveSettings(merged)

    this.closeDialog()
    this.refresh()
    wx.showToast({ title: '已用文件数据覆盖（' + parsed.records.length + ' 条）', icon: 'none' })
  },

  onDialogCancel() {
    this.closeDialog()
  },

  closeDialog() {
    this.pendingImport = null
    this.setData({
      dialog: {
        visible: false,
        fileCount: 0,
        dupCount: 0,
        badCount: 0,
        backupName: '',
        backupOk: true
      }
    })
  },

  onClearAll() {
    const that = this
    wx.showModal({
      title: '清空所有数据？',
      content: '会删除全部体重记录，并把单位、目标恢复为默认。此操作无法撤销，建议先导出 JSON 备份。',
      confirmText: '清空',
      confirmColor: '#c0392b',
      success(res) {
        if (!res.confirm) return
        wx.showModal({
          title: '再确认一次',
          content: '真的要清空吗？清空后只能靠之前导出的备份文件恢复。',
          confirmText: '确认清空',
          confirmColor: '#c0392b',
          success(r2) {
            if (!r2.confirm) return
            store.saveRecords([])
            store.saveSettings(Object.assign({}, store.DEFAULT_SETTINGS))
            that.refresh()
            wx.showToast({ title: '已清空', icon: 'success' })
          }
        })
      }
    })
  }
})
