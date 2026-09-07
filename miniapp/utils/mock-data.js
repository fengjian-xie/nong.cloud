const plots = [
  { id: 'PL001', name: '北山村·水稻田1号', area: '3.2亩', crop: '水稻（福两优1002）', town: '溪柄镇北山村', altitude: '46米', collectionMethod: '手机定位', status: '已通过', tone: 'success' },
  { id: 'PL002', name: '溪柄镇·甘蔗地2号', area: '5.6亩', crop: '甘蔗（桂糖42号）', town: '溪柄镇', altitude: '39米', collectionMethod: '地图选点', status: '审核中', tone: 'pending' },
  { id: 'PL003', name: '赛岐镇·蔬菜地3号', area: '1.8亩', crop: '番茄', town: '赛岐镇', altitude: '28米', collectionMethod: '拍照识别', status: '待完善', tone: 'neutral' },
  { id: 'PL004', name: '坂中乡·茶园4号', area: '2.5亩', crop: '茶树（福鼎大白）', town: '坂中乡', altitude: '286米', collectionMethod: '子女远程代录', status: '未通过', tone: 'danger', reason: '地块边界不清晰' }
]

const orders = [
  { id: 'WO20260829001', title: '水稻植保服务', plot: '北山村·水稻田1号', crop: '水稻', status: '服务中', provider: '禾盛农服', schedule: '08-29 08:00 - 12:00', action: 'checkin' },
  { id: 'WO20260828007', title: '机械耕整服务', plot: '溪柄镇·甘蔗地2号', crop: '甘蔗', status: '市场接单中', provider: '待服务商接单', schedule: '08-31 上午', action: 'none' },
  { id: 'WO20260827012', title: '施肥管理服务', plot: '赛岐镇·蔬菜地3号', crop: '番茄', status: '待验收', provider: '绿田农服', schedule: '已履约', action: 'accept' }
]

const records = [
  { id: 'FA001', title: '水稻病虫害巡查', plot: '北山村·水稻田1号', date: '今天 09:40', source: '女儿林小雨远程代录', sync: '已同步' },
  { id: 'FA002', title: '番茄追肥', plot: '赛岐镇·蔬菜地3号', date: '昨天 16:20', source: '离线草稿', sync: '待同步', clientSeq: 'local-002' }
]

const messages = [
  { id: 'MSG01', title: '地块审核通过', content: '北山村·水稻田1号已通过县域运营核验。', time: '今天 10:12', read: false },
  { id: 'MSG02', title: '服务已接单', content: '禾盛农服已接单，请关注现场签到。', time: '今天 08:45', read: false },
  { id: 'MSG03', title: '离线记录同步成功', content: '1条农事记录已完成同步。', time: '昨天 18:03', read: true }
]

module.exports = { plots, orders, records, messages }

