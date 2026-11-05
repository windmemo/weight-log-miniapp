const dateUtil = require('./date')

function averageKg(list) {
  if (!list || !list.length) return null
  let sum = 0
  list.forEach(function (r) {
    sum += Number(r.weightKg) || 0
  })
  return sum / list.length
}

// 每天只留一个点：当天所有记录的平均值
function groupByDay(records) {
  const map = {}
  records.forEach(function (r) {
    const key = dateUtil.dayKey(r.ts)
    if (!map[key]) map[key] = []
    map[key].push(r)
  })
  return Object.keys(map).sort().map(function (key) {
    const list = map[key]
    return {
      key: key,
      ts: dateUtil.parseDayKey(key),
      avgKg: averageKg(list),
      count: list.length
    }
  })
}

function cutoffTs(range) {
  if (range === 'all') return -Infinity
  const n = Number(range)
  const days = isFinite(n) && n > 0 ? n : 7
  return dateUtil.startOfDay(Date.now()) - (days - 1) * 86400000
}

// 区间边界：自定义区间带起止日期，快捷档从「今天往前 N 天」到不限
function rangeBounds(range, custom) {
  if (range === 'custom' && custom && custom.start && custom.end) {
    const from = dateUtil.parseDayKey(custom.start)
    const to = dateUtil.parseDayKey(custom.end) + 86400000
    return { from: from, to: to, days: Math.max(1, Math.round((to - from) / 86400000)) }
  }
  if (range === 'all') return { from: -Infinity, to: Infinity, days: 0 }
  const n = Number(range)
  const days = isFinite(n) && n > 0 ? n : 7
  return { from: cutoffTs(days), to: Infinity, days: days }
}

function inBounds(r, b) {
  return r.ts >= b.from && r.ts < b.to
}

function buildPoints(records, range, custom) {
  const b = rangeBounds(range, custom)
  return groupByDay(records.filter(function (r) {
    return inBounds(r, b)
  }))
}

function filterRecords(records, range, custom) {
  const b = rangeBounds(range, custom)
  return records.filter(function (r) {
    return inBounds(r, b)
  })
}

// 最近一条记录（按记录时间，不是录入时间）
function latestRecord(records) {
  let latest = null
  records.forEach(function (r) {
    if (!latest || r.ts > latest.ts) latest = r
  })
  return latest
}

module.exports = {
  averageKg,
  groupByDay,
  buildPoints,
  filterRecords,
  rangeBounds,
  latestRecord
}
