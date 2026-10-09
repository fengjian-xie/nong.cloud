export const farmTitle = '乡桥农场 · nc.nong.cloud'
export const farmDescription = '乡桥云农场交互演示：浏览地块影像、体验签约申请、关注地块与跟踪示例农事记录。真实摄像头、合同与交易尚未接入。'
export const demoNotice = '场景演示，未接入真实地块、摄像头与正式合同。'
export const isFarmSiteHost = (hostname: string) => hostname.toLowerCase().replace(/\.$/, '') === 'nc.nong.cloud'
export const isFarmPreviewPath = (pathname: string) => pathname === '/cloud-preview' || pathname.startsWith('/cloud-preview/')
export const farmAsset = (filename: string) => `${import.meta.env.BASE_URL}brand/${filename}`

export const plots = [
  { id: 'grape-a', name: '葡萄园A区（示例）', crop: '葡萄', location: '福安产区（示例）', image: 'fuan-vineyard.jpg', cameraConfigured: true },
  { id: 'grape-b', name: '葡萄园B区（示例）', crop: '葡萄', location: '福安产区（示例）', image: 'fuan-grapes.jpg', cameraConfigured: true },
  { id: 'observation', name: '种植观察区（示例）', crop: '葡萄', location: '福安产区（示例）', image: 'fuan-panorama.jpg', cameraConfigured: false },
] as const
export type FarmPlot = typeof plots[number]
export const findPlot = (id: string) => plots.find(plot => plot.id === id)
export const records = [
  { title: '萌芽期观察', description: '气温回升，葡萄开始萌芽，观察长势与新梢情况。' },
  { title: '花期管理', description: '进入花期，进行疏花、通风等田间管理。' },
  { title: '采收准备', description: '果实逐步转色，开展采收前的园区清理与设备检查。' },
] as const

export function filterPlots(search: string, crop: string, camera: string) {
  const query = search.trim().toLowerCase()
  return plots.filter(plot => (!query || `${plot.name}${plot.crop}${plot.location}`.toLowerCase().includes(query))
    && (!crop || plot.crop === crop)
    && (!camera || plot.cameraConfigured === (camera === 'configured')))
}
