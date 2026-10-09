export const newsCategories = ['中心动态', '服务公告', '产品进展', '产业观察'] as const
export type NewsCategory = typeof newsCategories[number]
export type NewsStatus = '草稿' | '待审核' | '演示已发布' | '已下架'
export type NewsArticle = {
  id: string; title: string; summary: string; body: string; category: NewsCategory
  date: string; status: NewsStatus; authorId: string; author: string; revision: number
  contributors?: string[]
}
export const publicNewsPreviewKey = 'xiangqiao:public-news-preview:v1:fuan'

// These are illustrative product notices, not invented operational achievements.
export const initialNews: NewsArticle[] = [
  { id: 'news-record-system', title: '从一张农事卡，留下真实的生产过程', summary: '乡桥农事记录体系以少操作、可核验、可追溯为目标，让年长种植户也能参与生产记录。', category: '产品进展', date: '2026-10-06', status: '演示已发布', authorId: 'content-example', author: '乡桥内容编辑（示例）', revision: 1,
    body: '乡桥规划通过农事记录卡采集开工、收工和A/B/C作业事件。作业按键可在官网或小程序配置，离线事件通过手机蓝牙同步，NFC用于授权关联服务记录。\n卡片仍处于概念与工程验证阶段，轻薄、定位、防水及续航均需通过样机验证。真实硬件采集与生产接口尚未接入，示意图不代表量产设备。\n乡桥农事记录核验不替代绿色食品等法定认证；以地块、原始记录、必要证据与独立验收为基础，逐步完善真实性。' },
  { id: 'news-card-fees', title: '农户免平台服务费，农事卡按张收费', summary: '办卡、补卡均为100元/张。平台服务费、设备费用和实际产品或作业服务价款分别说明。', category: '服务公告', date: '2026-10-06', status: '演示已发布', authorId: 'content-example', author: '乡桥内容编辑（示例）', revision: 1,
    body: '按当前项目确定的收费口径，乡桥不向农户收取平台服务费，农事记录卡办卡100元/张、补卡100元/张。卡片费用不属于平台服务费。\n消费者认购不收平台服务费，实际产品价款另行约定。农资、农机、农服等实际交易或作业服务费用，应向用户单独说明。\n本页为收费口径的示例说明，不受理真实办卡、付款或退款；量产交付、具体协议与真实收款能力尚待接入。' },
  { id: 'news-help-center', title: '帮助中心筹备：让种植户与消费者找到支持', summary: '常见问题、分类求助、中心分派和跟进进入原型阶段；真实热线、坐席与工单服务待接入。', category: '中心动态', date: '2026-10-06', status: '演示已发布', authorId: 'content-example', author: '乡桥内容编辑（示例）', revision: 1,
    body: '乡桥帮助中心面向种植户、消费者和各经营主体，规划统一受理农事卡、账号代办、农技检测、作业争议、产销及农场售后等问题。\n当前界面只提供本机演示，不能真实拨号、预约回访、录音或通知客服。工作台、农场与小程序的工单尚未通过服务端互通。\n客服只能协助、分派与记录，不能自行验收作业、修改原始生产数据或执行退款及分账。问题回复后等待用户确认，未解决可继续跟进。' },
  { id: 'news-pilot-draft', title: '福安葡萄试点建设思路（待审核示例）', summary: '以赛岐镇狮子头村为试点，先验证记录与服务流程，再分阶段扩大覆盖。', category: '产业观察', date: '2026-10-06', status: '待审核', authorId: 'content-editor-demo', author: '内容编辑员（示例）', revision: 1,
    body: '首年覆盖500亩福安葡萄、20个工程样机为规划目标，不代表已经完成覆盖。\n以可核验的农事记录、独立验收和授权产销信息为基础，推进合作社、服务中心与采购商协同。\n补贴项目、绿色食品标识和认证均需按实际条件申请，不能把规划或申报意向作为已获得资质宣传。' },
]

export function isNewsArticle(value: unknown): value is NewsArticle {
  if (!value || typeof value !== 'object') return false
  const a = value as NewsArticle
  return typeof a.id === 'string' && a.id.length < 120 && typeof a.title === 'string' && a.title.length <= 80
    && typeof a.summary === 'string' && a.summary.length <= 240 && typeof a.body === 'string' && a.body.length <= 6000
    && newsCategories.includes(a.category) && ['草稿', '待审核', '演示已发布', '已下架'].includes(a.status)
    && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && Number.isFinite(Date.parse(`${a.date}T00:00:00Z`))
    && new Date(`${a.date}T00:00:00Z`).toISOString().slice(0, 10) === a.date
    && typeof a.authorId === 'string' && typeof a.author === 'string'
    && (a.contributors === undefined || Array.isArray(a.contributors) && a.contributors.length <= 50 && a.contributors.every(id => typeof id === 'string' && id.length < 120))
    && Number.isInteger(a.revision) && a.revision > 0
}

export function publishedNews(articles: NewsArticle[]) {
  return articles.filter(a => a.status === '演示已发布').sort((a, b) => b.date.localeCompare(a.date))
}

export function readPublicNewsPreview(raw: string | null) {
  if (!raw) return publishedNews(initialNews)
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('articles' in data) || !Array.isArray(data.articles)) return publishedNews(initialNews)
    // Public cache deliberately has no private drafts, permission data or logs.
    return publishedNews(data.articles.filter(isNewsArticle).slice(0, 100))
  } catch { return publishedNews(initialNews) }
}
