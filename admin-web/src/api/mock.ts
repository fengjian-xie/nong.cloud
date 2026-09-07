import type { ApiEnvelope, DashboardData, DashboardRange, MemberPerformance, MemberTaskDetail, OperationRow, PlotMedia, PlotPurchase, Session } from '../types'
import { normalizeMemberProfile, persistMemberProfile, readMemberProfile, type MemberProfile } from './memberProfile'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let trace = 1

function envelope<T>(data: T): ApiEnvelope<T> {
  return {
    code: 0,
    message: 'OK',
    data,
    traceId: `mock-fuan-${String(trace++).padStart(6, '0')}`,
    timestamp: new Date().toISOString(),
  }
}

function failure(message: string, errorCode: string, code: number): never {
  const error = new Error(message) as Error & { code: number; errorCode: string; traceId: string }
  error.code = code
  error.errorCode = errorCode
  error.traceId = `mock-fuan-${String(trace++).padStart(6, '0')}`
  throw error
}

export async function login(phone: string, verificationCode: string): Promise<ApiEnvelope<Session>> {
  await sleep(650)
  if (!/^1\d{10}$/.test(phone)) failure('请输入正确的11位手机号', 'XQ-IA-422-001', 422001)
  if (verificationCode !== '000000') failure('验证码错误，请重新输入', 'XQ-IA-401-002', 401002)
  return envelope({
    token: `mock-token-fuan-${Date.now()}`,
    user: { id: 'admin-fuan-001', name: '陈晓岚', phone: `${phone.slice(0, 3)}****${phone.slice(-4)}`, role: '县域运营管理员' },
  })
}

export async function getMe(token: string): Promise<ApiEnvelope<Session['user']>> {
  await sleep(220)
  if (!token.startsWith('mock-token-fuan-')) failure('登录已失效，请重新登录', 'XQ-CM-401-001', 401001)
  return envelope({ id: 'admin-fuan-001', name: '陈晓岚', phone: '138****6234', role: '县域运营管理员' })
}

export async function getDashboard(options?: { fail?: boolean; range?: DashboardRange; dateFrom?: string; dateTo?: string }): Promise<ApiEnvelope<DashboardData>> {
  await sleep(520)
  if (options?.fail) failure('工作台数据加载失败，请稍后重试', 'XQ-OP-503-001', 503001)
  const range = options?.range || 'today'
  const dateFrom = options?.dateFrom || '2026-08-01'
  const dateTo = options?.dateTo || '2026-08-29'
  const customDays = Math.max(1, Math.round((new Date(`${dateTo}T00:00:00`).getTime() - new Date(`${dateFrom}T00:00:00`).getTime()) / 86400000) + 1)
  const customScale = customDays / 29
  const customValue = (value: number) => Math.max(1, Math.round(value * customScale)).toLocaleString('zh-CN')
  const customTrend = Array.from({ length: 6 }, (_, index) => {
    const point = new Date(`${dateFrom}T00:00:00`)
    point.setDate(point.getDate() + Math.round((customDays - 1) * index / 5))
    const label = `${String(point.getMonth() + 1).padStart(2, '0')}-${String(point.getDate()).padStart(2, '0')}`
    return { date: label, tasks: Math.round(18 + 138 * customScale * (index + 1) / 6), alerts: Math.round(2 + 21 * customScale * (index + 1) / 6), weather: Math.round(1 + 6 * customScale * (index + 1) / 6) }
  })
  const rangeData = {
    today: {
      periodLabel: '今日', comparisonLabel: '较昨日同期', trendTitle: '今日趋势', trendCaption: '按小时观察任务与风险变化',
      values: ['42', '31', '18', '6', '96', '12', '21'], deltas: [8, 6, 12, -2, 15, 3, 5],
      trend: [
        { date: '08时', tasks: 5, alerts: 1, weather: 1 }, { date: '10时', tasks: 12, alerts: 2, weather: 1 }, { date: '12时', tasks: 19, alerts: 3, weather: 2 },
        { date: '14时', tasks: 28, alerts: 4, weather: 2 }, { date: '16时', tasks: 36, alerts: 5, weather: 3 }, { date: '18时', tasks: 42, alerts: 6, weather: 3 },
      ],
    },
    week: {
      periodLabel: '本周', comparisonLabel: '较上周', trendTitle: '本周趋势', trendCaption: '近7日任务与风险变化',
      values: ['286', '174', '93', '18', '486', '68', '112'], deltas: [11, 9, 14, -4, 22, 6, 13],
      trend: [
        { date: '08-23', tasks: 28, alerts: 4, weather: 2 }, { date: '08-24', tasks: 35, alerts: 5, weather: 2 }, { date: '08-25', tasks: 47, alerts: 7, weather: 3 },
        { date: '08-26', tasks: 58, alerts: 8, weather: 3 }, { date: '08-27', tasks: 69, alerts: 10, weather: 4 }, { date: '08-28', tasks: 82, alerts: 13, weather: 5 }, { date: '08-29', tasks: 93, alerts: 18, weather: 6 },
      ],
    },
    custom: {
      periodLabel: `${dateFrom} 至 ${dateTo}`, comparisonLabel: '较上周期', trendTitle: '自定义周期趋势', trendCaption: `所选${customDays}天内任务与风险变化`,
      values: [customValue(3268), customValue(2854), customValue(156), customValue(23), customValue(8420), customValue(342), customValue(189)], deltas: [10, 12, 9, -3, 24, 7, 11],
      trend: customTrend,
    },
  }[range]
  const metricDefs = [
    ['plots', '已核验地块', '块', 'land'], ['growers', '认证种植户', '户', 'sprout'], ['requests', '服务需求', '件', 'clipboard'], ['orders', '执行中工单', '单', 'alert'],
    ['records', '农事记录', '条', 'cloud'], ['providers', '活跃服务主体', '家', 'users'], ['completed', '已履约', '单', 'tractor'],
  ]
  return envelope({
    updatedAt: '2026-08-29 15:40',
    periodLabel: rangeData.periodLabel,
    comparisonLabel: rangeData.comparisonLabel,
    trendTitle: rangeData.trendTitle,
    trendCaption: rangeData.trendCaption,
    metrics: metricDefs.map(([key, label, unit, icon], index) => ({ key, label, unit, icon, value: rangeData.values[index], delta: rangeData.deltas[index] })),
    trend: rangeData.trend,
    tasks: [
      { key: 'members', label: '待审核主体', count: range === 'today' ? 5 : range === 'week' ? 18 : Math.max(1, Math.round(36 * customScale)), urgency: 'high', route: '/members', updatedAt: '15:32' },
      { key: 'plots', label: '待核验地块', count: range === 'today' ? 4 : range === 'week' ? 13 : Math.max(1, Math.round(23 * customScale)), urgency: 'high', route: '/plots', updatedAt: '15:28' },
      { key: 'services', label: '超时服务工单', count: range === 'today' ? 3 : range === 'week' ? 9 : Math.max(1, Math.round(19 * customScale)), urgency: 'medium', route: '/services', updatedAt: '15:20' },
      { key: 'supply', label: '待审供需信息', count: range === 'today' ? 2 : range === 'week' ? 5 : Math.max(1, Math.round(8 * customScale)), urgency: 'medium', route: '/supply', updatedAt: '15:10' },
      { key: 'audit', label: '待审批临时提权', count: range === 'today' ? 1 : range === 'week' ? 3 : Math.max(1, Math.round(4 * customScale)), urgency: 'low', route: '/audit', updatedAt: '14:48' },
    ],
    activities: range === 'today' ? [
      { time: '15:36', title: '地块核验通过', detail: '溪柄镇 · 甘薯地2号' },
      { time: '15:22', title: '服务工单完成', detail: '赛岐镇 · 水稻植保服务' },
      { time: '15:08', title: '身份认证提交', detail: '种植户 · 林春梅' },
      { time: '14:50', title: '参数版本发布', detail: '农事记录模板 v1.4' },
    ] : range === 'week' ? [
      { time: '08-29', title: '本周履约突破100单', detail: '全市累计完成112单' },
      { time: '08-28', title: '服务主体整改复盘', detail: '禾盛农服 · 完成度提升至88%' },
      { time: '08-26', title: '新增认证种植户', detail: '本周新增31户' },
      { time: '08-24', title: '气象提醒批量触达', detail: '覆盖溪柄、赛岐等6个乡镇' },
    ] : [
      { time: dateTo.slice(5), title: '所选周期履约汇总', detail: `${dateFrom} 至 ${dateTo}` },
      { time: dateTo.slice(5), title: '主体评级更新', detail: `${customValue(342)}家活跃服务主体` },
      { time: dateFrom.slice(5), title: '自定义统计开始', detail: `统计跨度${customDays}天` },
    ],
  })
}

