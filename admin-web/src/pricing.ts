// 用户确认的收费口径：卡片费用与平台服务费分别列示。
export const recordCardPrices = { issue: 100, replacement: 100 } as const
export const recordCardFeeText = `农事记录卡办卡${recordCardPrices.issue}元/张，补卡${recordCardPrices.replacement}元/张`
export const farmerFeePolicy = `不向农户收平台服务费；${recordCardFeeText}。`
