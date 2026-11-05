const store = require('../../utils/store')
const unitUtil = require('../../utils/unit')
const dateUtil = require('../../utils/date')

Page({
  data: {
    isEdit: false,
    unit: 'jin',
    unitLabel: '斤',
    rangeText: '',
    weight: '',
    note: '',
    dateValue: '',
    timeValue: '',
    todayStr: ''
  },

  onLoad(options) {
    const settings = store.getSettings()
    const unit = settings.unit
    const now = Date.now()
    let ts = now
    let weight = ''
    let note = ''
    let isEdit = false

    if (options && options.id) {
      const list = store.getRecords()
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === options.id) {
          isEdit = true
          ts = list[i].ts
          weight = unitUtil.displayText(list[i].weightKg, unit)
          note = list[i].note || ''
          this.recordId = list[i].id
          break
        }
      }
    }

    // 从首页「未记录」的日期点进来时，把日期预填成那一天（时间取当前时刻）
    if (!isEdit && options && typeof options.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      const parsed = dateUtil.parseDateTime(options.date, dateUtil.formatTime(now))
      if (isFinite(parsed) && parsed <= now) ts = parsed
    }

    if (isEdit) {
      wx.setNavigationBarTitle({ title: '编辑记录' })
    } else {
      wx.setNavigationBarTitle({ title: '记一笔' })
    }

    this.setData({
      isEdit: isEdit,
      unit: unit,
      unitLabel: unitUtil.unitLabel(unit),
      rangeText: unitUtil.rangeText(unit),
      weight: weight,
      note: note,
      dateValue: dateUtil.formatDate(ts),
      timeValue: dateUtil.formatTime(ts),
      todayStr: dateUtil.formatDate(now)
    })
  },

  onWeightInput(e) {
    this.setData({ weight: e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  onDateChange(e) {
    this.setData({ dateValue: e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ timeValue: e.detail.value })
  },

  onSave() {
    const settings = store.getSettings()
    const unit = settings.unit
    const raw = String(this.data.weight || '').trim()

    if (!raw) {
      wx.showToast({ title: '请先输入体重', icon: 'none' })
      return
    }
    if (!/^\d{1,3}(\.\d)?$/.test(raw)) {
      wx.showToast({ title: '请输入数字，最多 1 位小数', icon: 'none' })
      return
    }

    const displayNum = Number(raw)
    const kg = unitUtil.fromDisplay(displayNum, unit)
    if (!unitUtil.isValidKg(kg)) {
      wx.showToast({ title: '体重需在 ' + unitUtil.rangeText(unit) + ' 之间', icon: 'none' })
      return
    }

    const ts = dateUtil.parseDateTime(this.data.dateValue, this.data.timeValue)
    if (ts > Date.now() + 60000) {
      wx.showToast({ title: '不能记录未来的时间', icon: 'none' })
      return
    }

    const records = store.getRecords()
    const now = Date.now()
    const note = String(this.data.note || '').trim().slice(0, 40)

    if (this.data.isEdit) {
      let found = false
      for (let i = 0; i < records.length; i++) {
        if (records[i].id === this.recordId) {
          records[i].ts = ts
          records[i].weightKg = kg
          records[i].note = note
          records[i].updatedAt = now
          found = true
          break
        }
      }
      if (!found) {
        wx.showToast({ title: '这条记录已不存在', icon: 'none' })
        return
      }
    } else {
      records.push({
        id: 'r_' + ts + '_' + Math.random().toString(36).slice(2, 8),
        ts: ts,
        weightKg: kg,
        note: note,
        createdAt: now,
        updatedAt: now
      })
    }

    store.saveRecords(records)
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(function () {
      wx.navigateBack()
    }, 600)
  },

  onDelete() {
    const that = this
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后无法恢复，同一天的其他记录不受影响。',
      confirmText: '删除',
      confirmColor: '#c0392b',
      success(res) {
        if (!res.confirm) return
        const records = store.getRecords()
        const left = records.filter(function (r) {
          return r.id !== that.recordId
        })
        store.saveRecords(left)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(function () {
          wx.navigateBack()
        }, 600)
      }
    })
  }
})
