const MIN_KG = 20
const MAX_KG = 300
const KG_PER_JIN = 0.5

function unitLabel(unit) {
  return unit === 'kg' ? 'kg' : '斤'
}

// 显示精度按单位区分：kg 保留 2 位小数，斤保留 1 位小数
function decimals(unit) {
  return unit === 'kg' ? 2 : 1
}

function toDisplay(kg, unit) {
  const f = Math.pow(10, decimals(unit))
  const v = unit === 'kg' ? kg : kg / KG_PER_JIN
  return Math.round(v * f) / f
}

function displayText(kg, unit) {
  if (typeof kg !== 'number' || !isFinite(kg)) return '--'
  return toDisplay(kg, unit).toFixed(decimals(unit))
}

function fromDisplay(value, unit) {
  const n = Number(value)
  if (!isFinite(n)) return null
  const kg = unit === 'kg' ? n : n * KG_PER_JIN
  return Math.round(kg * 100) / 100
}

function isValidKg(kg) {
  return typeof kg === 'number' && isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG
}

function rangeText(unit) {
  return unit === 'kg' ? '20–300 kg' : '40–600 斤'
}

module.exports = {
  MIN_KG,
  MAX_KG,
  KG_PER_JIN,
  unitLabel,
  decimals,
  toDisplay,
  displayText,
  fromDisplay,
  isValidKg,
  rangeText
}
