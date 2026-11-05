const RECORDS_KEY = 'weight_records_v1'
const SETTINGS_KEY = 'weight_settings_v1'
const SCHEMA_VERSION = 1
const APP_VERSION = '1.1.0'

const DEFAULT_SETTINGS = {
  unit: 'jin',
  targetWeightKg: null,
  heightCm: null,
  schemaVersion: SCHEMA_VERSION,
  lastExportAt: null,
  // 1.1.0 新增：身体信息 + 升级前备份记录（旧数据没有这些键时自动补默认值）
  gender: '',
  age: null,
  upgradeBackupAt: null,
  upgradeBackupFileName: ''
}

function getRecords() {
  const v = wx.getStorageSync(RECORDS_KEY)
  if (!Array.isArray(v)) return []
  // 只在内存里补齐 1.1.0 需要的默认字段，不删除、不改写任何已有字段
  return v.map(function (item, index) {
    return fillRecordDefaults(item, index)
  })
}

function saveRecords(list) {
  wx.setStorageSync(RECORDS_KEY, Array.isArray(list) ? list : [])
}

function getSettings() {
  const v = wx.getStorageSync(SETTINGS_KEY)
  const out = Object.assign({}, DEFAULT_SETTINGS)
  if (v && typeof v === 'object') {
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
      if (v[k] !== undefined) out[k] = v[k]
    })
  }
  if (out.unit !== 'kg' && out.unit !== 'jin') out.unit = 'jin'
  out.schemaVersion = SCHEMA_VERSION
  return out
}

function saveSettings(s) {
  if (!s || typeof s !== 'object') return
  wx.setStorageSync(SETTINGS_KEY, Object.assign({}, DEFAULT_SETTINGS, s, { schemaVersion: SCHEMA_VERSION }))
}

function ensureDefaults() {
  if (!Array.isArray(wx.getStorageSync(RECORDS_KEY))) {
    wx.setStorageSync(RECORDS_KEY, [])
  }
  const s = wx.getStorageSync(SETTINGS_KEY)
  if (!s || typeof s !== 'object') {
    wx.setStorageSync(SETTINGS_KEY, Object.assign({}, DEFAULT_SETTINGS))
  }
}

// 读取时补默认值：只新增缺失字段，原有字段（含未来新增字段）全部保留
function fillRecordDefaults(raw, index) {
  if (!raw || typeof raw !== 'object') return raw
  const out = Object.assign({}, raw)

  let ts = Number(out.ts)
  if (!isFinite(ts) || ts <= 0) {
    if (typeof out.time === 'string') {
      const parsed = new Date(out.time.replace(/-/g, '/')).getTime()
      if (isFinite(parsed)) ts = parsed
    }
  }
  if (!isFinite(ts) || ts <= 0) {
    const created = Number(out.createdAt)
    ts = isFinite(created) && created > 0 ? created : 0
  }
  out.ts = ts

  if (typeof out.id !== 'string' || !out.id) {
    // 旧数据缺 id 时用「时间戳 + 数组位置」生成稳定 id，重复读取结果一致
    out.id = 'r_legacy_' + ts + '_' + index
  }
  if (typeof out.note !== 'string') {
    out.note = out.note == null ? '' : String(out.note)
  }

  const createdAt = Number(out.createdAt)
  if (!isFinite(createdAt) || createdAt <= 0) out.createdAt = ts
  const updatedAt = Number(out.updatedAt)
  if (!isFinite(updatedAt) || updatedAt <= 0) out.updatedAt = out.createdAt

  return out
}

// 兼容手工改过或旧版备份：字段缺失时尽量修复，实在修不了就返回 null
function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null

  let ts = Number(raw.ts)
  if (!isFinite(ts) || ts <= 0) {
    if (typeof raw.time === 'string') {
      const parsed = new Date(raw.time.replace(/-/g, '/')).getTime()
      if (isFinite(parsed)) ts = parsed
    }
  }
  if (!isFinite(ts) || ts <= 0) return null

  const weightKg = Number(raw.weightKg)
  if (!isFinite(weightKg) || weightKg <= 0) return null

  const now = Date.now()
  const createdAt = Number(raw.createdAt)
  const updatedAt = Number(raw.updatedAt)

  // 用 Object.assign 保留文件里的额外字段，避免新结构覆盖旧数据时丢字段
  const out = Object.assign({}, raw)
  out.id = typeof raw.id === 'string' && raw.id ? raw.id : 'r_' + ts + '_' + Math.random().toString(36).slice(2, 8)
  out.ts = ts
  out.weightKg = Math.round(weightKg * 100) / 100
  out.note = typeof raw.note === 'string' ? raw.note.slice(0, 40) : ''
  out.createdAt = isFinite(createdAt) && createdAt > 0 ? createdAt : now
  out.updatedAt = isFinite(updatedAt) && updatedAt > 0 ? updatedAt : now
  return out
}

module.exports = {
  RECORDS_KEY,
  SETTINGS_KEY,
  SCHEMA_VERSION,
  APP_VERSION,
  DEFAULT_SETTINGS,
  getRecords,
  saveRecords,
  getSettings,
  saveSettings,
  ensureDefaults,
  normalizeRecord
}
