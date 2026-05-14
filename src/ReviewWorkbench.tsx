import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  CloudUpload,
  FileImage,
  FileText,
  Gavel,
  Loader,
  Loader2,
  Scale,
  Shield,
  Square,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

/** 与 public 目录下文件名一致，由 Vite 静态托管 */
const CONTRACT_PDF_URL = "/contract.pdf";
const posterImageUrl = "/poster.jpg";

type FileFormat = "pdf" | "jpg";
type RiskLevel = "high" | "medium" | "low";

/** 相对 PDF 单页尺寸的句级高亮（百分比，与 react-pdf 渲染页对齐） */
type PdfRect = {
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
};

type ReviewItem = {
  id: string;
  level: RiskLevel;
  title: string;
  description: string;
  /** 点击意见时跳转的页码 */
  page: number;
  /** 真实 PDF：句级框（可多框对应一句内多段或相邻短句） */
  pdfRects?: PdfRect[];
  /** 无 PDF 时的示意高亮 */
  highlight?: { top: number; left: number; width: number; height: number };
  /** 关联的法规依据 */
  laws?: { name: string; article: string }[];
  /** 实质性意见/非实质性建议，默认由 level 推导 */
  materiality?: "实质性意见" | "非实质性建议";
};

/** OCR 分段：hitId 与审查意见 id 一致，用于句级定位与滚动 */
type OcrSegment = { text: string; hitId?: string };

type ExplorerFile = {
  id: string;
  name: string;
  format: FileFormat;
  items: ReviewItem[];
  aiConfidence: number;
  ocrText?: string;
  ocrSegments?: OcrSegment[];
  sourceUrl?: string;
};

