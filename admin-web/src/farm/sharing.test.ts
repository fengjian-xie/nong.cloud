import { expect, it } from 'vitest'
import { sharingPreview } from './sharing'
it('整数分计算，中心余款与服务费合计等于实收，限额向下取整', () => {
  expect(sharingPreview('100.01','10.00','10')).toEqual({totalFen:10001,platformFen:1000,centerFen:9001,maximumFen:1000})
  expect(sharingPreview('100','0','0').centerFen).toBe(10000)
})
it('拒绝未提供批准上限、超限、负值、精度越界和零实收', () => {
  for (const input of [['100','1',''],['100','20','10'],['100','-1','10'],['100.001','1','10'],['0','0','10'],['100','1','101']]) expect(() => sharingPreview(...input as [string,string,string])).toThrow()
})
