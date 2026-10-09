// Native province/city/county selection uses WeChat's region picker.
// Initial township data: Fu'an, verified against Fujian Civil Affairs 2026-06-30 directory.
const source='https://mzt.fujian.gov.cn/gk/tzgg/202607/t20260710_7176497.htm'
const fuan=['城南街道','城北街道','阳头街道','罗江街道','赛岐镇','穆阳镇','上白石镇','潭头镇','社口镇','晓阳镇','溪潭镇','甘棠镇','下白石镇','溪尾镇','溪柄镇','湾坞镇','城阳镇','坂中畲族乡','范坑乡','穆云畲族乡','康厝畲族乡','松罗乡']
function townships(region){return Array.isArray(region)&&region.join('/')==='福建省/宁德市/福安市'?fuan.slice():[]}
function validTown(region,town){return townships(region).includes(town)}
module.exports={source,townships,validTown}
