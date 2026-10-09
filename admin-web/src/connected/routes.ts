/** A route is not permission. Unimplemented routes must not resolve to an unrelated module. */
const paths: Record<string,string> = {
 '/plots':'plots','/manage/production/plots':'plots',
 '/records':'records','/manage/production/records':'records',
 '/cards':'cards','/manage/production/cards':'cards',
 '/card-requests':'cardRequests','/manage/production/card-requests':'cardRequests',
 '/service-requests':'requests','/services':'orders','/manage/services/orders':'orders',
 '/services/help-center':'tickets','/manage/customer/support':'tickets',
 '/messages':'messages','/identity-applications':'applications',
 '/settings/news':'news','/manage/customer/news':'news',
 '/settings/social':'social','/manage/customer/social':'social',
 '/settings/logs':'audit','/manage/platform/logs':'audit',
 '/memberships':'memberships','/membership-plans':'plans','/stock-batches':'stock','/trade-orders':'trades',
 '/manage/platform/centers':'centers','/manage/finance/merchants':'merchants','/manage/finance/settlement':'settlements',
 '/manage/services/standards':'standards',
}
export function resolveConnectedPath(path: string): {module: string|null;available:boolean} {
 const clean=path.replace(/\/$/,'')||'/'
 if(clean==='/'||clean==='/login'||clean==='/work-preview')return {module:null,available:true}
 return paths[clean]?{module:paths[clean],available:true}:{module:null,available:false}
}
export function connectedPath(module:string) {return Object.entries(paths).find(([path,id])=>id===module&&!path.startsWith('/manage/'))?.[0]||'/'}
