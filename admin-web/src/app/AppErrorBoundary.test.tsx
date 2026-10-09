// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {AppErrorBoundary} from './AppErrorBoundary'
function expectedFailure(event:ErrorEvent){if(event.message==='private implementation detail')event.preventDefault()}
beforeEach(()=>window.addEventListener('error',expectedFailure))
afterEach(()=>{cleanup();vi.restoreAllMocks();window.removeEventListener('error',expectedFailure)})
function FailedPage():never {throw new Error('private implementation detail')}
it('renders the healthy application without a recovery banner',()=>{
 render(<AppErrorBoundary><h1>正常页面</h1></AppErrorBoundary>)
 expect(screen.getByRole('heading',{name:'正常页面'})).toBeTruthy();expect(screen.queryByRole('alert')).toBeNull()
})
it('render or module failures show an accessible recovery state, not a blank page or private error',()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{})
 render(<AppErrorBoundary><FailedPage/></AppErrorBoundary>)
 expect(screen.getByRole('alert')).toBeTruthy();expect(screen.getByRole('heading',{name:'页面暂时无法加载'})).toBeTruthy()
 expect(screen.queryByText('private implementation detail')).toBeNull();expect(screen.getByText(/不会使用演示数据替代/)).toBeTruthy()
})
it('recovery requires an explicit user action and warns about unconfirmed writes',()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});const retry=vi.fn()
 render(<AppErrorBoundary onRetry={retry}><FailedPage/></AppErrorBoundary>)
 expect(retry).not.toHaveBeenCalled();expect(screen.getByText(/避免重复办理/)).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'重新加载页面'}));expect(retry).toHaveBeenCalledOnce()
})
