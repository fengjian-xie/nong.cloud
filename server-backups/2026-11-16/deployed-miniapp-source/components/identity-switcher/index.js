const session = require('../../utils/session')
Component({ options: { styleIsolation: 'shared' }, properties: { context: { type: Object, value: null } }, data: { open: false }, methods: {
 show() { this.setData({ open: true }) }, close() { this.setData({ open: false }) }, noop() {},
 async choose(e) { try { const context = await session.switchIdentity(e.currentTarget.dataset.id); this.setData({ open: false }); this.triggerEvent('change', { context }) } catch (error) { wx.showToast({ title: error.message, icon: 'none' }) } }
} })
