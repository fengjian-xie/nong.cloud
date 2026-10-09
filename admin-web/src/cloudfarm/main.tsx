import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import CloudFarmSite from './CloudFarmSite'
import { AppErrorBoundary } from '../app/AppErrorBoundary'
import '../home/standalone.css'
import "../brand/vi.css"

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><BrowserRouter><CloudFarmSite/></BrowserRouter></AppErrorBoundary></React.StrictMode>)
