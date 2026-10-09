const session = require('./utils/session')
App({ globalData: { mode: 'demo', session: null }, onLaunch() { this.globalData.session = session.current() } })