const moduleRows: Record<string, OperationRow[]> = {
  members: [
    { id: 'MB20260829001', name: '林春梅', identities: '种植户、采购商', type: '个人会员', town: '溪柄镇', virtualPhone: '170****8001（虚拟号）', assignedTasks: 25, completedTasks: 23, overdueTasks: 1, canceledTasks: 1, taskCompletion: '92%', systemRating: '4.7', customerRating: '4.8', expenseAmount: 12680, incomeAmount: 35820, alipayBinding: '138****5678', wechatBinding: '林**', bankBinding: '农业银行 尾号6234', status: '待审核', updatedAt: '今天 15:08' },
    { id: 'MB20260828016', name: '福安禾盛农服', identities: '供应商、服务商', type: '企业主体', town: '赛岐镇', virtualPhone: '170****8002（虚拟号）', assignedTasks: 50, completedTasks: 44, overdueTasks: 3, canceledTasks: 3, taskCompletion: '88%', systemRating: '4.5', customerRating: '4.6', expenseAmount: 86950, incomeAmount: 178600, alipayBinding: '未绑定', wechatBinding: '禾盛农服', bankBinding: '福建农信 尾号9081', status: '待审核', updatedAt: '昨天 17:42' },
    { id: 'MB20260827009', name: '陈建国', identities: '种植户、代录人员', type: '个人会员', town: '甘棠镇', virtualPhone: '170****8003（虚拟号）', assignedTasks: 18, completedTasks: 18, overdueTasks: 0, canceledTasks: 0, taskCompletion: '100%', systemRating: '4.9', customerRating: '4.7', expenseAmount: 8320, incomeAmount: 29600, alipayBinding: '139****2186', wechatBinding: '未绑定', bankBinding: '邮储银行 尾号1179', status: '已通过', updatedAt: '08-27 11:20' },
  ],
  plots: [
    { id: 'PL20260829023', name: '北山村·水稻田1号', owner: '林春梅', town: '溪柄镇北山村', area: '3.2亩', altitude: '46米', longitude: '119.723188', latitude: '27.087614', collectionMethod: '手机定位', status: '待核验' },
    { id: 'PL20260828018', name: '甘蔗地2号', owner: '陈建国', town: '赛岐镇象环村', area: '5.6亩', altitude: '31米', longitude: '119.657320', latitude: '26.973621', collectionMethod: '地图选点', status: '待核验' },
    { id: 'PL20260827011', name: '茶园4号', owner: '吴秀兰', town: '坂中乡坑下村', area: '2.5亩', altitude: '286米', longitude: '119.634208', latitude: '27.115902', collectionMethod: '子女远程代录', status: '待纠偏' },
    { id: 'PL20260826032', name: '溪尾村·葡萄园1号', owner: '穆云家庭农场', town: '赛岐镇溪尾村', area: '8.4亩', altitude: '38米', longitude: '119.669842', latitude: '26.981205', collectionMethod: '手机定位', status: '已核验' },
    { id: 'PL20260826027', name: '坑头村·水稻田3号', owner: '王国安', town: '溪柄镇坑头村', area: '4.1亩', altitude: '62米', longitude: '119.741236', latitude: '27.104512', collectionMethod: '现场测绘', status: '待核验' },
    { id: 'PL20260825041', name: '白石村·茶园2号', owner: '福安绿野合作社', town: '甘棠镇白石村', area: '12.8亩', altitude: '315米', longitude: '119.692413', latitude: '27.059824', collectionMethod: '无人机测绘', status: '已核验' },
    { id: 'PL20260825036', name: '洋面村·蔬菜地1号', owner: '郑美华', town: '穆阳镇洋面村', area: '1.8亩', altitude: '128米', longitude: '119.560821', latitude: '27.121406', collectionMethod: '地图选点', status: '待纠偏' },
    { id: 'PL20260824029', name: '溪塔村·猕猴桃园', owner: '雷振兴', town: '穆云乡溪塔村', area: '6.7亩', altitude: '423米', longitude: '119.538612', latitude: '27.185230', collectionMethod: '手机定位', status: '待核验' },
    { id: 'PL20260824021', name: '松罗村·水蜜桃园', owner: '松罗果业', town: '松罗乡松罗村', area: '15.2亩', altitude: '176米', longitude: '119.801425', latitude: '26.908746', collectionMethod: '无人机测绘', status: '已核验' },
    { id: 'PL20260823038', name: '湾坞村·水稻田5号', owner: '刘成海', town: '湾坞镇湾坞村', area: '3.9亩', altitude: '18米', longitude: '119.774386', latitude: '26.872105', collectionMethod: '子女远程代录', status: '待核验' },
    { id: 'PL20260823024', name: '晓阳村·高山茶园', owner: '陈秀英', town: '晓阳镇晓阳村', area: '9.6亩', altitude: '612米', longitude: '119.601823', latitude: '27.246590', collectionMethod: '现场测绘', status: '已核验' },
    { id: 'PL20260822031', name: '社口村·坦洋茶园1号', owner: '坦洋茶业合作社', town: '社口镇坦洋村', area: '22.5亩', altitude: '358米', longitude: '119.683025', latitude: '27.198437', collectionMethod: '无人机测绘', status: '待核验' },
    { id: 'PL20260822019', name: '溪潭村·甘薯地', owner: '周明德', town: '溪潭镇溪潭村', area: '2.2亩', altitude: '73米', longitude: '119.636504', latitude: '27.038916', collectionMethod: '手机定位', status: '已核验' },
    { id: 'PL20260821044', name: '上白石村·油茶林', owner: '上白石林业合作社', town: '上白石镇上白石村', area: '31.6亩', altitude: '486米', longitude: '119.715832', latitude: '27.302614', collectionMethod: '无人机测绘', status: '待纠偏' },
    { id: 'PL20260821035', name: '范坑村·毛竹林2号', owner: '林志强', town: '范坑乡范坑村', area: '18.3亩', altitude: '538米', longitude: '119.612475', latitude: '27.348026', collectionMethod: '现场测绘', status: '待核验' },
    { id: 'PL20260820028', name: '康厝村·葡萄园3号', owner: '叶秋香', town: '康厝乡康厝村', area: '7.3亩', altitude: '205米', longitude: '119.590318', latitude: '27.086275', collectionMethod: '子女远程代录', status: '已核验' },
    { id: 'PL20260820017', name: '溪邳村·莲藕塘', owner: '高峰水产合作社', town: '下白石镇溪邳村', area: '10.7亩', altitude: '12米', longitude: '119.742690', latitude: '26.925138', collectionMethod: '地图选点', status: '待核验' },
    { id: 'PL20260819039', name: '棠溪村·生姜地', owner: '许文斌', town: '棠溪镇棠溪村', area: '3.6亩', altitude: '267米', longitude: '119.756412', latitude: '27.224581', collectionMethod: '手机定位', status: '已核验' },
    { id: 'PL20260819025', name: '城阳村·蔬菜基地', owner: '惠农种植专业合作社', town: '城阳镇城阳村', area: '26.4亩', altitude: '91米', longitude: '119.642836', latitude: '27.127604', collectionMethod: '无人机测绘', status: '待纠偏' },
    { id: 'PL20260818033', name: '溪柄村·稻虾田', owner: '黄建平', town: '溪柄镇溪柄村', area: '5.1亩', altitude: '54米', longitude: '119.731502', latitude: '27.096418', collectionMethod: '现场测绘', status: '待核验' },
    { id: 'PL20260818022', name: '王里村·茶园6号', owner: '王里生态农场', town: '坂中乡王里村', area: '14.9亩', altitude: '392米', longitude: '119.621734', latitude: '27.143829', collectionMethod: '地图选点', status: '已核验' },
    { id: 'PL20260817030', name: '南溪村·玉米地', owner: '谢月娥', town: '甘棠镇南溪村', area: '2.9亩', altitude: '109米', longitude: '119.704218', latitude: '27.047693', collectionMethod: '子女远程代录', status: '待核验' },
    { id: 'PL20260817016', name: '苏堤村·马铃薯地', owner: '郭长青', town: '穆阳镇苏堤村', area: '4.7亩', altitude: '154米', longitude: '119.572960', latitude: '27.113482', collectionMethod: '手机定位', status: '已核验' },
  ],
  services: [
    { id: 'WO20260829018', service: '水稻植保', grower: '林春梅', provider: '禾盛农服', status: '执行中', deadline: '今天 18:00', workload: '12亩', bookingFee: '¥680', fulfillmentProcess: '已接单 · 已进场作业', referenceStandard: '绿色防控作业规范', media: '现场图片 3 张 · 视频 1 段' },
    { id: 'WO20260828031', service: '机械耕整', grower: '福安分拣车间', provider: '市场待接单', status: '市场接单中', deadline: '明天 10:00', workload: '8亩', bookingFee: '¥520', fulfillmentProcess: '公开接单中', referenceStandard: '农机作业安全标准（V1）', media: '暂无记录' },
    { id: 'WO20260827007', service: '施肥管理', grower: '坦洋茶厂', provider: '绿田农服', status: '待验收', deadline: '08-30 12:00', workload: '35亩', bookingFee: '¥1,260', fulfillmentProcess: '已完成作业 · 待验收', referenceStandard: '茶园施肥技术规程', media: '现场图片 6 张' },
  ],
  supply: [
    { id: 'SP20260829008', title: '早熟水稻 12吨', owner: '溪柄合作社', source: '运营代录', status: '待审核', validUntil: '09-15' },
    { id: 'SP20260828002', title: '福安葡萄 6吨', owner: '穆云家庭农场', source: '存量数据', status: '待审核', validUntil: '09-05' },
  ],
  config: [
    { id: 'TPL-FA-001', name: '农事记录模板', version: 'v1.4', status: '已发布', publisher: '陈晓岚' },
    { id: 'TPL-FA-002', name: '地块基础字段', version: 'v1.2 草稿', status: '草稿', publisher: '—' },
  ],
  audit: [
    { id: 'EL20260829004', applicant: '赵海', permission: '地块批量核验', reason: '集中处理溪柄镇历史数据', status: '待审批' },
    { id: 'EL20260828006', applicant: '黄燕', permission: '参数发布', reason: '发布农事记录模板v1.4', status: '已通过' },
  ],
}

