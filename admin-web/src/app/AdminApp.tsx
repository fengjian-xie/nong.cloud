import { AuthProvider } from '../auth/AuthContext'
import { FarmProvider } from '../farm/FarmProvider'
import { App } from './App'
import { connectedMode } from '../connected/client'
import ConnectedWorkspace from '../connected/ConnectedWorkspace'

export default function AdminApp() { return connectedMode ? <ConnectedWorkspace/> : <AuthProvider><FarmProvider><App/></FarmProvider></AuthProvider> }