/** 与 PDF 原文对齐的节选；hitId 对应右侧意见 id */
const CONTRACT_OCR_SEGMENTS: OcrSegment[] = [
  { text: "【产品说明书首页】\n\n" },
  { text: "中银理财-稳富稳健直通车 A202514\n产品说明书\n产品代码：WFSJ202514\n产品登记编码：Z7001025001218\n\n" },
  { text: "一、理财非存款、产品有风险、投资须谨慎。", hitId: "r1" },
  { text: "投资者（客户）应本着\"充分了解风险、自主选择购买\"的原则自愿将其合法所有的资金用于认（申）购中银理财有限责任公司（以下简称\"中银理财\"）发行的理财产品。本理财产品有投资风险，不保证资金本金和理财收益，如出现所投资的金融资产市场价格下跌、未按时足额支付本金及/或收益或提前终止等不利情况，则将出现理财收益为零或本金损失（甚至全部损失）的情形，并存在被中银理财提前终止的可能，请充分认识投资风险，谨慎投资。\n\n" },
  { text: "二、理财产品过往业绩不代表其未来表现，不等于理财产品实际收益，投资须谨慎。\n\n" },
  { text: "三、主要风险列示：包括市场风险、信用风险、流动性风险、操作风险、管理风险、法律风险、政策风险、产品不成立风险、提前终止的风险、信息传递风险、产品延期风险、投资标的特有风险、其他风险等。（详见本理财产品说明书\"九、风险揭示\"部分）。\n\n" },
  { text: "四、中银理财郑重提示：投资者在认（申）购本理财产品前应仔细阅读本《产品说明书》及《风险揭示书》，确保完全明白该项投资的性质和所涉及的风险，详细了解和审慎评估该理财产品的资金投资方向、风险类型和收益等基本情况，在慎重考虑后自行决定购买与自身风险承受能力和资产管理需求匹配的理财产品。", hitId: "r2" },
  { text: "鉴于本产品主要投资于高信用等级债权资产，管理人将通过风险准备金机制确保投资者本金不受损失，并力争实现 2.00% 的固定回馈。\n\n" },
  { text: "五、投资者通过代销机构或直接与中银理财签署理财产品投资协议书等销售文件后，代销机构或中银理财在划款时，不再通过任何方式与投资者进行最后确认，直接划款。\n\n" },
  { text: "六、本理财产品说明书在法律许可的范围内由中银理财负责解释。\n\n" },
  { text: "七、购买理财产品后，投资者应随时关注该理财产品的信息披露情况，及时、主动获取相关信息。\n\n" },
  { text: "下面关于本理财产品的风险评级和相关描述，为中银理财内部评级。该产品通过代理销售机构渠道销售的，理财产品评级应当以代理销售机构最终披露的评级结果为准。\n\n" },
  { text: "风险级别 2、中低风险产品 出现本金损失的概率较低，且有一定净值波动率的产品。\n\n" },

  { text: "【一、理财产品基本信息】\n\n" },
  { text: "投资者类型：\n经产品销售机构风险承受能力评估为稳健型、平衡型、进取型和激进型的个人投资者、机构投资者。具体以销售机构风险评级结果和销售要求为准。\n\n" },
  { text: "理财产品认购起点金额：\n认购起点金额为人民币【1】元，认购起点金额以上按照人民币【0.01】元的整数倍累进认购；详见本理财产品说明书\"三、认购\"部分。\n\n" },
  { text: "理财产品名称：中银理财-稳富稳健直通车 A202514\n\n" },
  { text: "理财产品销售名称：(盛夏)中银理财-稳富稳健直通车 A202514\n\n" },
  { text: "理财产品代码：WFSJ202514\n\n" },
  { text: "全国银行业理财信息登记系统登记编码：【Z7001025001218】\n投资者可根据登记编码在中国理财网（www.chinawealth.com.cn）查询产品信息\n\n" },
  { text: "理财币种：人民币\n\n" },
  { text: "理财产品管理人：中银理财有限责任公司（以下简称\"中银理财\"）\n\n" },
  { text: "理财产品托管人：中国银行股份有限公司（以下简称\"中国银行\"）\n\n" },
  { text: "理财产品销售机构：\n中国银行股份有限公司，以及与中银理财有限责任公司签订代理销售协议并提供相关服务的其他销售机构。\n\n" },
  { text: "产品类型：固定收益类非保本浮动收益型\n\n" },
  { text: "产品运作模式：开放式净值型产品\n\n" },
  { text: "募集方式：公募\n\n" },
  { text: "投资目标：以灵活的资产配置策略力争超越业绩比较基准的收益水平\n\n" },
  { text: "投资策略：\n本理财产品根据经济周期及市场走势变化，以债券、非标准化债权类资产、债券回购合理配置为主，通过在债券等固定收益类资产中灵活配置资金，同时适当参与以对冲为目的的金融衍生品交易，实现跨市场、跨行业的投资运作，拓宽投资集合的有效边界。\n\n" },
  { text: "募集规模上限：人民币【3000】亿元\n产品管理人有权根据实际需要对本理财产品募集资金规模进行调整，本理财产品最终规模以产品管理人实际募集的资金数额为准。\n\n" },
  { text: "理财产品份额面值：1 元\n\n" },
  { text: "认购期：【2025】年【10】月【29】日，开放认购的时间为每个开放日的 9:00（含）至 17:00（含），具体以理财产品销售机构实际规定的交易时间为准。\n\n" },
  { text: "理财产品成立日：【2025】年【10】月【30】日\n\n" },
  { text: "理财产品到期日：【2026】年【6】月【26】日（如遇非工作日，则顺延至下一个工作日）\n\n" },
  { text: "理财产品存续期限：【239 天】（以理财产品实际存续天数为准，本产品于 2026 年 3 月 27 日到期，投资者实际持有期限根据购买日期或有不同，本产品存续期不可赎回）\n\n" },
  { text: "开放期及开放日：\n【2025】年【10】月【31】日至【2025】年【11】月【28】日为产品开放期，具体以理财产品销售机构实际受理时间为准。\n开放期内的每个工作日为产品开放日，本理财产品在每个开放日开放申购，不可赎回。详见本理财产品说明书\"七、申购和赎回\"部分。\n\n" },
  { text: "理财产品份额净值：\n本产品的估值日为产品成立日及开放日。详见\"十、理财产品估值\"部分。理财产品管理人在估值日后【2】个工作日内公布理财产品的份额净值，理财产品份额净值可能小于1元。产品份额净值信息依照\"十一、信息披露\"第（一）条第5款约定进行披露。\n\n" },
  { text: "申购确认日：\n本理财产品成立（不含成立日）后，投资者在销售机构实际规定的交易时间内提交的申购申请于申请当日后第一个工作日确认。详见本理财产品说明书\"七、申购和赎回\"部分。\n\n" },
  { text: "申购起点金额/份额：\n本产品初次申购起点金额为【1】元人民币，高于起点金额以人民币【0.01】元的整数倍递增；已持有理财份额的投资者追加申购金额为【0.01】元的整数倍。\n详见本理财产品说明书\"七、申购和赎回\"部分。\n\n" },
  { text: "资金来源限制：投资者不得使用贷款、发行债券等筹集的非自有资金投资本理财产品。\n\n" },
  { text: "业绩比较基准及测算：\n投资者认购本理财产品时，业绩比较基准为【1.65%-2.00%】（年化）（如业绩比较基准调整，将根据信息披露规则进行披露。请申购本理财产品的投资者及时、主动通过本理财产品说明书约定的信息披露渠道获取最新业绩比较基准情况）。业绩比较基准用年化收益率表示，是产品管理人基于产品性质、投资策略、过往经验等因素对产品设定的投资目标，仅用于评价投资结果和测算业绩报酬，业绩比较基准不是预期收益率，不代表产品的未来表现和实际收益，不构成对产品收益的承诺。\n\n" },
  { text: "业绩比较基准测算：\n业绩比较基准由产品管理人依据理财产品的投资范围、投资策略、资产配置计划，并综合考虑市场环境等因素测算。\n本理财产品为【固定收益类】产品，主要投资于【货币市场工具、银行存款、债券等固定收益类资产，并适当参与以对冲为目的的金融衍生品交易】。以产品【投资货币市场工具仓位0%-10%，银行存款仓位0%-50%，信用债仓位50%-90%，组合杠杆率110%】为例，业绩比较基准参考本产品发行时已知的【中债-综合财富（1年以下）指数收益率】，考虑本理财产品综合费率、资本利得收益并结合产品投资策略进行测算得出。(产品示例仅供参考，具体投资比例可根据各类资产的收益水平、流动性特征、信用风险等因素动态调整，投资范围、投资限制、投资策略详见【\"二、理财产品投资\"】部分。\n当监管政策、市场环境、产品性质等因素发生变化，导致理财产品的业绩比较基准进行调整时，产品管理人有权调整产品业绩比较基准，并至少提前【3】个工作日通过相应信息披露渠道公布调整情况和调整原因。\n\n" },
  { text: "投资者资金到账日：\n理财产品到期后三个工作日内，理财产品到期日至资金到账日期间不计利息。\n\n" },
  { text: "理财产品费用：\n固定管理费：【0.12%】（年化）\n销售服务费：【0.30%】（年化）\n托管费：【0.025%】（年化）\n认购费：【0.00】%\n申购费：【0.00】%\n赎回费：【0.00】%\n超额业绩报酬：本理财产品暂不收取超额业绩报酬。（中银理财有权根据市场及产品运作情况调整超额业绩报酬的收费条件、标准和方式，并至少提前3个工作日事先通过本产品说明书约定的信息披露渠道进行公告。若投资者在公告约定的收费起始日（不含当日）之前已经完成本产品的认购、申购申请，即投资者提出认购、申购申请的日期在公告约定的收费起始日（不含当日）之前，则就该等份额而言不适用超额业绩报酬收取的相关条款；若投资者在公告约定的收费起始日（含当日）后提出认购、申购申请，即投资者申请认购、申购的日期在公告约定的收费起始日（含当日）之后，则仅对此类份额适用超额业绩报酬收取的相关条款，超额业绩报酬的收费条件、标准和方式等要素以管理人公告约定为准。举例：若公告约定的收费起始日为T日，投资者分别在T日（不含当日）之前申请申购本理财产品份额、T日当日申请追加申购本理财产品份额，则在T日（不含当日）之前申购的理财产品份额不适用超额业绩报酬收取的相关条款，而在T日当日追加申购的理财产品份额适用于超额业绩报酬收取的相关条款。）\n因投资非标准化债权类资产而产生的费用：本理财产品在投资运作过程中可能投资非标准化债权类资产，如因投资该类资产而产生资产服务费或项目管理费等相关费用，将在实际发生时按照实际发生额支付。\n其他从理财产品财产中支付的税费包括但不限于：1、投资账户开立及维护费、交易手续费、资金汇划费、清算费；2、产品成立后与产品相关的审计费、诉讼费、仲裁费、律师费、执行费、信息披露费；3、增值税及附加税费等。上述税费（如有）在实际发生时按照实际发生额支付。\n产品管理人有权根据国家政策和适用法律的规定，对本理财产品费用名目、收费条件、收费标准和收费方式进行调整，并至少提前 2 个工作日通过相应信息披露渠道公布调整情况和调整原因。\n详见本理财产品说明书\"五、理财产品费用\"部分。\n各销售机构或各类份额（如有）的销售服务费或有不同。\n\n" },
  { text: "理财产品收益分配：\n当理财产品份额净值高于面值时可进行收益分配，理财产品收益分配后将相应调减理财产品份额净值，调减后的每份理财产品份额的净值不能低于面值；在符合有关理财产品收益分配条件的前提下，产品管理人有权根据理财产品实际运作情况，不定期的进行收益分配。详见\"六、理财产品收益分配\"。\n\n" },
  { text: "提前终止：\n本理财产品存续期内，投资者无权单方面主动决定终止本理财产品。为保护投资者利益，理财产品管理人有权按照本理财产品资金运作的实际情况，主动终止本理财产品。如理财产品管理人需要提前终止本理财产品，将至少提前【3】个工作日（含）予以公告。详见本理财产品说明书\"八、提前终止\"部分。\n\n" },
  { text: "工作日释义：\n指除周六日、公休日及中国法定节假日外的其他日，即中国证券市场的法定交易日。\n\n" },
  { text: "理财产品税款：\n根据中国税收相关法律法规、税收政策等要求，本理财产品运营过程中发生的增值税应税行为，以理财产品管理人为纳税人。签约各方同意本理财产品在运营过程应缴纳的增值税及附加税费（包括但不限于城市维护建设税、教育费附加及地方教育附加等）由产品管理人从理财产品财产中支付，并由产品管理人根据中国税务机关要求，履行相关纳税申报义务，由此可能会使理财产品净值或实际收益降低，请投资者知悉。投资者从理财产品取得的收益应缴纳的税款，由投资者自行申报及缴纳。\n\n" },

  { text: "【二、理财产品投资】\n\n" },
  { text: "（一）投资范围\n本理财产品募集的资金主要投资于以下金融工具：\n1．境内外货币市场工具，含现金、银行存款（含同业存放、协议存款、结构性存款等）、同业存单、大额可转让存单、债券回购（含逆回购）、资金拆借等；\n2．境内外国债、地方政府债、政策性金融债、中央银行票据、政府机构债券；\n3．境内外金融债，短期融资券、超短期融资券、中期票据、长期限含权中期票据、非公开定向债务融资工具、外国借款人在我国市场发行的债券等；\n4．境内外企业债券、公司债券、可转债、可交换债、交易所非公开发行债券、结构性票据等；\n5．境内外公开发行的以固定收益资产为主要投资标的的证券投资基金以及各类资产管理产品或计划；\n6．境内外资产证券化产品的优先档；\n7．外汇即期；境内外商品现货；境内外利率衍生品、汇率衍生品、信用衍生品、权益衍生品、商品衍生品，具体工具包括但不限于各类期货、远期、互换/掉期、期权、信用风险缓释工具/信用保护工具、债券借贷以及其他符合监管规定的商品及金融衍生品。\n8．境内外法律、法规、监管规定允许范围内的非标准化债权类资产。\n\n" },
  { text: "（二）投资比例限制\n1．投资于同一只证券或同一只证券投资基金的市值不得超过该证券市值或该证券投资基金市值的30%。\n2．投资于单只证券或单只证券投资基金的市值不得超过本理财产品净资产的10%。\n3．投资于同一只资产支持证券优先档的市值不得超过该档次市值的30%。\n4．本理财产品的总资产不得超过产品净资产的140%。\n5．投资于债权类资产占组合总资产的比例不低于80%。\n6.投资于非标准化债权类资产占组合总资产的比例低于50%。\n7．投资于衍生金融工具（以保证金计）占组合总资产的比例不高于5%。\n8．投资于现金或者到期日在一年以内的国债、中央银行票据和政策性金融债券的比例不低于本理财产品净资产的5%。\n9．投资于流动性受限资产的市值在开放日不得超过该产品资产净值的15%。\n10．在开放日前一工作日内，7个工作日可变现资产的可变现价值应当不低于该产品资产净值的10%。\n非因理财产品管理人主观因素导致突破上述第1、2项投资比例限制的，理财产品管理人应当在流动性受限资产可出售、可转让或者恢复交易的10个交易日内调整至符合产品说明书的有关要求。\n\n" },
  { text: "（三）评级限制\n本理财产品对于投资的信用类债券、同业存单，发行主体评级或外部债项评级应为 AA级（含）以上（中债资信评级除外）。\n\n" },
  { text: "（四）投资策略\n本理财产品根据经济周期及市场走势变化，以债券、非标准化债权类资产、债券回购合理配置为主，通过在债券等固定收益类资产中灵活配置资金，同时适当参与以对冲为目的的金融衍生品交易，实现跨市场、跨行业的投资运作，拓宽投资集合的有效边界。\n1．久期配置策略\n2．信用类债券投资策略\n3．息差策略\n4．非标准化债权类资产投资策略\n\n" },
  { text: "（五）理财投资合作机构\n本理财产品投资合作机构包括中银国际证券股份有限公司、中银基金管理有限公司、中国国际金融股份有限公司、中信证券股份有限公司、创金合信基金管理有限公司，以及其他与产品相关的合作机构。\n\n" },

  { text: "【三、认购】\n\n" },
  { text: "（一）本理财产品认购期：【2025】年【10】月【29】日，受理时间：北京时间9:00（含）至17:00（含），具体以理财产品销售机构实际规定的交易时间为准。\n\n" },
  { text: "（二）认购期内，实际收到的认购申请金额累计达到募集规模上限后，产品管理人有权自下一工作日起停止接受认购，认购期间提前结束。\n\n" },
  { text: "（三）认购方式：本理财产品可通过销售机构各营业网点柜台（含智能柜台）及网上银行、手机银行等电子渠道进行认购。\n\n" },
  { text: "（四）本产品认购起点金额人民币【1】元，高于起点金额以人民币【0.01】元的整数倍递增。\n\n" },
  { text: "（五）认购费用：本理财产品无认购费。\n\n" },
  { text: "（六）认购份额计算：\n认购理财产品份额=（认购金额-认购费用+认购期利息）/理财产品份额面值\n\n" },
  { text: "（七）认购程序：投资者应在其资金账户中预留足够的认购金额，预留资金不足的，视为认购无效。\n\n" },
  { text: "（八）认购期间，投资者可于销售机构扣划认购资金当日销售渠道规定的交易时间截止时点前撤销认购申请，该时点后不得撤销。\n\n" },
  { text: "（九）认购期利息：如销售机构实时扣划投资者认购资金，投资者认购申请成功确认当日（含）至认购期最后一日（不含）期间产生的活期利息将折算成产品份额，归投资者所有。\n\n" },
  { text: "（十）认购资金来源限制：投资者不得使用贷款、发行债券等筹集的非自有资金投资本理财产品。\n\n" },
  { text: "（十一）对于可能导致单一投资者累计持有本理财产品份额超过总份额 50%的认购申请，产品管理人或销售机构应拒绝接受或部分接受，确保单一投资者持有份额不超过总份额 50%。\n\n" },

  { text: "【四、产品成立】\n\n" },
  { text: "（一）本理财产品认购期届满（或提前结束）之日的下一工作日本理财产品成立，该日为产品成立日。\n\n" },
  { text: "（二）本理财产品不成立时，理财产品管理人将在认购期届满（或提前结束）之日的下一工作日（含）起【7】个工作日内，通过销售渠道退还已扣划的投资者认购资金及其在申请成功确认当日（含）至认购期届满（或提前结束）之日（不含）期间产生的活期利息（如有）。\n\n" },

  { text: "【五、理财产品费用】\n\n" },
  { text: "（一）理财产品固定管理费：【0.12%】（年化）。\n", hitId: "r3" },
  { text: "在通常情况下，按本产品初始募集总金额的 0.12% 年费率计提，且不因产品净值下跌而减免。计算方法如下：\nF1=E×【0.12%】÷365\nF1为每日应计提的产品固定管理费\nE为前一估值日资产净值（成立日当日，则E为成立日当日的产品份额。）\n\n" },
  { text: "（二）理财产品销售服务费：【0.30%】（年化）。\n\n" },
  { text: "（三）理财产品托管费：【0.025%】（年化）。\n\n" },
  { text: "（四）理财产品认购费、申购费、赎回费\n本理财产品无认购费、申购费、赎回费。\n\n" },
  { text: "（五）超额业绩报酬：本理财产品暂不收取超额业绩报酬。\n\n" },
  { text: "（六）因投资非标准化债权类资产而产生的费用：将在实际发生时按照实际发生额支付。\n\n" },
  { text: "（七）其他从理财产品财产中支付的税费包括但不限于：\n1、投资账户开立及维护费、交易手续费、资金汇划费、清算费；\n2、产品成立后与产品相关的审计费、诉讼费、仲裁费、律师费、执行费、信息披露费；\n3、增值税及附加税费等。\n\n" },

  { text: "【六、理财产品收益分配】\n\n" },
  { text: "（一）收益分配的原则：\n1．理财产品收益分配采取现金方式；\n2．每一理财产品份额享有同等分配权；\n3．只有当理财产品份额净值高于面值时方可进行收益分配；\n4．理财产品收益分配后每份理财产品份额的净值不能低于面值；\n5．在符合有关理财产品收益分配条件的前提下，产品管理人有权根据理财产品实际运作情况，不定期的进行收益分配。\n\n" },
  { text: "（二）收益分配方案的确定和公布：收益分配方案由理财产品管理人拟定，并由理财产品托管人核实后，在分配前进行信息披露。\n\n" },
  { text: "（三）分配的收益将在投资收益分配日后3个工作日内划入投资者账户，投资收益分配日至到账日期间不计利息。\n\n" },

  { text: "【七、申购和赎回】\n\n" },
  { text: "本产品存续期内仅可申购，不可赎回。\n\n" },
  { text: "（一）开放期及开放日：【2025】年【10】月【31】日至【2025】年【11】月【28】日为产品开放期，开放期内的每个工作日为产品开放日，本理财产品在每个开放日开放申购，不可赎回。\n\n" },
  { text: "（二）申购交易时间：每个开放日的北京时间 09:00-15:30。\n\n" },
  { text: "（三）挂单时间：理财产品开放期内，投资者可在挂单时间内（工作日的北京时间 0:00-09:00、15：30-24：00 及非工作日的 0:00-24:00），通过销售机构指定渠道进行挂单申购本理财产品。\n\n" },
  { text: "（四）申购的原则\n1．申购价格以开放日交易结束后的理财份额净值进行计算；\n2．本理财产品采用金额申购的原则，即申购以金额申请；\n3．本理财产品可于开放日销售机构规定的交易时间内办理理财产品的申购。\n4．投资者的申购申请可以在申请当日交易时间内撤销，在交易时间以外不得撤销；\n5．因不可抗力导致理财产品无法继续申购时，理财产品管理人有权拒绝或暂停接受投资者的申购申请。\n\n" },
  { text: "（五）申购的数额限制\n1．本理财产品初次申购起点金额为【1】元人民币，高于起点金额以人民币【0.01】元的整数倍递增；已持有理财份额的投资者追加申购金额为【0.01】元或【0.01】元的整数倍。\n2．对于可能导致单一投资者累计持有本理财产品份额超过总份额 50%的申购申请，产品管理人或销售机构应拒绝接受或部分接受。\n\n" },
  { text: "（六）申购的程序\n1．投资者在提交申购申请时须按销售机构规定的方式备足申购资金，否则所提交的申购申请无效。\n2．申购申请的确认：本理财产品开放期内，投资者在销售机构规定的交易时间内提交的申购申请，理财产品管理人在申请当日（T 日）后第一个工作日（T+1）对该申请的有效性进行确认。\n3．申购的款项支付：\n\n" },
  { text: "（七）申购份额的计算与示例\n1．申购份额的计算：本理财产品的申购份额以申请当日（T 日）交易结束后理财份额净值为基准进行计算，其中：\n净申购金额=申购金额-申购费用\n申购费用=申购金额×申购费率\n申购份额＝净申购金额/T 日理财份额净值\n\n" },
  { text: "4．投资者收益与风险计算示例\n假如投资者在开放期以 5,000,000 元人民币申购理财产品，产品无申购费，购买理财产品时份额净值为 1，则投资者申购份额为：5,000,000/1=5,000,000 份\n（1）假如该产品于到期日正常到期，投资者实际持有产品期限为 365 天。当日产品净值为 1.060000，投资者获得：5,000,000×1.060000=5,300,000 元。\n（2）假如该产品提前终止，投资者实际持有产品期限为 146 天。提前终止时的理财产品份额净值为 0.980000，投资者获得：0.980000×5,000,000=4,900,000 元。\n上述收益与风险计算示例仅为说明文件，所用数据均为模拟数据，并不作为产品承诺收益或损失的保证。\n\n" },
  { text: "（八）暂停申购的情形\n发生下列情形时，产品管理人可拒绝或暂停接受投资人的申购申请：\n1．因不可抗力导致理财无法正常运作；\n2．发生暂停理财资产估值情况时；\n3．当产品申购金额将导致产品规模大幅波动或超过上限，为保护投资者利益时。\n\n" },
  { text: "（九）本理财产品不承诺保证本金和投资收益。\n\n" },

  { text: "【八、产品到期】\n\n" },
  { text: "（一）本理财产品于到期日后一次性支付到期款项。\n投资者到期款项金额=投资者持有理财产品份额×到期产品份额净值-超额业绩报酬（如有）\n\n" },
  { text: "（二）理财到期款项到账日为理财产品到期日后的 3 个工作日之内，期间不计息。\n\n" },
  { text: "（三）理财到期款项以理财产品财产为限进行支付。\n\n" },
  { text: "（四）本理财产品不承诺保证本金和投资收益。\n\n" },
  { text: "（五）投资者收益计算示例\n假如投资者在认购期认购理财产品 5,000,000 元，产品无认购费，购买理财产品时份额净值为 1，认购份额为 500 万份，产品期限为 365 天。该产品于到期日正常到期，当日产品净值为 1.060000，投资者获得：5,000,000×1.060000=5,300,000 元。\n\n" },
  { text: "（六）投资者风险计算示例\n假如投资者在认购期认购理财产品 5,000,000 元，产品无认购费，购买理财产品时份额净值为 1，认购份额为 500 万份，产品期限为 365 天。该产品于到期日正常到期，当日产品净值为 0.980000，投资者获得：0.980000×5,000,000=4,900,000 元。\n\n" },

  { text: "【九、提前终止】\n\n" },
  { text: "（一）本理财产品在不可预料的情况或产品说明书约定的其他情况下提前终止时，依照产品估值情况支付投资者到期款项。\n\n" },
  { text: "（二）投资者到期款项金额=投资者持有理财产品份额×提前终止日产品份额净值-超额业绩报酬（如有）\n\n" },
  { text: "（三）本理财产品存续期内，投资者无权单方面主动决定终止本理财产品。为保护投资者利益，理财产品管理人有权按照本理财产品资金运作的实际情况，主动终止本理财产品。如理财产品管理人需要提前终止本理财产品，将至少提前【3】个工作日（含）予以公告。\n\n" },
  { text: "（四）理财产品管理人提前终止本理财产品的原因包括但不限于：\n1．因不可抗力原因导致理财产品无法继续运作。\n2．遇有市场出现剧烈波动、异常风险事件等情形导致理财产品收益出现大幅波动或严重影响理财产品的资产安全。\n3．因投资者理财资金被有权机关扣划等原因导致理财产品剩余资产无法满足相关法律法规规定、所投资市场要求或协议等相关法律文件约定，或者继续存续无法实现投资目标。\n4．因相关投资管理机构解散、破产、撤销、被取消业务资格等原因无法继续履行相应职责导致产品无法继续运作。\n5．相关投资管理机构或运用理财资金的第三方主体实施符合法律法规规定或协议等相关文件约定的行为导致理财产品被动提前终止。\n6．因法律法规变化或国家金融政策调整、紧急措施出台影响产品继续正常运作。\n7．提前终止产品比维持产品运作更有利于保护产品持有人的权益。\n8．本理财产品资产净值低于【5000万】元时，产品管理人有权提前终止本产品。\n9．法律法规规定或监管部门认定或产品说明书约定的其他情形。\n\n" },
  { text: "（五）如理财产品管理人提前终止本理财产品，将至少提前【3】个工作日（含）通过相应信息披露渠道予以披露，将理财产品资产变现，并在变现完成后【10】个工作日内将变现后资金根据本理财产品说明书的规定分配。\n\n" },
  { text: "（六）如理财产品管理人提前终止本理财产品，管理费、销售服务费、超额业绩报酬（如有）、托管费依照\"五、理财产品费用\"的约定计算和支付。\n\n" },

  { text: "【十、风险揭示】\n\n" },
  { text: "本理财产品为非保本浮动收益型中低风险产品，理财产品管理人将本着\"恪守信用、勤勉尽责\"的原则管理和运用理财产品财产，但并不对本理财产品提供保证本金和收益的承诺，投资者的本金和收益可能会因市场变动而蒙受一定程度的损失，投资者应充分认识投资风险，谨慎投资。\n\n" },
  { text: "（一）市场风险\n受各种市场因素、宏观政策因素等的影响，本理财产品所投资的各类资产价值可能下跌，导致理财收益下降甚至本金损失。\n\n" },
  { text: "（二）信用风险\n如果本理财产品的交易对手或者所投资的各类债券、非标准化债权类资产和其他债权发生信用违约、托管人破产，可能影响投资收益，甚至致使理财产品本金受到损失。\n\n" },
  { text: "（三）流动性风险\n流动性风险是指本理财产品无法通过变现资产等途径以合理成本及时候得充足资金，用于满足本理财产品的投资者赎回需求、履行其他支付义务的风险。\n1．认（申）购、赎回安排\n2．拟投资市场、资产的流动性风险评估\n3．拟运用的流动性风险应对措施及其使用情形、处理方法、程序及对投资者的潜在影响\n\n" },
  { text: "（四）操作风险\n操作风险是指由于内部程序、员工、信息科技系统存在问题以及外部事件造成损失的风险。\n\n" },
  { text: "（五）管理风险\n由于本理财产品管理人受技能和管理水平等因素的限制，可能会影响本理财产品的本金和投资收益，导致本金遭受损失和理财收益处于较低水平甚至为零的风险。\n\n" },
  { text: "（六）法律风险\n法律风险包括但不限于因监管措施和解决民商事争议而支付的罚款、罚金、违约金或者赔偿金所导致的风险。\n\n" },
  { text: "（七）政策风险\n本理财产品是针对当前的相关法规和政策设计的，如国家宏观政策及市场相关法规政策发生变化，可能影响本理财产品的受理、投资、偿还等的正常进行，甚至导致本理财产品收益降低甚至本金损失。\n\n" },
  { text: "（八）产品不成立风险\n如果因不可抗力、募集规模低于说明书约定的最低规模（如有）或其他因素导致产品管理人宣布本理财产品不成立的情形，投资者将面临再投资风险。\n\n" },
  { text: "（九）提前终止的风险\n在投资期内，如本理财产品发生本《产品说明书》\"八、提前终止\"部分规定的情形，理财产品管理人权提前终止本理财产品，投资者可能面临不能实现收益目标及不能进行再投资的风险。\n\n" },
  { text: "（十）信息传递风险\n本理财产品存续期内，投资者应根据本《产品说明书》所载明的信息披露方式及时、主动查询本理财产品的相关信息。如果投资者未及时、主动查询，或由于通讯故障、系统故障以及其他不可抗力等因素的影响使得投资者无法及时了解产品信息，并由此产生的责任和风险由投资者自行承担。\n\n" },
  { text: "（十一）产品延期风险\n本理财产品到期后，如因本产品投资的资产无法及时变现等原因造成不能按时支付本金和收益，则客户面临产品延期、调整等风险。\n\n" },
  { text: "（十二）投资标的特有风险\n1. 货币市场工具投资风险\n2. 债券投资风险（市场风险、信用风险）\n3. 非标准化债权类资产投资风险\n4. 资产管理产品投资风险\n5. 境外投资特别风险（境外市场风险、汇率风险、税务风险）\n\n" },
  { text: "（十三）其他风险\n包括但不限于自然灾害、金融市场危机、战争等不可抗力因素造成的相关投资风险。\n\n" },

  { text: "【十一、理财产品估值】\n\n" },
  { text: "（一）估值原则\n1．匹配性原则\n2．一致性原则\n3．审慎性原则\n4．充分披露原则\n\n" },
  { text: "（二）估值日\n本产品的估值日为产品成立日及开放日。\n\n" },
  { text: "（三）估值对象\n本产品所拥有的各类证券、银行存款本息、非标准化债权类资产、应收款项及其它投资等资产及负债。\n\n" },
  { text: "（四）估值方法\n1. 债券\n2. 金融衍生品\n3. 基金\n4. 资产管理产品\n5. 非标准化债权类资产、存款、债券逆回购及同业拆借等货币市场工具，采用合理的估值技术确定公允价值。\n6. 若理财产品存续期间持有其他投资品种，以理财产品管理人和理财产品托管人共同认可的方式估值。\n7. 如有确凿证据表明按上述方法进行估值不能客观反映资产公允价值的，可根据具体情况，在综合考虑市场成交、市场报价、流动性、收益率曲线等因素基础上，按最能反映公允价值的价格估值。\n8. 如有新增事项或变更事项，按国家最新规定或理财产品管理人公布的最新约定进行估值。\n\n" },

  { text: "【十二、信息披露】\n\n" },
  { text: "（一）信息披露的内容\n\n" },
  { text: "1．发行公告：在产品成立后30个工作日内披露产品发行公告。\n", hitId: "r4" },
  { text: "2．定期报告：在每个季度结束之日起15个工作日内、上半年结束之日起60个工作日内、每年结束之日起90个工作日内，披露理财产品的季度、半年和年度报告等定期报告。\n\n" },
  { text: "3．到期公告：在产品终止后30个工作日内披露产品到期公告。\n", hitId: "r5" },
  { text: "4．重大事项公告：在产品重大事项发生后的2个工作日内披露重大事项公告。\n\n" },
  { text: "5．净值披露\n（1）产品成立后，理财产品管理人在估值日后【】个工作日内公布理财产品的份额净值，该份额净值扣除当期应付未付的理财费用，但未扣除超额业绩报酬（如有）。\n（2）每个开放日结束后【2】个工作日内公告开放日的份额净值、份额累计净值、认购价格。\n（3）在定期报告中披露产品在季度、半年和年度最后1个市场交易日的份额净值、份额累计净值和资产净值。\n\n" },
  { text: "6．临时报告：\n（1）如理财产品投资非标准化债权类资产：理财产品管理人将在非标准化债权类资产投资交易日后【3】个工作日内发布非标准化债权类资产投资公告。\n（2）如理财产品管理人转换产品运作方式；产品认购期延长；变更投资收益分配事项；管理费、托管费等费用的具体收费项目、条件、计提标准、计提方式和费率发生变更。\n（3）如本理财产品变更投资比例范围，理财产品管理人应在变更生效前进行公告。\n（4）如理财产品提前成立，理财产品管理人将于提前成立日后的第2个工作日发布相关信息公告。\n（5）如理财产品提前终止，理财产品管理人将至少提前3个工作日（含）予以公告。\n（6）如理财产品变更托管人、注册登记机构；理财产品所投资的资金信托变更受托人或投资顾问。\n（7）如理财产品管理人决定进行收益分配，将至少于产品分配前【2】个工作日发布相关信息公告。\n（8）如产品成立后调整相关要素，将事先公告。\n\n" },
  { text: "7．", hitId: "r6" },
  { text: "如本理财产品终止后的清算期超过5个工作日的，理财产品管理人应当在本理财产品终止前向投资者进行披露。\n\n" },
  { text: "8．其他信息披露：理财产品有权根据国家政策或市场波动，单方面调整本理财计划的收费项目及费率，调整自乙方网站公告之日起生效，无需另行通知投资者。\n\n" },
  { text: "（二）投资者关于信息披露方式的确认\n投资者购买本理财产品，即表明其确认并同意理财产品管理人可以通过下列方式披露信息：\n1．在【中国银行网站（http://www.boc.cn）或手机银行、网上银行等电子渠道】公告上述信息；\n2．在理财产品销售机构网站或在销售机构营业网点将根据投资者的要求，现场打印对账信息供投资者核对；\n\n" },
  { text: "（三）其他需要投资者知晓的事项\n1．理财产品管理人根据适用的法律法规和监管机构要求，向监管机构和/或其他有权机关报送投资者身份信息及投资者持有本产品份额及其变动情况等相关信息。\n2．理财产品管理人对向监管机构和/或监管机构指定机构报送的相关信息负有保密义务。\n\n" },

  { text: "【十三、托管人】\n\n" },
  { text: "（一）托管人基本信息：\n托管人：中国银行股份有限公司\n注册地址：北京市西城区复兴门内大街 1 号\n\n" },
  { text: "（二）托管人职责：\n本理财产品托管人应当履行下列职责，确保实现实质性独立托管：\n1．安全保管理财产品财产；\n2．为每只理财产品开设独立的托管账户，不同托管账户中的资产应当相互独立；\n3．按照托管协议约定和理财产品管理人的投资指令，及时办理清算、交割事宜；\n4．建立与理财产品管理人的对账机制，复核、审查理财产品资金头寸、资产账目、资产净值、认购价格等数据，及时核查认购以及投资资金的支付和到账情况；\n5．监督理财产品投资运作，发现理财产品违反法律、行政法规、规章规定或合同约定进行投资的，应当拒绝执行，及时通知理财产品管理人并报告银行业监督管理机构；\n6．办理与理财产品托管业务活动相关的信息披露事项；\n7．理财托管业务活动的记录、账册、报表和其他相关资料保存15年以上；\n8．对理财产品投资信息和相关资料承担保密责任；\n9．国务院银行业监督管理机构规定的其他职责。\n\n" },

  { text: "【十四、销售机构】\n\n" },
  { text: "（一）销售机构基本信息\n销售机构：中国银行股份有限公司\n注册地址：北京市西城区复兴门内大街 1 号\n\n" },
  { text: "（二）销售机构职责：\n1．在销售产品过程中，对投资者身份信息的真实性进行验证。\n2．做好投资者持续信息服务。\n3．充分了解面向特定对象销售的理财产品的投资者信息，收集、核验投资者金融资产证明、收入证明或纳税凭证等材料。\n4．根据反洗钱、反恐怖融资及非居民金融账户涉税信息尽职调查等相关法律法规要求识别客户身份。\n5．按照法律法规规定、理财产品销售协议约定办理理财产品的认（申）购、赎回，归集、划转理财产品销售结算资金。\n6．完整记录和保存销售业务活动信息，确保记录信息全面、准确和不可篡改。\n7．建立健全档案管理制度，妥善保管投资者理财产品销售相关资料，保管年限不得低于20年。\n8．国务院银行业监督管理机构规定、理财产品代理销售协议约定的其他职责。\n\n" },

  { text: "【十五、特别提示】\n\n" },
  { text: "（一）根据《商业银行理财业务监督管理办法》相关规定，理财产品按照投资性质不同，\"分为固定收益类理财产品、权益类理财产品、商品及金融衍生品类理财产品和混合类理财产品。\n\n" },
  { text: "（二）本《产品说明书》是投资者与中银理财有限责任公司所签订的理财产品相关法律文件的组成部分，请认真阅读。\n\n" },
  { text: "（三）投资者通过销售渠道提交认（申）购申请，即视为投资者授权及同意中银理财有限责任公司作为本理财产品的产品管理人，代表理财产品的投资者将募集资金进行投资和执行相关操作。\n\n" },
  { text: "（四）如果发生理财产品的交易对手未按时足额付款等情形，投资者同意，中银理财有限责任公司有权向上述各方进行追索，追索期间所发生的费用将从追索回的款项中优先扣除。\n\n" },
  { text: "（五）如出于维持产品正常运营的需要且在不实质损害投资者利益的前提下，或因国家法律法规、监管规定发生变化，产品管理人有权在法律法规、监管规定允许的范围内单方对《产品说明书》进行修订。\n\n" },
  { text: "（六）本《产品说明书》与《风险揭示书》、《中银理财有限责任公司理财产品投资协议书》共同规范投资者与理财产品管理人之间的权利义务关系。\n\n" },
  { text: "（七）咨询或投诉请致电服务热线：中国银行服务热线（95566）、中银理财服务热线（95566-8）。\n\n" },
];