const plotHarvestDates = [
  ['2026-09-12', '2026-09-25'], ['2026-10-05', '2026-10-20'], ['2026-09-03', '2026-09-18'], ['2026-09-08', '2026-09-22'], ['2026-09-18', '2026-10-02'], ['2026-09-25', '2026-10-18'], ['2026-09-01', '2026-09-12'], ['2026-09-15', '2026-10-10'], ['2026-08-31', '2026-09-15'], ['2026-10-12', '2026-10-28'], ['2026-09-20', '2026-10-15'], ['2026-09-06', '2026-09-16'], ['2026-11-01', '2026-11-25'], ['2026-10-18', '2026-11-10'], ['2026-09-10', '2026-09-28'], ['2026-09-02', '2026-09-20'], ['2026-09-14', '2026-09-30'], ['2026-09-05', '2026-09-17'], ['2026-10-01', '2026-10-20'], ['2026-09-07', '2026-09-19'], ['2026-09-22', '2026-10-05'], ['2026-09-11', '2026-09-24'], ['2026-09-28', '2026-10-16'],
]

export const fuanCropOptions = ['茶叶', '葡萄', '水蜜桃', '脐橙', '芙蓉李', '晚熟龙眼', '杨梅', '绿竹笋', '油茶', '水稻', '甘薯', '马铃薯', '玉米', '甘蔗', '时令蔬菜', '莲藕', '生姜', '猕猴桃', '食用菌', '中药材', '毛竹']

