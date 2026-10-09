import { Component, type ReactNode } from 'react'
import './app-load-error.css'

/** A failed lazy import or render must not leave a blank page or display mock data. */
export class AppErrorBoundary extends Component<{children:ReactNode;onRetry?:()=>void},{failed:boolean}> {
  state = { failed:false }
  static getDerivedStateFromError() { return {failed:true} }
  render() {
    if(!this.state.failed)return this.props.children
    return <main className="app-load-error" role="alert">
      <h1>页面暂时无法加载</h1>
      <p>页面资源加载或运行失败。请检查连接后重新加载；不会使用演示数据替代。</p>
      <p>重新加载可能清除尚未保存的表单。已提交但未确认的操作，请先核对数据库记录，避免重复办理。</p>
      <button type="button" onClick={this.props.onRetry || (()=>window.location.reload())}>重新加载页面</button>
    </main>
  }
}
