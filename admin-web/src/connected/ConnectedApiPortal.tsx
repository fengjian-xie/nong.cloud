import { useEffect, useState } from 'react'
import { BrandLockup } from '../brand/BrandLockup'
import { request } from './client'
import './connected.css'
const endpoints = [
  ['认证与多身份', 'POST /auth/password/login；GET /users/me；POST /identities/{id}/switch；POST /auth/logout'],
  ['地块', 'GET/POST /plots；GET/PATCH /plots/{id}；POST /admin/plots/{id}/verify'],
  ['手工记录', 'GET/POST /farm-activities'],
  ['农事服务', 'GET /service-standards；GET/POST /service-requests；POST /service-requests/{id}/claim；GET /work-orders；POST /work-orders/{id}/{check-in|submit|accept|dispute}'],
  ['帮助与消息', 'GET/POST /help-tickets；POST /help-tickets/{id}/reply；GET /messages；POST /messages/{id}/read'],
  ['农事卡', 'GET /cards；GET/PUT /cards/{id}/configuration；POST /cards/{id}/events（未验证证据）'],
  ['卡片软件生命周期','GET/POST /card-requests；POST /card-requests/{id}/cancel；POST /admin/card-requests/{id}/{review|register}；POST /cards/{id}/lifecycle/{report-loss|restore|retire}；GET /cards/{id}/{events|binding-history|configuration-history}。收费仅报价，设备与实物未确认。'],
  ['身份申请', 'GET /role-catalog；GET/POST /identity-applications；POST /admin/identity-applications/{id}/review'],
  ['内容配置', 'GET/POST /admin/news；POST /admin/news/{id}/{publish|withdraw}；GET /admin/social-accounts；PUT /admin/social-accounts/{channel}'],
  ['公开资料', 'GET /public/news；GET /public/site-config'],
  ['管理审计', 'GET /admin/subjects；GET /admin/audit-logs；GET /tenants/current/config'],
  ['会员与准入','GET /membership-plans；POST /admin/membership-plans；GET/POST /memberships；POST /admin/memberships/{id}/review。收费方案不伪造付款生效。'],
  ['中心递归管理','GET/POST /admin/centers；POST /admin/centers/{id}/status；POST /admin/service-standards。云端登记不等于工商设立。'],
  ['采购交接','GET/POST /stock-batches；GET/POST /trade-orders；POST /trade-orders/{id}/{seller-confirm|dispatch|accept|dispute|cancel}；GET /trade-orders/{id}/handovers。库存与履约实际落库。'],
  ['商户及分账计划','GET/POST /admin/merchants；GET/POST /admin/settlement-plans。资金执行尚未接通，execute 返回503；不提供小程序财务入口。'],
]
export default function ConnectedApiPortal() {
  const [status, setStatus] = useState('检查本地接口…')
  useEffect(() => { const previous = document.title; document.title = '乡桥 · 本地API联调'; return () => { document.title = previous } }, [])
  useEffect(() => { const c = new AbortController(); request<{ database: string; status: string }>('/health', { signal: c.signal }).then(data => setStatus(data.database === 'postgresql' && data.status === 'up' ? 'PostgreSQL 已连接' : '健康状态异常')).catch(() => { if (!c.signal.aborted) setStatus('接口未连通；没有使用模拟状态替代') }); return () => c.abort() }, [])
  return <div className="connected-page"><header><BrandLockup context="乡桥本地API联调" domain="api.nong.cloud"/><span className="connected-badge">{status}</span></header><h1>已实现接口</h1><p className="connected-boundary">这里描述运行中的本地接口。尚未向外部客户开放生产API；原型AppKey沙箱不参与此联调，不能创建真实客户端凭据或执行支付。</p><section className="connected-results">{endpoints.map(([title, routes]) => <article key={title}><h2>{title}</h2><p>{routes}</p></article>)}</section><h2>通用约束</h2><p>基础路径 /api/v1。网页 HttpOnly Cookie + 精确 Origin，小程序 Bearer。业务写入必须带 Idempotency-Key，版本操作必须带 If-Match。所属中心、主体及权限由服务端身份决定。</p><p>失败返回对应 HTTP 状态、message、errorCode 和 traceId；绝不回退到 mock。完整字段契约见仓库 contracts/local-backend-v1.md。</p><p>微信登录需服务端配置，设备事件仅是未验证证据。库存与采购交接、会员申请及分账计划已落库；成本、合同、摄像头、真实支付分账与第三方同步仍未完成，不返回模拟成功。</p></div>
}
