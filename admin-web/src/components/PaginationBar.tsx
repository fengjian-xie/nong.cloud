import { ChevronLeft, ChevronRight } from 'lucide-react'

const pageSizes = [20, 50, 100, 200]

type PaginationBarProps = {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function PaginationBar({ total, page, pageSize, onPageChange, onPageSizeChange }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  return <div className="pagination-bar">
    <span>共 {total} 条记录</span>
    <div className="page-size"><label>每页<select aria-label="每页条数" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>{pageSizes.map((size) => <option key={size} value={size}>{size} 条</option>)}</select></label></div>
    <nav aria-label="列表分页">
      <button aria-label="上一页" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft size={15}/></button>
      {pageNumbers.map((number) => <button key={number} className={number === currentPage ? 'active' : ''} aria-current={number === currentPage ? 'page' : undefined} onClick={() => onPageChange(number)}>{number}</button>)}
      <button aria-label="下一页" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}><ChevronRight size={15}/></button>
    </nav>
    <span>第 {currentPage}/{totalPages} 页</span>
  </div>
}
