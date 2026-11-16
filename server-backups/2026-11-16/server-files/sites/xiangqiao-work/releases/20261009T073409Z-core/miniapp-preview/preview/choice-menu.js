// Browser-preview adapter. Shares the same CSS and single-choice behavior as PC.
(function () {
 window.XqChoiceMenu = function (root) {
  const trigger = root.querySelector('[role=combobox]'), panel = root.querySelector('[role=listbox]')
  let options = [], value = '', onChange = () => {}, open = false, active = 0
  const selected = () => Math.max(0, options.findIndex(option => option.value === value))
  function render() {
   root.classList.toggle('open', open); panel.hidden = !open
   trigger.setAttribute('aria-expanded', String(open)); trigger.textContent = options.find(option => option.value === value)?.label || '选择其他角色页面'
   if(open && options[active])trigger.setAttribute('aria-activedescendant', panel.id+'-'+active);else trigger.removeAttribute('aria-activedescendant')
   panel.replaceChildren()
   for(const [index, option] of options.entries()) {
    const button = document.createElement('button');button.type='button';button.id=panel.id+'-'+index;button.tabIndex=-1;button.className='xq-choice-option'+(index===active?' is-active':'');button.setAttribute('role','option');button.setAttribute('aria-selected', String(option.value===value));button.textContent=option.label
    button.onmousedown=event=>event.preventDefault()
    button.onclick=()=>choose(option.value)
    panel.append(button)
   }
   const current=panel.children[active]
   if(open&&current){const top=current.offsetTop,bottom=top+current.offsetHeight;if(top<panel.scrollTop)panel.scrollTop=top;else if(bottom>panel.scrollTop+panel.clientHeight)panel.scrollTop=bottom-panel.clientHeight}
  }
  function close() { open=false;render() }
  function choose(next) { close();trigger.focus({preventScroll:true});onChange(next) }
  trigger.onclick=()=>{open=!open;active=selected();render()}
  const outside=event=>{if(open&&!root.contains(event.target))close()}
  document.addEventListener('pointerdown',outside)
  root.onfocusout=event=>{if(open&&!root.contains(event.relatedTarget))close()}
  root.onkeydown=event=>{
   const key=event.key
   if(key==='Escape'){if(open){event.preventDefault();close();trigger.focus()}return}
   if(key==='Tab'){close();return}
   if(!options.length)return
   if(['ArrowDown','ArrowUp','Home','End'].includes(key)){event.preventDefault();active=key==='Home'?0:key==='End'?options.length-1:!open?selected():(active+(key==='ArrowDown'?1:-1)+options.length)%options.length;open=true;render()}
   else if(key==='Enter'||key===' '){event.preventDefault();if(open)choose(options[active].value);else{open=true;active=selected();render()}}
  }
  return { update(nextOptions,nextValue,nextOnChange) { options=nextOptions;value=nextValue;onChange=nextOnChange;active=selected();open=false;render() }, destroy() { document.removeEventListener('pointerdown',outside);trigger.onclick=null;root.onfocusout=null;root.onkeydown=null;close() } }
 }
})()