moduleRows.plots.push(
  { id: 'PL20260817011', name: '岳秀村·脐橙园', owner: '岳秀果业合作社', town: '晓阳镇岳秀村', area: '11.3亩', altitude: '428米', longitude: '119.615927', latitude: '27.233816', collectionMethod: '无人机测绘', status: '待核验' },
  { id: 'PL20260816027', name: '潭头村·芙蓉李园', owner: '林月清', town: '社口镇潭头村', area: '7.8亩', altitude: '336米', longitude: '119.674218', latitude: '27.214605', collectionMethod: '手机定位', status: '已核验' },
  { id: 'PL20260816018', name: '半屿村·晚熟龙眼园', owner: '半屿果蔬合作社', town: '湾坞镇半屿村', area: '9.2亩', altitude: '42米', longitude: '119.781306', latitude: '26.884219', collectionMethod: '地图选点', status: '待核验' },
  { id: 'PL20260815034', name: '廉村·杨梅园', owner: '郑晓峰', town: '溪潭镇廉村', area: '5.4亩', altitude: '168米', longitude: '119.651804', latitude: '27.061927', collectionMethod: '现场测绘', status: '待纠偏' },
  { id: 'PL20260815022', name: '虎头村·绿竹笋基地', owner: '虎头村集体合作社', town: '穆云乡虎头村', area: '16.5亩', altitude: '472米', longitude: '119.541773', latitude: '27.176308', collectionMethod: '无人机测绘', status: '已核验' },
  { id: 'PL20260814031', name: '南岩村·食用菌棚', owner: '南岩菌业', town: '上白石镇南岩村', area: '3.4亩', altitude: '518米', longitude: '119.704326', latitude: '27.318492', collectionMethod: '手机定位', status: '待核验' },
  { id: 'PL20260814017', name: '南山村·畲药中药材基地', owner: '南山畲药合作社', town: '穆云乡南山村', area: '12.6亩', altitude: '584米', longitude: '119.528914', latitude: '27.193570', collectionMethod: '现场测绘', status: '已核验' },
)

function cropFromPlotName(name: string) {
  if (/水稻|稻虾/.test(name)) return '水稻'
  if (/油茶/.test(name)) return '油茶'
  if (/茶园|茶叶|坦洋/.test(name)) return '茶叶'
  if (/葡萄/.test(name)) return '葡萄'
  if (/脐橙|柑橘/.test(name)) return '脐橙'
  if (/芙蓉李|李园/.test(name)) return '芙蓉李'
  if (/龙眼/.test(name)) return '晚熟龙眼'
  if (/杨梅/.test(name)) return '杨梅'
  if (/甘蔗/.test(name)) return '甘蔗'
  if (/猕猴桃/.test(name)) return '猕猴桃'
  if (/水蜜桃/.test(name)) return '水蜜桃'
  if (/蔬菜/.test(name)) return '时令蔬菜'
  if (/甘薯/.test(name)) return '甘薯'
  if (/毛竹/.test(name)) return '毛竹'
  if (/莲藕/.test(name)) return '莲藕'
  if (/生姜/.test(name)) return '生姜'
  if (/玉米/.test(name)) return '玉米'
  if (/马铃薯/.test(name)) return '马铃薯'
  if (/竹笋|绿竹笋/.test(name)) return '绿竹笋'
  if (/食用菌|菌棚/.test(name)) return '食用菌'
  if (/中药材|畲药/.test(name)) return '中药材'
  return '综合作物'
}

const cropYieldFactors: Record<string, number> = {
  茶叶: 0.18,
  葡萄: 0.68,
  水蜜桃: 0.62,
  脐橙: 0.72,
  芙蓉李: 0.48,
  晚熟龙眼: 0.42,
  杨梅: 0.36,
  绿竹笋: 0.55,
  油茶: 0.22,
  水稻: 0.52,
  甘蔗: 1.2,
  食用菌: 1.5,
}

moduleRows.plots.forEach((plot, index) => {
  const [harvestStart, harvestEnd] = plotHarvestDates[index % plotHarvestDates.length]
  const crop = cropFromPlotName(String(plot.name))
  const area = Number.parseFloat(String(plot.area)) || 0
  const yieldFactor = cropYieldFactors[crop] || 0.45
  plot.crop = crop
  plot.harvestYield = `${(area * yieldFactor).toFixed(1)}吨`
  plot.estimatedYield = plot.harvestYield
  plot.pendingHarvest = `${(Number.parseFloat(String(plot.harvestYield)) * (0.58 + (index % 5) * 0.07)).toFixed(1)}吨`
  plot.harvestStart = harvestStart
  plot.harvestEnd = harvestEnd
})

const mockTowns = ['溪柄镇', '赛岐镇', '甘棠镇', '穆阳镇', '穆云乡', '松罗乡', '湾坞镇', '晓阳镇', '社口镇', '溪潭镇', '上白石镇', '范坑乡', '康厝乡', '下白石镇', '棠溪镇', '城阳镇', '坂中乡']
const mockMemberNames = ['王国安', '郑美华', '雷振兴', '刘成海', '陈秀英', '周明德', '林志强', '叶秋香', '许文斌', '黄建平', '谢月娥', '郭长青', '绿野合作社', '松罗果业', '坦洋茶业合作社', '惠农种植合作社', '高峰水产合作社']
const mockIdentities = ['种植户、采购商', '种植户、代录人员', '供应商、服务商', '采购商、供应商', '种植户、服务商']

