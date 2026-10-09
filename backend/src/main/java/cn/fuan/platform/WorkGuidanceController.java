package cn.fuan.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

/** Read-only process guidance. It neither grants permissions nor certifies qualifications. */
@RestController @RequestMapping("/api/v1")
public class WorkGuidanceController {
 private record Step(String module,String title,String detail,String permission) {}
 private Step step(String module,String title,String detail,String permission){return new Step(module,title,detail,permission);}
 @GetMapping("/work-guidance") public Object guidance(HttpServletRequest r){
  AuthService.Actor a=AccessFilter.actor(r);
  String title=switch(a.role()){
   case "farmer","cooperative"->"先记录、再交接；平台服务不向种植主体收费";
   case "buyer"->"先核对货源与验收约定，再锁定库存";
   case "machine"->"先核对机具、地块和作业条件，再接单";
   case "team","protection"->"按冻结标准履约，由种植主体独立验收";
   case "supplier"->"销售、交付和实际施用是三种不同记录";
   case "center_admin"->"按中心治理，审批不能替代当事人验收";
   default->"只在当前已批准身份的权限内办理业务";
  };
  List<Step> candidates=List.of(
   step("applications","添加业务身份","一个账号可申请多种身份，批准后切换；当前身份不能替另一个主体操作。","application.create"),
   step("cardRequests","办卡与补卡","均100元/张；补卡先挂失。费用报价、云端登记与实物交付分开；待审核申请可取消。","cards.request"),
   step("records","补充农事记录","人工补录保留来源；卡片上传只作采集证据。不要将记录直接标为绿色食品或质量认证。","records.write"),
   step("requests","发起或取消服务需求","先选择已核验地块与已发布标准。仅自己发起且未被接单的需求可取消；接单后需协商。","services.request"),
   step("orders","服务履约与验收","核对冻结标准、日期、作业范围和安全条件；说明机具或投入品及异常。接单、开工、完工、独立验收分别留痕。","services.claim"),
   step("stock","发布产品批次","数量统一千克、单价分/千克。等级目前是卖方自报，不是检测结论；货权、采收时间、保存条件和验收口径仍需双方核对。","stock.write"),
   step("memberships","申请会员或撤回","方案费用由服务端冻结。收费方案未付款不生效；待审核/待付款申请可撤回，不等于退款；已生效会员不在此取消。","membership.apply"),
   step("trades","采购与交接","有效会员方可查库存与采购。发货后由买方独立验收；数量、等级、损耗和凭据应在交接说明中写明。","trade.buy"),
   step("standards","发布执行标准","明确作业范围、机具/人员要求、投入品、天气与安全限制、完工凭据和争议处置。新版本不覆盖旧工单标准。","center.manage"),
   step("centers","管理下级中心","各中心业务隔离；停用上级会阻止下级访问。软件登记不代表工商设立或行政授权。","branches.manage"),
   step("tickets","请求中心帮助","写明业务编号、当前身份和问题；不要提交密码或支付密钥。收到客服回复不代表采购争议或退款已处理。","help.create")
  );
  List<Map<String,Object>> steps=new ArrayList<>();
  for(Step s:candidates)if(a.permissions().contains(s.permission()))steps.add(Map.of("module",s.module(),"title",s.title(),"detail",s.detail()));
  List<String> checks=switch(a.role()){
   case "farmer","cooperative"->List.of("不要重复录入可由服务方提供的信息；代办须有明确授权，家庭授权功能尚未接通。","验收核对实际作业范围、投入品和异常，不凭按卡次数判断工作质量。","产季记录可辅助议价，但估算成本和溢价不是保证收购价。");
   case "buyer"->List.of("库存为卖方登记的可用量，不等于实时产量或已检测合格数量。","B级等等级必须约定口径；核对货权、采收/分拣时间、存储条件、计量及抽检办法。","争议后库存继续锁定，人工调解、退货退款流程尚未接通；不要重复下单处理同一争议。");
   case "machine"->List.of("现版本尚未自动核验驾驶/操作资质、机具能力或作业适配，不能因看到接单按钮就认为有资格。","接单前核对地形、通行、天气、服务面积、工期及费用约定；不要接不具备条件的任务。","按卡、开工登记和工时记录不能替代完工证明，也不直接结算服务费。");
   case "team","protection"->List.of("核对人员与服务能力；植保投入品、适用作物、用量及安全间隔须另行核验，系统未自动判定合规。","完工说明写清范围、投入品、异常及未完成项；由不同自然人的种植主体独立验收。","争议不能由中心代替当事人强行验收，协商/调解闭环尚待接通。");
   case "supplier"->List.of("农资商身份和会员申请已接通，但农资销售/批号/交付台账尚未接通。","未来需记录商品、生产厂家、批号、规格、有效期、数量单位、购买主体及交付凭据。","购买不等于已使用；种植户确认交付不等于投入品质量认证，也不能据此生成施肥或用药记录。");
   case "center_admin"->List.of("先核对准入证据与费用承担方；身份审核不能当作法定资质审批。","跨中心明细和政府数据授权尚未接通，不通过赋管理员权限替代政府只读权限。","政府报表须区分录入、核验、缺失与异常，并先确定用途、统计口径和最小披露范围。");
   default->List.of("未接通的功能不能使用演示数据作为真实交易、生产或验收结果。","不共享账户密码；申请新身份与获得业务授权是两个环节。");
  };
  List<Map<String,Object>> fees=new ArrayList<>();
  if(Set.of("farmer","cooperative").contains(a.role())){
   fees.add(Map.of("label","种植主体平台服务费","feeFen",0,"note","不收平台会员服务费"));
   fees.add(Map.of("label","办卡/补卡报价","feeFen",10000,"note","每张100元；支付尚未接通，不代表已收款"));
  }
  return ApiSupport.envelope(Map.of("version","stakeholder-v1","identityId",a.identityId(),"role",a.role(),"title",title,"steps",steps,"checks",checks,"fees",fees,"limits",List.of("本指引仅说明已接通的软件流程，不授予角色或数据权限。","硬件、支付分账、质量认证与政府数据授权不能用软件状态代替。")),r);
 }
}
