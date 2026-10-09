import { useState } from 'react'
import { applicationRoles, memberGroups, members } from './community'
import { applicationChecklist } from './standards'
import { downloadText } from './download'
import { SectionTabs } from './SectionTabs'
import { farmerFeePolicy } from '../pricing'

export function MembersSection() {
  const [group, setGroup] = useState(0)
  const [selected, setSelected] = useState<string[]>(['grower'])
  const [area, setArea] = useState('福安市')
  const [message, setMessage] = useState('')
  const [checklist, setChecklist] = useState('')
  function toggle(id: string) {
    setSelected(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id])
    setChecklist('')
    setMessage('')
  }
  function generate() {
    if (!selected.length) { setMessage('请至少选择一种身份，再生成申请清单。'); return }
    const standardIds = applicationRoles.filter(role => selected.includes(role.id)).flatMap(role => [...role.standards])
    setChecklist(applicationChecklist(standardIds, area))
    setMessage('清单已在本页生成，尚未提交到农事中心。')
  }
  return <section id="members" className="xq-wrap xq-section xq-members" aria-labelledby="members-title">
    <div className="xq-section-heading xq-centered"><h2 id="members-title">把专业的人，连接成服务网络。</h2><p>农事中心成员架构，按项目提供的筹建资料整理。</p><p className="xq-caption">名单不代表已通过准入；空缺资料待补充，不公开个人联系方式。</p></div>
    <SectionTabs id="member-group" label="农事中心成员分组" items={memberGroups} active={group} onChange={setGroup}/>
    <div id="member-group-panel" role="tabpanel" aria-labelledby={`member-group-tab-${group}`} tabIndex={0} className="xq-table-scroll">
      <table className="xq-member-table"><caption className="xq-sr-only">{memberGroups[group]} · 筹建资料名单</caption><thead><tr><th scope="col">负责人</th><th scope="col">团队或主体</th><th scope="col">业务</th><th scope="col">服务范围</th></tr></thead><tbody>{members.filter(member => member.group === group).map((member, index) => <tr key={`${member.service}-${index}`}><td>{member.name}</td><td>{member.organization}</td><td>{member.service}</td><td>{member.area}</td></tr>)}</tbody></table>
    </div>
    <p className="xq-caption xq-member-source">来源：成员架构.xlsx。称号与资质不作未经核验的公开背书。</p>
    <div id="join" className="xq-join-layout" aria-labelledby="join-title">
      <div><h2 id="join-title">一起把服务，做在田间。</h2><p>种植户、合作社、服务团队和采购主体都可准备加入申请。一个账号可申请多个身份，每个身份单独核验。</p><ol className="xq-join-steps">{[['选择身份', '根据自身情况，选择需要申请的身份类型。'], ['准备资料', '按清单准备相应的资料与文件。'], ['中心核验', '正式受理入口接入后，提交资料并由中心核验。'], ['按权限协作', '核验通过后，按相应权限参与服务与项目协作。']].map(([title, body], index) => <li key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></div>
      <div className="xq-join-preparation"><h3>申请加入 · 资料准备</h3><fieldset><legend className="xq-sr-only">选择申请身份，可多选</legend><div className="xq-role-checks">{applicationRoles.map(role => <label key={role.id}><input type="checkbox" checked={selected.includes(role.id)} onChange={() => toggle(role.id)}/>{role.label}</label>)}</div></fieldset>
        <label className="xq-select-label" htmlFor="join-area">计划服务区域</label><select id="join-area" value={area} onChange={event => { setArea(event.target.value); setChecklist(''); setMessage('') }}><option>福安市</option><option>宁德市其他县域</option><option>福建省其他地区</option><option>其他地区（需另行说明）</option></select>
        <p className="xq-caption">已选择{selected.length}类身份；生成对应准入资料清单。</p><button className="xq-solid-button" type="button" onClick={generate}>生成申请清单</button><a className="xq-underlined-link" href="#standards">查看准入标准</a>
        <p className="xq-caption">当前不在线收集个人资料，也不提交到中心；生成清单不等于申请已受理。正式受理入口待接入。</p>
        <p className="xq-caption">收费说明：{farmerFeePolicy}</p>
        <p role="status" className="xq-join-status">{message}</p>
        {checklist && <details className="xq-checklist" open><summary>查看已生成的申请资料清单</summary><pre>{checklist}</pre><button className="xq-download-button" type="button" onClick={() => downloadText('乡桥加入申请资料清单.txt', checklist)}>下载申请清单</button></details>}
      </div>
    </div>
  </section>
}