moduleRows.members.push(...mockMemberNames.map((name, index) => {
  const assignedTasks = 16 + index * 2
  const missedTasks = index % 6
  const completedTasks = assignedTasks - missedTasks
  return {
    id: `MB202608${String(2600 - index).padStart(4, '0')}`,
    name,
    identities: mockIdentities[index % mockIdentities.length],
    type: index < 12 ? '个人会员' : '企业主体',
    town: mockTowns[index],
    virtualPhone: `170****${String(8100 + index).slice(-4)}（虚拟号）`,
    assignedTasks,
    completedTasks,
    overdueTasks: Math.min(missedTasks, 3),
    canceledTasks: Math.max(0, missedTasks - 3),
    taskCompletion: `${Math.round(completedTasks / assignedTasks * 100)}%`,
    systemRating: (4.1 + (index % 8) * 0.1).toFixed(1),
    customerRating: (4.2 + (index % 7) * 0.1).toFixed(1),
    expenseAmount: 5600 + index * 2180,
    incomeAmount: 18600 + index * 7350,
    alipayBinding: index % 3 === 0 ? '未绑定' : `13${8 + index % 2}****${String(4200 + index * 29).slice(-4)}`,
    wechatBinding: index % 4 === 0 ? '未绑定' : `${String(name).slice(0, 1)}**`,
    bankBinding: index % 5 === 0 ? '未绑定' : `${['农业银行', '福建农信', '邮储银行'][index % 3]} 尾号${String(5100 + index * 41).slice(-4)}`,
    status: index % 4 === 0 ? '待审核' : '已通过',
    updatedAt: `08-${String(26 - index).padStart(2, '0')} ${String(9 + index % 8).padStart(2, '0')}:20`,
  }
}))

const plotPurchases: Record<string, PlotPurchase[]> = {}
moduleRows.plots.forEach((plot, index) => {
  const buyerOne = mockMemberNames[(index + 1) % mockMemberNames.length]
  const buyerTwo = mockMemberNames[(index + 7) % mockMemberNames.length]
  const product = String(plot.crop || cropFromPlotName(String(plot.name)))
  plotPurchases[String(plot.id)] = [
    { id: `PO-PL-${String(index + 1).padStart(3, '0')}-01`, buyer: buyerOne, purchasedAt: `2026-08-${String(28 - index % 8).padStart(2, '0')} 10:20`, product, quantity: `${(0.6 + index % 5 * 0.4).toFixed(1)}吨`, status: index % 3 === 0 ? '待发货' : '已完成' },
    { id: `PO-PL-${String(index + 1).padStart(3, '0')}-02`, buyer: buyerTwo, purchasedAt: `2026-08-${String(20 - index % 8).padStart(2, '0')} 15:40`, product, quantity: `${(0.4 + index % 4 * 0.3).toFixed(1)}吨`, status: index % 4 === 0 ? '已完成' : '已结算' },
  ]
  plot.pendingHarvest = `${plotPurchases[String(plot.id)].reduce((sum, purchase) => sum + (Number.parseFloat(purchase.quantity) || 0), 0).toFixed(1)}吨`
  const pending = Number.parseFloat(String(plot.pendingHarvest)) || 0
  const estimated = Math.max(Number.parseFloat(String(plot.estimatedYield)) || 0, pending)
  plot.estimatedYield = `${estimated.toFixed(1)}吨`
  plot.harvestYield = plot.estimatedYield
  plot.harvestedAmount = `${Math.max(0, estimated - pending).toFixed(1)}吨`
  plot.remainingAmount = plot.pendingHarvest
  plot.harvestStatus = index % 5 === 0 ? '待采' : index % 5 === 1 ? '采收中' : '已采收'
})

const mockServices = ['水稻植保', '机械耕整', '施肥管理', '茶园修剪', '葡萄病害巡查', '无人机飞防', '水稻收割', '农机维修', '土壤检测', '灌溉排水', '果树授粉', '除草作业', '种苗配送', '秸秆还田', '茶叶采摘', '冷链运输', '农产品质检', '疏花蔬果', '分拣打包', '采摘']
moduleRows.services.push(...mockServices.map((service, index) => ({
  id: `WO202608${String(2700 - index).padStart(4, '0')}`,
  service,
  grower: index % 3 === 0 ? '福安分拣车间' : index % 3 === 1 ? '坦洋茶厂' : mockMemberNames[index],
  provider: index % 5 === 0 ? '市场待接单' : ['禾盛农服', '绿田农服', '福安农机队', '惠农服务站'][index % 4],
  status: ['市场接单中', '作业中', '待标准验收', '已完成'][index % 4],
  deadline: `09-${String(1 + index).padStart(2, '0')} ${index % 2 ? '17:00' : '10:00'}`,
  workload: `${6 + (index % 8) * 2}亩`,
  bookingFee: `¥${380 + (index % 7) * 120}`,
  fulfillmentProcess: ['公开接单中', '已自由接单 · 进行中', '已完成作业 · 待标准验收', '标准验收通过'][index % 4],
  referenceStandard: ['农事作业规范', '绿色生产标准', '安全操作规程'][index % 3],
  media: index % 3 === 0 ? '现场图片 2 张 · 视频 1 段' : `现场图片 ${3 + (index % 4)} 张`,
  serviceRating: (4.2 + (index % 8) / 10).toFixed(1),
  customerRating: (4.0 + (index % 10) / 10).toFixed(1),
  weather: ['晴 28℃ · 东南风2级', '多云 26℃ · 微风', '小雨 23℃ · 东风3级'][index % 3],
  plotInfo: `PL202608${String(23 - (index % 12)).padStart(3, '0')} · ${['溪柄镇北山村', '甘棠镇白石村', '赛岐镇溪尾村'][index % 3]} · ${['水稻', '茶叶', '葡萄'][index % 3]} · ${(2.5 + (index % 8) * 1.2).toFixed(1)}亩 · 海拔${46 + (index % 6) * 28}米`,
})))

const mockSupplies = ['坦洋工夫茶 3吨', '晚熟葡萄 8吨', '优质稻谷 20吨', '鲜食玉米 6吨', '生态土鸡 1200羽', '山地生姜 5吨', '高山马铃薯 9吨', '竹笋 4吨', '水蜜桃 7吨', '莲藕 11吨', '有机肥 30吨', '育秧盘 6000张', '农用薄膜 2吨', '水稻种子 1.5吨', '茶苗 8万株', '果蔬周转筐 3000个', '小型旋耕机 12台', '植保无人机服务 800亩']
moduleRows.supply.push(...mockSupplies.map((title, index) => ({
  id: `SP202608${String(2700 - index).padStart(4, '0')}`,
  title,
  owner: mockMemberNames[index % mockMemberNames.length],
  source: ['运营代录', '会员自主发布', '存量数据'][index % 3],
  status: ['待审核', '已通过', '已驳回'][index % 3],
  validUntil: `09-${String(10 + index).padStart(2, '0')}`,
})))

