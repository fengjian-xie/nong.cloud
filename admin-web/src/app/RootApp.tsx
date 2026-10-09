import { lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { isApiPreviewPath, isApiSiteHost } from '../openapi/site'
import { isHomePreviewPath, isHomeSiteHost } from '../home/site'
import { isFarmPreviewPath, isFarmSiteHost } from '../cloudfarm/site'
import { isWorkSiteHost } from '../work/site'

const ApiSite = lazy(() => import('../openapi/ApiSite'))
const AdminApp = lazy(() => import('./AdminApp'))
const HomeSite = lazy(() => import('../home/HomeSite'))
const CloudFarmSite = lazy(() => import('../cloudfarm/CloudFarmSite'))
const WorkSite = lazy(() => import('../work/WorkSite'))

export function RootApp({ hostname = window.location.hostname }: { hostname?: string }) {
  const { pathname } = useLocation()
  const standalone = import.meta.env.MODE === 'api-site' || isApiSiteHost(hostname) || isApiPreviewPath(pathname)
  const homepage = import.meta.env.MODE === 'home-site' || isHomeSiteHost(hostname) || isHomePreviewPath(pathname)
  const farm = import.meta.env.MODE === 'farm-site' || isFarmSiteHost(hostname) || isFarmPreviewPath(pathname)
  const work = import.meta.env.MODE === 'work-site' || isWorkSiteHost(hostname)
  return <Suspense fallback={<div className="app-boot">正在加载乡桥平台…</div>}>{standalone ? <ApiSite/> : work ? <WorkSite/> : farm ? <CloudFarmSite/> : homepage ? <HomeSite/> : <AdminApp/>}</Suspense>
}
