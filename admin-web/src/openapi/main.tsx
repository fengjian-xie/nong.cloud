import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ApiSite from './ApiSite'
import { AppErrorBoundary } from '../app/AppErrorBoundary'
import '../app/styles.css'
import '../app/responsive.css'
import '../app/badges.css'
import '../farm/farm.css'
import "../brand/vi.css"

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><BrowserRouter><ApiSite/></BrowserRouter></AppErrorBoundary></React.StrictMode>)
