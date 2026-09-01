(function(){
  const FILTER_KEY='moneyPlanPaymentFilterV2';
  const $=id=>document.getElementById(id);
  const money=n=>'MVR '+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  let correcting=false;

  function paidFor(b){
    try{return Number(paidValue(b)||0);}catch{return b?.[3]?Number(b?.[1]||0):0;}
  }
  function dueFor(b){return Math.max(0,Number(b?.[1]||0)-paidFor(b));}
  function norm(v){return String(v||'').trim().toLowerCase();}
  function salaryState(){
    try{
      const all=JSON.parse(localStorage.getItem('moneyPlanSalaryPlanV1'))||{};
      return all[activeMonth]&&typeof all[activeMonth]==='object'?all[activeMonth]:{};
    }catch{return {};}
  }
  function deferred(b){return !!salaryState()[norm(b?.[0])+'||'+norm(b?.[2])];}
  function totals(){
    let paid=0,thisDue=0,nextDue=0,thisCount=0,nextCount=0;
    (s?.bills||[]).forEach(b=>{
      paid+=paidFor(b);
      const due=dueFor(b);if(due<=.004)return;
      if(deferred(b)){nextDue+=due;nextCount++;}
      else{thisDue+=due;thisCount++;}
    });
    return {paid,thisDue,nextDue,thisCount,nextCount};
  }
  function setStat(stat,label,value,countText){
    if(!stat)return;
    const span=stat.querySelector('span'),strong=stat.querySelector('strong');
    if(span)span.textContent=label;
    if(strong)strong.textContent=value;
    let small=stat.querySelector('.planStatHint');
    if(!small){small=document.createElement('small');small.className='planStatHint';stat.append(small);}
    small.textContent=countText;
  }
  function forcePlanFilter(){
    if(document.body.dataset.paymentMode!=='plan'||correcting)return false;
    let current='all';try{current=activeBillFilter||'all';}catch{}
    if(current==='all')return false;
    correcting=true;
    try{activeBillFilter='all';localStorage.setItem(FILTER_KEY,'all');}catch{}
    setTimeout(()=>{
      try{render();}catch{}
      correcting=false;
      setTimeout(refresh,40);
    },0);
    return true;
  }
  function refreshPlanSummary(){
    if(document.body.dataset.paymentMode!=='plan')return;
    const box=$('compactBillSummary');if(!box)return;
    const items=box.querySelectorAll('.compactBillStat');if(items.length<3)return;
    const t=totals();
    setStat(items[0],'This salary',money(t.thisDue),t.thisCount+' bill'+(t.thisCount===1?'':'s')+' to pay now');
    setStat(items[1],'Next salary',money(t.nextDue),t.nextCount+' bill'+(t.nextCount===1?'':'s')+' waiting');
    setStat(items[2],'Paid this month',money(t.paid),'Completed payments');

    const title=document.querySelector('#paymentsView .billsCard .sectionHead h2');
    const sub=document.querySelector('#paymentsView .billsCard .sectionHead .sub');
    if(title)title.textContent='Plan this month';
    if(sub)sub.textContent='Choose what you will pay with this salary. Move anything you cannot pay now to Next salary.';

    document.querySelectorAll('#paymentsView [data-bill-filter]').forEach(b=>b.classList.toggle('active',b.dataset.billFilter==='all'));
    const empty=document.querySelector('#paymentsView #bills .emptyState span');
    if(empty)empty.textContent='There are no unpaid bills in this plan.';
  }
  function refresh(){
    if(forcePlanFilter())return;
    refreshPlanSummary();
  }

  const oldRender=typeof render==='function'?render:null;
  if(oldRender){render=function(){oldRender();setTimeout(refresh,80);};}
  document.addEventListener('click',e=>{
    if(e.target.closest?.('#workflowPlanNav,[data-workflow="plan"]'))setTimeout(refresh,120);
  });
  document.addEventListener('change',e=>{
    if(e.target?.id==='monthSelect')setTimeout(refresh,140);
  });
  setTimeout(refresh,180);
})();
