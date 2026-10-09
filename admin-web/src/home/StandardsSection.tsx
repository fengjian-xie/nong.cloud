import { useState } from 'react'
import { acceptanceTemplate, admissionBaseline, fullStandardsText, legalReferences, roleStandards, stageStandards, standardsNotice, standardsVersion } from './standards'
import { downloadText } from './download'
import { SectionTabs } from './SectionTabs'
import { homeAsset } from './site'

const categories = ['准入标准', '角色执行', '环节验收'] as const

export function StandardsSection() {
  const [category, setCategory] = useState(0)
  const [roleId, setRoleId] = useState('grower')
  const [stageId, setStageId] = useState('admission')
  const role = roleStandards.find(item => item.id === roleId)!
  const stage = stageStandards.find(item => item.id === stageId)!
  const details = category === 2 ? [['责任主体', stage.operator], ['前置与执行', stage.before], ['凭证记录', stage.evidence], ['验收标准', stage.criteria], ['验收责任', stage.reviewer], ['异常处理', stage.exception]] : category === 0 ? [['需准备', role.admission], ['执行要求', role.execution], ['验收依据', role.acceptance], ['不通过时', role.exception]] : [['执行要求', role.execution], ['所需记录', role.records], ['验收依据', role.acceptance], ['验收责任', role.reviewer], ['异常处理', role.exception]]
  return <section id="standards" className="xq-wrap xq-section xq-standards" aria-labelledby="standards-title">
    <div className="xq-section-heading"><h2 id="standards-title">把每一步，做成可验收的标准。</h2><p>准入有依据，执行有记录，验收有凭证。</p></div>
    <p className="xq-draft-notice">{standardsVersion}。{standardsNotice}</p>
    <SectionTabs id="standard-category" label="执行标准类别" items={categories} active={category} onChange={setCategory}/>
    <div id="standard-category-panel" role="tabpanel" aria-labelledby={`standard-category-tab-${category}`} tabIndex={0} className="xq-standards-layout">
      <div><h3>{category === 2 ? '验收共同底线' : '共同准入底线'}</h3><ol className="xq-numbered-list">{admissionBaseline.map(([title, body], index) => <li key={title}><span>{index + 1}</span><div><h4>{title}</h4><p>{body}</p></div></li>)}</ol></div>
      <div className="xq-standard-detail">
        {category === 2 ? <><label className="xq-select-label" htmlFor="standard-stage">查看环节标准</label><select id="standard-stage" value={stageId} onChange={event => setStageId(event.target.value)}>{stageStandards.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></> : <><label className="xq-select-label" htmlFor="standard-role">查看角色标准</label><select id="standard-role" value={roleId} onChange={event => setRoleId(event.target.value)}>{roleStandards.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></>}
        <h3>{category === 2 ? stage.name : `${role.name}${category === 0 ? '准入' : '执行'}`}</h3><dl>{details.map(([title, body]) => <div key={title}><dt>{title}</dt><dd>{body}</dd></div>)}</dl><p className="xq-caption">身份可兼任，委托方与服务方的验收责任不能混同。</p>
      </div>
    </div>
    <div className="xq-standard-downloads"><button type="button" className="xq-download-button" onClick={() => downloadText('乡桥准入与执行验收标准-草案v0.1.txt', fullStandardsText())}>↓ 下载完整标准草案</button><button type="button" className="xq-download-button" onClick={() => downloadText('乡桥通用验收记录模板-草案v0.1.txt', acceptanceTemplate)}>↓ 下载验收记录模板</button></div>
    <p className="xq-caption">法规依据与具体产品参数另行核验；糖度、等级和冷链温度按品种、用途及合同约定，不使用统一硬编码阈值。</p>
    <details className="xq-legal-references"><summary>查看法规依据</summary><ul>{legalReferences.map(ref => <li key={ref.url}><a href={ref.url} target="_blank" rel="noreferrer">{ref.title} ↗</a><p>{ref.note}</p></li>)}</ul><p className="xq-caption">按2026-10-04可查公开依据整理；正式经营应向当地主管部门核实具体适用范围及后续更新。</p></details>
    <div className="xq-project-reference" aria-labelledby="project-reference-title">
      <h3 id="project-reference-title">模块方案与项目支持参考</h3>
      <p>六大模块覆盖农事记录与地块、记录核验、产业服务、产销库存、消费者农场及数据API。项目支持可研究水果提质增效、数字农业基地、品牌农业、数字乡村、设施农业与样机研发等方向。</p>
      <div className="xq-standard-downloads"><a className="xq-download-button" href={homeAsset('xiangqiao-modules-20261005.txt')} download="乡桥平台模块方案-2026-10-05.txt">↓ 下载完整模块方案</a><a className="xq-download-button" href={homeAsset('xiangqiao-project-support-20261005.txt')} download="乡桥项目支持与补贴清单-2026-10-05.txt">↓ 下载项目支持与补贴清单</a></div>
      <p className="xq-caption">按2026-10-05公开资料整理；适配建议不代表正在受理、具备资格或已获补助，具体窗口与条件须向福安、宁德主管部门核实。补贴申报管理为待开发需求，本网站不受理政府项目申报。</p>
    </div>
  </section>
}
