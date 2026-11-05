// BMI 只做记录参考，不做任何医疗判断
// 分类依据：《成人体重判定》WS/T 428—2013（国家卫生健康委员会）
//   BMI < 18.5 过轻；18.5 ≤ BMI < 24.0 正常；24.0 ≤ BMI < 28.0 超重；BMI ≥ 28.0 肥胖
// 65 岁及以上参考区间 20.0–26.9：中国疾控中心科普（2025）
// 说明：男女 BMI 分界值相同，不做性别差异；18 岁以下不适用成人标准

const ADULT_MIN = 18.5
const ADULT_MAX = 23.9
const SENIOR_MIN = 20.0
const SENIOR_MAX = 26.9

function calc(weightKg, heightCm) {
  const kg = Number(weightKg)
  const h = Number(heightCm)
  if (!isFinite(kg) || kg <= 0 || !isFinite(h) || h <= 0) return null
  const m = h / 100
  return kg / (m * m)
}

function round1(v) {
  return Math.round(v * 10) / 10
}

// 用保留 1 位小数后的 BMI 做分类，保证屏幕上的数字和分类一致
function classify(bmi) {
  if (bmi < 18.5) return '过轻'
  if (bmi < 24.0) return '正常'
  if (bmi < 28.0) return '超重'
  return '肥胖'
}

function bestRange(age) {
  const n = Number(age)
  if (!isFinite(n) || n <= 0) return null
  if (n < 18) return { applicable: false, min: null, max: null }
  if (n >= 65) return { applicable: true, min: SENIOR_MIN, max: SENIOR_MAX }
  return { applicable: true, min: ADULT_MIN, max: ADULT_MAX }
}

function rangeLabel(range) {
  if (!range) return ''
  if (!range.applicable) return '成人标准不适用，仅供参考'
  return range.min.toFixed(1) + '–' + range.max.toFixed(1)
}

// 距离参考区间：高于上限 / 低于下限 / 区间内
function distanceText(bmi, range) {
  if (!range || !range.applicable) return ''
  if (bmi > range.max) return '距最佳区间上限还差 ' + (bmi - range.max).toFixed(1)
  if (bmi < range.min) return '低于最佳区间下限 ' + (range.min - bmi).toFixed(1)
  return '在最佳区间内'
}

module.exports = {
  calc,
  round1,
  classify,
  bestRange,
  rangeLabel,
  distanceText
}
