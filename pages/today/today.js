const store = require('../../utils/store')
const unitUtil = require('../../utils/unit')
const dateUtil = require('../../utils/date')
const stats = require('../../utils/stats')

Page({
  data: {
    unit: 'jin',
    unitLabel: '斤',
    hasToday: false,
    todayText: '--',
    todayCount: 0,
    gapText: '',
    gapReached: false,
    days: [],
    hasAnyRecent: false
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const settings = store.getSettings()
    const unit = settings.unit
    const records = store.getRecords()
    const start = dateUtil.startOfDay(Date.now())
    const todayList = records.filter(function (r) {
      return r.ts >= start && r.ts < start + 86400000
    })

    const hasToday = todayList.length > 0
    const todayAvg = stats.averageKg(todayList)
    const todayText = hasToday ? unitUtil.displayText(todayAvg, unit) : '--'

    // 与目标的差值：优先用今天的平均值，没有今天的记录就用最近一次
    let gapText = ''
    let gapReached = false
    const target = settings.targetWeightKg

    if (!target) {
      gapText = '还没设目标 · 点这里去设置'
    } else {
      let base = null
      let prefix = ''
      if (hasToday) {
        base = todayAvg
      } else {
        const sorted = records.slice().sort(function (a, b) {
          return b.ts - a.ts
        })
        if (sorted.length) {
          base = sorted[0].weightKg
          prefix = '最近一次 '
        }
      }

      if (base === null) {
        gapText = '目标已设好，记第一笔就能看到差距'
      } else {
        const diffKg = base - target
        if (diffKg <= 0) {
          gapText = '已达成目标'
          gapReached = true
        } else {
          gapText = prefix + '距目标还差 ' + unitUtil.displayText(diffKg, unit) + ' ' + unitUtil.unitLabel(unit)
        }
      }
    }

    // 最近 3 个自然日：今天、昨天、前天；没有记录的那天也保留一行占位
    const days = []
    let hasAnyRecent = false
    for (let i = 0; i < 3; i++) {
      const dayStart = start - i * 86400000
      const dayList = records.filter(function (r) {
        return r.ts >= dayStart && r.ts < dayStart + 86400000
      })
      if (dayList.length) hasAnyRecent = true
      const avg = stats.averageKg(dayList)
      days.push({
        key: dateUtil.formatDate(dayStart),
        label: dateUtil.dayLabel(dayStart),
        hasData: dayList.length > 0,
        avgText: dayList.length ? unitUtil.displayText(avg, unit) : '未记录',
        countText: dayList.length ? dayList.length + ' 次' : ''
      })
    }

    this.setData({
      unit: unit,
      unitLabel: unitUtil.unitLabel(unit),
      hasToday: hasToday,
      todayText: todayText,
      todayCount: todayList.length,
      gapText: gapText,
      gapReached: gapReached,
      days: days,
      hasAnyRecent: hasAnyRecent
    })
  },

  onRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  },

  // 点某一天：有 1 条直接编辑；多条弹出当天列表（沿用长按/点击编辑的交互）；没有记录则补记到那天
  onDayTap(e) {
    const key = e.currentTarget.dataset.key
    const dayStart = dateUtil.parseDayKey(key)
    const list = store.getRecords().filter(function (r) {
      return r.ts >= dayStart && r.ts < dayStart + 86400000
    }).sort(function (a, b) {
      return a.ts - b.ts
    })

    if (!list.length) {
      wx.navigateTo({ url: '/pages/record/record?date=' + key })
      return
    }
    if (list.length === 1) {
      wx.navigateTo({ url: '/pages/record/record?id=' + list[0].id })
      return
    }

    const unit = this.data.unit
    const shown = list.slice(0, 6)
    wx.showActionSheet({
      itemList: shown.map(function (r) {
        return dateUtil.formatTime(r.ts) + ' · ' + unitUtil.displayText(r.weightKg, unit) + ' ' + unitUtil.unitLabel(unit)
      }),
      success: function (res) {
        const target = shown[res.tapIndex]
        if (target) wx.navigateTo({ url: '/pages/record/record?id=' + target.id })
      }
    })
  },

  onTrend() {
    wx.switchTab({ url: '/pages/trend/trend' })
  },

  onGap() {
    wx.switchTab({ url: '/pages/profile/profile' })
  }
})
