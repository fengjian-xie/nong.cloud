// Local help prototype; never calls a hotline or submits to an external center.
const categories = ['农事卡与同步', '账号与代办', '农事服务与验收', '土壤与种植问题', '收购与库存', '农场认购与售后', '其他问题与投诉']
const methods = ['站内答复', '电话回访意向（待接入）']
const faqs = [
 { id:'card', title:'卡片没有网络，记录会丢吗？', answer:'目标方案是卡片离线保存、手机蓝牙读取、服务器持久化后回执。当前只演示，没有真实硬件同步；办卡和补卡均100元。' },
 { id:'identity', title:'我既种地又提供农服，需要两个账号吗？', answer:'不需要。一次登录后切换已批准的主体与身份。添加角色和子女代办分别审核，切换身份不会扩大权限。' },
 { id:'service', title:'服务完工后有争议怎么办？', answer:'保留工单、现场情况与必要证据，申请独立复核。服务方不能自验收，客服受理也不代表退款或验收已完成。' },
 { id:'soil', title:'种植或土壤问题能找谁？', answer:'帮助中心可转交农技人员或检测机构；专业建议需结合实际资料确认，客服不自动开具施肥或用药方案。' },
 { id:'farm', title:'农场镜头、认购或配送有问题怎么办？', answer:'关联农场和订单说明情况。当前照片不是直播、意向不是合同；质量、减产、交付和退款按真实订单及独立流程处理。' },
 { id:'fee', title:'寻求帮助要付平台服务费吗？', answer:'种植户和消费者不收平台服务费；卡片、实际产品、农资或农服费用另行明确。帮助登记不产生支付或分账。' }
]
function createTicket(context, description, categoryIndex, methodIndex, count) {
 if(!context) throw new Error('请先进入演示账号，常见问题可游客查看。')
 const text=String(description||'').trim(), category=categories[categoryIndex], method=methods[methodIndex]
 if(!category || !method || text.length<8 || text.length>1000) throw new Error('请选择问题类型，填写8–1000字测试说明。')
 if(/1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text)) throw new Error('演示请勿填写真实手机号、邮箱或其他隐私资料。')
 return { id:'help-local-'+Date.now()+'-'+count, ownerAccount:context.account.id, ownerIdentity:context.identity.id, org:context.identity.org, role:context.identity.label, category, method, description:text, status:'本地待受理', timeline:['本地登记：未提交真实中心', '待后端接入后受理与分派'], reply:'' }
}
function visibleTickets(context, tickets) { return context&&Array.isArray(tickets)?tickets.filter(t=>t&&t.ownerAccount===context.account.id&&t.ownerIdentity===context.identity.id&&typeof t.id==='string'&&typeof t.description==='string'&&categories.includes(t.category)&&methods.includes(t.method)&&t.status==='本地待受理'&&Array.isArray(t.timeline)&&t.timeline.every(line=>typeof line==='string')):[] }
module.exports = { categories, methods, faqs, createTicket, visibleTickets }
