(function(){
  const $=id=>document.getElementById(id);
  const money=n=>'MVR '+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const norm=v=>String(v||'').trim().toLowerCase();

  function paidFor(b){
    try{return Number(paidValue(b)||0);}
    catch{return b?.[3]?Number(b?.[1]||0):0;}
  }
  function dueFor(b){return Math.max(0,Number(b?.[1]||0)-paidFor(b));}
  function salaryState(){
    try{
      const all=JSON.parse(localStorage.getItem('moneyPlanSalaryPlanV1'))||{};
      return all[activeMonth]&&typeof all[activeMonth]==='object'?all[activeMonth]:{};
    }catch{return {};}
  }
  function isDeferred(b){
    const state=salaryState();
    return !!state[norm(b?.[0])+'||'+norm(b?.[2])];
  }
  function totals(){
    let planned=0,paid=0,unpaid=0,next=0,paidCount=0,unpaidCount=0;
    (s?.bills||[]).forEach(b=>{
      const plan=Math.max(0,Number(b?.[1]||0));
      const paidAmount=Math.min(plan,Math.max(0,paidFor(b)));
      const due=Math.max(0,plan-paidAmount);
      planned+=plan;paid+=paidAmount;unpaid+=due;
      if(paidAmount>0)paidCount++;
      if(due>.004)unpaidCount++;
      if(due>.004&&isDeferred(b))next+=due;
    });
    return {planned,paid,unpaid,next,paidCount,unpaidCount};
  }
  function ensureReport(){
    const card=document.querySelector('#paymentsView .billsCard');
    if(!card)return null;
    let report=$('paymentStatusReport');
    if(report)return report;
    report=document.createElement('section');
    report.id='paymentStatusReport';
    report.className='paymentStatusReport';
    report.setAttribute('aria-label','Payment report');
    report.innerHTML=
      '<div class="paymentReportHead"><div><span>PAYMENT REPORT</span><h3>Paid and unpaid balance</h3></div><small id="paymentReportMonth"></small></div>'+
      '<div class="paymentReportGrid">'+
        '<div class="paymentReportItem planned"><span>Total planned</span><strong id="reportPlanned">MVR 0</strong><small>All bills this month</small></div>'+
        '<div class="paymentReportItem paid"><span>Paid</span><strong id="reportPaid">MVR 0</strong><small id="reportPaidCount">0 payments</small></div>'+
        '<div class="paymentReportItem unpaid"><span>Unpaid left</span><strong id="reportUnpaid">MVR 0</strong><small id="reportUnpaidCount">0 bills remaining</small></div>'+
        '<div class="paymentReportItem next"><span>Next salary</span><strong id="reportNext">MVR 0</strong><small>Included in unpaid left</small></div>'+
      '</div>'+
      '<div class="paymentProgress"><div id="paymentProgressFill"></div></div>'+
      '<p id="paymentProgressText" class="paymentProgressText">0% paid</p>';
    const filters=card.querySelector('.filters,.billFilters,[data-bill-filter]')?.closest('.filters,.billFilters')||
      card.querySelector('[data-bill-filter]')?.parentElement;
    if(filters)card.insertBefore(report,filters);
    else{
      const head=card.querySelector('.sectionHead');
      if(head)head.insertAdjacentElement('afterend',report);else card.prepend(report);
    }
    return report;
  }
  function refresh(){
    if(document.body.dataset.paymentMode!=='pay')return;
    if(!ensureReport())return;
    const t=totals();
    $('reportPlanned').textContent=money(t.planned);
    $('reportPaid').textContent=money(t.paid);
    $('reportUnpaid').textContent=money(t.unpaid);
    $('reportNext').textContent=money(t.next);
    $('reportPaidCount').textContent=t.paidCount+' payment'+(t.paidCount===1?'':'s')+' recorded';
    $('reportUnpaidCount').textContent=t.unpaidCount+' bill'+(t.unpaidCount===1?'':'s')+' remaining';
    const pct=t.planned>0?Math.min(100,Math.round(t.paid/t.planned*100)):0;
    $('paymentProgressFill').style.width=pct+'%';
    $('paymentProgressText').textContent=pct+'% paid · '+money(t.unpaid)+' still unpaid';
    try{
      $('paymentReportMonth').textContent=new Date(activeMonth+'-01T00:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
    }catch{$('paymentReportMonth').textContent='';}
  }
  const oldRender=typeof render==='function'?render:null;
  if(oldRender)render=function(){oldRender();setTimeout(refresh,90);};
  document.addEventListener('click',()=>setTimeout(refresh,120));
  document.addEventListener('change',()=>setTimeout(refresh,120));
  setTimeout(refresh,220);
})();