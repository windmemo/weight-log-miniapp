const store = require('../../utils/store')
const unitUtil = require('../../utils/unit')
const dateUtil = require('../../utils/date')
const stats = require('../../utils/stats')

Page({
  data: {
    range: '7',
    hasData: false,
    unit: 'jin',
    unitLabel: '斤',
    summaryText: '',
    rangeCaption: '',
    emptyText: '',
    customOpen: false,
    customStart: '',
    customEnd: '',
    todayStr: '',
    list: []
  },

  onLoad() {
    const today = dateUtil.startOfDay(Date.now())
    this.setData({
      todayStr: dateUtil.formatDate(today),
      customStart: dateUtil.formatDate(today - 29 * 86400000),
      customEnd: dateUtil.formatDate(today)
    })
  },

  onShow() {
    this.refresh()
  },

  onRange(e) {
    const range = e.currentTarget.dataset.range
    if (range === 'custom') {
      this.setData({ range: 'custom', customOpen: true }, function () {
        this.refresh()
      }.bind(this))
      return
    }
    if (range === this.data.range) return
    this.setData({ range: range, customOpen: false }, function () {
      this.refresh()
    }.bind(this))
  },

  onStartChange(e) {
    this.setData({ customStart: e.detail.value })
  },

  onEndChange(e) {
    this.setData({ customEnd: e.detail.value })
  },

  onApplyCustom() {
    const start = this.data.customStart
    const end = this.data.customEnd
    if (!start || !end) {
      wx.showToast({ title: '请选择开始和结束日期', icon: 'none' })
      return
    }
    if (dateUtil.parseDayKey(end) < dateUtil.parseDayKey(start)) {
      wx.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
      return
    }

    const days = Math.round((dateUtil.parseDayKey(end) - dateUtil.parseDayKey(start)) / 86400000) + 1
    if (days > 366) {
      const that = this
      wx.showModal({
        title: '时间跨度较长',
        content: '已选 ' + days + ' 天，超过 366 天，折线上的点会比较密，仍然可以查看。',
        confirmText: '继续查看',
        cancelText: '改一下',
        success(res) {
          if (res.confirm) that.applyCustom()
        }
      })
      return
    }
    this.applyCustom()
  },

  applyCustom() {
    this.setData({ range: 'custom', customOpen: true }, function () {
      this.refresh()
    }.bind(this))
  },

  refresh() {
    const settings = store.getSettings()
    const unit = settings.unit
    const records = store.getRecords()
    const custom = { start: this.data.customStart, end: this.data.customEnd }
    const range = this.data.range
    const bounds = stats.rangeBounds(range, custom)

    // 每天一个点，取当天平均值
    const points = stats.buildPoints(records, range, custom)
    const inRange = stats.filterRecords(records, range, custom).slice().sort(function (a, b) {
      return b.ts - a.ts
    })

    const list = inRange.map(function (r) {
      return {
        id: r.id,
        dateText: dateUtil.formatDateTime(r.ts),
        weightText: unitUtil.displayText(r.weightKg, unit),
        note: r.note || ''
      }
    })

    let summaryText = ''
    const unitText = unitUtil.unitLabel(unit)
    if (points.length === 1) {
      summaryText = '共 1 天记录 · 平均 ' + unitUtil.displayText(points[0].avgKg, unit) + ' ' + unitText
    } else if (points.length > 1) {
      const diff = points[points.length - 1].avgKg - points[0].avgKg
      let diffText = '持平'
      if (diff > 0) diffText = '+' + unitUtil.displayText(diff, unit) + ' ' + unitText
      if (diff < 0) diffText = '-' + unitUtil.displayText(Math.abs(diff), unit) + ' ' + unitText
      summaryText = '共 ' + points.length + ' 天 · 较首日 ' + diffText + ' · 每天取平均值'
    }

    // 当前选中区间的说明，显示在图表上方
    let rangeCaption = ''
    if (range === 'all') {
      rangeCaption = points.length
        ? '全部 · ' + dateUtil.formatDate(points[0].ts) + ' ~ ' + dateUtil.formatDate(points[points.length - 1].ts)
        : '全部记录'
    } else {
      const endTs = bounds.to === Infinity ? dateUtil.startOfDay(Date.now()) : bounds.to - 86400000
      rangeCaption = dateUtil.formatDate(bounds.from) + ' ~ ' + dateUtil.formatDate(endTs) + ' · ' + bounds.days + ' 天'
    }

    const emptyText = range === 'custom'
      ? '这个区间内还没有记录。换一段日期，或回到「今天」点「记一笔」。'
      : '这段时间还没有记录。回到「今天」点「记一笔」，第一天就有了。'

    this.chartPoints = points
    this.chartSettings = settings

    this.setData({
      unit: unit,
      unitLabel: unitText,
      hasData: points.length > 0,
      summaryText: summaryText,
      rangeCaption: rangeCaption,
      emptyText: emptyText,
      list: list
    }, function () {
      if (points.length > 0) this.drawChart(0)
    }.bind(this))
  },

  // canvas 2d 手绘折线：网格 + 目标水平虚线 + 折线 + 数据点
  drawChart(attempt) {
    const points = this.chartPoints || []
    const settings = this.chartSettings || {}
    if (!points.length) return

    wx.createSelectorQuery().in(this).select('#trendCanvas').fields({ node: true, size: true }).exec(function (res) {
      const item = res && res[0]
      if (!item || !item.node || !item.width || !item.height) {
        if (attempt < 3) {
          setTimeout(function () {
            this.drawChart(attempt + 1)
          }.bind(this), 80)
        }
        return
      }

      const canvas = item.node
      const ctx = canvas.getContext('2d')
      let dpr = 2
      if (wx.getWindowInfo) dpr = wx.getWindowInfo().pixelRatio || 2
      else dpr = wx.getSystemInfoSync().pixelRatio || 2

      const W = item.width
      const H = item.height
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, W, H)

      const padL = 42
      const padR = 16
      const padT = 18
      const padB = 26
      const plotW = W - padL - padR
      const plotH = H - padT - padB

      const unit = settings.unit
      const places = unitUtil.decimals(unit)
      const values = points.map(function (p) {
        return unitUtil.toDisplay(p.avgKg, unit)
      })

      let min = Math.min.apply(null, values)
      let max = Math.max.apply(null, values)
      let targetVal = null
      if (settings.targetWeightKg) {
        targetVal = unitUtil.toDisplay(settings.targetWeightKg, unit)
        min = Math.min(min, targetVal)
        max = Math.max(max, targetVal)
      }

      if (max - min < 1) {
        const mid = (max + min) / 2
        min = mid - 0.6
        max = mid + 0.6
      } else {
        const padV = (max - min) * 0.12
        min -= padV
        max += padV
      }

      function xOf(i) {
        if (points.length === 1) return padL + plotW / 2
        return padL + (plotW * i) / (points.length - 1)
      }

      function yOf(v) {
        return padT + plotH - ((v - min) / (max - min)) * plotH
      }

      // 横向网格 + 纵轴刻度
      ctx.strokeStyle = '#e6e9e4'
      ctx.lineWidth = 1
      ctx.fillStyle = '#9aa39b'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      for (let g = 0; g <= 2; g++) {
        const v = min + ((max - min) * g) / 2
        const y = yOf(v)
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
        ctx.stroke()
        ctx.fillText(v.toFixed(places), 2, y)
      }

      // 目标水平虚线
      if (targetVal !== null) {
        const ty = yOf(targetVal)
        ctx.save()
        ctx.strokeStyle = '#c9a227'
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.moveTo(padL, ty)
        ctx.lineTo(padL + plotW, ty)
        ctx.stroke()
        ctx.restore()

        ctx.fillStyle = '#b58d12'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText('目标 ' + targetVal.toFixed(places), padL + plotW, ty - 8)
      }

      // 折线
      if (points.length > 1) {
        ctx.strokeStyle = '#2f6b4f'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.beginPath()
        points.forEach(function (p, i) {
          const x = xOf(i)
          const y = yOf(values[i])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      }

      // 数据点
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#2f6b4f'
      ctx.lineWidth = 2
      points.forEach(function (p, i) {
        const x = xOf(i)
        const y = yOf(values[i])
        ctx.beginPath()
        ctx.arc(x, y, 3.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      })

      // 横轴日期
      ctx.fillStyle = '#9aa39b'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      let idxs = [0, points.length - 1]
      if (points.length <= 4) {
        idxs = points.map(function (p, i) {
          return i
        })
      } else if (points.length > 2) {
        idxs = [0, Math.floor((points.length - 1) / 2), points.length - 1]
      }
      idxs.forEach(function (i) {
        ctx.fillText(dateUtil.formatMonthDay(points[i].ts), xOf(i), H - 8)
      })
    }.bind(this))
  },

  onLongPress(e) {
    const id = e.currentTarget.dataset.id
    const that = this
    wx.showActionSheet({
      itemList: ['编辑这条记录', '删除这条记录'],
      success(res) {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/record/record?id=' + id })
        } else if (res.tapIndex === 1) {
          that.confirmDelete(id)
        }
      }
    })
  },

  confirmDelete(id) {
    const that = this
    const records = store.getRecords()
    const target = records.filter(function (r) {
      return r.id === id
    })[0]

    let content = '删除后无法恢复。'
    if (target) {
      content = dateUtil.formatDateTime(target.ts) + ' · ' + unitUtil.displayText(target.weightKg, this.data.unit) + ' ' + this.data.unitLabel + '，删除后无法恢复。'
    }

    wx.showModal({
      title: '删除这条记录？',
      content: content,
      confirmText: '删除',
      confirmColor: '#c0392b',
      success(res) {
        if (!res.confirm) return
        const left = store.getRecords().filter(function (r) {
          return r.id !== id
        })
        store.saveRecords(left)
        wx.showToast({ title: '已删除', icon: 'success' })
        that.refresh()
      }
    })
  }
})
