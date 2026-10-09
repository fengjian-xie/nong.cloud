import { useEffect } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { BrandLockup } from '../brand/BrandLockup'
import OpenApiPage from './OpenApiPage'
import { apiSiteDomain, isApiPreviewPath } from './site'
import { connectedMode } from '../connected/client'
import ConnectedApiPortal from '../connected/ConnectedApiPortal'

export default function ApiSite() {
  return connectedMode ? <ConnectedApiPortal/> : <DemoApiSite/>
}
function DemoApiSite() {
  const { pathname } = useLocation()
  const home = isApiPreviewPath(pathname) ? '/api-portal' : '/'
  useEffect(() => {
    const title = document.title; const description = document.querySelector('meta[name="description"]'); const previous = description?.getAttribute('content')
    document.title = `乡桥API开放平台 · ${apiSiteDomain}`; description?.setAttribute('content', '乡桥API开放平台 · 接口文档、接入应用与本地调试沙箱')
    return () => { document.title = title; if (previous !== null && previous !== undefined) description?.setAttribute('content', previous) }
  }, [])
  if (!['/', '/api-portal', '/api-portal/'].includes(pathname)) return <Navigate to={home} replace/>
  return <div className="app-shell api-site">
    <header className="api-site-header"><div className="api-site-header-inner"><Link to={home} className="api-site-brand" aria-label="乡桥开放平台"><BrandLockup context="乡桥开放平台" domain={apiSiteDomain}/></Link><div className="api-site-header-links"><span>开发者站点 · 前端演示</span><a href="https://nong.cloud/" target="_blank" rel="noreferrer">乡桥农事中心<ArrowUpRight size={14}/></a></div></div></header>
    <main className="api-site-main"><OpenApiPage standalone/></main>
    <footer className="api-site-footer"><span>乡桥农业有限公司 · {apiSiteDomain}</span><span>文档与本地沙箱 · 未开放生产接口</span></footer>
  </div>
}