/** 依据 PDF 文本层原点 + 中文等宽约 1.62%/字 校准的句级框（595×842 视口） */
const FILES: ExplorerFile[] = [
  {
    id: "f1",
    name: "contract.pdf",
    format: "pdf",
    sourceUrl: CONTRACT_PDF_URL,
    aiConfidence: 94,
    ocrSegments: CONTRACT_OCR_SEGMENTS,
    items: [
      {
        id: "r1",
        level: "high",
        page: 1,
        title: "风险提示未显著展示",
        description:
          "「理财非存款，产品有风险，投资须谨慎。」未作加粗等显著化处理，违反《银行保险机构消费者权益保护管理办法》关于风险揭示应当「醒目、显著」的要求。",
        pdfRects: [
          { page: 1, left: 18.0, top: 26.0, width: 64.0, height: 3.5 },
        ],
        laws: [
          {
            name: "《银行保险机构消费者权益保护管理办法》",
            article: "第十条：银行保险机构应当遵循诚实信用原则，依法开展经营活动，不得夸大产品收益、隐瞒产品风险。保险产品应当对产品的风险进行充分揭示，确保消费者在购买前充分了解产品的主要风险。",
          },
          {
            name: "《银行保险机构消费者权益保护管理办法》",
            article: "第十五条：银行保险机构向消费者提供产品和服务时，应当对可能产生的风险进行充分揭示，并以通俗易懂的语言向消费者说明产品和服务的性质、主要风险及注意事项等内容，确保消费者能够正确理解产品信息。",
          },
        ],
      },
      {
        id: "r2",
        level: "high",
        page: 1,
        title: "涉嫌刚性兑付与不当收益承诺",
        description:
          "出现「确保投资者本金不受损失」「并力争实现 2.00%」及「固定回馈」等表述，违反《关于规范金融机构资产管理业务的指导意见》关于打破刚性兑付的规定，不得承诺保本保收益或变相承诺。",
        pdfRects: [
          { page: 1, left: 15.0, top: 48.0, width: 70.0, height: 16.0 },
        ],
        laws: [
          {
            name: "《关于规范金融机构资产管理业务的指导意见》",
            article: "第十九条：资产管理业务不得承诺保本保收益。任何单位和个人发现存在刚性兑付行为的，应当向金融监管部门举报。金融机构不得以任何形式垫资兑付。",
          },
          {
            name: "《银行理财公司理财产品销售管理暂行办法》",
            article: "第二十条：理财产品销售机构不得使用未说明原因的词语对理财产品本金或者收益进行明示或者暗示，不得使用安全、保证、承诺、保险、避险、有保障、高收益、无风险等与产品风险收益特征不匹配的表述。",
          },
        ],
      },
      {
        id: "r3",
        level: "medium",
        page: 8,
        title: "费用计提方式加重消费者负担",
        description:
          "「按本产品初始募集总金额的 0.12% 年费率计提，且不因产品净值下跌而减免」在净值型产品中易被认定为费用与净值脱钩、不当加重消费者负担，建议对照监管口径与公平原则评估修订。",
        pdfRects: [
          { page: 8, left: 15.0, top: 46.0, width: 70.0, height: 4.5 },
        ],
        laws: [
          {
            name: "《商业银行理财业务监督管理办法》",
            article: "第三十五条：商业银行应当按照国务院银行业监督管理机构关于商业银行信息披露的相关规定，在理财产品销售文件中明确约定与投资者联络和信息披露的方式、渠道和频率，以及信息披露责任，确保投资者及时获取产品相关信息。",
          },
          {
            name: "《全国银行业理财信息登记系统业务操作规程》",
            article: "产品说明书应当真实、准确、完整地披露产品费用结构，不得设置不合理或显失公平的收费条款。",
          },
        ],
      },
      {
        id: "r4",
        level: "medium",
        page: 17,
        title: "发行公告披露不及时",
        description:
          "「产品成立后30个工作日内披露产品发行公告」严重偏离信息披露及时性要求，损害投资者知情权，建议改为合理短时限并显著提示。",
        pdfRects: [
          { page: 17, left: 15.0, top: 52.0, width: 70.0, height: 4.0 },
        ],
        laws: [
          {
            name: "《公开募集证券投资基金信息披露管理办法》",
            article: "第十五条：基金管理人应当在基金合同生效后，按照基金合同的约定，在规定期限内编制完成基金定期报告，并予以公告。基金定期报告的编制和披露时间应当及时、准确。",
          },
          {
            name: "《关于规范金融机构资产管理业务的指导意见》",
            article: "金融机构应当加强投资者教育，提高其对资产管理产品的认知能力和风险意识，并应当向投资者充分披露产品投资组合、收益、风险等重要信息。",
          },
        ],
      },
      {
        id: "r5",
        level: "high",
        page: 17,
        title: "到期公告披露不及时",
        description:
          "「产品终止后30个工作日内披露产品到期公告」同样存在披露迟滞问题，侵害消费者对产品终止及清算结果的知情权。",
        pdfRects: [
          { page: 17, left: 15.0, top: 58.0, width: 70.0, height: 4.0 },
        ],
        laws: [
          {
            name: "《公开募集证券投资基金信息披露管理办法》",
            article: "第十七条：基金合同终止的，基金管理人应当依法组织清算组对基金财产进行清算，清算结束后，按照规定将清算结果报告中国证监会，并予以公告。",
          },
        ],
      },
      {
        id: "r6",
        level: "low",
        page: 18,
        title: "格式条款排除消费者权利（单方调费）",
        description:
          "「有权……单方面调整本理财计划的收费项目及费率……无需另行通知投资者」剥夺知情与自主选择权，涉嫌《消费者权益保护法》第二十六条所禁止的「排除消费者权利」的格式条款。说明：该条在 PDF 中自第17页末起排，主要文字在第十八页。",
        pdfRects: [
          { page: 18, left: 15.0, top: 28.0, width: 70.0, height: 10.0 },
        ],
        laws: [
          {
            name: "《中华人民共和国消费者权益保护法》",
            article: "第二十六条：经营者在经营活动中使用格式条款的，应当以显著方式提请消费者注意商品或者服务的数量和质量、价款或者费用、履行期限和方式、安全注意事项和风险警示、售后服务、民事责任等与消费者有重大利害关系的内容，并按照消费者的要求予以说明。",
          },
          {
            name: "《中华人民共和国消费者权益保护法》",
            article: "经营者不得以格式条款、通知、声明、店堂告示等方式，作出排除或者限制消费者权利、减轻或者免除经营者责任、加重消费者责任等对消费者不公平、不合理的规定，不得利用格式条款并借助技术手段强制交易。",
          },
        ],
      },
    ],
  },
  {
    id: "f2",
    name: "poster.jpg",
    format: "jpg",
    sourceUrl: posterImageUrl,
    aiConfidence: 88,
    ocrText: `龙头贷
100%放款，不看征信，当天到账。
贷款利率最低可达3.7%
产品利率
线上办理 超值利率 快速抵押 额度最高
全网第一 最高额度
300万
扫码识别即可体验`,
    items: [
      {
        id: "poster-1",
        level: "high",
        page: 1,
        title: "使用禁止性绝对化用语",
        description: "「全网第一」属于《广告法》明确禁止使用的绝对化用语，涉嫌夸大宣传，无法提供权威依据证明，属于实质性违规，必须删除。",
        highlight: { top: 72, left: 45, width: 20, height: 5 },
        laws: [
          {
            name: "《中华人民共和国广告法》",
            article: "第九条：广告不得有下列情形：（三）使用“国家级”、“最高级”、“最佳”等用语。",
          },
        ],
      },
      {
        id: "poster-2",
        level: "high",
        page: 1,
        title: "未显著展示年化利率",
        description: "海报仅标注「3.7%」但未明确是否为「年化利率」，违反了央行及消保条例关于贷款产品必须显著标示年化利率（单利/复利）的规定。需改为「年化利率（单利）3.7% 起」。",
        highlight: { top: 40, left: 35, width: 30, height: 15 },
        laws: [
          {
            name: "《中国人民银行金融消费者权益保护实施办法》",
            article: "第十六条：金融机构向金融消费者提供金融产品或者服务时，应当使用有利于金融消费者接收、理解的方式，对产品或者服务的风险及责任承担进行提示。",
          },
        ],
      },
      {
        id: "poster-3",
        level: "high",
        page: 1,
        title: "虚假承诺与诱导营销",
        description: "「100% 放款，不看征信」属于误导性陈述。金融机构必须根据风险评估结果决定是否放款，此类表述涉嫌隐瞒金融风险，诱导消费者盲目借贷，必须删除。",
        highlight: { top: 18, left: 20, width: 60, height: 8 },
        laws: [
          {
            name: "《中华人民共和国广告法》",
            article: "第二十五条：招商等有投资回报预期的商品或者服务广告，应当对可能存在的风险以及风险责任承担有合理提示或者警示，并不得含有下列内容：（一）对未来效果、收益或者与其相关的情况作出保证性承诺，明示或者暗示保本、无风险或者保收益等。",
          },
        ],
      },
      {
        id: "poster-4",
        level: "low",
        page: 1,
        title: "缺少必要风险警示",
        description: "页面底部缺少「贷款需谨慎」、「请根据自身还款能力理性借贷」等必要风险提示语。根据消保要求，此类警示必须以显著、易辨识的方式展示。",
        highlight: { top: 90, left: 10, width: 80, height: 5 },
        laws: [
          {
            name: "《中华人民共和国广告法》",
            article: "第十八条：保健食品广告不得涉及疾病预防、治疗功能。",
          },
          {
            name: "《金融消费者权益保护实施方案》",
            article: "金融机构应当以显著方式向金融消费者披露产品或者服务的风险、收益等关键信息。",
          },
        ],
      },
    ],
  },
];