const mockTemplates = ['会员基础字段', '主体认证规则', '多身份关联规则', '任务完成度规则', '系统评分模型', '客户评分问卷', '地块核验规则', '地块影像规范', '农事记录模板', '远程代录规则', '服务需求模板', '市场接单规则', '标准验收模板', '供需发布模板', '供需审核规则', '消息提醒模板', '数据字典', '审计日志规则']
moduleRows.config.push(...mockTemplates.map((name, index) => ({
  id: `TPL-FA-${String(index + 3).padStart(3, '0')}`,
  name,
  version: `v${1 + Math.floor(index / 5)}.${index % 5}${index % 4 === 0 ? ' 草稿' : ''}`,
  status: index % 4 === 0 ? '草稿' : '已发布',
  publisher: index % 4 === 0 ? '—' : ['陈晓岚', '赵海', '黄燕'][index % 3],
})))

const mockPermissions = ['会员批量审核', '主体资料导出', '地块批量核验', '地块影像删除', '服务跨区调度', '工单强制改派', '供需批量上架', '供应信息下架', '参数发布', '评分规则调整', '主体类型维护', '所在地维护', '管理员新增', '管理员权限调整', '农事记录补录', '历史任务修正', '数据批量导入', '审计日志导出']
moduleRows.audit.push(...mockPermissions.map((permission, index) => ({
  id: `EL202608${String(2700 - index).padStart(4, '0')}`,
  applicant: ['赵海', '黄燕', '林志远', '陈晓岚'][index % 4],
  permission,
  reason: `处理${mockTowns[index % mockTowns.length]}专项运营事项`,
  status: ['待审批', '已通过', '已驳回'][index % 3],
})))

const memberPerformance: Record<string, MemberPerformance> = {
  MB20260829001: {
    activities: [
      { id: 'ACT001', taskId: 'FA20260829001', occurredAt: '2026-08-29 09:40', action: '完成水稻病虫害巡查', target: '北山村·水稻田1号', identity: '种植户', result: '按时完成，验收通过', tone: 'positive' },
      { id: 'ACT002', taskId: 'PO20260827001', occurredAt: '2026-08-27 14:20', action: '确认农资采购订单', target: '复合肥采购单 PO082701', identity: '采购商', result: '较计划晚2小时确认', tone: 'warning' },
      { id: 'ACT003', taskId: 'WO20260825018', occurredAt: '2026-08-25 08:15', action: '提交植保服务需求', target: '北山村·水稻田1号', identity: '种植户', result: '已由禾盛农服接单', tone: 'neutral' },
      { id: 'ACT004', taskId: 'WO20260822003', occurredAt: '2026-08-22 17:30', action: '验收机械耕整任务', target: '服务工单 WO082203', identity: '种植户', result: '验收通过，客户评分4.8', tone: 'positive' },
    ],
    remediation: { issue: '近30天有1项任务逾期、1项任务取消，主要因消息确认不及时。', measures: ['任务开始前48小时和4小时双重提醒', '连续未响应时由溪柄镇运营员电话协助', '允许授权子女代为确认任务与补录记录'], owner: '溪柄镇运营员 · 赵海', dueAt: '2026-09-15', status: '跟进中', beforeCompletion: '78%', currentCompletion: '92%', effect: '完成度提升14个百分点，最近8项任务均按时响应；需继续观察至9月中旬。', reviewedAt: '2026-08-29' },
  },
  MB20260828016: {
    activities: [
      { id: 'ACT101', taskId: 'WO20260828011', occurredAt: '2026-08-28 16:10', action: '完成水稻植保服务', target: '溪柄镇服务工单 WO082811', identity: '服务商', result: '验收通过，客户评分4.6', tone: 'positive' },
      { id: 'ACT102', taskId: 'PO20260826003', occurredAt: '2026-08-26 10:00', action: '供应农膜与肥料', target: '采购订单 PO082603', identity: '供应商', result: '部分商品晚到1天', tone: 'warning' },
      { id: 'ACT103', taskId: 'WO20260824009', occurredAt: '2026-08-24 08:30', action: '接受机械耕整任务', target: '赛岐镇服务工单 WO082409', identity: '服务商', result: '已按计划排班', tone: 'neutral' },
    ],
    remediation: { issue: '跨乡镇排班冲突导致3项逾期、3项取消。', measures: ['限制同一时段可接单数量', '按服务半径自动推荐任务', '每日17点由调度员检查次日冲突'], owner: '服务调度主管 · 黄燕', dueAt: '2026-09-10', status: '整改中', beforeCompletion: '72%', currentCompletion: '88%', effect: '完成度提升16个百分点，近两周取消率由10%降至4%，仍需降低跨乡镇迟到。', reviewedAt: '2026-08-28' },
  },
  MB20260827009: {
    activities: [
      { id: 'ACT201', taskId: 'FA20260827009', occurredAt: '2026-08-27 11:20', action: '为父亲代录施肥记录', target: '甘棠镇·葡萄园2号', identity: '代录人员', result: '同步成功，资料完整', tone: 'positive' },
      { id: 'ACT202', taskId: 'FA20260826012', occurredAt: '2026-08-26 15:40', action: '完成葡萄园巡查', target: '甘棠镇·葡萄园2号', identity: '种植户', result: '按时完成', tone: 'positive' },
    ],
    remediation: { issue: '当前任务完成度良好，无需专项整改。', measures: ['保持任务前提醒', '每月复核一次异常任务'], owner: '系统自动观察', dueAt: '2026-09-30', status: '常规观察', beforeCompletion: '100%', currentCompletion: '100%', effect: '完成度保持稳定，近30天无逾期、无取消。', reviewedAt: '2026-08-27' },
  },
}

