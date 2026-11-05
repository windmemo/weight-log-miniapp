const store = require('./store')
const dateUtil = require('./date')
const unitUtil = require('./unit')

const fs = wx.getFileSystemManager()

function buildBackup(settings, records, now) {
  return {
    app: 'weight-log-miniapp',
    appVersion: store.APP_VERSION,
    schemaVersion: store.SCHEMA_VERSION,
    exportedAt: now,
    exportedAtText: dateUtil.formatDateTime(now),
    settings: settings,
    records: records
  }
}

function csvCell(v) {
  const s = String(v == null ? '' : v)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

// CSV 给 Excel 直接看：表头用当前显示单位，同时附上另一种单位；带 BOM 防止中文乱码
function buildCsv(settings, records) {
  const unit = settings.unit
  const mainLabel = unitUtil.unitLabel(unit)
  const otherLabel = unit === 'kg' ? '斤' : 'kg'
  const head = ['日期', '时间', '体重(' + mainLabel + ')', '体重(' + otherLabel + ')', '备注'].join(',')
  const rows = records.slice().sort(function (a, b) {
    return a.ts - b.ts
  }).map(function (r) {
    return [
      dateUtil.formatDate(r.ts),
      dateUtil.formatTime(r.ts),
      unitUtil.displayText(r.weightKg, unit),
      unitUtil.displayText(r.weightKg, unit === 'kg' ? 'jin' : 'kg'),
      csvCell(r.note || '')
    ].join(',')
  })
  return '\ufeff' + [head].concat(rows).join('\r\n')
}

function writeFile(fileName, content) {
  return new Promise(function (resolve, reject) {
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName
    fs.writeFile({
      filePath: filePath,
      data: content,
      encoding: 'utf8',
      success: function () {
        resolve(filePath)
      },
      fail: function (err) {
        reject(err)
      }
    })
  })
}

function saveExportTime(now) {
  const s = store.getSettings()
  s.lastExportAt = now
  store.saveSettings(s)
}

function exportData(kind) {
  const settings = store.getSettings()
  const records = store.getRecords()
  const now = Date.now()

  if (kind === 'csv') {
    const csvName = '体重记录-' + dateUtil.stamp(now) + '.csv'
    return writeFile(csvName, buildCsv(settings, records)).then(function (filePath) {
      saveExportTime(now)
      return { filePath: filePath, fileName: csvName }
    })
  }

  const jsonName = '体重备份-' + dateUtil.stamp(now) + '.json'
  return writeFile(jsonName, JSON.stringify(buildBackup(settings, records, now), null, 2)).then(function (filePath) {
    saveExportTime(now)
    return { filePath: filePath, fileName: jsonName }
  })
}

// 导入前自动备份当前数据（同步写，保证弹窗出现前文件已经落盘）
function autoBackup() {
  const now = Date.now()
  const fileName = '自动备份-' + dateUtil.stamp(now) + '.json'
  const filePath = wx.env.USER_DATA_PATH + '/' + fileName
  try {
    fs.writeFileSync(filePath, JSON.stringify(buildBackup(store.getSettings(), store.getRecords(), now), null, 2), 'utf8')
    return { ok: true, fileName: fileName, filePath: filePath }
  } catch (e) {
    return { ok: false, fileName: '', filePath: '', error: e }
  }
}

// 1.1.0 首次启动时的「升级前备份」：复用完整备份结构，同步落盘，保证升级前数据先有副本
function upgradeBackup() {
  const now = Date.now()
  const records = store.getRecords()
  if (!records.length) {
    return { ok: true, skipped: true, at: now, fileName: '', filePath: '' }
  }

  const fileName = '升级前备份-' + dateUtil.stamp(now) + '.json'
  const filePath = wx.env.USER_DATA_PATH + '/' + fileName
  try {
    fs.writeFileSync(filePath, JSON.stringify(buildBackup(store.getSettings(), records, now), null, 2), 'utf8')
    return { ok: true, skipped: false, at: now, fileName: fileName, filePath: filePath }
  } catch (e) {
    return { ok: false, skipped: false, at: now, fileName: '', filePath: '', error: e }
  }
}

// 手机走「发送文件」，电脑/开发者工具走「保存到电脑」，互相回退
function shareFile(filePath, fileName) {
  return new Promise(function (resolve, reject) {
    function tryDisk(reason) {
      if (wx.saveFileToDisk) {
        wx.saveFileToDisk({
          filePath: filePath,
          success: function () {
            resolve({ mode: 'disk' })
          },
          fail: function (err) {
            reject({ filePath: filePath, reason: reason, err: err })
          }
        })
      } else {
        reject({ filePath: filePath, reason: reason })
      }
    }

    if (wx.shareFileMessage) {
      wx.shareFileMessage({
        filePath: filePath,
        fileName: fileName,
        success: function () {
          resolve({ mode: 'share' })
        },
        fail: function (err) {
          tryDisk(err && err.errMsg ? err.errMsg : 'share-failed')
        }
      })
    } else {
      tryDisk('no-share-api')
    }
  })
}

function sanitizeSettings(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out

  if (raw.unit === 'kg' || raw.unit === 'jin') out.unit = raw.unit

  const t = Number(raw.targetWeightKg)
  if (isFinite(t) && t >= unitUtil.MIN_KG && t <= unitUtil.MAX_KG) {
    out.targetWeightKg = Math.round(t * 100) / 100
  }

  const h = Number(raw.heightCm)
  if (isFinite(h) && h >= 100 && h <= 250) out.heightCm = Math.round(h)

  // 1.1.0 新增的身体信息；旧备份里没有这两个键时保持本机原值
  if (raw.gender === 'male' || raw.gender === 'female') out.gender = raw.gender
  const age = Number(raw.age)
  if (isFinite(age) && age >= 1 && age <= 120) out.age = Math.round(age)

  const la = Number(raw.lastExportAt)
  if (isFinite(la) && la > 0) out.lastExportAt = la

  return out
}

function parseBackup(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: '这个文件不是小程序的备份数据。' }
  }
  if (!Array.isArray(raw.records)) {
    return { ok: false, message: '文件里找不到记录列表（records）。' }
  }

  const records = []
  const ids = {}
  let badCount = 0
  raw.records.forEach(function (item) {
    const rec = store.normalizeRecord(item)
    if (!rec) {
      badCount++
      return
    }
    if (!unitUtil.isValidKg(rec.weightKg)) {
      badCount++
      return
    }
    if (ids[rec.id]) {
      badCount++
      return
    }
    ids[rec.id] = true
    records.push(rec)
  })

  if (!records.length) {
    return { ok: false, message: '文件里没有可用的体重记录。' }
  }

  return {
    ok: true,
    records: records,
    settings: sanitizeSettings(raw.settings),
    badCount: badCount
  }
}

module.exports = {
  buildBackup,
  buildCsv,
  exportData,
  autoBackup,
  upgradeBackup,
  shareFile,
  parseBackup,
  sanitizeSettings
}
