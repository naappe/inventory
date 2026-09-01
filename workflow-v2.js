(function(){
  const WORKFLOW_KEY='moneyPlanWorkflowSectionV2';
  const SALARY_KEY='moneyPlanSalaryPlanV1';
  const PAYEES_KEY='moneyPlanVendorAccounts';
  const BANK_KEY='moneyPlanBankBalance';
  const FILTER_KEY='moneyPlanPaymentFilterV2';
  const GROUP_KEY='moneyPlanOpenBillGroupV2';
  const $=id=>document.getElementById(id);
  const money=n=>'MVR '+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const norm=v=>String(v||'').trim().toLowerCase();
  const legacyOpen=typeof openPage==='function'?openPage:null;

  function currentMonthName(){
    const value=String(activeMonth||'');
    if(!/^\d{4}-\d{2}$/.test(value))return value;
    const [y,m]=value.split('-').map(Number);
    return new Date(y,m-1,1).toLocaleDateString(undefined,{month:'long',year:'numeric'});
  }
  function loadObject(key){
    try{const v=JSON.parse(localStorage.getItem(key))||{};return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {};}
  }
  function hasBank(){return localStorage.getItem(BANK_KEY)!==null;}
  function bank(){const n=Number(localStorage.getItem(BANK_KEY));return Number.isFinite(n)?n:0;}
  function payeeAccount(name){const p=loadObject(PAYEES_KEY)[norm(name)];return p?.accountNumber?String(p.accountNumber):'';}
  function paidFor(b){try{return Number(paidValue(b)||0)}catch{return b?.[3]?Number(b?.[1]||0):0;}}
  function dueFor(b){return Math.max(0,Number(b?.[1]||0)-paidFor(b));}
  function originalFor(b){try{return Number(originalBalanceValue(b)||0)}catch{return Math.max(Number(b?.[5]||0),Number(b?.[4]||0)+Number(b?.[6]||0));}}
  function isDebt(b){
    const c=norm(b?.[2]);
    if(c==='loan')return true;
    try{return typeof isCreditCategory==='function'?!!isCreditCategory(b?.[2]):/(debt|credit)/.test(c);}catch{return /(debt|credit)/.test(c);}
  }
  function isLoan(b){return norm(b?.[2])==='loan';}
  function salaryState(){
    const all=loadObject(SALARY_KEY);
    return all[activeMonth]&&typeof all[activeMonth]==='object'?all[activeMonth]:{};
  }
  function salaryKey(b){return norm(b?.[0])+'||'+norm(b?.[2]);}
  function isDeferred(b){return !!salaryState()[salaryKey(b)];}
  function monthTotals(){
    const bills=Array.isArray(s?.bills)?s.bills:[];
    let planned=0,paid=0,thisDue=0,nextDue=0;
    bills.forEach(b=>{
      planned+=Math.max(0,Number(b?.[1]||0));
      paid+=paidFor(b);
      const due=dueFor(b);
      if(due<=.004)return;
      if(isDeferred(b))nextDue+=due;else thisDue+=due;
    });
    return {planned,paid,thisDue,nextDue,bank:hasBank()?bank():null,after:hasBank()?bank()-thisDue:null};
  }

  function addNavButton(nav,{id,label,icon,section}){
    const b=document.createElement('button');
    b.type='button';b.id=id;b.className='workflowNavBtn';b.dataset.workflow=section;
    b.innerHTML='<span class="workflowNavIcon" aria-hidden="true">'+icon+'</span><span>'+label+'</span>';
    b.onclick=()=>openSection(section);
    nav.append(b);
    return b;
  }
  function navLabel(nav,text){const d=document.createElement('div');d.className='workflowNavLabel';d.textContent=text;nav.append(d);}
  function ensureNav(){
    const nav=document.querySelector('.nav');if(!nav)return;
    if(nav.dataset.workflowV2==='1')return;
    nav.dataset.workflowV2='1';nav.innerHTML='';
    navLabel(nav,'MONTH FLOW');
    addNavButton(nav,{id:'workflowOverviewNav',label:'Overview',icon:'◫',section:'overview'});
    addNavButton(nav,{id:'workflowPlanNav',label:'Monthly Plan',icon:'▤',section:'plan'});
    addNavButton(nav,{id:'workflowPayNav',label:'Pay',icon:'→',section:'pay'});
    addNavButton(nav,{id:'spendingNav',label:'Spending',icon:'＋',section:'spending'});
    navLabel(nav,'RECORDS');
    addNavButton(nav,{id:'workflowDebtsNav',label:'Debts',icon:'≡',section:'debts'});
    addNavButton(nav,{id:'payeesNav',label:'Payees',icon:'◎',section:'payees'});
    addNavButton(nav,{id:'historyNav',label:'History',icon:'↺',section:'history'});
    addNavButton(nav,{id:'workflowSettingsNav',label:'Settings',icon:'⚙',section:'settings'});
    const hint=document.createElement('div');hint.className='workflowFlowHint';hint.innerHTML='<b>Month flow</b><br>Plan → Pay → Spend → Review';nav.append(hint);
    const ot=document.createElement('a');ot.className='otNavLink';ot.href='./ot.html';ot.innerHTML='<span class="workflowNavIcon">OT</span><span>OT Work</span>';nav.append(ot);
    const sub=document.querySelector('.head .sub');if(sub)sub.textContent='Plan → Pay → Spend → Review';
  }

  function ensureOverviewHead(){
    const view=$('dashboardView');if(!view||$('workflowOverviewHead'))return;
    const h=document.createElement('div');h.id='workflowOverviewHead';h.className='workflowPageHead';
    h.innerHTML='<div><span class="workflowPageEyebrow">'+currentMonthName()+'</span><h2>Overview</h2><p>See what is in the bank, what still needs attention, and what you still owe.</p></div>'+ 
      '<div class="workflowQuickActions"><button type="button" id="overviewPlanBtn">Plan month</button><button type="button" id="overviewPayBtn" class="primary">Pay bills</button></div>';
    view.insertBefore(h,view.firstChild);
    $('overviewPlanBtn').onclick=()=>openSection('plan');$('overviewPayBtn').onclick=()=>openSection('pay');
  }
  function arrangeOverview(){
    ensureOverviewHead();
    const details=$('dashboardDetails');if(!details)return;
    const cash=$('dashboardCashFlow'),upcoming=$('upcomingPaymentsCard'),debt=details.querySelector('.debtOverview'),alerts=details.querySelector('.alertCard');
    [cash,upcoming,debt,alerts].filter(Boolean).forEach(el=>details.append(el));
  }

  function ensurePaymentsHead(){
    const view=$('paymentsView');if(!view||$('workflowPaymentsHead'))return;
    const h=document.createElement('div');h.id='workflowPaymentsHead';h.className='workflowPaymentsHead';
    h.innerHTML='<div><span id="workflowPaymentsEyebrow" class="workflowPageEyebrow"></span><h2 id="workflowPaymentsTitle"></h2><p id="workflowPaymentsText"></p></div>'+ 
      '<span id="workflowModeBadge" class="workflowModeBadge"></span>';
    const strip=document.createElement('div');strip.id='workflowPayStrip';strip.className='workflowPayStrip';
    strip.innerHTML='<div class="workflowPayStat"><span>Bank now</span><strong id="workflowPayBank">—</strong></div>'+ 
      '<div class="workflowPayStat due"><span>Pay now</span><strong id="workflowPayDue">MVR 0</strong></div>'+ 
      '<div class="workflowPayStat next"><span>Next salary</span><strong id="workflowPayNext">MVR 0</strong></div>'+ 
      '<div id="workflowPayAfterCard" class="workflowPayStat safe"><span>Bank after pay now</span><strong id="workflowPayAfter">—</strong></div>';
    view.insertBefore(h,view.firstChild);h.insertAdjacentElement('afterend',strip);
  }
  function updatePaymentsHead(mode){
    ensurePaymentsHead();
    const eyebrow=$('workflowPaymentsEyebrow'),title=$('workflowPaymentsTitle'),text=$('workflowPaymentsText'),badge=$('workflowModeBadge');
    if(!title)return;
    eyebrow.textContent=currentMonthName();
    if(mode==='plan'){
      title.textContent='Monthly Plan';
      text.textContent='Set salary, add planned bills, and decide what this salary can cover before money leaves the bank.';
      badge.textContent='1 · PLAN';
    }else{
      title.textContent='Pay';
      text.textContent='Only bills assigned to this salary belong here. Recording payment changes the bank and History.';
      badge.textContent='2 · PAY';
    }
    const t=monthTotals();
    $('workflowPayBank').textContent=t.bank===null?'Not set':money(t.bank);
    $('workflowPayDue').textContent=money(t.thisDue);
    $('workflowPayNext').textContent=money(t.nextDue);
    $('workflowPayAfter').textContent=t.after===null?'—':money(t.after);
    $('workflowPayAfterCard').classList.toggle('danger',t.after!==null&&t.after<0);
  }

  function billFromRow(row){
    const name=norm(row.querySelector('.billInfo strong')?.textContent);
    const cat=norm(row.querySelector('.billInfo small')?.textContent);
    const matches=(s.bills||[]).filter(b=>norm(b?.[0])===name);
    return matches.find(b=>cat.startsWith(norm(b?.[2])))||matches[0]||null;
  }
  function applyPlanRowActions(){
    document.querySelectorAll('#paymentsView #bills .bill').forEach(row=>{
      const bill=billFromRow(row),control=row.querySelector('.friendlyBillControl');if(!bill||!control)return;
      let btn=control.querySelector('.workflowPlanAllocation');
      if(!btn){btn=document.createElement('button');btn.type='button';btn.className='friendlyPrimary workflowPlanAllocation';control.insertBefore(btn,control.firstChild);}
      btn.classList.remove('isDeferred','isPaid');
      const due=dueFor(bill),paid=paidFor(bill),deferred=row.classList.contains('salaryDeferred');
      if(due<=.004&&paid>0){btn.textContent='Paid';btn.disabled=true;btn.classList.add('isPaid');return;}
      if(Number(bill?.[1]||0)<=.004){
        btn.textContent='Set plan';btn.disabled=false;
        btn.onclick=e=>{e.preventDefault();e.stopPropagation();row.querySelector('.billActions .edit')?.click();};
        return;
      }
      btn.disabled=false;
      if(deferred){
        btn.textContent='Bring to this salary';btn.classList.add('isDeferred');
      }else btn.textContent='Move to next salary';
      btn.onclick=e=>{e.preventDefault();e.stopPropagation();row.querySelector('.billActions .salaryDeferBtn')?.click();};
    });
  }
  function removePlanRowActions(){document.querySelectorAll('.workflowPlanAllocation').forEach(b=>b.remove());}

  function setFilter(value){
    try{activeBillFilter=value;}catch{}
    try{localStorage.setItem(FILTER_KEY,value);}catch{}
    try{render();}catch{}
  }
  function updateBillsHeading(mode){
    const title=document.querySelector('#paymentsView .billsCard .sectionHead h2');
    const sub=document.querySelector('#paymentsView .billsCard .sectionHead .sub');
    if(!title||!sub)return;
    if(mode==='plan'){
      title.textContent='Allocate this month';
      sub.textContent='Choose what this salary pays now and what must wait for the next salary. Red = not paid · Blue = pending · Green = paid.';
    }else{
      title.textContent='Bills to pay';
      sub.textContent='Pay only when money actually leaves the bank. Bills kept for next salary are hidden here.';
    }
  }
  function applyPaymentMode(mode,{resetFilter=false}={}){
    document.body.dataset.paymentMode=mode;
    updatePaymentsHead(mode);updateBillsHeading(mode);
    if(resetFilter)setFilter('waiting');
    if(mode==='plan')setTimeout(applyPlanRowActions,20);else removePlanRowActions();
  }

  function ensureDebtsView(){
    if($('debtsView'))return;
    const main=document.querySelector('main'),footer=document.querySelector('.summaryFooter');if(!main)return;
    const v=document.createElement('section');v.id='debtsView';v.className='extraView hidden';
    v.innerHTML='<div class="workflowPageHead"><div><span class="workflowPageEyebrow">BALANCES</span><h2>Debts</h2><p>Loans and credit are long-term balances. Monthly payments are shown separately from what remains.</p></div><div class="workflowQuickActions"><button type="button" id="debtsPlanBtn">Plan payments</button><button type="button" id="debtsPayBtn" class="primary">Pay debt</button></div></div>'+ 
      '<div class="debtSummaryGrid"><div class="debtSummaryCard credit"><span>Credit remaining</span><strong id="debtCreditTotal">MVR 0</strong></div><div class="debtSummaryCard loan"><span>Loans remaining</span><strong id="debtLoanTotal">MVR 0</strong></div><div class="debtSummaryCard"><span>Debt plan this month</span><strong id="debtMonthlyPlan">MVR 0</strong></div><div class="debtSummaryCard paid"><span>Paid this month</span><strong id="debtPaidMonth">MVR 0</strong></div></div>'+ 
      '<div class="debtColumns"><section class="card debtPanel"><div class="debtPanelHead"><div><h2>Credit & debt</h2><p>Shop or personal credit balances.</p></div><strong id="creditPanelTotal">MVR 0</strong></div><div id="creditDebtList" class="debtAccountList"></div></section>'+ 
      '<section class="card debtPanel"><div class="debtPanelHead"><div><h2>Loans</h2><p>People, bank and other loan balances.</p></div><strong id="loanPanelTotal">MVR 0</strong></div><div id="loanDebtList" class="debtAccountList"></div></section></div>';
    main.insertBefore(v,footer||null);
    $('debtsPlanBtn').onclick=()=>openSection('plan');$('debtsPayBtn').onclick=()=>openSection('pay');
  }
  function debtStatus(b){
    const remaining=Math.max(0,Number(b?.[4]||0)),plan=Math.max(0,Number(b?.[1]||0)),paid=paidFor(b);
    if(remaining<=.004)return {cls:'paid',text:'Finished'};
    if(plan<=.004)return {cls:'neutral',text:'No payment planned'};
    if(paid>=plan-.004)return {cls:'paid',text:'Paid this month'};
    if(paid>.004)return {cls:'pending',text:'Partial · '+money(Math.max(0,plan-paid))+' left this month'};
    if(isDeferred(b))return {cls:'pending',text:'Next salary'};
    return {cls:'due',text:'Due this month'};
  }
  function debtRow(b,kind){
    const remaining=Math.max(0,Number(b?.[4]||0)),original=originalFor(b),cumulative=Math.max(0,original-remaining),plan=Math.max(0,Number(b?.[1]||0)),paid=paidFor(b),account=payeeAccount(b?.[0]),status=debtStatus(b);
    const row=document.createElement('div');row.className='debtAccountRow';
    row.innerHTML='<div class="debtAccountTop"><div class="debtAccountName"><strong></strong><span></span></div><div class="debtRemaining"><small>REMAINING</small><strong></strong></div></div>'+ 
      '<div class="debtAccountMeta"><div class="debtMetaCell"><span>Original</span><b class="original"></b></div><div class="debtMetaCell"><span>Paid overall</span><b class="overall"></b></div><div class="debtMetaCell"><span>This month plan</span><b class="monthly"></b></div></div>'+ 
      '<div class="debtAccountBottom"><span class="debtStatus"></span><button type="button" class="debtManageBtn"></button></div>';
    row.querySelector('.debtAccountName strong').textContent=String(b?.[0]||'Unnamed');
    row.querySelector('.debtAccountName span').textContent=(account?'A/C '+account+' · ':'')+(kind==='loan'?'Loan':'Credit / debt');
    row.querySelector('.debtRemaining strong').textContent=money(remaining);
    row.querySelector('.original').textContent=money(original);
    row.querySelector('.overall').textContent=money(cumulative);
    row.querySelector('.monthly').textContent=plan>0?money(plan)+(paid>0?' · '+money(paid)+' paid':''):'No plan';
    const sEl=row.querySelector('.debtStatus');sEl.className='debtStatus '+status.cls;sEl.textContent=status.text;
    const btn=row.querySelector('.debtManageBtn');
    if(remaining<=.004){btn.textContent='Finished ✓';btn.disabled=true;}else{
      btn.textContent='Manage';btn.onclick=()=>openPayForDebt(b,kind);
    }
    return row;
  }
  function renderDebtList(holder,bills,kind){
    holder.innerHTML='';
    if(!bills.length){holder.innerHTML='<div class="debtEmpty">No '+(kind==='loan'?'loans':'credit balances')+' in this month.</div>';return;}
    bills.sort((a,b)=>Number(b?.[4]||0)-Number(a?.[4]||0)).forEach(b=>holder.append(debtRow(b,kind)));
  }
  function renderDebts(){
    ensureDebtsView();
    const debts=(s.bills||[]).filter(isDebt),loans=debts.filter(isLoan),credits=debts.filter(b=>!isLoan(b));
    const rem=list=>list.reduce((a,b)=>a+Math.max(0,Number(b?.[4]||0)),0);
    const plan=debts.reduce((a,b)=>a+Math.max(0,Number(b?.[1]||0)),0);
    const paid=debts.reduce((a,b)=>a+paidFor(b),0);
    $('debtCreditTotal').textContent=money(rem(credits));$('debtLoanTotal').textContent=money(rem(loans));$('debtMonthlyPlan').textContent=money(plan);$('debtPaidMonth').textContent=money(paid);
    $('creditPanelTotal').textContent=money(rem(credits));$('loanPanelTotal').textContent=money(rem(loans));
    renderDebtList($('creditDebtList'),credits,'credit');renderDebtList($('loanDebtList'),loans,'loan');
  }

  function openPayForDebt(b,kind){
    try{activeBillFilter='all';localStorage.setItem(FILTER_KEY,'all');render();}catch{}
    openSection('pay',{keepFilter:true});
    setTimeout(()=>{
      const groups=[...document.querySelectorAll('#paymentsView #bills .billGroup')];
      const group=groups.find(g=>{
        const t=norm(g.querySelector('.billGroupHead span')?.textContent);
        return kind==='loan'?(t==='loan'||t==='loans'):(t.includes('credit')||t.includes('debt'));
      });
      if(group){
        groups.forEach(g=>g.classList.toggle('compactCollapsed',g!==group));
        try{localStorage.setItem(GROUP_KEY+':'+activeMonth+':all',group.querySelector('.billGroupHead span')?.textContent||'');}catch{}
      }
      const target=[...document.querySelectorAll('#paymentsView #bills .bill')].find(r=>norm(r.querySelector('.billInfo strong')?.textContent)===norm(b?.[0]));
      (target||group||$('bills'))?.scrollIntoView({behavior:'smooth',block:'center'});
      if(target){target.classList.add('jumpFlash');setTimeout(()=>target.classList.remove('jumpFlash'),900);}
    },180);
  }

  function allViews(){return ['dashboardView','paymentsView','spendingView','debtsView','payeesView','historyView','categoriesView'].map($).filter(Boolean);}
  function showCustom(id){allViews().forEach(v=>v.classList.add('hidden'));$(id)?.classList.remove('hidden');}
  function updateNav(section){
    document.querySelectorAll('.workflowNavBtn').forEach(b=>b.classList.toggle('active',b.dataset.workflow===section));
  }
  function canonical(page){
    if(page==='dashboard')return 'overview';
    if(page==='categories')return 'settings';
    if(page==='payments'){
      const remembered=localStorage.getItem(WORKFLOW_KEY);return remembered==='plan'||remembered==='pay'?remembered:'pay';
    }
    return ['overview','plan','pay','spending','debts','payees','history','settings'].includes(page)?page:'overview';
  }
  function openSection(request,opts={}){
    const section=canonical(request);
    ensureAll();
    localStorage.setItem(WORKFLOW_KEY,section);
    document.body.dataset.moneySection=section;
    if(section==='overview')legacyOpen?.('dashboard');
    else if(section==='plan'||section==='pay')legacyOpen?.('payments');
    else if(section==='spending')legacyOpen?.('spending');
    else if(section==='payees')legacyOpen?.('payees');
    else if(section==='history')legacyOpen?.('history');
    else if(section==='settings')legacyOpen?.('categories');
    else if(section==='debts'){try{render();}catch{}showCustom('debtsView');}
    if(section==='plan'||section==='pay')applyPaymentMode(section,{resetFilter:!opts.keepFilter});
    else delete document.body.dataset.paymentMode;
    if(section==='debts')renderDebts();
    if(section==='overview')arrangeOverview();
    updateNav(section);
    setTimeout(()=>{updateNav(section);if(section==='plan'||section==='pay')applyPaymentMode(section);if(section==='debts')renderDebts();},80);
    if(!opts.keepScroll)window.scrollTo({top:0,behavior:'auto'});
  }

  function ensureAll(){ensureNav();ensureOverviewHead();ensurePaymentsHead();ensureDebtsView();arrangeOverview();}

  // All existing code that says openPage("payments") now lands in the right workflow context.
  openPage=function(page){return openSection(page);};
  window.moneyPlanOpenSection=openSection;

  // Keep the new views refreshed whenever the underlying app renders.
  const previousRender=typeof render==='function'?render:null;
  if(previousRender){render=function(){previousRender();setTimeout(()=>{
    ensureAll();renderDebts();
    const section=localStorage.getItem(WORKFLOW_KEY)||'overview';
    if(section==='plan'||section==='pay')applyPaymentMode(section);
  },35);};}

  // Overview debt cards still open the detailed drawer; its manage button routes into Pay.
  document.addEventListener('click',e=>{
    const quick=e.target.closest?.('[data-workflow-jump]');if(!quick)return;
    e.preventDefault();openSection(quick.dataset.workflowJump);
  });

  function boot(){
    ensureAll();
    const old=localStorage.getItem('moneyPlanModernPage')||localStorage.getItem('moneyPlanActivePage');
    let first=localStorage.getItem(WORKFLOW_KEY);
    if(!first){first=old==='payments'?'plan':old==='categories'?'settings':old||'overview';}
    openSection(first,{keepScroll:true});
  }
  setTimeout(boot,40);setTimeout(()=>{ensureAll();const sct=localStorage.getItem(WORKFLOW_KEY)||'overview';updateNav(sct);},240);
})();