for (const [index, member] of moduleRows.members.slice(3).entries()) {
  const completion = String(member.taskCompletion)
  const previousCompletion = `${Math.max(60, Number(completion.replace('%', '')) - 8)}%`
  const day = String(26 - index).padStart(2, '0')
  const identity = String(member.identities).split('、')[0]
  memberPerformance[String(member.id)] = {
    activities: [
      { id: `ACT-G${index + 1}-01`, taskId: `FA202608${day}${String(index + 1).padStart(3, '0')}`, occurredAt: `2026-08-${day} 09:30`, action: '完成日常农事任务', target: `${member.town}生产任务`, identity, result: index % 4 === 0 ? '补充材料后验收通过' : '按时完成，验收通过', tone: index % 4 === 0 ? 'warning' : 'positive' },
      { id: `ACT-G${index + 1}-02`, taskId: `WO202608${day}${String(index + 21).padStart(3, '0')}`, occurredAt: `2026-08-${day} 15:10`, action: '确认服务工单进度', target: `服务工单 WO${day}${String(index + 21).padStart(3, '0')}`, identity, result: index % 3 === 0 ? '正在执行，等待验收' : '服务已完成', tone: index % 3 === 0 ? 'neutral' : 'positive' },
    ],
    remediation: {
      issue: index % 6 === 0 ? '近期存在任务响应不及时，需要运营协助提醒。' : '当前任务完成情况稳定，继续常规观察。',
      measures: index % 6 === 0 ? ['开启任务双重提醒', '由属地运营员电话回访', '允许授权家属远程协助办理'] : ['保持任务到期提醒', '每月复核异常任务'],
      owner: `${member.town}运营员`,
      dueAt: '2026-09-30',
      status: index % 6 === 0 ? '跟进中' : '常规观察',
      beforeCompletion: previousCompletion,
      currentCompletion: completion,
      effect: `当前任务完成度为${completion}，最近一次任务已形成履约记录。`,
      reviewedAt: `2026-08-${day}`,
    },
  }
}

const plotMedia: Record<string, PlotMedia[]> = {
  PL20260829023: [], PL20260828018: [], PL20260827011: [],
}

export type SettingGroup = 'administrators' | 'subjectTypes' | 'locations'

const settings: Record<SettingGroup, OperationRow[]> = {
  administrators: [
    { id: 'ADM001', name: '陈晓岚', phone: '138****6234', role: '县域运营管理员', permissions: '全部模块', status: '启用' },
    { id: 'ADM002', name: '赵海', phone: '139****2168', role: '地块审核员', permissions: '会员查看、地块审核', status: '启用' },
  ],
  subjectTypes: [
    { id: 'SUB001', name: '个人会员', identities: '种植户、采购商、代录人员', status: '启用' },
    { id: 'SUB002', name: '企业主体', identities: '供应商、采购商、农事服务商', status: '启用' },
  ],
  locations: [
    { id: 'LOC001', name: '溪柄镇', code: '350981110', villages: '北山村、溪南村、立峰村', status: '启用' },
    { id: 'LOC002', name: '赛岐镇', code: '350981100', villages: '象环村、宅里村、苏阳村', status: '启用' },
    { id: 'LOC003', name: '坂中畲族乡', code: '350981201', villages: '坑下村、长汀村', status: '启用' },
  ],
}

const mockAdminNames = ['黄燕', '林志远', '王海峰', '陈佳宁', '李秋月', '郑文斌', '周晓梅', '叶建华', '许志强', '郭春兰', '谢国平', '刘美芳', '雷俊杰', '吴海燕', '高明辉', '何玉珍', '苏志鹏', '缪晓琴']
settings.administrators.push(...mockAdminNames.map((name, index) => ({
  id: `ADM${String(index + 3).padStart(3, '0')}`,
  name,
  phone: `13${8 + index % 2}****${String(3100 + index * 37).slice(-4)}`,
  role: ['会员审核员', '地块审核员', '服务调度员', '供需审核员', '参数管理员', '审计员'][index % 6],
  permissions: ['会员查看、会员审核', '地块查看、地块审核', '服务查看、服务调度', '供需查看、供需审核', '参数查看、参数发布', '审计查看、提权审批'][index % 6],
  status: index % 9 === 0 ? '停用' : '启用',
})))

const mockSubjectTypes = ['家庭农场', '农民专业合作社', '农业企业', '村集体经济组织', '农机服务组织', '植保服务组织', '农资供应商', '农产品采购商', '个体工商户', '家庭种植户', '养殖户', '水产养殖主体', '茶叶加工主体', '果蔬经纪人', '冷链物流企业', '质量检测机构', '农技服务机构', '代录服务人员']
settings.subjectTypes.push(...mockSubjectTypes.map((name, index) => ({
  id: `SUB${String(index + 3).padStart(3, '0')}`,
  name,
  identities: ['种植户、采购商', '供应商、服务商', '采购商、供应商', '种植户、代录人员', '服务商'][index % 5],
  status: index % 10 === 0 ? '停用' : '启用',
})))

const mockLocationNames = ['穆阳镇', '穆云畲族乡', '松罗乡', '湾坞镇', '晓阳镇', '社口镇', '溪潭镇', '上白石镇', '范坑乡', '康厝畲族乡', '下白石镇', '棠溪镇', '城阳镇', '罗江街道', '阳头街道', '城北街道', '城南街道']
settings.locations.push(...mockLocationNames.map((name, index) => ({
  id: `LOC${String(index + 4).padStart(3, '0')}`,
  name,
  code: `350981${String(120 + index).padStart(3, '0')}`,
  villages: ['洋面村、苏堤村、百岁街', '溪塔村、虎头村、燕科村', '松罗村、王家村、南溪村', '湾坞村、半屿村、宝岭村'][index % 4],
  status: index === 16 ? '停用' : '启用',
})))

export async function getModuleRows(module: string): Promise<ApiEnvelope<OperationRow[]>> {
  await sleep(420)
  return envelope(moduleRows[module].map((row) => ({ ...(module === 'members' ? readMemberProfile(row) : row) })))
}

export async function getMember(id: string): Promise<ApiEnvelope<OperationRow>> {
  await sleep(360)
  const member = moduleRows.members.find((row) => row.id === id)
  if (!member) failure('未找到该会员或主体', 'XQ-MB-404-001', 404001)
  return envelope({ ...readMemberProfile(member) })
}

export async function saveMemberProfile(id: string, input: MemberProfile): Promise<ApiEnvelope<OperationRow>> {
  await sleep(360)
  const member = moduleRows.members.find((row) => row.id === id)
  if (!member) failure('未找到该会员或主体', 'XQ-MB-404-001', 404001)
  const profile = normalizeMemberProfile(input)
  const current = readMemberProfile(member)
  const allowedTypes = settings.subjectTypes.filter((item) => item.status === '启用').map((item) => String(item.name))
  const allowedTowns = settings.locations.filter((item) => item.status === '启用').map((item) => String(item.name))
  const allowedIdentities = new Set([...settings.subjectTypes.filter((item) => item.status === '启用').flatMap((item) => String(item.identities).split('、')), ...String(current.identities).split('、')])
  if (profile.type !== current.type && !allowedTypes.includes(profile.type)) throw new Error('主体类型已停用，请重新选择')
  if (profile.town !== current.town && !allowedTowns.includes(profile.town)) throw new Error('所在乡镇已停用，请重新选择')
  if (profile.identities.split('、').some((identity) => !allowedIdentities.has(identity))) throw new Error('身份选项已变更，请重新打开编辑窗口')
  const updatedAt = new Date().toLocaleString('sv-SE', { hour12: false }).slice(0, 16)
  persistMemberProfile(id, profile, updatedAt)
  return envelope({ ...current, ...profile, updatedAt })
}

