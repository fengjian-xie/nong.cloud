export const apiSiteDomain = 'api.nong.cloud'
export const apiSiteOrigin = `https://${apiSiteDomain}`
export const plannedApiBase = `${apiSiteOrigin}/open-api/v1`
export const isApiSiteHost = (hostname: string) => hostname.toLowerCase().replace(/\.$/, '') === apiSiteDomain
export const isApiPreviewPath = (pathname: string) => /^\/api-portal(?:\/|$)/.test(pathname)
export const apiSiteEntry = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? '/api-portal' : apiSiteOrigin
