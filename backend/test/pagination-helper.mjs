/** Read a fixture by ID without assuming it lives on the first page of a reused test DB. */
export async function findPaginated(getPage,path,id) {
 for(let page=1;page<=100000;page++) {
  const result=await getPage(path+'?page='+page+'&size=100')
  const row=result.items.find(item=>item.id===id)
  if(row)return row
  if(!result.hasNext)return undefined
 }
 throw new Error('Fixture pagination exceeded the API page bound')
}
