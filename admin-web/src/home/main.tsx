import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import HomeSite from './HomeSite'
import { AppErrorBoundary } from '../app/AppErrorBoundary'
import './standalone.css'
import "../brand/vi.css"

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><BrowserRouter><HomeSite/></BrowserRouter></AppErrorBoundary></React.StrictMode>)
