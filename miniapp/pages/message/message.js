const api = require('../../utils/api')
Page({ data: { messages: [] }, onShow() { this.load() }, async load() { this.setData({ messages: (await api.getMessages()).data }) }, async read(e) { await api.readMessage(e.currentTarget.dataset.id); await this.load() } })
