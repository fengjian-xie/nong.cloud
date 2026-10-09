// Local calculator, not a WeChat Pay request or a signed commercial rule.
export function sharingPreview(amount: string, fee: string, approvedPercent: string) {
  const money = (text: string) => {
    if (!/^\d+(\.\d{1,2})?$/.test(text.trim())) throw new Error('金额须为非负数，最多两位小数')
    const fen = Math.round(Number(text) * 100)
    if (!Number.isSafeInteger(fen) || fen > 10000000000) throw new Error('金额超出本地测算范围')
    return fen
  }
  const totalFen = money(amount), platformFen = money(fee)
  if (!totalFen) throw new Error('示例实收金额须大于0')
  if (!/^\d+(\.\d{1,2})?$/.test(approvedPercent.trim()) || Number(approvedPercent) > 100) throw new Error('须填写该中心已批准上限的示例值（0–100%），不能假定统一比例')
  const basisPoints = Math.round(Number(approvedPercent) * 100)
  const maximumFen = Number(BigInt(totalFen) * BigInt(basisPoints) / 10000n)
  if (platformFen > maximumFen) throw new Error('约定服务费超过示例实收金额或该中心的批准上限')
  return { totalFen, platformFen, centerFen: totalFen - platformFen, maximumFen }
}
