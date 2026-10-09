import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AdminApp from './AdminApp'
import { AppErrorBoundary } from './AppErrorBoundary'
import './styles.css'
import './responsive.css'
import './badges.css'
import '../farm/farm.css'
import "../brand/vi.css"

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><BrowserRouter><AdminApp/></BrowserRouter></AppErrorBoundary></React.StrictMode>)