export async function getPlot(id: string): Promise<ApiEnvelope<OperationRow>> {
  await sleep(340)
  const plot = moduleRows.plots.find((row) => row.id === id)
  if (!plot) failure('未找到该地块', 'XQ-PL-404-001', 404001)
  return envelope({ ...plot })
}

export async function getPlotPurchases(id: string): Promise<ApiEnvelope<PlotPurchase[]>> {
  await sleep(280)
  return envelope((plotPurchases[id] || []).map((item) => ({ ...item })))
}

export async function getPlotMedia(id: string): Promise<ApiEnvelope<PlotMedia[]>> {
  await sleep(260)
  return envelope((plotMedia[id] || []).map((item) => ({ ...item })))
}

export async function savePlotMedia(plotId: string, media: Omit<PlotMedia, 'id' | 'uploadedAt'>): Promise<ApiEnvelope<PlotMedia>> {
  await sleep(300)
  const item: PlotMedia = { ...media, id: `PM${Date.now()}${Math.random().toString(16).slice(2, 6)}`, uploadedAt: '刚刚' }
  if (!plotMedia[plotId]) plotMedia[plotId] = []
  plotMedia[plotId].unshift(item)
  return envelope({ ...item })
}

export async function deletePlotMedia(plotId: string, mediaId: string): Promise<ApiEnvelope<{ id: string }>> {
  await sleep(220)
  plotMedia[plotId] = (plotMedia[plotId] || []).filter((item) => item.id !== mediaId)
  return envelope({ id: mediaId })
}

export async function getMemberPerformance(id: string): Promise<ApiEnvelope<MemberPerformance>> {
  await sleep(320)
  const performance = memberPerformance[id]
  if (!performance) failure('未找到该主体的履约记录', 'XQ-MB-404-002', 404002)
  return envelope({ activities: performance.activities.map((item) => ({ ...item })), remediation: { ...performance.remediation, measures: [...performance.remediation.measures] } })
}

export async function getMemberTask(taskId: string): Promise<ApiEnvelope<MemberTaskDetail>> {
  await sleep(340)
  for (const [memberId, performance] of Object.entries(memberPerformance)) {
    const activity = performance.activities.find((item) => item.taskId === taskId)
    if (!activity) continue
    const member = moduleRows.members.find((row) => row.id === memberId)
    const planned = new Date(activity.occurredAt.replace(' ', 'T'))
    planned.setHours(planned.getHours() - (activity.tone === 'warning' ? 2 : 1))
    return envelope({
      id: taskId,
      memberId,
      memberName: String(member?.name || '未知主体'),
      title: activity.action,
      category: taskId.startsWith('PO') ? '采购任务' : taskId.startsWith('WO') ? '农事服务任务' : '农事记录任务',
      identity: activity.identity,
      target: activity.target,
      occurredAt: activity.occurredAt,
      plannedAt: planned.toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-'),
      status: activity.tone === 'neutral' ? '进行中' : activity.tone === 'warning' ? '已完成·有延误' : '已完成',
      result: activity.result,
      operator: `${String(member?.name || '未知主体')}（${activity.identity}）`,
      workLog: [`${activity.occurredAt.slice(0, 10)} 任务进入执行流程`, `${activity.occurredAt} ${activity.action}`, activity.result],
    })
  }
  failure('未找到具体任务', 'XQ-TS-404-001', 404001)
}

export async function decide(module: string, id: string, action: string): Promise<ApiEnvelope<{ id: string; status: string }>> {
  await sleep(500)
  const statusByAction: Record<string, string> = { approve: '已通过', reject: '已驳回', verify: '已通过', dispatch: '已分派', publish: '已发布' }
  const status = statusByAction[action] ?? '已处理'
  const target = moduleRows[module].find((row) => row.id === id)
  if (target) target.status = status
  return envelope({ id, status })
}

export async function getSettingRows(group: SettingGroup): Promise<ApiEnvelope<OperationRow[]>> {
  await sleep(260)
  return envelope(settings[group].map((row) => ({ ...row })))
}

export async function saveSetting(group: SettingGroup, row: OperationRow): Promise<ApiEnvelope<OperationRow>> {
  await sleep(320)
  const normalized = { ...row, id: row.id || `${group.slice(0, 3).toUpperCase()}${Date.now()}`, status: row.status || '启用' }
  const index = settings[group].findIndex((item) => item.id === normalized.id)
  if (index >= 0) settings[group][index] = normalized
  else settings[group].unshift(normalized)
  return envelope({ ...normalized })
}

export async function deleteSetting(group: SettingGroup, id: string): Promise<ApiEnvelope<{ id: string }>> {
  await sleep(260)
  const index = settings[group].findIndex((item) => item.id === id)
  if (index >= 0) settings[group].splice(index, 1)
  return envelope({ id })
}

export async function saveModuleRow(module: string, row: OperationRow): Promise<ApiEnvelope<OperationRow>> {
  await sleep(360)
  const list = moduleRows[module] || []
  const normalized: OperationRow = { ...row, id: row.id || `${module === 'plots' ? 'PL' : 'MB'}${Date.now()}` }
  if (module === 'members') {
    const assigned = Number(normalized.assignedTasks) || 0
    const completed = Math.min(Number(normalized.completedTasks) || 0, assigned)
    normalized.completedTasks = completed
    normalized.taskCompletion = assigned ? `${Math.round(completed / assigned * 100)}%` : '—'
  }
  const index = list.findIndex((item) => item.id === normalized.id)
  if (index >= 0) list[index] = normalized
  else list.unshift(normalized)
  return envelope({ ...normalized })
}

export async function deleteModuleRow(module: string, id: string): Promise<ApiEnvelope<{ id: string }>> {
  await sleep(300)
  const list = moduleRows[module] || []
  const index = list.findIndex((item) => item.id === id)
  if (index >= 0) list.splice(index, 1)
  return envelope({ id })
}



