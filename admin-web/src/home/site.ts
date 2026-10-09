import { platform } from '../platform'
import { farmerFeePolicy } from '../pricing'

export const homeTitle = '乡桥农事中心 · 让农事有记录，让好产品被看见'
export const homeDescription = `乡桥农业有限公司，连接种植户、合作社、农服机构与采购商。以农事记录体系、产业服务协同、云农场与产销连接，扎根福安葡萄产业带。${farmerFeePolicy}`
export const isHomeSiteHost = (hostname: string) => ['nong.cloud', 'www.nong.cloud'].includes(hostname.toLowerCase().replace(/\.$/, ''))
export const isHomePreviewPath = (pathname: string) => pathname === '/home-preview' || pathname.startsWith('/home-preview/')
export const homeAsset = (filename: string) => `${import.meta.env.BASE_URL}brand/${filename}`
export const cloudFarmEntryReady = true
export const workEntryReady = true
export const platformEntries = [
  { name: '乡桥农事中心', domain: 'nong.cloud', description: '平台总入口：业务介绍、公司介绍、农事记录体系与产业带服务。', status: '乡桥农业有限公司 · 福安市乡桥农事综合服务有限公司。', href: '#business', action: '了解乡桥业务体系', business: 0 },
  { name: '管理后台', domain: 'm.nong.cloud', description: '九个业务中心：运营、主体、生产、农事服务、产品交易、核验追溯、客户内容、财务结算、平台安全。', status: '后台按业务整合；真实对象授权与跨端业务接口待接入。', href: platform.admin, action: '进入后台演示' },
  { name: '乡桥农场', domain: 'nc.nong.cloud', description: '面向消费者：浏览地块影像、了解认养方案、申请签约、跟踪生产记录。', status: '交互演示入口；真实直播与正式合同待接入。', href: platform.farm, action: '进入乡桥农场', business: 2 },
  { name: '开放API', domain: 'api.nong.cloud', description: '面向开发者与合作机构：接口目录、接入应用和联调体验。', status: '文档与本地沙箱演示；生产接口未开放。', href: platform.api, action: '查看接口文档' },
  { name: '用户工作台', domain: 'work.nong.cloud', description: '面向种植户、合作社、采购商及农资、农机、农服、植保等主体；一个账号支持多个已授权身份。', status: '主体端演示；正式权限由服务端核验，农户免平台服务费，农事卡另行收费。', href: workEntryReady ? platform.work : '#business', action: workEntryReady ? '进入用户工作台' : '查看主体端规划' },
] as const

export const businesses = [
  {
    name: '农事记录体系', title: '一张卡，记录一季耕耘。',
    description: '按键记录作业，离线保存信息。规划通过GPS定位、蓝牙与NFC同步，让农事采集贴近农户习惯；A、B、C作业键可由合作社或子女在官网、小程序设置。',
    status: '农事卡处于工程样机规划阶段，硬件能力以实测为准。',
    image: 'fuan-vineyard.jpg', alt: '福安葡萄园大棚航拍，用户提供的产区资料照片',
    steps: ['作业采集', '地块档案', '记录核验', '产销连接'],
    detailTitle: '乡桥农事记录认证体系',
    detail: '记录来源可核验、修改留痕、授权可追溯。种植信息变更以照片、视频辅助核验；结合当地人工和农资行情估算生产成本，帮助农户自主定价。该体系不替代绿色食品等法定认证。',
  },
  {
    name: '产业服务协同', title: '把需要的服务，送到田间。',
    description: '连接农资商、农机手、农服与植保团队，把服务订单与地块、作业记录衔接。规划通过NFC衔接农事卡，减少重复录入。',
    status: '服务中心与设备联动分阶段建设，尚未开放线上服务下单。',
    image: 'fuan-vineyard.jpg', alt: '福安葡萄产业带的连片大棚航拍',
    steps: ['服务匹配', '作业协同', '检测对接', '记录归档'],
    detailTitle: '一个产业带，一张服务网络',
    detail: '汇集冷库、加工车间、农机与服务队伍的位置和可用情况；对接专业土壤检测机构，将检测结果与施肥建议归入地块档案。后续研究经授权的设备运行监测，不以单一用电数据判断真实经营情况。',
  },
  {
    name: '乡桥云农场', title: '相隔千里，也能看见生长。',
    description: '从地块档案和农事记录开始，逐步接入摄像头、环境传感器与田间网络，让远方的消费者了解前端生产、认购应季产品。',
    status: '云农场交互演示已开放；真实摄像头与正式交易待接入，当前不收款。',
    image: 'fuan-farm-aerial-v1.jpg', alt: '用户提供的农场航拍图：连片葡萄大棚与田间道路，不作为摄像头已安装证明',
    steps: ['了解产地', '查看记录', '应季认购', '产地履约'],
    detailTitle: '让种植者与消费者更近一点',
    detail: '消费者认购不收平台服务费，仍需支付产品价款；在种植户授权范围内，子女可以同步了解农事情况、讲述产地记录。摄像头展示与数据公开尊重生产者和入镜人员的隐私。',
  },
  {
    name: '采购与库存共享', title: '好产品，遇见合适的采购商。',
    description: '规划产品成熟一览图，让采购商了解哪里有货、什么时候成熟、预计规模多大。让分拣余货、不同等级产品与加工需求找到彼此。',
    status: '供需信息服务、交易与收费规则尚未正式上线。',
    image: 'fuan-grapes.jpg', alt: '葡萄园中生长的紫色葡萄特写',
    steps: ['成熟预估', '供需匹配', '库存共享', '采购协同'],
    detailTitle: '有依据的采购，更合理的定价',
    detail: '采购信息服务探索会员或按条查看，具体收费另议；预计产量和生产成本仅供参考，不承诺保底收购价。乡桥也可向加入合作社的种植户收购产品，再组织销售，价格与履约责任另行约定。',
  },
] as const
