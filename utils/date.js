function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatDate(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function formatTime(ts) {
  const d = new Date(ts)
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function formatDateTime(ts) {
  return formatDate(ts) + ' ' + formatTime(ts)
}

function formatMonthDay(ts) {
  const d = new Date(ts)
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function formatMonthDayCN(ts) {
  const d = new Date(ts)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

// 今天 / 昨天 / 11月3日
function dayLabel(ts) {
  const today = startOfDay(Date.now())
  const day = startOfDay(ts)
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return formatMonthDayCN(ts)
}

function formatRecent(ts) {
  const today = startOfDay(Date.now())
  const day = startOfDay(ts)
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return '今天 ' + formatTime(ts)
  if (diff === 1) return '昨天 ' + formatTime(ts)
  return formatMonthDay(ts) + ' ' + formatTime(ts)
}

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dayKey(ts) {
  return formatDate(ts)
}

function parseDayKey(key) {
  const parts = key.split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0).getTime()
}

function parseDateTime(dateStr, timeStr) {
  const dp = dateStr.split('-')
  const tp = timeStr.split(':')
  return new Date(Number(dp[0]), Number(dp[1]) - 1, Number(dp[2]), Number(tp[0]) || 0, Number(tp[1]) || 0, 0, 0).getTime()
}

function stamp(ts) {
  const d = new Date(ts)
  return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes())
}

module.exports = {
  pad,
  formatDate,
  formatTime,
  formatDateTime,
  formatMonthDay,
  formatMonthDayCN,
  dayLabel,
  formatRecent,
  startOfDay,
  dayKey,
  parseDayKey,
  parseDateTime,
  stamp
}
