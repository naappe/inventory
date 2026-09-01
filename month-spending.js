(function(){
  const PURCHASES_KEY='moneyPlanPurchasesV1';
  const $=id=>document.getElementById(id);
  const money=n=>'MVR '+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});

  function loadPurchases(){
    try{const v=JSON.parse(localStorage.getItem(PURCHASES_KEY))||{};return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {};}
  }
  function monthName(value){
    if(!/^\d{4}-\d{2}$/.test(String(value||'')))return String(value||'');
    const [y,m]=String(value).split('-').map(Number);
    return new Date(y,m-1,1).toLocaleDateString(undefined,{month:'long',year:'numeric'});
  }
  function paidFor(b){
    try{return Number(paidValue(b)||0)}catch{return b?.[3]?Number(b?.[1]||0):0;}
  }
  function selectedPurchases(){return (loadPurchases()[activeMonth]||[]).filter(Boolean);}
  function purchaseTotal(){return selectedPurchases().reduce((a,p)=>a+Number(p?.total||0),0);}
  function paidBills(){return (s?.bills||[]).map((b,index)=>({b,index,paid:paidFor(b)})).filter(x=>x.paid>.004);}
  function billPaidTotal(){return paidBills().reduce((a,x)=>a+x.paid,0);}

  function ensureSection(){
    const view=$('spendingView'),position=$('spendingPosition');
    if(!view||!position||$('selectedMonthSpending'))return;
    const section=document.createElement('section');
    section.id='selectedMonthSpending';section.className='card selectedMonthSpending';
    section.innerHTML=
      '<div class="selectedMonthHead"><div><span class="selectedMonthEyebrow">SELECTED MONTH</span><h2 id="selectedMonthSpendingTitle"></h2><p>Actual paid bills and purchases recorded for the month you selected.</p></div><button type="button" id="selectedMonthOpenPay">Open Pay</button></div>'+ 
      '<div class="selectedMonthStats">'+
        '<div><span>Bills paid</span><strong id="selectedMonthBillsPaid">MVR 0</strong></div>'+ 
        '<div><span>Purchases</span><strong id="selectedMonthPurchases">MVR 0</strong></div>'+ 
        '<div class="total"><span>Total recorded spending</span><strong id="selectedMonthTotal">MVR 0</strong></div>'+ 
      '</div>'+ 
      '<div class="selectedMonthPaidList" id="selectedMonthPaidList"></div>';
    position.insertAdjacentElement('afterend',section);
    $('selectedMonthOpenPay').onclick=()=>window.moneyPlanOpenSection?window.moneyPlanOpenSection('pay'):openPage('payments');
  }

  function renderPaidBills(){
    const holder=$('selectedMonthPaidList');if(!holder)return;
    holder.innerHTML='';
    const rows=paidBills();
    if(!rows.length){
      holder.innerHTML='<div class="selectedMonthEmpty"><strong>No paid bills recorded</strong><span>If this month has purchases, they remain visible in the purchase list below.</span></div>';
      return;
    }
    rows.forEach(({b,paid})=>{
      const row=document.createElement('div');row.className='selectedMonthPaidRow';
      row.innerHTML='<div><strong class="selectedPaidName"></strong><span class="selectedPaidMeta"></span></div><div class="selectedPaidMoney"><small>PAID</small><strong></strong></div>';
      row.querySelector('.selectedPaidName').textContent=String(b?.[0]||'Expense');
      row.querySelector('.selectedPaidMeta').textContent=String(b?.[2]||'Other');
      row.querySelector('.selectedPaidMoney strong').textContent=money(paid);
      holder.append(row);
    });
  }

  function refreshSelectedMonthSpending(){
    ensureSection();
    if(!$('selectedMonthSpending'))return;
    const label=monthName(activeMonth),billTotal=billPaidTotal(),purchases=purchaseTotal();
    $('selectedMonthSpendingTitle').textContent=label+' spending';
    $('selectedMonthBillsPaid').textContent=money(billTotal);
    $('selectedMonthPurchases').textContent=money(purchases);
    $('selectedMonthTotal').textContent=money(billTotal+purchases);
    renderPaidBills();

    const pageHead=document.querySelector('#spendingView .spendingPageHead h2');
    const pageSub=document.querySelector('#spendingView .spendingPageHead p');
    if(pageHead)pageHead.textContent='Spending · '+label;
    if(pageSub)pageSub.textContent='Review '+label+' paid bills, purchases, carry-over and shop credit.';
    const purchasesHead=document.querySelector('#purchaseLedger')?.closest('.card')?.querySelector('.spendingSectionHead h2');
    if(purchasesHead)purchasesHead.textContent=label+' purchases';
  }

  const oldRender=typeof render==='function'?render:null;
  if(oldRender){render=function(){oldRender();setTimeout(refreshSelectedMonthSpending,80);};}

  document.addEventListener('change',event=>{
    if(event.target?.id==='monthSelect')setTimeout(refreshSelectedMonthSpending,120);
  });
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#spendingNav,[data-workflow="spending"]'))setTimeout(refreshSelectedMonthSpending,120);
  });

  setTimeout(refreshSelectedMonthSpending,160);
})();
