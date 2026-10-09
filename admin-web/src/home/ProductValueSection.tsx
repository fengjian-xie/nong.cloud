import { ArrowUpRight, FileCheck2, CalendarDays, BookOpenText, Calculator, Boxes, History } from 'lucide-react'
import './product-value.css'
const features = [
  { icon: FileCheck2, title: '一批产品，一份履历', copy: '核验记录、检测来源、采收与交接分开标注；缺项如实说明。' },
  { icon: CalendarDays, title: '采收前，让买家看见', copy: '预计成熟窗口与供货规模区间，便于关注和询价；不是现货承诺。' },
  { icon: BookOpenText, title: '这一季的产季记录', copy: '首先记录产季事实，可选择用于产品介绍；子女在授权范围代办，农户确认后再公开。' },
  { icon: Calculator, title: '看清经营净收益', copy: '把包装、冷链、配送和家庭劳动算清楚，帮助自主定价；私人成本不公开。' },
  { icon: Boxes, title: '按等级，匹配去处', copy: '鲜食、加工和尾货需求分开；异常货隔离，质量与货权独立验收。' },
  { icon: History, title: '让经验，跨产季积累', copy: '比较已有产量与经营档案，缺项不造数据，不把相关性当作技术因果。' },
]
export function ProductValueSection({ preview = false }: { preview?: boolean }) {
  return <section id="product-value" className="xq-wrap xq-section xq-product-value" aria-labelledby="product-value-title"><div className="xq-section-heading"><span>FROM RECORDS TO TRUST</span><h2 id="product-value-title">让认真劳作，有依据；让好产品，被看见。</h2><p>农事卡是起点，批次对应、授权公开和真实交付才让记录产生价值。</p></div><div className="xq-product-grid">{features.map(({ icon: Icon, title, copy }) => <article key={title}><Icon size={25}/><h3>{title}</h3><p>{copy}</p></article>)}</div><div className="xq-product-links"><a href={preview ? '/cloud-preview?view=products' : 'https://nc.nong.cloud/?view=products'} target="_blank" rel="noopener noreferrer">查看产品履历原型<ArrowUpRight size={16}/></a><a href="https://work.nong.cloud/" target="_blank" rel="noopener noreferrer">进入主体工作台<ArrowUpRight size={16}/></a></div><p className="xq-image-note">上述功能为交互原型与建设方向；不承诺产品涨价、质量认证、融资或补贴。网页与小程序真实数据尚待统一后端接入。</p></section>
}
