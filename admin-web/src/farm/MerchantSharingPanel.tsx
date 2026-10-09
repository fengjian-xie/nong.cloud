import { useState } from 'react'
import { Panel, Tag } from './ui'
import { sharingPreview } from './sharing'

export function MerchantSharingPanel() {
  const [view, setView] = useState('商户绑定')
  const [amount, setAmount] = useState('')
  const [fee, setFee] = useState('')
  const [limit, setLimit] = useState('')
  const [result, setResult] = useState<ReturnType<typeof sharingPreview> | null>(null)
  const [error, setError] = useState('')
  function reset() { setResult(null); setError('') }
  return <Panel title="支付商户与分账管理" caption="仅管理后台 · 服务商与中心特约商户，不是普通工作角色权限">
    <div className="farm-body">
      <p className="farm-note">用户已提供服务商号和中心特约商户号的开通情况；本版未录入真实号、未校验支付权限。无支付请求、转账或实际分账。</p>
      <label>管理模块 <select aria-label="支付管理模块" value={view} onChange={e => setView(e.target.value)}>{['商户绑定','分账测算','对账与退款'].map(tab => <option key={tab}>{tab}</option>)}</select></label>
      {view === '商户绑定' ? <>
        <h3>按实际销售主体路由订单</h3>
        <p>乡桥农业有限公司：微信支付服务商（sp_mchid）；福安市乡桥农事综合服务有限公司：中心特约商户（sub_mchid）。号值和授权状态待财务后台安全配置。</p>
        <p>中心销售订单由对应特约商户收款；乡桥按合同及已授权接收方规则分取约定服务费，余款留在该中心。自营销售按真实销售主体处理，跨中心购物拆分订单。</p>
        <Tag tone="amber">绑定关系、接收方与批准额度：待接口核验</Tag>
        <p>密钥和证书仅存服务端。平台财务与各中心财务分别授权；种植户、合作社及农服身份不自动获得财务权限。禁止把钱先归集到私人账户再人工分配。</p>
      </> : view === '分账测算' ? <>
        <h3>中心订单分账测算（非生效规则）</h3>
        <form className="farm-form" onSubmit={e => { e.preventDefault(); try { setResult(sharingPreview(amount, fee, limit)); setError('') } catch (error) { setResult(null); setError(error instanceof Error ? error.message : '测算失败') } }}>
          <div className="farm-form-grid">
            <label>示例订单实收 / 元<input required type="text" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); reset() }}/></label>
            <label>合同约定服务费示例 / 元<input required type="text" inputMode="decimal" value={fee} onChange={e => { setFee(e.target.value); reset() }}/></label>
            <label>中心批准上限示例 / %<input required type="text" inputMode="decimal" value={limit} onChange={e => { setLimit(e.target.value); reset() }}/></label>
          </div><button className="secondary-button">计算本地示例</button>
        </form>
        {error && <p className="farm-warning" role="alert">{error}</p>}
        {result && <div className="farm-note" role="status">仅为测算：订单金额 {(result.totalFen/100).toFixed(2)}元；乡桥约定服务费 {(result.platformFen/100).toFixed(2)}元；中心账面余款 {(result.centerFen/100).toFixed(2)}元。未扣渠道手续费、退款及历史分账，非可执行额度或结算净额；不代表已付款，不产生实际分账。</div>}
        <p>本地输入不是微信批准凭证。真实执行须核对该支付单累计分账、剩余待分金额、中心额度、接收方授权、合同及规则版本，并独立审核。农户农事记录平台费为0；办卡/补卡100元属于卡片价款，不默认从农户售货款扣平台费。</p>
      </> : <>
        <h3>支付、分账、退款分别核对</h3>
        <ol><li>收到已验签的支付成功通知，持久化去重后建立订单实收账。</li><li>按订单绑定的销售主体、规则快照与授权接收方发起分账，查询异步结果；受理不等于成功。</li><li>处理未分账余款解冻，逐笔核对渠道流水；分账成功不等于银行提现到账。</li><li>退款前核对已分账金额及分账回退权限，执行相应回退与退款流程；部分退款、失败重试和争议保留审核记录。</li></ol>
        <p>同一支付单、分账单、退款单使用独立幂等编号，禁止重复收费。正式财务操作仅服务端执行，本原型无执行按钮。</p>
      </>}
    </div>
  </Panel>
}
