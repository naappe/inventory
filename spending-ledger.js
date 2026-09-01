(function(){
  const PURCHASES_KEY="moneyPlanPurchasesV1";
  const CARRY_KEY="moneyPlanCarryoverV1";
  const BANK_KEY="moneyPlanBankBalance";
  const BANK_AT="moneyPlanBankBalanceUpdatedAt";
  const BANK_SRC="moneyPlanBankBalanceUpdateSource";
  const TX_KEY="moneyPlanTransactionsV1";
  const PAGE_KEY="moneyPlanModernPage";
  const $=(id)=>document.getElementById(id);
  const money=(n)=>"MVR "+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const norm=(v)=>String(v||"").trim().toLowerCase();
  const uid=(prefix)=>prefix+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);

  function loadObject(key){
    try{const v=JSON.parse(localStorage.getItem(key))||{};return v&&typeof v==="object"&&!Array.isArray(v)?v:{}}catch{return {}};
  }
  function saveObject(key,value){localStorage.setItem(key,JSON.stringify(value));}
  function getPurchases(){return loadObject(PURCHASES_KEY);}
  function savePurchases(store){saveObject(PURCHASES_KEY,store);}
  function getCarry(){return loadObject(CARRY_KEY);}
  function saveCarry(store){saveObject(CARRY_KEY,store);}
  function hasBank(){return localStorage.getItem(BANK_KEY)!==null;}
  function bank(){const n=Number(localStorage.getItem(BANK_KEY));return Number.isFinite(n)?n:0;}
  function setBank(value){
    localStorage.setItem(BANK_KEY,String(Math.max(0,Number(value)||0)));
    localStorage.setItem(BANK_AT,new Date().toISOString());
    localStorage.setItem(BANK_SRC,"payment");
  }
  function addTransaction(kind,label,amount,note){
    let rows=[];
    try{const v=JSON.parse(localStorage.getItem(TX_KEY))||[];rows=Array.isArray(v)?v:[]}catch{}
    rows.unshift({
      id:uid("tx"),at:new Date().toISOString(),month:activeMonth,kind,label,
      amount:amount===null?null:Number(amount||0),bankAfter:bank(),note:note||""
    });
    localStorage.setItem(TX_KEY,JSON.stringify(rows.slice(0,800)));
  }
  function monthName(value){
    if(!/^\d{4}-\d{2}$/.test(String(value||"")))return String(value||"");
    const [y,m]=value.split("-").map(Number);
    return new Date(y,m-1,1).toLocaleDateString(undefined,{month:"long",year:"numeric"});
  }
  function shiftMonth(value,delta){
    const [y,m]=String(value||"").split("-").map(Number);
    if(!y||!m)return value;
    const d=new Date(y,m-1+delta,1);
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
  }
  function defaultDate(){
    const now=new Date();
    const current=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
    return activeMonth===current
      ? current+"-"+String(now.getDate()).padStart(2,"0")
      : activeMonth+"-01";
  }
  function paidForBill(b){
    try{return Number(paidValue(b)||0)}catch{return b?.[3]?Number(b?.[1]||0):0}
  }
  function dueForBill(b){return Math.max(0,Number(b?.[1]||0)-paidForBill(b));}

  function sourcePlan(month){
    if(month===activeMonth)return s;
    const raw=months?.[month];
    if(!raw)return null;
    try{return typeof preparePlan==="function"?preparePlan(raw):raw}catch{return raw}
  }
  function billKey(b){return norm(b?.[0])+"||"+norm(b?.[2]);}
  function buildCarryover(sourceMonth,targetMonth){
    if(!sourceMonth||!targetMonth||shiftMonth(sourceMonth,1)!==targetMonth)return;
    const plan=sourcePlan(sourceMonth);if(!plan)return;
    const carry=getCarry();
    const old=carry[targetMonth]?.fromMonth===sourceMonth?carry[targetMonth]:null;
    const oldQueues={};
    (old?.items||[]).forEach(item=>{const k=item.key||norm(item.name)+"||"+norm(item.category);(oldQueues[k]||(oldQueues[k]=[])).push(item)});
    const items=[];
    (plan.bills||[]).forEach((b,index)=>{
      const due=Math.max(0,Number(b?.[1]||0)-paidForBill(b));
      if(due<=.004)return;
      const key=billKey(b),prior=(oldQueues[key]||[]).shift();
      items.push({
        id:prior?.id||uid("carry"),key,name:String(b?.[0]||"Bill"),category:String(b?.[2]||"Other"),
        sourceMonth,originalDue:due,paidAmount:Math.min(due,Math.max(0,Number(prior?.paidAmount||0))),
        createdAt:prior?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()
      });
    });
    Object.values(oldQueues).flat().forEach(prior=>{
      if(Number(prior?.paidAmount||0)>.004){
        items.push({...prior,originalDue:Math.max(Number(prior.originalDue||0),Number(prior.paidAmount||0)),updatedAt:new Date().toISOString()});
      }
    });
    carry[targetMonth]={
      fromMonth:sourceMonth,
      openingBank:old?.openingBank??(hasBank()?bank():0),
      items,
      createdAt:old?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
    saveCarry(carry);
  }
  function carryRecord(month=activeMonth){return getCarry()[month]||null;}
  function carryRemaining(month=activeMonth){
    const record=carryRecord(month);
    return (record?.items||[]).reduce((sum,item)=>sum+Math.max(0,Number(item.originalDue||0)-Number(item.paidAmount||0)),0);
  }
  function carryCount(month=activeMonth){
    const record=carryRecord(month);
    return (record?.items||[]).filter(item=>Number(item.originalDue||0)-Number(item.paidAmount||0)>.004).length;
  }

  function purchasesForMonth(month=activeMonth){return getPurchases()[month]||[];}
  function purchaseTotal(month=activeMonth){return purchasesForMonth(month).reduce((a,p)=>a+Number(p.total||0),0);}
  function bankPurchaseTotal(month=activeMonth){return purchasesForMonth(month).filter(p=>p.paymentMethod==="bank").reduce((a,p)=>a+Number(p.total||0),0);}
  function newCreditTotal(month=activeMonth){return purchasesForMonth(month).filter(p=>p.paymentMethod==="credit").reduce((a,p)=>a+Number(p.total||0),0);}
  function creditPaid(p){return (p.creditPayments||[]).reduce((a,x)=>a+Number(x.amount||0),0);}
  function creditOutstanding(p){return p.paymentMethod==="credit"?Math.max(0,Number(p.total||0)-creditPaid(p)):0;}
  function vendorBalances(){
    const store=getPurchases(),map=new Map();
    Object.entries(store).forEach(([month,rows])=>(rows||[]).forEach(p=>{
      if(p.paymentMethod!=="credit")return;
      const key=norm(p.vendor)||"unknown";
      const current=map.get(key)||{key,vendor:p.vendor||"Unknown",purchased:0,paid:0,owed:0};
      current.purchased+=Number(p.total||0);current.paid+=creditPaid(p);current.owed+=creditOutstanding(p);map.set(key,current);
    }));
    return [...map.values()].filter(v=>v.owed>.004).sort((a,b)=>b.owed-a.owed);
  }
  function totalVendorCredit(){return vendorBalances().reduce((a,v)=>a+v.owed,0);}
  function freeBankAfterOldBills(){return hasBank()?bank()-carryRemaining():null;}

  function ensureNav(){
    const nav=document.querySelector(".nav");if(!nav||$("spendingNav"))return;
    const b=document.createElement("button");b.id="spendingNav";b.className="extraNavButton";b.textContent="Spending";
    b.onclick=()=>openPage("spending");
    const payees=$("payeesNav");nav.insertBefore(b,payees||nav.querySelector('[data-page="categories"]'));
  }
  function ensureView(){
    const main=document.querySelector("main"),footer=document.querySelector(".summaryFooter");
    if(!main||$("spendingView"))return;
    const view=document.createElement("section");view.id="spendingView";view.className="extraView hidden";
    view.innerHTML=`
      <div class="spendingPageHead">
        <div><span class="spendingEyebrow">CASH FLOW</span><h2>Spending & carry-over</h2><p>Keep old bills reserved, record what you buy, and reconcile shop credit with the bank.</p></div>
      </div>
      <section class="spendingPosition" id="spendingPosition">
        <div class="positionStat bank"><span>Bank now</span><strong id="ledgerBank">—</strong><small>Actual bank balance</small></div>
        <div class="positionStat reserve"><span>Old bills reserved</span><strong id="ledgerReserve">MVR 0</strong><small id="ledgerReserveNote">No prior-month bills</small></div>
        <div class="positionStat free"><span>Free after old bills</span><strong id="ledgerFree">—</strong><small>Can be used for this month</small></div>
        <div class="positionStat spent"><span>Bought this month</span><strong id="ledgerSpent">MVR 0</strong><small>Groceries, emergency and other purchases</small></div>
        <div class="positionStat credit"><span>Shop credit owed</span><strong id="ledgerCredit">MVR 0</strong><small>Credit purchases not yet paid</small></div>
      </section>
      <div class="spendingGrid">
        <section class="card purchaseEntryCard">
          <div class="spendingSectionHead"><div><h2>Record a purchase</h2><p class="sub">Enter what you bought. Paying from bank reduces the bank immediately; credit does not.</p></div></div>
          <form id="purchaseForm" class="purchaseForm">
            <div class="purchaseFields">
              <label><span>Date</span><input id="purchaseDate" type="date" required></label>
              <label><span>Shop / vendor</span><input id="purchaseVendor" required placeholder="e.g. Stop & Shop"></label>
              <label><span>Purpose</span><select id="purchaseCategory"><option>Grocery</option><option>Emergency</option><option>Food</option><option>Household</option><option>Transport</option><option>Kids</option><option>Health</option><option>Other</option></select></label>
              <label><span>How paid</span><select id="purchaseMethod"><option value="bank">Paid from bank</option><option value="credit">Bought on credit</option></select></label>
            </div>
            <div class="itemEditor">
              <div class="itemEditorHead"><strong>Items bought</strong><button type="button" id="addPurchaseItem">+ Add item</button></div>
              <div id="purchaseItems" class="purchaseItems"></div>
              <div class="purchaseTotalLine"><span>Purchase total</span><strong id="purchaseFormTotal">MVR 0</strong></div>
            </div>
            <label class="purchaseNote"><span>Note <small>(optional)</small></span><input id="purchaseNote" placeholder="Anything to remember about this purchase"></label>
            <div id="purchaseFormMessage" class="purchaseFormMessage"></div>
            <button class="primary purchaseSave">Save purchase</button>
          </form>
        </section>
        <section class="card carryCard">
          <div class="spendingSectionHead"><div><h2>Prior month commitments</h2><p id="carryIntro" class="sub">Unpaid bills from the previous month stay protected here.</p></div></div>
          <div id="carryList" class="carryList"></div>
        </section>
      </div>
      <div class="spendingGrid lower">
        <section class="card">
          <div class="spendingSectionHead"><div><h2>This month's purchases</h2><p class="sub">What you actually bought, item by item.</p></div><span id="purchaseMonthTotal" class="sectionAmount"></span></div>
          <div id="purchaseLedger" class="purchaseLedger"></div>
        </section>
        <section class="card">
          <div class="spendingSectionHead"><div><h2>Shop credit</h2><p class="sub">Credit purchases stay owed until money actually leaves the bank.</p></div></div>
          <div id="vendorCreditList" class="vendorCreditList"></div>
        </section>
      </div>`;
    main.insertBefore(view,footer||null);
    $("purchaseForm").onsubmit=savePurchaseFromForm;
    $("addPurchaseItem").onclick=()=>addItemRow();
    addItemRow();
  }

  function addItemRow(item={name:"",qty:1,price:""}){
    const holder=$("purchaseItems");if(!holder)return;
    const row=document.createElement("div");row.className="purchaseItemRow";
    row.innerHTML='<input class="itemName" placeholder="Item name" required><input class="itemQty" type="number" min="0.01" step="0.01" value="1" aria-label="Quantity"><input class="itemPrice" type="number" min="0" step="0.01" placeholder="Price" aria-label="Unit price"><strong class="itemLineTotal">MVR 0</strong><button type="button" class="itemRemove" aria-label="Remove item">×</button>';
    row.querySelector(".itemName").value=item.name||"";row.querySelector(".itemQty").value=item.qty||1;row.querySelector(".itemPrice").value=item.price||"";
    row.querySelectorAll("input").forEach(input=>input.addEventListener("input",updatePurchaseTotal));
    row.querySelector(".itemRemove").onclick=()=>{if(holder.children.length>1)row.remove();else{row.querySelector(".itemName").value="";row.querySelector(".itemQty").value=1;row.querySelector(".itemPrice").value="";}updatePurchaseTotal();};
    holder.append(row);updatePurchaseTotal();
  }
  function readItems(){
    return [...document.querySelectorAll("#purchaseItems .purchaseItemRow")].map(row=>{
      const name=row.querySelector(".itemName").value.trim(),qty=Math.max(0,Number(row.querySelector(".itemQty").value)||0),price=Math.max(0,Number(row.querySelector(".itemPrice").value)||0);
      return {name,qty,price,total:qty*price};
    }).filter(item=>item.name&&item.total>.004);
  }
  function updatePurchaseTotal(){
    let total=0;
    document.querySelectorAll("#purchaseItems .purchaseItemRow").forEach(row=>{
      const qty=Math.max(0,Number(row.querySelector(".itemQty").value)||0),price=Math.max(0,Number(row.querySelector(".itemPrice").value)||0),line=qty*price;total+=line;
      row.querySelector(".itemLineTotal").textContent=money(line);
    });
    if($("purchaseFormTotal"))$("purchaseFormTotal").textContent=money(total);
    return total;
  }
  function resetPurchaseForm(){
    $("purchaseForm")?.reset();
    if($("purchaseDate"))$("purchaseDate").value=defaultDate();
    const holder=$("purchaseItems");if(holder){holder.innerHTML="";addItemRow();}
    if($("purchaseMethod"))$("purchaseMethod").value="bank";
    if($("purchaseCategory"))$("purchaseCategory").value="Grocery";
    if($("purchaseFormMessage"))$("purchaseFormMessage").textContent="";
  }
  function savePurchaseFromForm(event){
    event.preventDefault();
    const items=readItems(),total=items.reduce((a,x)=>a+x.total,0),method=$("purchaseMethod").value,vendor=$("purchaseVendor").value.trim(),message=$("purchaseFormMessage");
    if(!items.length||total<=.004){message.textContent="Add at least one item with a price.";message.className="purchaseFormMessage error";return;}
    if(method==="bank"){
      if(!hasBank()){message.textContent="Set your bank balance first, or choose Bought on credit.";message.className="purchaseFormMessage error";return;}
      if(total>bank()+.004){message.textContent="Bank balance is not enough for this purchase. Update the bank or choose Bought on credit.";message.className="purchaseFormMessage error";return;}
    }
    const store=getPurchases();if(!store[activeMonth])store[activeMonth]=[];
    const purchase={
      id:uid("purchase"),month:activeMonth,date:$("purchaseDate").value||defaultDate(),vendor,
      category:$("purchaseCategory").value,paymentMethod:method,items,total,note:$("purchaseNote").value.trim(),creditPayments:[],createdAt:new Date().toISOString()
    };
    store[activeMonth].unshift(purchase);savePurchases(store);
    if(method==="bank"){
      setBank(bank()-total);
      addTransaction("purchase","Purchase · "+vendor,-total,purchase.category+" · "+items.length+" item"+(items.length===1?"":"s"));
    }
    message.textContent=method==="bank"?"Purchase saved and bank reduced by "+money(total)+".":"Purchase saved on credit. Bank balance did not change.";
    message.className="purchaseFormMessage success";
    setTimeout(()=>{resetPurchaseForm();refreshLedger();try{render();}catch{};try{openPage("spending");}catch{};},500);
  }

  function renderPosition(){
    if(!$("ledgerBank"))return;
    const reserve=carryRemaining(),free=freeBankAfterOldBills(),rec=carryRecord();
    $("ledgerBank").textContent=hasBank()?money(bank()):"Not set";
    $("ledgerReserve").textContent=money(reserve);
    $("ledgerReserveNote").textContent=reserve>.004?(carryCount()+" bill"+(carryCount()===1?"":"s")+" from "+monthName(rec?.fromMonth)):"No prior-month bills waiting";
    $("ledgerFree").textContent=free===null?"Set bank":money(free);
    $("ledgerFree").classList.toggle("negative",free!==null&&free<0);
    $("ledgerSpent").textContent=money(purchaseTotal());
    $("ledgerCredit").textContent=money(totalVendorCredit());
    if($("purchaseMonthTotal"))$("purchaseMonthTotal").textContent=money(purchaseTotal());
  }
  function renderCarry(){
    const holder=$("carryList");if(!holder)return;holder.innerHTML="";
    const rec=carryRecord(),items=(rec?.items||[]).filter(item=>Number(item.originalDue||0)-Number(item.paidAmount||0)>.004);
    if(!rec){
      holder.innerHTML='<div class="ledgerEmpty"><strong>No carry-over created</strong><span>Use Save month → Next month. Any unpaid bills will be reserved automatically.</span></div>';return;
    }
    if(!items.length){
      holder.innerHTML='<div class="ledgerEmpty success"><strong>Prior month is clear</strong><span>No unpaid commitment remains from '+monthName(rec.fromMonth)+'.</span></div>';return;
    }
    if($("carryIntro"))$("carryIntro").textContent="Reserved from "+monthName(rec.fromMonth)+". Paying these bills reduces bank and the reserve together.";
    items.forEach(item=>{
      const remaining=Math.max(0,Number(item.originalDue||0)-Number(item.paidAmount||0));
      const row=document.createElement("div");row.className="carryRow";
      row.innerHTML='<div><strong class="carryName"></strong><span class="carryMeta"></span></div><div class="carryMoney"><small>Still reserved</small><strong></strong></div><button class="carryPay">Pay</button>';
      row.querySelector(".carryName").textContent=item.name;row.querySelector(".carryMeta").textContent=item.category+" · from "+monthName(item.sourceMonth);row.querySelector(".carryMoney strong").textContent=money(remaining);
      row.querySelector(".carryPay").onclick=()=>openPaymentModal({type:"carry",id:item.id,label:item.name,max:remaining});holder.append(row);
    });
  }
  function renderPurchases(){
    const holder=$("purchaseLedger");if(!holder)return;holder.innerHTML="";
    const rows=purchasesForMonth();
    if(!rows.length){holder.innerHTML='<div class="ledgerEmpty"><strong>No purchases recorded</strong><span>Record groceries, emergency spending or shop purchases above.</span></div>';return;}
    rows.forEach(p=>{
      const row=document.createElement("details");row.className="purchaseRow";
      const outstanding=creditOutstanding(p),status=p.paymentMethod==="bank"?"Paid from bank":outstanding>.004?"Credit · "+money(outstanding)+" owed":"Credit paid";
      row.innerHTML='<summary><div class="purchaseSummaryMain"><strong></strong><span></span></div><div class="purchaseSummaryAmount"><strong></strong><span></span></div></summary><div class="purchaseDetail"><div class="purchaseItemsRead"></div><div class="purchaseDetailFoot"></div></div>';
      row.querySelector(".purchaseSummaryMain strong").textContent=p.vendor||"Shop";
      row.querySelector(".purchaseSummaryMain span").textContent=new Date((p.date||activeMonth+"-01")+"T00:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short"})+" · "+p.category;
      row.querySelector(".purchaseSummaryAmount strong").textContent=money(p.total);row.querySelector(".purchaseSummaryAmount span").textContent=status;
      row.classList.add(p.paymentMethod==="bank"?"paid":outstanding>.004?"creditOpen":"paid");
      const itemHolder=row.querySelector(".purchaseItemsRead");(p.items||[]).forEach(item=>{const line=document.createElement("div");line.innerHTML='<span></span><small></small><strong></strong>';line.querySelector("span").textContent=item.name;line.querySelector("small").textContent=Number(item.qty||0)+" × "+money(item.price);line.querySelector("strong").textContent=money(item.total);itemHolder.append(line);});
      const foot=row.querySelector(".purchaseDetailFoot");foot.innerHTML='<span></span><div></div>';foot.querySelector("span").textContent=p.note||"";
      const actions=foot.querySelector("div");
      if(p.paymentMethod==="credit"&&outstanding>.004){const pay=document.createElement("button");pay.textContent="Pay credit";pay.onclick=()=>openPaymentModal({type:"vendor",vendor:p.vendor,label:p.vendor,max:vendorBalanceByName(p.vendor)});actions.append(pay);}
      const del=document.createElement("button");del.className="danger";del.textContent="Delete";del.onclick=()=>deletePurchase(p);actions.append(del);
      holder.append(row);
    });
  }
  function vendorBalanceByName(name){return vendorBalances().find(v=>norm(v.vendor)===norm(name))?.owed||0;}
  function renderVendorCredit(){
    const holder=$("vendorCreditList");if(!holder)return;holder.innerHTML="";
    const vendors=vendorBalances();
    if(!vendors.length){holder.innerHTML='<div class="ledgerEmpty success"><strong>No shop credit owed</strong><span>Credit purchases will appear here until they are paid.</span></div>';return;}
    vendors.forEach(v=>{
      const row=document.createElement("div");row.className="vendorCreditRow";
      row.innerHTML='<div><strong></strong><span></span></div><div class="vendorCreditMoney"><small>Owed</small><strong></strong></div><button>Pay credit</button>';
      row.querySelector("div > strong").textContent=v.vendor;row.querySelector("div > span").textContent=money(v.purchased)+" bought · "+money(v.paid)+" paid";row.querySelector(".vendorCreditMoney strong").textContent=money(v.owed);
      row.querySelector("button").onclick=()=>openPaymentModal({type:"vendor",vendor:v.vendor,label:v.vendor,max:v.owed});holder.append(row);
    });
  }
  function deletePurchase(purchase){
    if(!confirm("Delete this purchase?"))return;
    if(purchase.paymentMethod==="bank"){
      if(!confirm("This purchase was paid from bank. Deleting it will add "+money(purchase.total)+" back to the bank balance. Continue?"))return;
      setBank(bank()+Number(purchase.total||0));addTransaction("reversal","Purchase deleted · "+purchase.vendor,Number(purchase.total||0),"Bank payment reversed");
    }else if(creditPaid(purchase)>.004){alert("This credit purchase already has payments. Keep it so the vendor balance remains correct.");return;}
    const store=getPurchases();store[purchase.month]=(store[purchase.month]||[]).filter(p=>p.id!==purchase.id);savePurchases(store);refreshLedger();try{render();}catch{};try{openPage("spending");}catch{};
  }

  function ensurePaymentModal(){
    if($("ledgerPaymentModal"))return;
    const d=document.createElement("div");d.id="ledgerPaymentModal";d.className="modalBackdrop hidden";
    d.innerHTML='<section class="modal ledgerPayModal"><h2 id="ledgerPayTitle">Record payment</h2><p id="ledgerPaySub" class="sub"></p><form id="ledgerPayForm" class="form"><label class="fieldLabel">Amount to pay</label><input id="ledgerPayAmount" type="number" min="0.01" step="0.01" required><div id="ledgerPayError" class="ledgerPayError"></div><div class="modalActions"><button type="button" id="ledgerPayCancel" class="secondary">Cancel</button><button class="primary">Pay from bank</button></div></form></section>';
    document.body.append(d);$("ledgerPayCancel").onclick=()=>d.classList.add("hidden");$("ledgerPayForm").onsubmit=submitLedgerPayment;
  }
  let paymentContext=null;
  function openPaymentModal(context){
    ensurePaymentModal();paymentContext=context;$("ledgerPayTitle").textContent=context.type==="carry"?"Pay prior month bill":"Pay shop credit";$("ledgerPaySub").textContent=context.type==="carry"?context.label+" · reserved from the previous month":context.label+" · reduce the vendor credit balance";$("ledgerPayAmount").max=String(context.max);$("ledgerPayAmount").value=String(Number(context.max||0).toFixed(2));$("ledgerPayError").textContent="";$("ledgerPaymentModal").classList.remove("hidden");setTimeout(()=>$("ledgerPayAmount").focus(),0);
  }
  function submitLedgerPayment(event){
    event.preventDefault();if(!paymentContext)return;
    const amount=Math.max(0,Number($("ledgerPayAmount").value)||0),max=Number(paymentContext.max||0),error=$("ledgerPayError");
    if(amount<=.004||amount>max+.004){error.textContent="Enter an amount up to "+money(max)+".";return;}
    if(!hasBank()){error.textContent="Set the bank balance first.";return;}
    if(amount>bank()+.004){error.textContent="Bank balance is not enough for this payment.";return;}
    if(paymentContext.type==="carry")payCarryItem(paymentContext.id,amount);
    else payVendorCredit(paymentContext.vendor,amount);
    $("ledgerPaymentModal").classList.add("hidden");paymentContext=null;refreshLedger();try{render();}catch{};try{openPage("spending");}catch{};
  }
  function payCarryItem(id,amount){
    const carry=getCarry(),rec=carry[activeMonth];if(!rec)return;const item=(rec.items||[]).find(x=>x.id===id);if(!item)return;
    const remaining=Math.max(0,Number(item.originalDue||0)-Number(item.paidAmount||0)),actual=Math.min(remaining,amount);if(actual<=.004)return;
    item.paidAmount=Number(item.paidAmount||0)+actual;item.updatedAt=new Date().toISOString();saveCarry(carry);setBank(bank()-actual);addTransaction("carryover_payment","Prior month bill · "+item.name,-actual,"From "+monthName(item.sourceMonth));
  }
  function payVendorCredit(vendor,amount){
    const store=getPurchases(),matches=[];
    Object.entries(store).forEach(([month,rows])=>(rows||[]).forEach(p=>{if(p.paymentMethod==="credit"&&norm(p.vendor)===norm(vendor)&&creditOutstanding(p)>.004)matches.push(p)}));
    matches.sort((a,b)=>String(a.date||a.createdAt).localeCompare(String(b.date||b.createdAt)));
    let left=amount;
    matches.forEach(p=>{if(left<=.004)return;const take=Math.min(left,creditOutstanding(p));if(take<=.004)return;(p.creditPayments||(p.creditPayments=[])).push({id:uid("creditpay"),date:new Date().toISOString(),month:activeMonth,amount:take});left-=take;});
    const actual=amount-left;if(actual<=.004)return;savePurchases(store);setBank(bank()-actual);addTransaction("vendor_payment","Shop credit payment · "+vendor,-actual,"Paid against oldest credit purchases");
  }

  function ensureCarryBanner(){
    const bills=document.querySelector("#paymentsView .billsCard");if(!bills||$("carryPaymentBanner"))return;
    const banner=document.createElement("section");banner.id="carryPaymentBanner";banner.className="carryPaymentBanner";
    banner.innerHTML='<div><span>FROM PREVIOUS MONTH</span><strong id="carryPaymentAmount"></strong><small id="carryPaymentText"></small></div><button type="button" id="openCarrySpending">Review & pay</button>';
    bills.insertAdjacentElement("beforebegin",banner);$("openCarrySpending").onclick=()=>openPage("spending");
  }
  function renderCarryBanner(){
    const banner=$("carryPaymentBanner");if(!banner)return;const remaining=carryRemaining(),rec=carryRecord();banner.classList.toggle("hidden",remaining<=.004);if(remaining<=.004)return;$("carryPaymentAmount").textContent=money(remaining);$("carryPaymentText").textContent=carryCount()+" unpaid bill"+(carryCount()===1?"":"s")+" carried from "+monthName(rec?.fromMonth)+". This money is reserved before new spending.";
  }

  function ensureDashboardCashFlow(){
    const details=$("dashboardDetails");if(!details||$("dashboardCashFlow"))return;
    const card=document.createElement("section");card.id="dashboardCashFlow";card.className="card dashboardCashFlow";
    card.innerHTML='<div class="spendingSectionHead"><div><h2>Bank money position</h2><p class="sub">What is protected for old bills and what is actually free to use.</p></div><button type="button" id="openSpendingFromDash">Open spending</button></div><div class="dashboardCashGrid"><div><span>Bank now</span><strong id="dashLedgerBank"></strong></div><div><span>Old bills reserved</span><strong id="dashLedgerReserve"></strong></div><div class="free"><span>Free after old bills</span><strong id="dashLedgerFree"></strong></div><div><span>Bought this month</span><strong id="dashLedgerSpent"></strong></div><div><span>Shop credit owed</span><strong id="dashLedgerCredit"></strong></div></div>';
    details.insertBefore(card,details.firstChild);$("openSpendingFromDash").onclick=()=>openPage("spending");
  }
  function renderDashboardCashFlow(){
    if(!$("dashboardCashFlow"))return;const free=freeBankAfterOldBills();$("dashLedgerBank").textContent=hasBank()?money(bank()):"Not set";$("dashLedgerReserve").textContent=money(carryRemaining());$("dashLedgerFree").textContent=free===null?"Set bank":money(free);$("dashLedgerFree").classList.toggle("negative",free!==null&&free<0);$("dashLedgerSpent").textContent=money(purchaseTotal());$("dashLedgerCredit").textContent=money(totalVendorCredit());
  }

  function renderUnifiedHistory(){
    const list=$("transactionList");if(!list)return;
    let all=[];try{const v=JSON.parse(localStorage.getItem(TX_KEY))||[];all=Array.isArray(v)?v:[]}catch{}
    const rows=all.filter(t=>!t.month||t.month===activeMonth);
    if($("txCount"))$("txCount").textContent=rows.filter(t=>["payment","purchase","carryover_payment","vendor_payment"].includes(t.kind)).length;
    if($("txPaid"))$("txPaid").textContent=money(rows.filter(t=>Number(t.amount)<0).reduce((a,t)=>a+Math.abs(Number(t.amount||0)),0));
    if($("txAdjust"))$("txAdjust").textContent=rows.filter(t=>t.kind==="adjustment"||t.kind==="opening").length;
    list.innerHTML="";
    if(!rows.length){list.innerHTML='<div class="emptyState"><div><div class="emptyMark">0</div><strong>No bank transactions yet</strong><span>Payments, purchases and bank corrections will appear here.</span></div></div>';return;}
    rows.slice(0,150).forEach(t=>{const r=document.createElement("div");r.className="transactionRow";const d=new Date(t.at);r.innerHTML='<div class="transactionMain"><strong></strong><span></span></div><div class="transactionAmount"></div><div class="transactionBank"></div>';r.querySelector("strong").textContent=t.label;r.querySelector(".transactionMain span").textContent=d.toLocaleString(undefined,{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})+(t.note?" · "+t.note:"");const a=r.querySelector(".transactionAmount");if(t.amount===null)a.textContent="Balance set";else{const n=Number(t.amount||0);a.textContent=(n>0?"+":n<0?"−":"")+money(Math.abs(n));a.classList.add(n<0?"negative":n>0?"positive":"");}r.querySelector(".transactionBank").textContent="Bank after: "+money(t.bankAfter);list.append(r);});
  }

  function refreshLedger(){
    ensureNav();ensureView();ensurePaymentModal();ensureCarryBanner();ensureDashboardCashFlow();
    if($("purchaseDate")&&!$("purchaseDate").value)$("purchaseDate").value=defaultDate();
    renderPosition();renderCarry();renderPurchases();renderVendorCredit();renderCarryBanner();renderDashboardCashFlow();renderUnifiedHistory();
  }

  function captureMonthWorkflow(){
    document.addEventListener("click",event=>{
      const next=event.target.closest?.("#nextMonthBtn,#bannerNextMonth");
      if(next){const target=shiftMonth(activeMonth,1);buildCarryover(activeMonth,target);}
      const saveMonthButton=event.target.closest?.("#saveMonthBtn,#bannerSaveMonth");
      if(saveMonthButton){const target=shiftMonth(activeMonth,1),carry=getCarry();if(months?.[target]||carry[target])buildCarryover(activeMonth,target);}
    },true);
    document.addEventListener("change",event=>{
      if(event.target?.id!=="monthSelect")return;
      const target=event.target.value;if(shiftMonth(activeMonth,1)===target)buildCarryover(activeMonth,target);
      setTimeout(refreshLedger,0);
    },true);
  }

  const previousOpenPage=openPage;
  openPage=function(page){
    ensureNav();ensureView();
    if(page==="spending"){
      previousOpenPage("dashboard");
      ["dashboardView","paymentsView","categoriesView","payeesView","historyView"].forEach(id=>$(id)?.classList.add("hidden"));
      $("spendingView")?.classList.remove("hidden");
      document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.id==="spendingNav"));
      localStorage.setItem(PAGE_KEY,"spending");localStorage.setItem("moneyPlanActivePage","spending");
      refreshLedger();
      return;
    }
    $("spendingView")?.classList.add("hidden");previousOpenPage(page);$("spendingNav")?.classList.remove("active");setTimeout(refreshLedger,0);
  };

  const previousRender=render;
  render=function(){previousRender();setTimeout(refreshLedger,0);};

  captureMonthWorkflow();
  refreshLedger();
  const saved=localStorage.getItem(PAGE_KEY)||localStorage.getItem("moneyPlanActivePage");
  if(saved==="spending")setTimeout(()=>openPage("spending"),0);
})();
