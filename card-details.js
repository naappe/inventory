(function(){
  const $=(id)=>document.getElementById(id);
  const interactiveSelector='button,a,input,select,textarea,label,summary,details,[role="button"],[contenteditable="true"]';

  function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function titleFor(el){
    const explicit=el.getAttribute('data-details-title');
    if(explicit)return explicit;
    const heading=el.querySelector('h1,h2,h3,.modernMetricLabel,.bankBalanceLabel,.salaryPlanStat span,.positionStat span,.compactBillStat span,.historySummaryItem span,.billInfo strong,.vendorRow strong');
    return cleanText(heading?.textContent)||'Details';
  }
  function textLines(el){
    const clone=el.cloneNode(true);
    clone.querySelectorAll('button,a,input,select,textarea,script,style,.groupToggle,.billActions,.cardDetailTrigger').forEach(n=>n.remove());
    const lines=[];
    clone.querySelectorAll('h1,h2,h3,strong,span,small,p,b').forEach(node=>{
      const t=cleanText(node.textContent);
      if(t&&t.length<180&&!lines.includes(t))lines.push(t);
    });
    return lines.slice(0,12);
  }
  function metricPairs(el){
    const pairs=[];
    const candidates=el.querySelectorAll('.modernMetric,.salaryPlanStat,.salaryAllocationBox,.positionStat,.compactBillStat,.historySummaryItem,.plannedMetric,.paidMetric,.billStatus,.dashboardCashGrid>div');
    candidates.forEach(node=>{
      if(node===el&&candidates.length>1)return;
      const label=cleanText(node.querySelector('span,small,.modernMetricLabel')?.textContent);
      const value=cleanText(node.querySelector('strong,b,.modernMetricValue')?.textContent);
      if(label&&value&&value!==label&&!pairs.some(p=>p.label===label&&p.value===value))pairs.push({label,value});
    });
    if(!pairs.length){
      const label=cleanText(el.querySelector('span,small,.modernMetricLabel')?.textContent);
      const value=cleanText(el.querySelector('strong,b,.modernMetricValue')?.textContent);
      if(label&&value)pairs.push({label,value});
    }
    return pairs.slice(0,8);
  }

  function ensureDrawer(){
    if($('cardDetailBackdrop'))return;
    const wrap=document.createElement('div');
    wrap.id='cardDetailBackdrop';
    wrap.className='cardDetailBackdrop hidden';
    wrap.innerHTML='<aside class="cardDetailDrawer" role="dialog" aria-modal="true" aria-labelledby="cardDetailTitle">'+
      '<div class="cardDetailTop"><div><span>DETAIL VIEW</span><h2 id="cardDetailTitle">Details</h2></div><button type="button" id="cardDetailClose" class="cardDetailClose" aria-label="Close details">×</button></div>'+ 
      '<div class="cardDetailBody"><p id="cardDetailSummary" class="cardDetailSummary"></p><div id="cardDetailMetrics" class="cardDetailMetrics"></div><div id="cardDetailText" class="cardDetailText"></div><button type="button" id="cardDetailAction" class="cardDetailAction hidden"></button><div class="cardDetailHint">Press Esc or click outside to close.</div></div>'+ 
      '</aside>';
    document.body.append(wrap);
    $('cardDetailClose').onclick=closeDrawer;
    wrap.addEventListener('click',e=>{if(e.target===wrap)closeDrawer();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
  }
  function closeDrawer(){const d=$('cardDetailBackdrop');if(d)d.classList.add('hidden');}

  function jump(page,selector){
    try{openPage(page);}catch{}
    setTimeout(()=>{
      const target=selector?document.querySelector(selector):null;
      if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.add('jumpFlash');setTimeout(()=>target.classList.remove('jumpFlash'),900);}
    },70);
  }

  function routeFor(el){
    const text=cleanText(el.textContent).toLowerCase();
    if(el.matches('.modernMetric')){
      if(text.includes('paid this month'))return {label:'Open payment history',page:'history',selector:'#transactionList'};
      if(text.includes('bills remaining'))return {label:'Open unpaid bills',page:'payments',selector:'#bills'};
      if(text.includes('safe after bills'))return {label:'Open money position',page:'spending',selector:'#spendingPosition'};
      if(text.includes('monthly income'))return {label:'Open income and bank',page:'payments',selector:'#paymentsView .paymentTop'};
    }
    if(el.matches('.salaryPlanStat')){
      if(text.includes('salary')||text.includes('income'))return {label:'Open salary and bank',page:'payments',selector:'#paymentsView .paymentTop'};
      if(text.includes('paid'))return {label:'Open payment history',page:'history',selector:'#transactionList'};
      if(text.includes('unpaid')||text.includes('planned'))return {label:'Open bills',page:'payments',selector:'#bills'};
      if(text.includes('available'))return {label:'Open money position',page:'spending',selector:'#spendingPosition'};
    }
    if(el.matches('.salaryAllocationBox')){
      return {label:text.includes('next')?'Open deferred bills':'Open this salary bills',page:'payments',selector:'#bills'};
    }
    if(el.matches('.positionStat')){
      if(el.classList.contains('bank'))return {label:'Open bank balance',page:'payments',selector:'#bankBalancePanel'};
      if(el.classList.contains('reserve'))return {label:'Open old bills',page:'spending',selector:'.carryCard'};
      if(el.classList.contains('free'))return {label:'Open money position',page:'spending',selector:'#spendingPosition'};
      if(el.classList.contains('spent'))return {label:'Open purchases',page:'spending',selector:'#purchaseLedger'};
      if(el.classList.contains('credit'))return {label:'Open shop credit',page:'spending',selector:'#vendorCreditList'};
    }
    if(el.matches('.upcomingRow'))return {label:'Open this bill',page:'payments',selector:'#bills'};
    if(el.matches('.bill'))return {label:'Open in Payments',page:'payments',selector:'#bills'};
    if(el.matches('.vendorRow'))return {label:'Open Payees',page:'payees',selector:'#vendorManager'};
    if(el.matches('.historySummaryItem'))return {label:'Open transactions',page:'history',selector:'#transactionList'};
    if(el.matches('.budgetAlert'))return {label:'Open payments',page:'payments',selector:'#bills'};
    if(el.id==='upcomingPaymentsCard')return {label:'Open payments',page:'payments',selector:'#bills'};
    if(el.id==='dashboardCashFlow')return {label:'Open spending details',page:'spending',selector:'#spendingPosition'};
    if(el.classList.contains('salaryPlanCard'))return {label:'Open salary plan',page:'payments',selector:'.salaryPlanCard'};
    if(el.closest('#payeesView'))return {label:'Open Payees',page:'payees',selector:'#vendorManager'};
    if(el.closest('#historyView'))return {label:'Open History',page:'history',selector:'#transactionList'};
    if(el.closest('#categoriesView'))return {label:'Open Settings',page:'categories',selector:'#categoriesView'};
    if(el.closest('#spendingView'))return {label:'Open Spending',page:'spending',selector:'#spendingView'};
    if(el.closest('#paymentsView'))return {label:'Open Payments',page:'payments',selector:'#paymentsView'};
    if(el.closest('#dashboardView'))return {label:'Open Dashboard',page:'dashboard',selector:'#dashboardView'};
    return null;
  }

  function showDrawer(el){
    ensureDrawer();
    const title=titleFor(el),lines=textLines(el),metrics=metricPairs(el),route=routeFor(el);
    $('cardDetailTitle').textContent=title;
    const summary=lines.find(t=>t!==title&&!/^MVR\b/i.test(t)&&!/^\d+[%.]?/.test(t));
    $('cardDetailSummary').textContent=summary||'Open this card to review the information connected to it.';
    const metricBox=$('cardDetailMetrics');metricBox.innerHTML='';
    metrics.forEach(m=>{const d=document.createElement('div');d.className='cardDetailMetric';d.innerHTML='<span></span><strong></strong>';d.querySelector('span').textContent=m.label;d.querySelector('strong').textContent=m.value;metricBox.append(d);});
    metricBox.style.display=metrics.length?'grid':'none';
    const textBox=$('cardDetailText');textBox.innerHTML='';
    lines.filter(t=>t!==title&&t!==summary).slice(0,8).forEach(t=>{const d=document.createElement('div');d.textContent=t;textBox.append(d);});
    textBox.style.display=textBox.children.length?'grid':'none';
    const action=$('cardDetailAction');
    if(route){action.textContent=route.label+' →';action.classList.remove('hidden');action.onclick=()=>{closeDrawer();jump(route.page,route.selector);};}
    else{action.classList.add('hidden');action.onclick=null;}
    $('cardDetailBackdrop').classList.remove('hidden');
  }

  function directRoute(el){
    if(el.matches('.modernMetric,.salaryPlanStat,.salaryAllocationBox,.positionStat,.upcomingRow'))return routeFor(el);
    return null;
  }

  function wire(el){
    if(!el||el.dataset.cardDetailsReady)return;
    if(el.matches('details,.purchaseRow,summary'))return;
    if(el.dataset.jumpReady||el.dataset.debtJump)return;
    el.dataset.cardDetailsReady='1';
    el.classList.add('detailsClickable');
    const complex=!!el.querySelector('form,input,select,textarea');
    if(complex)el.classList.add('detailsComplex'); else el.classList.add('detailsArrow');
    if(!complex){el.tabIndex=0;el.setAttribute('role','button');}
    const activate=(event)=>{
      const inner=event.target.closest(interactiveSelector);
      if(inner&&inner!==el)return;
      if(event.target.closest('[data-jump-ready],[data-debt-jump]'))return;
      const route=directRoute(el);
      if(route){jump(route.page,route.selector);return;}
      showDrawer(el);
    };
    el.addEventListener('click',activate);
    el.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!complex){event.preventDefault();activate(event);}});
  }

  function candidates(){
    return document.querySelectorAll([
      'main .modernMetric','main .salaryPlanStat','main .salaryAllocationBox','main .positionStat','main .historySummaryItem',
      'main .dashboardCashGrid>div','main .upcomingRow','main .budgetAlert','main .vendorRow','main .bill',
      'main .salaryPlanCard','main .card'
    ].join(','));
  }
  function wireAll(){candidates().forEach(wire);}

  const observer=new MutationObserver(()=>requestAnimationFrame(wireAll));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  const oldRender=typeof render==='function'?render:null;
  if(oldRender){render=function(){oldRender();setTimeout(wireAll,0);};}
  const oldOpen=typeof openPage==='function'?openPage:null;
  if(oldOpen){openPage=function(page){oldOpen(page);setTimeout(wireAll,0);};}
  setTimeout(wireAll,0);
})();