/** 气泡卡片：法规依据详情 */
function LawPopover({ laws }: { laws: { name: string; article: string }[] }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPosition({ top: rect.top, left: rect.left });
  };

  const handleOpen = () => {
    updatePosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!laws?.length) return null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          open ? setOpen(false) : handleOpen();
        }}
        className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-blue-900 hover:bg-blue-50/60"
      >
        <BookOpen className="size-3 text-blue-600" aria-hidden />
        查看法规依据
      </button>
      {open && position && (
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-80 rounded-xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.08)]"
          style={{ top: position.top - 8, left: position.left }}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <Scale className="size-3.5 text-blue-600" aria-hidden />
              <span className="text-[12px] font-semibold text-slate-900">法规依据详情</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="flex size-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-3" />
            </button>
          </div>
          {/* 列表 */}
          <div className="max-h-64 overflow-y-auto p-3">
            <div className="flex flex-col gap-3">
              {laws.map((law, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                  <div className="mb-1.5 flex items-start gap-1.5">
                    <Gavel className="mt-0.5 size-3 shrink-0 text-slate-500" aria-hidden />
                    <span className="text-[11px] font-semibold text-slate-800 leading-snug">
                      {law.name}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    {law.article}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 紧凑型分段控制器：实质性意见/非实质性建议 */
function SegmentedControl({
  value,
  onChange,
}: {
  value: "实质性意见" | "非实质性建议";
  onChange: (v: "实质性意见" | "非实质性建议") => void;
}) {
  return (
    <div className="inline-flex h-7 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-semibold shadow-sm">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChange("实质性意见");
        }}
        className={`h-full rounded-md px-2.5 transition-all ${
          value === "实质性意见"
            ? "bg-white text-slate-700 shadow-sm ring-1 ring-slate-300"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        实质性意见
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChange("非实质性建议");
        }}
        className={`h-full rounded-md px-2.5 transition-all ${
          value === "非实质性建议"
            ? "bg-white text-slate-700 shadow-sm ring-1 ring-slate-300"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        非实质性建议
      </button>
    </div>
  );
}

function formatIcon(fmt: FileFormat) {
  if (fmt === "pdf") {
    return <FileText className="size-4 text-red-600" aria-hidden />;
  }
  return <FileImage className="size-4 text-blue-600" aria-hidden />;
}

const RISK_STYLES: Record<RiskLevel, {
  label: string;
  tagClass: string;
  pdfBoxClass: string;
  pdfBoxActiveClass: string;
  ocrClass: string;
  ocrActiveClass: string;
}> = {
  high: {
    label: "高",
    tagClass: "bg-red-50 text-red-800 ring-1 ring-red-200",
    pdfBoxClass: "border-red-400/70 bg-red-500/12",
    pdfBoxActiveClass: "border-red-600 bg-red-500/22 animate-highlight-pulse-high",
    ocrClass: "bg-red-100/70 text-slate-900",
    ocrActiveClass: "bg-red-200/90 text-slate-900 ring-2 ring-red-500/70",
  },
  medium: {
    label: "中",
    tagClass: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
    pdfBoxClass: "border-amber-400/70 bg-amber-500/12",
    pdfBoxActiveClass: "border-amber-500 bg-amber-500/22 animate-highlight-pulse-medium",
    ocrClass: "bg-amber-100/70 text-slate-900",
    ocrActiveClass: "bg-amber-200/90 text-slate-900 ring-2 ring-amber-500/70",
  },
  low: {
    label: "低",
    tagClass: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    pdfBoxClass: "border-slate-400/70 bg-slate-500/12",
    pdfBoxActiveClass: "border-slate-500 bg-slate-500/22 animate-highlight-pulse-low",
    ocrClass: "bg-slate-200/70 text-slate-900",
    ocrActiveClass: "bg-slate-300/90 text-slate-900 ring-2 ring-slate-500/70",
  },
};

function RiskBadge({ level }: { level: RiskLevel }) {
  const c = RISK_STYLES[level];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${c.tagClass}`}
    >
      {c.label}
    </span>
  );
}

export function ReviewWorkbench() {
  const [activeFileId, setActiveFileId] = useState(FILES[0]!.id);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    FILES[0]!.items[0]!.id,
  );
  const [itemDescriptions, setItemDescriptions] = useState<
    Record<string, string>
  >(() => {
    const m: Record<string, string> = {};
    for (const f of FILES) {
      for (const it of f.items) m[it.id] = it.description;
    }
    return m;
  });
  /** 当前正在编辑的卡片 id */
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  /** 非受控 ref：onInput 时直接写入，避免触发全局重绘 */
  const tempTextRef = useRef<string>("");

  /** 默认全选；用户可手动剔除（取消勾选） */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(FILES.flatMap((f) => f.items.map((it) => it.id))),
  );
  /** 实质性意见/非实质性建议状态，默认高->实质性意见，中/低->非实质性建议 */
  const [materialities, setMaterialities] = useState<Record<string, "实质性意见" | "非实质性建议">>(
    () => {
      const m: Record<string, "实质性意见" | "非实质性建议"> = {};
      for (const f of FILES) {
        for (const it of f.items) {
          m[it.id] = it.materiality ?? (it.level === "high" ? "实质性意见" : "非实质性建议");
        }
      }
      return m;
    },
  );

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(520);

  const previewMeasureRef = useRef<HTMLDivElement>(null);
  const reviewListRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const ocrContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const isScrollingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 上传弹窗状态 */
  const [showUploadModal, setShowUploadModal] = useState(false);
  /** 上传进度状态：null=未上传, 0-100=进度, 'done'=完成, 'error'=失败 */
  const [uploadProgress, setUploadProgress] = useState<number | 'done' | 'error' | null>(null);
  /** 上传错误信息 */
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** 审查结论状态 */
  const [reviewConclusion, setReviewConclusion] = useState<"通过" | "整改后通过" | "驳回" | null>(null);
  /** PDF生成中状态 */
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  /** 生成审查报告PDF */
  const handleGenerateReport = async () => {
    if (!reviewConclusion) {
      alert("请先选择审查结论（通过/整改后通过/驳回）");
      return;
    }

    setIsGeneratingPdf(true);

    try {
      // 分类审查意见
      const substantiveItems = activeFile.items.filter(it => materialities[it.id] === "实质性意见");
      const nonSubstantiveItems = activeFile.items.filter(it => materialities[it.id] === "非实质性建议");

      // 构建HTML内容
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: "Microsoft YaHei", "PingFang SC", "SimHei", sans-serif; padding: 40px; font-size: 12px; line-height: 1.8; color: #333; }
            .title { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 30px; }
            .divider { border-top: 1px solid #ccc; margin: 20px 0; }
            .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px 0; }
            .file-info { margin-left: 10px; }
            .file-info p { margin: 5px 0; }
            .ocr-content { background: #f9f9f9; padding: 15px; margin-top: 10px; white-space: pre-wrap; font-size: 10px; border-radius: 4px; }
            .conclusion { font-size: 14px; font-weight: bold; }
            .conclusion.pass { color: #008000; }
            .conclusion.reform { color: #c88c00; }
            .conclusion.reject { color: #c80000; }
            .opinion-section { margin-top: 15px; }
            .opinion-category { font-size: 14px; font-weight: bold; margin: 15px 0 10px 0; }
            .opinion-item { margin: 15px 0; padding-left: 20px; }
            .opinion-item p { text-indent: 2em; margin: 8px 0; }
            .law-section { margin-top: 10px; padding-left: 30px; }
            .law-title { font-weight: bold; color: #555; margin: 5px 0; }
            .law-content { color: #666; padding-left: 10px; }
            .page-number { text-align: center; color: #999; font-size: 10px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="title">金融产品合规审查报告</div>
          
          <div class="divider"></div>
          
          <div class="section-title">一、审查源文件</div>
          <div class="file-info">
            <p><strong>文件名：</strong>${activeFile.name}</p>
            <p><strong>文件格式：</strong>${activeFile.format.toUpperCase()}</p>
            <p><strong>文件页数：</strong>${activeFile.items[0]?.page ?? 1} 页</p>
          </div>
          ${activeFile.ocrText ? `
          <div class="section-title" style="margin-top: 20px;">源文件内容（OCR识别）：</div>
          <div class="ocr-content">${activeFile.ocrText}</div>
          ` : ''}
          
          <div class="divider"></div>
          
          <div class="section-title">二、整体意见</div>
          <div class="conclusion ${reviewConclusion === "通过" ? "pass" : reviewConclusion === "整改后通过" ? "reform" : "reject"}">${reviewConclusion}</div>
          
          <div class="divider"></div>
          
          <div class="section-title">三、审查意见</div>
          <div class="opinion-section">
            ${substantiveItems.length > 0 ? `
            <div class="opinion-category">（一）实质性意见：</div>
            ${substantiveItems.map((item, index) => `
              <div class="opinion-item">
                <p>${index + 1}. ${item.description}</p>
                ${item.laws && item.laws.length > 0 ? `
                <div class="law-section">
                  <div class="law-title">相关法规依据：</div>
                  ${item.laws.map(law => `
                    <div class="law-content">
                      <strong>${law.name}</strong><br>
                      ${law.article}
                    </div>
                  `).join('<br>')}
                </div>
                ` : ''}
              </div>
            `).join('')}
            ` : ''}
            
            ${nonSubstantiveItems.length > 0 ? `
            <div class="opinion-category">（二）非实质性建议：</div>
            ${nonSubstantiveItems.map((item, index) => `
              <div class="opinion-item">
                <p>${index + 1}. ${item.description}</p>
                ${item.laws && item.laws.length > 0 ? `
                <div class="law-section">
                  <div class="law-title">相关法规依据：</div>
                  ${item.laws.map(law => `
                    <div class="law-content">
                      <strong>${law.name}</strong><br>
                      ${law.article}
                    </div>
                  `).join('<br>')}
                </div>
                ` : ''}
              </div>
            `).join('')}
            ` : ''}
          </div>
          
          <div class="page-number">第 1 页</div>
        </body>
        </html>
      `;

      // 创建临时iframe来渲染HTML（隐藏）
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // 等待内容渲染
        await new Promise(resolve => setTimeout(resolve, 500));

        // 使用html2canvas截图
        const canvas = await html2canvas(iframeDoc.body, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        // 转换为PDF
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });

        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        // 如果内容超过一页，分页处理
        const pageHeight = pdf.internal.pageSize.getHeight();
        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }

        // 保存PDF
        const fileNameWithoutExt = activeFile.name.replace(/\.[^/.]+$/, "");
        pdf.save(`审查报告_${fileNameWithoutExt}_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.pdf`);

        // 清理
        document.body.removeChild(iframe);
      }

    } catch (error) {
      console.error("生成PDF失败:", error);
      alert("生成PDF失败，请重试");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const activeFile = useMemo(
    () => FILES.find((f) => f.id === activeFileId) ?? FILES[0]!,
    [activeFileId],
  );

  useEffect(() => {
    const first = activeFile.items[0];
    setSelectedItemId(first?.id ?? null);
    setSelectedIds(new Set(activeFile.items.map((it) => it.id)));
    setMaterialities(() => {
      const m: Record<string, "实质性意见" | "非实质性建议"> = {};
      for (const it of activeFile.items) {
        m[it.id] = it.materiality ?? (it.level === "high" ? "实质性意见" : "非实质性建议");
      }
      return m;
    });
    setPdfLoadError(null);
    setNumPages(null);
    pageRefs.current = {};
  }, [activeFile]);

  /** 支持的文件格式 */
  const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx', '.txt'];
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

  /** 校验文件 */
  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `不支持的文件格式 "${file.name}"，仅支持：${ALLOWED_EXTENSIONS.join(' / ')}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `文件 "${file.name}" 超过 500MB 限制`;
    }
    return null;
  };

  /** 处理文件上传 */
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      setUploadProgress('error');
      return;
    }

    setUploadError(null);
    setUploadProgress(0);

    // 模拟上传进度
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        setUploadProgress('done');
        clearInterval(interval);
        // 3秒后关闭弹窗
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadProgress(null);
        }, 1500);
      } else {
        setUploadProgress(Math.round(progress));
      }
    }, 200);
  };

  const selectedItem = useMemo(
    () => activeFile.items.find((i) => i.id === selectedItemId),
    [activeFile.items, selectedItemId],
  );

  useEffect(() => {
    if (numPages != null && selectedItem?.page != null && selectedItem.page > numPages) {
      setNumPages(numPages);
    }
  }, [numPages, selectedItem?.page]);

  useEffect(() => {
    if (!selectedItemId || !activeFile.ocrSegments?.length) return;
    const t = requestAnimationFrame(() => {
      document
        .getElementById(`ocr-hit-${selectedItemId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(t);
  }, [selectedItemId, activeFileId, activeFile.ocrSegments]);

  useEffect(() => {
    const el = previewMeasureRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setPageWidth(Math.max(240, Math.min(580, el.clientWidth - 24)));
    });
    ro.observe(el);
    setPageWidth(Math.max(240, Math.min(580, el.clientWidth - 24)));
    return () => ro.disconnect();
  }, [activeFileId, activeFile.sourceUrl]);

  useEffect(() => {
    if (!selectedItem?.page || !numPages || !pdfContainerRef.current) return;
    const targetPageEl = pageRefs.current[selectedItem.page];
    if (targetPageEl) {
      targetPageEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedItem?.page, selectedItemId, numPages]);

  /** 源文件预览 → OCR 识别结果：等比同步滚动 */
  useEffect(() => {
    const pdfEl = pdfContainerRef.current;
    const ocrEl = ocrContainerRef.current;
    if (!pdfEl || !ocrEl) return;

    const handleScroll = () => {
      if (isScrollingRef.current) return;
      isScrollingRef.current = true;

      requestAnimationFrame(() => {
        const pdfMax = pdfEl.scrollHeight - pdfEl.clientHeight;
        if (pdfMax <= 0) {
          isScrollingRef.current = false;
          return;
        }
        const ratio = pdfEl.scrollTop / pdfMax;
        const ocrMax = ocrEl.scrollHeight - ocrEl.clientHeight;
        ocrEl.scrollTop = ratio * ocrMax;
        isScrollingRef.current = false;
      });
    };

    pdfEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => pdfEl.removeEventListener("scroll", handleScroll);
  }, []);

  /** 切换源文件时重置两个区域的滚动位置 */
  useEffect(() => {
    const pdfEl = pdfContainerRef.current;
    const ocrEl = ocrContainerRef.current;
    if (!pdfEl || !ocrEl) return;
    pdfEl.scrollTop = 0;
    ocrEl.scrollTop = 0;
  }, [activeFileId]);

  const stats = useMemo(() => {
    const items = activeFile.items;
    return {
      total: items.length,
      selected: selectedIds.size,
      high: items.filter((i) => i.level === "high").length,
      medium: items.filter((i) => i.level === "medium").length,
      low: items.filter((i) => i.level === "low").length,
    };
  }, [activeFile, selectedIds]);

  const showRealPdf = activeFile.format === "pdf" && Boolean(activeFile.sourceUrl);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/50 text-slate-900">
      <header className="flex h-11 shrink-0 items-center border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-blue-600" aria-hidden />
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            消保智能审查工作台
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            vibecoding from Erin
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[200px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-blue-50/40 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-900/70">
              待审文件
            </p>
          </div>
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {FILES.map((f) => {
              const selected = f.id === activeFileId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFileId(f.id)}
                  className={`flex w-full flex-col gap-1.5 rounded-lg border px-2 py-2 text-left transition ${
                    selected
                      ? "border-blue-200 bg-blue-50/90 shadow-sm ring-1 ring-blue-100"
                      : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">{formatIcon(f.format)}</span>
                    <span className="line-clamp-2 text-xs font-medium leading-snug text-slate-800">
                      {f.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pl-6">
                    <span className="text-[10px] font-medium text-slate-500">
                      {f.format.toUpperCase()}
                    </span>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-100">
                      {f.items.length} 项违规
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
          <div className="border-t border-slate-100 bg-slate-50/80 p-2">
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-200 bg-white py-2 text-xs font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-50/80"
            >
              <Upload className="size-3.5 text-blue-600" aria-hidden />
              上传文件
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-slate-50/70">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
            <div className="min-w-0 flex-1 pr-4">
              <p className="truncate text-sm font-semibold text-slate-900">
                {activeFile.name}
              </p>
              <p className="text-[11px] text-slate-500">
                当前材料 · {activeFile.format.toUpperCase()}
                {showRealPdf && numPages != null
                  ? ` · 共 ${numPages} 页`
                  : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/90 px-3 py-1.5 shadow-sm">
              <span className="text-[11px] font-medium text-blue-900/70">
                AI 识别置信度
              </span>
              <span className="text-sm font-bold tabular-nums text-blue-700">
                {activeFile.aiConfidence}%
              </span>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-2 gap-px bg-slate-200">
            <div className="min-h-0 bg-white">
              <div className="flex h-8 items-center border-b border-blue-100 bg-blue-50/50 px-3">
                <span className="text-[11px] font-semibold text-blue-900/80">
                  源文件预览
                </span>
              </div>
              <div ref={pdfContainerRef} className="h-[calc(100%-2rem)] overflow-y-auto overflow-x-hidden bg-slate-50/50">
                <div ref={previewMeasureRef} className="mx-auto max-w-2xl p-4 pb-8">
                  {showRealPdf && activeFile.sourceUrl ? (
                    <>
                      <p className="sticky top-0 z-10 rounded-lg bg-white/90 px-4 py-2 text-center text-[11px] text-slate-600 shadow-sm backdrop-blur-sm">
                        {numPages != null ? (
                          <>共 {numPages} 页 · 滚动查看全部内容 · 点击右侧审查意见跳转到对应页</>
                        ) : (
                          "加载中..."
                        )}
                      </p>
                      {pdfLoadError ? (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-xs text-red-800">
                          {pdfLoadError}
                        </p>
                      ) : (
                        <Document
                          file={activeFile.sourceUrl}
                          loading={
                            <div className="flex items-center justify-center gap-2 px-8 py-16 text-sm text-slate-600">
                              <Loader2 className="size-5 animate-spin text-blue-600" />
                              正在加载 PDF…
                            </div>
                          }
                          onLoadSuccess={({ numPages: n }) => {
                            setNumPages(n);
                            setPdfLoadError(null);
                          }}
                          onLoadError={(e) => {
                            setPdfLoadError(
                              e?.message ??
                                "PDF 加载失败，请确认 public 目录下存在该文件。",
                            );
                          }}
                          options={{
                            cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                            cMapPacked: true,
                          }}
                        >
                          {Array.from({ length: numPages ?? 0 }, (_, i) => i + 1).map((pageNum) => (
                            <div
                              key={pageNum}
                              ref={(el) => {
                                pageRefs.current[pageNum] = el;
                              }}
                              className="relative inline-block max-w-full rounded-lg border border-slate-200 bg-slate-100 shadow-lg shadow-slate-200/80"
                              style={{ marginBottom: "16px" }}
                            >
                              <Page
                                pageNumber={pageNum}
                                width={pageWidth}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                              />
                              <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-sm">
                                {activeFile.items.flatMap((it) => {
                                  const rects = it.pdfRects?.filter(
                                    (r) => r.page === pageNum,
                                  );
                                  if (!rects?.length) return [];
                                  const active = selectedItemId === it.id;
                                  const styleConfig = RISK_STYLES[it.level];
                                  return rects.map((r, idx) => {
                                    const style: CSSProperties = {
                                      top: `${r.top}%`,
                                      left: `${r.left}%`,
                                      width: `${r.width}%`,
                                      height: `${r.height}%`,
                                    };
                                    return (
                                      <div
                                        key={`${it.id}-${idx}`}
                                        style={style}
                                        className={`absolute rounded border-2 ${
                                          active
                                            ? styleConfig.pdfBoxActiveClass
                                            : styleConfig.pdfBoxClass
                                        }`}
                                      />
                                    );
                                  });
                                })}
                              </div>
                              <div className="absolute bottom-2 right-2 rounded bg-white/80 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm">
                                第 {pageNum} 页
                              </div>
                            </div>
                          ))}
                        </Document>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className="relative mx-auto overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-200/80"
                        style={{
                          width: `${pageWidth}px`,
                        }}
                      >
                        <img
                          src={activeFile.sourceUrl}
                          alt={activeFile.name}
                          className="w-full h-auto"
                        />
                        <div className="pointer-events-none absolute inset-0">
                          {activeFile.items.flatMap((it) => {
                            if (!it.highlight) return null;
                            const active = selectedItemId === it.id;
                            const style: CSSProperties = {
                              top: `${it.highlight.top}%`,
                              left: `${it.highlight.left}%`,
                              width: `${it.highlight.width}%`,
                              height: `${it.highlight.height}%`,
                            };
                            const styleConfig = RISK_STYLES[it.level];
                            return (
                              <div
                                key={it.id}
                                style={style}
                                className={`absolute rounded border-2 ${
                                  active
                                    ? styleConfig.pdfBoxActiveClass
                                    : styleConfig.pdfBoxClass
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <p className="mt-3 text-center text-[10px] text-slate-500">
                        示意预览 · 点击右侧审查意见可联动高亮区域
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="min-h-0 bg-white">
              <div className="flex h-8 items-center border-b border-blue-100 bg-blue-50/50 px-3">
                <span className="text-[11px] font-semibold text-blue-900/80">
                  OCR 识别结果
                </span>
              </div>
              <div ref={ocrContainerRef} className="h-[calc(100%-2rem)] overflow-y-auto bg-white">
                <div className="px-5 py-4 font-mono text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {activeFile.ocrSegments ? (
                    activeFile.ocrSegments.map((seg, i) => {
                      if (seg.hitId) {
                        const on = selectedItemId === seg.hitId;
                        const item = activeFile.items.find(it => it.id === seg.hitId);
                        const styleConfig = item ? RISK_STYLES[item.level] : RISK_STYLES.high;
                        return (
                          <mark
                            key={i}
                            id={`ocr-hit-${seg.hitId}`}
                            className={`rounded px-0.5 decoration-clone ${
                              on
                                ? styleConfig.ocrActiveClass
                                : styleConfig.ocrClass
                            }`}
                          >
                            {seg.text}
                          </mark>
                        );
                      }
                      return <span key={i}>{seg.text}</span>;
                    })
                  ) : (
                    <span>{activeFile.ocrText}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex w-[350px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-sm">
          <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="size-4 text-blue-600" aria-hidden />
              <span className="text-sm font-semibold text-slate-900">
                智能审查建议
              </span>
            </div>
            {/* 吸顶工具栏：全选 + 统计 */}
            <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
              {/* 全选复选框 */}
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.size === activeFile.items.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(activeFile.items.map((it) => it.id)));
                  }
                }}
                className="flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {selectedIds.size === activeFile.items.length ? (
                  <CheckSquare className="size-4 shrink-0 text-blue-600" aria-hidden />
                ) : selectedIds.size === 0 ? (
                  <Square className="size-4 shrink-0 text-slate-400" aria-hidden />
                ) : (
                  <span className="relative inline-flex size-4 shrink-0">
                    <span className="absolute inset-0 rounded border-2 border-blue-400 bg-blue-400/30" />
                    <span className="absolute inset-1 rounded-sm bg-blue-500" />
                  </span>
                )}
                <span className="text-[11px] font-semibold text-slate-800">全选</span>
              </button>

              {/* 分割线 */}
              <div className="h-4 w-px bg-slate-200" />

              {/* 实时统计 */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-600">
                  已选{" "}
                  <span className="font-bold tabular-nums text-blue-600">{stats.selected}</span>
                  {" "}/ {stats.total} 项
                </span>
              </div>

              {/* 右侧快速筛选 */}
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-red-600">高{stats.high}</span>
                <span className="text-[10px] font-semibold text-amber-700">中{stats.medium}</span>
                <span className="text-[10px] font-semibold text-slate-500">低{stats.low}</span>
              </div>
            </div>
          </div>

          <div ref={reviewListRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-3 pb-28">
            {activeFile.items.map((it) => {
              const selected = it.id === selectedItemId;
              return (
                <article
                  key={it.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedItemId(it.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedItemId(it.id);
                    }
                  }}
                  className={`relative rounded-xl border bg-white p-3 shadow-sm transition outline-none ${
                    selected
                      ? "border-blue-400 ring-2 ring-blue-100"
                      : "border-slate-200 hover:border-blue-200"
                  } ${!selectedIds.has(it.id) ? "opacity-60" : ""}`}
                >
                  {/* 卡片顶部：勾选 -> 标题 -> 风险等级 -> 页码 */}
                  <div className="mb-2 flex items-center gap-2">
                    {/* 第一位：Checkbox */}
                    <button
                      type="button"
                      aria-label={selectedIds.has(it.id) ? "取消选择" : "选择"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(it.id)) {
                            next.delete(it.id);
                          } else {
                            next.add(it.id);
                          }
                          return next;
                        });
                      }}
                      className="mt-0.5 shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      {selectedIds.has(it.id) ? (
                        <CheckSquare className="size-4 text-blue-600" aria-hidden />
                      ) : (
                        <Square className="size-4 text-slate-400" aria-hidden />
                      )}
                    </button>

                    {/* 第二位：标题 */}
                    <span className="min-w-0 flex-1 text-xs font-bold leading-snug text-slate-900 truncate">
                      {it.title}
                    </span>

                    {/* 第三/四位：风险等级 + 页码 */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      {RiskBadge({ level: it.level })}
                      {it.page != null && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 ring-1 ring-blue-100">
                          第 {it.page} 页
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 内容区：浅灰色背景容器 */}
                  <div className="rounded-lg bg-slate-100 p-3">
                    {/* 滑块：实质性意见 / 非实质性建议 */}
                    <div className="mb-2 flex justify-center">
                      <SegmentedControl
                        value={materialities[it.id]}
                        onChange={(v) =>
                          setMaterialities((prev) => ({ ...prev, [it.id]: v }))
                        }
                      />
                    </div>

                    {/* 审查意见文字（支持直接编辑） */}
                    <div
                      key={`${it.id}-${editingItemId === it.id}`}
                      contentEditable={editingItemId === it.id}
                      suppressContentEditableWarning
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingItemId !== it.id) {
                          tempTextRef.current = itemDescriptions[it.id] ?? it.description;
                          setEditingItemId(it.id);
                          if (!selectedIds.has(it.id)) {
                            setSelectedIds((prev) => new Set(prev).add(it.id));
                          }
                        }
                      }}
                      onInput={(e) => {
                        tempTextRef.current = e.currentTarget.textContent ?? "";
                        if (!selectedIds.has(it.id)) {
                          setSelectedIds((prev) => new Set(prev).add(it.id));
                        }
                      }}
                      dangerouslySetInnerHTML={{ __html: itemDescriptions[it.id] ?? it.description }}
                      className={`rounded-lg border px-3 py-2 text-xs leading-relaxed text-slate-800 ${
                        editingItemId === it.id
                          ? "cursor-text border-slate-400 bg-white outline-none"
                          : "cursor-default border-slate-200 bg-white"
                      }`}
                    />

                    {/* 编辑操作按钮 */}
                    {editingItemId === it.id && (
                      <div className="mt-2 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          data-edit-box={it.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItemId(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          <XCircle className="size-3" aria-hidden />
                          取消
                        </button>
                        <button
                          type="button"
                          data-edit-box={it.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemDescriptions((prev) => ({
                              ...prev,
                              [it.id]: tempTextRef.current || (itemDescriptions[it.id] ?? it.description),
                            }));
                            setEditingItemId(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          <Check className="size-3" aria-hidden />
                          确认
                        </button>
                      </div>
                    )}
                  </div>

                  <LawPopover laws={it.laws ?? []} />
                </article>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_24px_rgba(15,23,42,0.06)]">
            <div className="mb-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setReviewConclusion("通过")}
                className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                  reviewConclusion === "通过"
                    ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
              >
                通过
              </button>
              <button
                type="button"
                onClick={() => setReviewConclusion("整改后通过")}
                className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                  reviewConclusion === "整改后通过"
                    ? "border-amber-500 bg-amber-100 text-amber-800"
                    : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                }`}
              >
                整改后通过
              </button>
              <button
                type="button"
                onClick={() => setReviewConclusion("驳回")}
                className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                  reviewConclusion === "驳回"
                    ? "border-red-500 bg-red-100 text-red-800"
                    : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                }`}
              >
                驳回
              </button>
            </div>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isGeneratingPdf}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-700 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  生成中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 text-blue-100" aria-hidden />
                  生成审查报告
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* 上传文件弹窗 */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            setShowUploadModal(false);
            setUploadProgress(null);
            setUploadError(null);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={() => {
                setShowUploadModal(false);
                setUploadProgress(null);
                setUploadError(null);
              }}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-5" />
            </button>

            <h3 className="mb-4 text-center text-base font-semibold text-slate-900">上传文件</h3>

            {/* 拖拽上传区域 */}
            <div
              className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                uploadProgress !== null && uploadProgress !== 'error'
                  ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                  : uploadError
                    ? 'border-red-300 bg-red-50'
                    : 'border-blue-300 bg-blue-50/50 hover:border-blue-400 hover:bg-blue-50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                if (uploadProgress === null) {
                  e.currentTarget.classList.add('border-blue-500', 'bg-blue-100');
                  e.currentTarget.classList.remove('border-blue-300', 'bg-blue-50/50');
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100');
                e.currentTarget.classList.add('border-blue-300', 'bg-blue-50/50');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100');
                if (uploadProgress === null) {
                  handleFileUpload(e.dataTransfer.files);
                }
              }}
              onClick={() => {
                if (uploadProgress === null) {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_EXTENSIONS.join(',')}
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />

              {uploadProgress === null ? (
                <>
                  <CloudUpload className="mx-auto mb-3 size-12 text-blue-500" />
                  <p className="text-sm font-medium text-slate-700">将文件拖到此处，或点击上传</p>
                </>
              ) : uploadProgress === 'done' ? (
                <>
                  <CheckCircle className="mx-auto mb-3 size-12 text-green-500" />
                  <p className="text-sm font-medium text-green-600">上传成功！</p>
                </>
              ) : uploadProgress === 'error' ? (
                <>
                  <AlertCircle className="mx-auto mb-3 size-12 text-red-500" />
                  <p className="text-sm font-medium text-red-600">{uploadError || '上传失败'}</p>
                </>
              ) : (
                <>
                  <Loader className="mx-auto mb-3 size-12 animate-spin text-blue-500" />
                  <p className="text-sm font-medium text-slate-700">上传中... {uploadProgress}%</p>
                  <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* 文件限制说明 */}
            <div className="mt-4 flex justify-center gap-4 text-[11px] text-slate-400">
              <span>支持：PNG / JPG / PDF / Word / TXT</span>
              <span>单文件不超过 500MB</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
