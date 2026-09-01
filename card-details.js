(function(){
  const $=(id)=>document.getElementById(id);
  const interactiveSelector='button,a,input,select,textarea,label,summary,details,[role="button"],[contenteditable="true"]';
  const PAYEES_KEY='moneyPlanVendorAccounts';
  const FILTER_KEY='moneyPlanPaymentFilterV2';
  const GROUP_KEY='moneyPlanOpenBillGroupV2';

  function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function money(n){return 'MVR '+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});}
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

  function loadPayees(){
    try{
      const value=JSON.parse(localStorage.getItem(PAYEES_KEY))||{};
      return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    }catch{return {};}
  }
  function accountFor(name){
    const p=loadPayees()[String(name||'').trim().toLowerCase()];
    return p?.accountNumber?String(p.accountNumber):'';
  }
  function paidForBill(bill){
    try{return typeof paidValue==='function'?Number(paidValue(bill)||0):Number(bill?.[3]||0);}catch{return Number(bill?.[3]||0);}
  }
  function originalForBill(bill){
    try{return typeof originalBalanceValue==='function'?Number(originalBalanceValue(bill)||0):Number(bill?.[5]||bill?.[4]||0);}catch{return Number(bill?.[5]||bill?.[4]||0);}
  }
  function isCreditBill(bill){
    const category=String(bill?.[2]||'').trim().toLowerCase();
    if(category==='loan')return false;
    try{return typeof isCreditCategory==='function'?!!isCreditCategory(bill?.[2]):category.includes('credit')||category.includes('debt');}
    catch{return category.includes('credit')||category.includes('debt');}
  }
  function debtBills(kind){
    let bills=[];
    try{bills=Array.isArray(s?.bills)?s.bills:[];}catch{return [];}
    return bills.filter(bill=>{
      const category=String(bill?.[2]||'').trim().toLowerCase();
      const remaining=Number(bill?.[4]||0);
      if(remaining<=0)return false;
      if(kind==='loan')return category==='loan';
      if(kind==='credit')return isCreditBill(bill);
      return category==='loan'||isCreditBill(bill);
    });
  }

  function ensureDrawer(){
    if($('cardDetailBackdrop'))return;
    const wrap=document.createElement('div');
    wrap.id='cardDetailBackdrop';
    wrap.className='cardDetailBackdrop hidden';
    wrap.innerHTML='<aside class="cardDetailDrawer" role="dialog" aria-modal="true" aria-labelledby="cardDetailTitle">'+
      '<div class="cardDetailTop"><div><span>DETAIL VIEW</span><h2 id="cardDetailTitle">Details</h2></div><button type="button" id="cardDetailClose" class="cardDetailClose" aria-label="Close details">×</button></div>'+ 
      '<div class="cardDetailBody"><p id="cardDetailSummary" class="cardDetailSummary"></p><div id="cardDetailMetrics" class="cardDetailMetrics"></div><div id="cardDetailDebt" class="cardDetailDebt hidden"></div><div id="cardDetailText" class="cardDetailText"></div><button type="button" id="cardDetailAction" class="cardDetailAction hidden"></button><div class="cardDetailHint">Press Esc or click outside to close.</div></div>'+ 
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

  function groupTitle(group){return cleanText(group?.querySelector('.billGroupHead span')?.textContent);}
  function openDebtPayments(kind){
    try{activeBillFilter='all';}catch{}
    try{localStorage.setItem(FILTER_KEY,'all');}catch{}
    try{render();}catch{}
    try{openPage('payments');}catch{}
    setTimeout(()=>{
      try{activeBillFilter='all';render();}catch{}
      setTimeout(()=>{
        const groups=[...document.querySelectorAll('#paymentsView #bills .billGroup')];
        const group=groups.find(g=>{
          const t=groupTitle(g).toLowerCase();
          return kind==='loan'?(t==='loan'||t==='loans'):(t.includes('credit')||t.includes('debt'));
        });
        if(!group){jump('payments','#bills');return;}
        groups.forEach(g=>{
          const open=g===group;
          g.classList.toggle('compactCollapsed',!open);
          const toggle=g.querySelector('.groupToggle');
          if(toggle)toggle.setAttribute('aria-expanded',String(open));
        });
        try{localStorage.setItem(GROUP_KEY+':'+activeMonth+':all',groupTitle(group));}catch{}
        group.scrollIntoView({behavior:'smooth',block:'center'});
        group.classList.add('jumpFlash');
        setTimeout(()=>group.classList.remove('jumpFlash'),900);
      },80);
    },100);
  }

  function resetDrawerSections(){
    const debt=$('cardDetailDebt'); if(debt){debt.innerHTML='';debt.classList.add('hidden');}
    const text=$('cardDetailText'); if(text){text.innerHTML='';text.style.display='none';}
    const metrics=$('cardDetailMetrics'); if(metrics){metrics.innerHTML='';metrics.style.display='none';}
  }

  function addMetric(label,value){
    const box=$('cardDetailMetrics');
    const d=document.createElement('div');
    d.className='cardDetailMetric';
    d.innerHTML='<span></span><strong></strong>';
    d.querySelector('span').textContent=label;
    d.querySelector('strong').textContent=value;
    box.append(d);
  }

  function renderDebtSection(kind,title,bills){
    const debt=$('cardDetailDebt');
    const section=document.createElement('section');
    section.className='debtDetailSection';
    const total=bills.reduce((sum,b)=>sum+Number(b[4]||0),0);
    section.innerHTML='<div class="debtDetailSectionHead"><div><span></span><strong></strong></div><b></b></div><div class="debtDetailList"></div>';
    section.querySelector('span').textContent=kind==='loan'?'LOAN ACCOUNTS':'CREDIT ACCOUNTS';
    section.querySelector('strong').textContent=title;
    section.querySelector('b').textContent=money(total);
    const list=section.querySelector('.debtDetailList');
    if(!bills.length){
      list.innerHTML='<div class="debtDetailEmpty">No remaining '+(kind==='loan'?'loans':'credit balances')+'.</div>';
    }else{
      bills.forEach(bill=>{
        const remaining=Number(bill[4]||0);
        const planned=Number(bill[1]||0);
        const paid=paidForBill(bill);
        const original=originalForBill(bill);
        const account=accountFor(bill[0]);
        const pct=original>0?Math.max(0,Math.min(100,(remaining/original)*100)):0;
        const row=document.createElement('div');
        row.className='debtDetailRow';
        row.innerHTML='<div class="debtDetailMain"><div class="debtDetailName"><strong></strong><span></span></div><div class="debtDetailRemaining"><small>REMAINING</small><strong></strong></div></div>'+ 
          '<div class="debtDetailMeta"><span class="monthly"></span><span class="paid"></span><span class="account"></span></div>'+ 
          '<div class="debtDetailBar"><i></i></div>';
        row.querySelector('.debtDetailName strong').textContent=String(bill[0]||'Unnamed');
        row.querySelector('.debtDetailName span').textContent=kind==='loan'?'Loan':'Credit / debt';
        row.querySelector('.debtDetailRemaining strong').textContent=money(remaining);
        row.querySelector('.monthly').textContent='Monthly plan '+money(planned);
        row.querySelector('.paid').textContent=paid>0?'Paid this month '+money(paid):'Not paid this month';
        row.querySelector('.account').textContent=account?'A/C '+account:'No account number saved';
        row.querySelector('.debtDetailBar i').style.width=pct+'%';
        list.append(row);
      });
    }
    debt.append(section);
  }

  function showDebtDrawer(kind){
    ensureDrawer();
    resetDrawerSections();
    const loanList=debtBills('loan');
    const creditList=debtBills('credit');
    const list=kind==='loan'?loanList:kind==='credit'?creditList:[...creditList,...loanList];
    const total=list.reduce((sum,b)=>sum+Number(b[4]||0),0);
    const monthly=list.reduce((sum,b)=>sum+Number(b[1]||0),0);
    const paid=list.reduce((sum,b)=>sum+paidForBill(b),0);
    $('cardDetailTitle').textContent=kind==='loan'?'Loan details':kind==='credit'?'Credit & debt details':'Credit and loan details';
    $('cardDetailSummary').textContent=kind==='loan'?'See exactly whom you owe, what remains, and this month\'s planned payment.':kind==='credit'?'See each credit balance, remaining amount, and this month\'s plan.':'See every credit and loan balance separately.';
    addMetric('Total remaining',money(total));
    addMetric('Monthly plan',money(monthly));
    addMetric('Paid this month',money(paid));
    addMetric('Accounts',String(list.length));
    $('cardDetailMetrics').style.display='grid';
    const debt=$('cardDetailDebt');
    debt.classList.remove('hidden');
    if(kind==='loan')renderDebtSection('loan','Who to pay',loanList);
    else if(kind==='credit')renderDebtSection('credit','Who to pay',creditList);
    else{
      renderDebtSection('credit','Credit balances',creditList);
      renderDebtSection('loan','Loan balances',loanList);
    }
    const action=$('cardDetailAction');
    action.textContent=kind==='loan'?'Manage loan payments →':kind==='credit'?'Manage credit payments →':'Open all debt payments →';
    action.classList.remove('hidden');
    action.onclick=()=>{closeDrawer();openDebtPayments(kind==='credit'?'credit':'loan');};
    $('cardDetailBackdrop').classList.remove('hidden');
  }
  window.moneyPlanOpenDebtDetails=showDebtDrawer;

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
    if(el.matches('.salaryAllocationBox'))return {label:text.includes('next')?'Open deferred bills':'Open this salary bills',page:'payments',selector:'#bills'};
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
    if(el.matches('.debtOverview')){showDebtDrawer('all');return;}
    if(el.matches('.loanBalanceTile')){showDebtDrawer('loan');return;}
    if(el.matches('.balanceTile')&&el.closest('.debtOverview')){showDebtDrawer('credit');return;}
    ensureDrawer();
    resetDrawerSections();
    const title=titleFor(el),lines=textLines(el),metrics=metricPairs(el),route=routeFor(el);
    $('cardDetailTitle').textContent=title;
    const summary=lines.find(t=>t!==title&&!/^MVR\b/i.test(t)&&!/^\d+[%.]?/.test(t));
    $('cardDetailSummary').textContent=summary||'Open this card to review the information connected to it.';
    const metricBox=$('cardDetailMetrics');
    metrics.forEach(m=>addMetric(m.label,m.value));
    metricBox.style.display=metrics.length?'grid':'none';
    const textBox=$('cardDetailText');
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
