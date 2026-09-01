(function(){
  const SALARY_KEY='moneyPlanSalaryPlanV1';
  const CARRY_KEY='moneyPlanCarryoverV1';
  const TX_KEY='moneyPlanTransactionsV1';
  const FILTER_KEY='moneyPlanPaymentFilterV2';
  const $=id=>document.getElementById(id);
  const money=n=>'MVR '+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const signed=n=>(n>0?'+':n<0?'−':'')+money(Math.abs(Number(n||0)));
  const norm=v=>String(v||'').trim().toLowerCase();
  let lastMode='';
  let filterAdjusting=false;

  function loadObject(key){try{const v=JSON.parse(localStorage.getItem(key))||{};return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {};}}
  function loadArray(key){try{const v=JSON.parse(localStorage.getItem(key))||[];return Array.isArray(v)?v:[]}catch{return [];}}
  function paidFor(b){try{return Number(paidValue(b)||0)}catch{return b?.[3]?Number(b?.[1]||0):0;}}
  function dueFor(b){return Math.max(0,Number(b?.[1]||0)-paidFor(b));}
  function salaryKey(b){return norm(b?.[0])+'||'+norm(b?.[2]);}
  function deferredMap(){const all=loadObject(SALARY_KEY);return all[activeMonth]||{};}
  function isDeferred(b){return !!deferredMap()[salaryKey(b)];}
  function carryRemaining(){
    const rec=loadObject(CARRY_KEY)[activeMonth];
    return (rec?.items||[]).reduce((sum,item)=>sum+Math.max(0,Number(item?.originalDue||0)-Number(item?.paidAmount||0)),0);
  }
  function monthTotals(){
    let paid=0,planned=0,thisDue=0,nextDue=0;
    (s.bills||[]).forEach(b=>{
      paid+=paidFor(b);planned+=Math.max(0,Number(b?.[1]||0));
      const due=dueFor(b);if(due<=.004)return;
      if(isDeferred(b))nextDue+=due;else thisDue+=due;
    });
    const raw=localStorage.getItem('moneyPlanBankBalance'),bank=raw===null?null:Number(raw);
    return {paid,planned,thisDue,nextDue,bank:Number.isFinite(bank)?bank:null,carry:carryRemaining()};
  }

  function enforceModeFilter(){
    const mode=document.body.dataset.paymentMode||'';
    if(!mode||mode===lastMode)return;
    lastMode=mode;
    const desired=mode==='plan'?'all':'waiting';
    let current='';try{current=activeBillFilter}catch{}
    if(current===desired)return;
    try{activeBillFilter=desired;localStorage.setItem(FILTER_KEY,desired);}catch{}
    if(filterAdjusting)return;
    filterAdjusting=true;
    setTimeout(()=>{try{render();}catch{}filterAdjusting=false;},0);
  }

  function rowBill(row){
    const name=norm(row.querySelector('.billInfo strong')?.textContent);
    const cat=norm(row.querySelector('.billInfo small')?.textContent);
    const matches=(s.bills||[]).filter(b=>norm(b?.[0])===name);
    return matches.find(b=>cat.startsWith(norm(b?.[2])))||matches[0]||null;
  }
  function replaceGroupSummary(group,mode){
    group.querySelector('.workflowFreshSummary')?.remove();
    const rows=[...group.querySelectorAll(':scope > .bill')];
    const relevant=mode==='plan'?rows.filter(r=>!r.classList.contains('statusPaid')):rows.filter(r=>!r.classList.contains('salaryDeferred'));
    group.classList.toggle('workflowNoPlanWork',mode==='plan'&&!relevant.length);
    group.classList.toggle('workflowNoPayWork',mode==='pay'&&!relevant.length);
    if(!relevant.length)return;
    let due=0,paidCount=0,pending=0,notPaid=0;
    relevant.forEach(r=>{
      const b=rowBill(r);if(!b)return;
      const d=dueFor(b);due+=d;
      if(d<=.004&&paidFor(b)>0)paidCount++;
      else if(r.classList.contains('statusPending'))pending++;
      else if(d>.004)notPaid++;
    });
    const sEl=document.createElement('span');sEl.className='workflowFreshSummary';
    if(due<=.004){sEl.classList.add('green');sEl.textContent='All paid';}
    else if(mode==='plan'){
      sEl.classList.add(pending?'blue':'red');
      sEl.textContent=(notPaid+pending)+' to plan · '+money(due);
    }else{
      sEl.classList.add('red');sEl.textContent=(notPaid+pending)+' to pay · '+money(due);
    }
    group.querySelector('.billGroupHead')?.append(sEl);
  }
  function refreshGroups(){
    const mode=document.body.dataset.paymentMode;if(mode!=='plan'&&mode!=='pay')return;
    document.querySelectorAll('#paymentsView #bills .billGroup').forEach(g=>replaceGroupSummary(g,mode));
  }

  function refreshOverview(){
    if(!$('dashboardView')||$('dashboardView').classList.contains('hidden'))return;
    const t=monthTotals();
    const paidLabel=$('modernPaid')?.closest('.modernMetric')?.querySelector('.modernMetricLabel');
    const dueLabel=$('modernRemaining')?.closest('.modernMetric')?.querySelector('.modernMetricLabel');
    const safeLabel=$('modernSafe')?.closest('.modernMetric')?.querySelector('.modernMetricLabel');
    const incomeLabel=$('modernIncome')?.closest('.modernMetric')?.querySelector('.modernMetricLabel');
    if(paidLabel)paidLabel.textContent='Bills paid';
    if(dueLabel)dueLabel.textContent='Pay now';
    if(safeLabel)safeLabel.textContent='Free after commitments';
    if(incomeLabel)incomeLabel.textContent='Monthly salary';
    if($('modernPaid'))$('modernPaid').textContent=money(t.paid);
    if($('modernRemaining'))$('modernRemaining').textContent=money(t.thisDue);
    if($('modernIncome'))$('modernIncome').textContent=money(Number(s.income||0));
    if($('modernSafe')){
      if(t.bank===null){$('modernSafe').textContent='—';if($('modernSafeHint'))$('modernSafeHint').textContent='Set bank balance in Monthly Plan';}
      else{
        const free=t.bank-t.carry-t.thisDue;
        $('modernSafe').textContent=money(free);
        if($('modernSafeHint'))$('modernSafeHint').textContent='After old bills + bills assigned to this salary';
        $('modernSafeCard')?.classList.toggle('danger',free<0);
      }
    }
  }

  function renderFreshHistory(){
    const list=$('transactionList');if(!list)return;
    const rows=loadArray(TX_KEY).filter(t=>!t.month||t.month===activeMonth);
    if($('txCount'))$('txCount').textContent=rows.filter(t=>['payment','purchase','credit-payment'].includes(t.kind)).length;
    if($('txPaid'))$('txPaid').textContent=money(rows.filter(t=>Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount||0)),0));
    if($('txAdjust'))$('txAdjust').textContent=rows.filter(t=>t.kind==='adjustment'||t.kind==='opening').length;
    list.innerHTML='';
    if(!rows.length){list.innerHTML='<div class="emptyState"><div><div class="emptyMark">0</div><strong>No transactions yet</strong><span>Payments, purchases and bank corrections will appear here.</span></div></div>';return;}
    rows.slice(0,150).forEach(t=>{
      const r=document.createElement('div');r.className='transactionRow';const d=new Date(t.at);
      r.innerHTML='<div class="transactionMain"><strong></strong><span></span></div><div class="transactionAmount"></div><div class="transactionBank"></div>';
      r.querySelector('strong').textContent=t.label||'Transaction';
      r.querySelector('.transactionMain span').textContent=d.toLocaleString(undefined,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})+(t.note?' · '+t.note:'');
      const a=r.querySelector('.transactionAmount');
      a.textContent=t.amount===null?'Balance set':signed(t.amount);
      if(t.amount!==null)a.classList.add(Number(t.amount)<0?'negative':Number(t.amount)>0?'positive':'');
      r.querySelector('.transactionBank').textContent='Bank after: '+money(t.bankAfter);
      list.append(r);
    });
  }

  function arrangeSettings(){
    const stack=document.querySelector('#categoriesView .settingsStack');if(!stack)return;
    const cards=[...stack.querySelectorAll(':scope > .card')];
    const byTitle=text=>cards.find(c=>norm(c.querySelector('h2')?.textContent).includes(text));
    [byTitle('categories'),byTitle('backup'),byTitle('install'),byTitle('ot work')].filter(Boolean).forEach(c=>stack.append(c));
  }

  function makeDebtSummaryClickable(){
    const cards=[...document.querySelectorAll('#debtsView .debtSummaryCard')];
    cards.forEach((card,index)=>{
      if(card.dataset.wfClick)return;card.dataset.wfClick='1';card.classList.add('workflowClickable');
      card.tabIndex=0;card.setAttribute('role','button');
      const go=()=>{
        const panel=index===0?$('creditDebtList')?.closest('.debtPanel'):index===1?$('loanDebtList')?.closest('.debtPanel'):null;
        if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'});
        else window.moneyPlanOpenSection?.(index===3?'history':'plan');
      };
      card.onclick=go;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};
    });
  }

  function rerouteDashboardCards(){
    document.querySelectorAll('#dashboardView .modernMetric').forEach(card=>{
      if(card.dataset.workflowRoute)return;card.dataset.workflowRoute='1';
      card.addEventListener('click',e=>{
        const text=norm(card.textContent);let page='';
        if(text.includes('monthly salary'))page='plan';
        else if(text.includes('bills paid'))page='history';
        else if(text.includes('pay now'))page='pay';
        else if(text.includes('free after commitments'))page='spending';
        if(page){e.preventDefault();e.stopImmediatePropagation();window.moneyPlanOpenSection?.(page);}
      },true);
    });
    document.querySelectorAll('#upcomingPaymentsCard .upcomingRow').forEach(row=>{
      if(row.dataset.workflowRoute)return;row.dataset.workflowRoute='1';
      row.addEventListener('click',e=>{if(e.target.closest('button'))return;e.preventDefault();e.stopImmediatePropagation();window.moneyPlanOpenSection?.('pay');},true);
    });
  }

  function refresh(){
    enforceModeFilter();refreshGroups();refreshOverview();renderFreshHistory();arrangeSettings();makeDebtSummaryClickable();rerouteDashboardCards();
  }

  const oldRender=typeof render==='function'?render:null;
  if(oldRender){render=function(){oldRender();setTimeout(refresh,90);};}
  const observer=new MutationObserver(()=>requestAnimationFrame(refresh));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target.closest('#historyNav'))setTimeout(renderFreshHistory,120);
    if(e.target.closest('#workflowPlanNav'))lastMode='';
    if(e.target.closest('#workflowPayNav'))lastMode='';
  });
  setTimeout(refresh,140);setTimeout(refresh,360);
})();
