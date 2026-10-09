import { useState } from 'react'
import { cardFeatures, cardScenarios } from './community'
import { homeAsset } from './site'
import { SectionTabs } from './SectionTabs'
import { farmerFeePolicy } from '../pricing'

const scenarioNames = cardScenarios.map(scenario => scenario.name)

export function CardSection() {
  const [active, setActive] = useState(0)
  const scenario = cardScenarios[active]
  return <section id="card" className="xq-wrap xq-section xq-card-section" aria-labelledby="card-title">
    <div className="xq-section-heading xq-centered"><h2 id="card-title"><span className="xq-card-title-line">一张农事卡，</span><span className="xq-card-title-line">留下一季的耕耘。</span></h2><p>让年长农户少操作，让真实农事有记录。</p></div>
    <p className="xq-draft-notice">研发方案示意，非已量产设备；尺寸、续航、定位与防水能力以工程样机验证为准。</p>
    <p className="xq-card-pricing">{farmerFeePolicy}</p>
    <div className="xq-card-layout">
      <figure><img src={homeAsset('xiangqiao-card-vi-v1.jpg')} alt="乡桥农事记录卡概念设计：开工、收工、A、B、C单排五键，指示灯与NFC；乡桥农业VI标志，非实物照片" width="1536" height="1024" loading="lazy"/><figcaption>农事记录卡 · 概念设计，非实物照片</figcaption></figure>
      <div><ol className="xq-numbered-list">{cardFeatures.map(([title, body], index) => <li key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol><p className="xq-caption">A/B/C可在官网或小程序设置。轻薄与30天续航为设计目标，待验证。</p></div>
    </div>
    <SectionTabs id="card-scenario" label="农事卡应用场景" items={scenarioNames} active={active} onChange={setActive}/>
    <div id="card-scenario-panel" role="tabpanel" aria-labelledby={`card-scenario-tab-${active}`} tabIndex={0}>
      <ol className="xq-card-steps">{scenario.steps.map((step, index) => <li key={step}><span>{index + 1}</span><h3>{step}</h3>{index < scenario.steps.length - 1 && <i aria-hidden="true">→</i>}</li>)}</ol><p className="xq-scenario-copy">{scenario.description}</p>
    </div>
  </section>
}
