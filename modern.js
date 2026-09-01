(function () {
  const BANK="moneyPlanBankBalance", BANK_AT="moneyPlanBankBalanceUpdatedAt",
        BANK_SRC="moneyPlanBankBalanceUpdateSource", PAYEES="moneyPlanVendorAccounts",
        TX="moneyPlanTransactionsV1", PAGE="moneyPlanModernPage";
  const coreOpenPage = openPage;
  const $ = (id) => document.getElementById(id);
  const money = (n) => "MVR " + Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const signed = (n) => (n>0?"+":n<0?"−":"") + money(Math.abs(n));
  const norm = (s) => String(s||"").trim().toLowerCase();

  let payees = (()=>{try{return JSON.parse(localStorage.getItem(PAYEES))||{}}catch{return {}}})();
  let tx = (()=>{try{const x=JSON.parse(localStorage.getItem(TX))||[];return Array.isArray(x)?x:[]}catch{return []}})();

  function savePayees(){ localStorage.setItem(PAYEES,JSON.stringify(payees)); }
  function accountFor(name){ return payees[norm(name)]?.accountNumber || ""; }
  function savePayee(name,account){
    name=String(name||"").trim(); account=String(account||"").trim();
    if(!name) return;
    if(account) payees[norm(name)]={name,accountNumber:account,updatedAt:new Date().toISOString()};
    else delete payees[norm(name)];
    savePayees();
  }
  function hasBank(){ return localStorage.getItem(BANK)!==null; }
  function bank(){ const n=Number(localStorage.getItem(BANK)); return Number.isFinite(n)?n:0; }
  function setBank(n,src){
    localStorage.setItem(BANK,String(n));
    localStorage.setItem(BANK_AT,new Date().toISOString());
    localStorage.setItem(BANK_SRC,src||"manual");
  }
  function log(kind,label,amount,after,note){
    tx.unshift({id:Date.now()+"-"+Math.random().toString(36).slice(2,7),at:new Date().toISOString(),
      month:activeMonth,kind,label,amount:amount===null?null:Number(amount||0),bankAfter:Number(after||0),note:note||""});
    tx=tx.slice(0,500); localStorage.setItem(TX,JSON.stringify(tx)); renderHistory();
  }
  function paidTotal(){ return (s.bills||[]).reduce((a,b)=>a+Number(paidValue(b)||0),0); }
  function plannedTotal(){ return (s.bills||[]).reduce((a,b)=>a+Number(b[1]||0),0); }
  function remainingTotal(){ return (s.bills||[]).reduce((a,b)=>a+Math.max(0,Number(b[1]||0)-Number(paidValue(b)||0)),0); }

  function ensureNav(){
    const nav=document.querySelector(".nav"), settings=nav?.querySelector('[data-page="categories"]');
    if(!nav||!settings) return;
    settings.textContent="Settings";
    if(!$("payeesNav")){
      const b=document.createElement("button"); b.id="payeesNav"; b.className="extraNavButton"; b.textContent="Payees";
      b.onclick=()=>openPage("payees"); nav.insertBefore(b,settings);
    }
    if(!$("historyNav")){
      const b=document.createElement("button"); b.id="historyNav"; b.className="extraNavButton"; b.textContent="History";
      b.onclick=()=>openPage("history"); nav.insertBefore(b,settings);
    }
  }

  function ensureViews(){
    const main=document.querySelector("main"), footer=document.querySelector(".summaryFooter");
    if(!main||!footer) return;
    if(!$("payeesView")){
      const v=document.createElement("section"); v.id="payeesView"; v.className="extraView hidden";
      v.innerHTML='<div class="pageIntro"><div><h2>Payees</h2><p>Save bank details once and reuse them when paying.</p></div></div>'+ 
        '<section class="card"><h2>Payee accounts</h2><p class="sub">Saved account numbers fill automatically in new payments.</p>'+ 
        '<form id="payeeForm" class="payeeCreate"><input id="payeeName" required placeholder="Payee name">'+ 
        '<input id="payeeAccount" required placeholder="Bank account number"><button class="primary">Save payee</button></form>'+ 
        '<div id="vendorManager" class="vendorManager"></div></section>';
      main.insertBefore(v,footer);
      $("payeeForm").onsubmit=e=>{e.preventDefault();savePayee($("payeeName").value,$("payeeAccount").value);e.target.reset();renderPayees();refreshDatalist();};
    }
    if(!$("historyView")){
      const v=document.createElement("section"); v.id="historyView"; v.className="extraView hidden";
      v.innerHTML='<div class="pageIntro"><div><h2>History</h2><p>Payments and bank corrections for the selected month.</p></div></div>'+ 
        '<section class="card"><h2>Bank transactions</h2><p class="sub">Real payments reduce bank balance; undo adds the money back.</p>'+ 
        '<div class="historySummary"><div class="historySummaryItem"><span>PAYMENTS</span><strong id="txCount">0</strong></div>'+ 
        '<div class="historySummaryItem"><span>PAID FROM BANK</span><strong id="txPaid">MVR 0</strong></div>'+ 
        '<div class="historySummaryItem"><span>ADJUSTMENTS</span><strong id="txAdjust">0</strong></div></div>'+ 
        '<div id="transactionList" class="transactionList"></div></section>';
      main.insertBefore(v,footer);
    }
  }

  function ensureOTSettings(){
    const stack=document.querySelector("#categoriesView .settingsStack");
    if(!stack||$("otSettingsCard")) return;
    const c=document.createElement("section"); c.id="otSettingsCard"; c.className="card otSettingsCard";
    c.innerHTML='<h2>OT Work</h2><p class="sub">Overtime is a separate work tool, not part of the money plan.</p>'+ 
      '<a class="otSettingsLink" href="./ot.html">Open OT Work</a>'; stack.append(c);
  }

  function ensureDashboard(){
    const dash=$("dashboardView"), details=$("dashboardDetails");
    if(!dash||!details) return;
    if(!$("dashboardModernOverview")){
      const o=document.createElement("section"); o.id="dashboardModernOverview"; o.className="modernDashboard";
      o.innerHTML='<div class="modernMetricGrid">'+
        '<div class="modernMetric paid"><span class="modernMetricLabel">Paid this month</span><strong id="modernPaid" class="modernMetricValue"></strong><span class="modernMetricHint">Money already paid</span></div>'+ 
        '<div class="modernMetric remaining"><span class="modernMetricLabel">Bills remaining</span><strong id="modernRemaining" class="modernMetricValue"></strong><span class="modernMetricHint">Planned payments still waiting</span></div>'+ 
        '<div id="modernSafeCard" class="modernMetric safe"><span class="modernMetricLabel">Safe after bills</span><strong id="modernSafe" class="modernMetricValue"></strong><span id="modernSafeHint" class="modernMetricHint"></span></div>'+ 
        '<div class="modernMetric"><span class="modernMetricLabel">Monthly income</span><strong id="modernIncome" class="modernMetricValue"></strong><span class="modernMetricHint">Income received this month</span></div></div>'+ 
        '<div class="moneyProgressCard"><div class="moneyProgressHead"><strong id="modernProgressText"></strong><span id="modernProgressPct"></span></div>'+ 
        '<div class="moneyProgressTrack"><i id="modernProgressBar"></i></div></div>';
      dash.insertBefore(o,details);
    }
    if(!$("upcomingPaymentsCard")){
      const c=document.createElement("section"); c.id="upcomingPaymentsCard"; c.className="card upcomingCard";
      c.innerHTML='<div class="upcomingHead"><div><h2>Payments still waiting</h2><p class="sub">What needs attention next.</p></div>'+ 
        '<button id="openAllPayments">Open payments</button></div><div id="upcomingPaymentsList" class="upcomingList"></div>';
      details.insertBefore(c,details.firstChild); $("openAllPayments").onclick=()=>openPage("payments");
    }
  }

  function renderDashboard(){
    const paid=paidTotal(), planned=plannedTotal(), remaining=remainingTotal(), pct=planned?Math.min(100,paid/planned*100):0;
    if($("modernPaid")) $("modernPaid").textContent=money(paid);
    if($("modernRemaining")) $("modernRemaining").textContent=money(remaining);
    if($("modernIncome")) $("modernIncome").textContent=money(s.income);
    if($("modernSafe")){
      if(hasBank()){
        const safe=bank()-remaining; $("modernSafe").textContent=money(safe);
        $("modernSafeHint").textContent=safe>=0?"After every currently planned bill":"Planned bills exceed current bank balance";
        $("modernSafeCard").classList.toggle("danger",safe<0);
      } else {
        $("modernSafe").textContent="—"; $("modernSafeHint").textContent="Set bank balance in Payments";
        $("modernSafeCard").classList.remove("danger");
      }
    }
    if($("modernProgressText")) $("modernProgressText").textContent=money(paid)+" paid of "+money(planned)+" planned";
    if($("modernProgressPct")) $("modernProgressPct").textContent=Math.round(pct)+"%";
    if($("modernProgressBar")) $("modernProgressBar").style.width=pct+"%";

    const list=$("upcomingPaymentsList"); if(!list) return; list.innerHTML="";
    const waiting=(s.bills||[]).filter(isWaitingBill).slice(0,5);
    if(!waiting.length){list.innerHTML='<div class="emptyState"><div><div class="emptyMark">✓</div><strong>No payments waiting</strong><span>This month is clear based on your records.</span></div></div>';return;}
    waiting.forEach(b=>{
      const r=document.createElement("div"); r.className="upcomingRow";
      const due=Math.max(0,Number(b[1]||0)-Number(paidValue(b)||0));
      r.innerHTML='<div class="upcomingName"><strong></strong><span></span></div><div class="upcomingAmount"></div><button>Pay</button>';
      r.querySelector("strong").textContent=b[0]; r.querySelector("span").textContent=b[2]+(accountFor(b[0])?" · A/C saved":"");
      r.querySelector(".upcomingAmount").textContent=money(due); r.querySelector("button").onclick=()=>openPage("payments"); list.append(r);
    });
  }

  function ensureBankPanel(){
    const card=document.querySelector("#paymentsView .paymentTop > .card:first-child"); if(!card||$("bankBalancePanel")) return;
    const p=document.createElement("div"); p.id="bankBalancePanel"; p.className="bankBalancePanel";
    p.innerHTML='<div class="bankBalanceHead"><div><span class="bankBalanceLabel">Current bank balance</span>'+ 
      '<strong id="bankBalanceTotal" class="bankBalanceAmount"></strong><div id="bankBalanceUpdated" class="bankBalanceMeta"></div></div>'+ 
      '<button id="updateBankBalance" class="bankUpdateBtn">Update balance</button></div>'+ 
      '<div class="bankBalanceRule">Only real payments change this balance automatically. Editing a plan does not change your bank.</div>';
    card.append(p); $("updateBankBalance").onclick=openBankModal;
  }

  function ensureBankModal(){
    if($("bankBalanceModal")) return;
    const d=document.createElement("div"); d.id="bankBalanceModal"; d.className="modalBackdrop hidden";
    d.innerHTML='<section class="modal"><h2>Update bank balance</h2><p class="sub">Enter what is actually in your bank now. Corrections are saved in History.</p>'+ 
      '<form id="bankBalanceForm" class="form"><label class="fieldLabel">Current bank balance</label>'+ 
      '<input id="bankBalanceInput" type="number" inputmode="decimal" step="0.01" min="0" required placeholder="MVR">'+ 
      '<div class="modalActions"><button type="button" id="cancelBankBalance" class="secondary">Cancel</button><button class="primary">Save balance</button></div></form></section>';
    document.body.append(d); $("cancelBankBalance").onclick=()=>d.classList.add("hidden");
    $("bankBalanceForm").onsubmit=e=>{
      e.preventDefault(); const n=Number($("bankBalanceInput").value); if(!Number.isFinite(n)||n<0)return;
      const had=hasBank(), before=bank(); setBank(n,"manual");
      if(!had) log("opening","Bank balance set",null,n,"Starting balance");
      else if(Math.abs(n-before)>=.005) log("adjustment","Bank balance adjustment",n-before,n,"Manual correction");
      d.classList.add("hidden"); renderAll();
    };
  }
  function openBankModal(){ ensureBankModal(); $("bankBalanceInput").value=hasBank()?bank():""; $("bankBalanceModal").classList.remove("hidden"); $("bankBalanceInput").focus(); }
  function renderBank(){
    if(!$("bankBalanceTotal")) return;
    $("bankBalanceTotal").textContent=hasBank()?money(bank()):"Not set";
    $("bankBalanceTotal").classList.toggle("red",hasBank()&&bank()<0);
    const raw=localStorage.getItem(BANK_AT), src=localStorage.getItem(BANK_SRC)||"manual";
    $("bankBalanceUpdated").textContent=!raw?"Not set yet":(src==="payment"?"Synced after payment · ":"Manually updated · ")+new Date(raw).toLocaleDateString(undefined,{day:"numeric",month:"short"});
  }

  function uniqueNames(){
    const m=new Map();
    Object.values(months||{}).forEach(p=>(p?.bills||[]).forEach(b=>{const n=String(b?.[0]||"").trim();if(n)m.set(norm(n),n)}));
    (s.bills||[]).forEach(b=>{const n=String(b?.[0]||"").trim();if(n)m.set(norm(n),n)});
    Object.values(payees).forEach(p=>{if(p?.name)m.set(norm(p.name),p.name)});
    return [...m.values()].sort((a,b)=>a.localeCompare(b));
  }
  function ensureVendorFields(){
    const name=$("name");
    if(name&&!$("vendorAccount")){
      const dl=document.createElement("datalist"); dl.id="payeeSuggestions"; document.body.append(dl); name.setAttribute("list","payeeSuggestions");
      const w=document.createElement("div"); w.className="accountField"; w.innerHTML='<label class="fieldLabel">Payee account</label><input id="vendorAccount" placeholder="Auto-filled for saved payees">';
      name.insertAdjacentElement("afterend",w);
      const fill=()=>{const a=accountFor(name.value);if(a)$("vendorAccount").value=a}; name.addEventListener("input",fill); name.addEventListener("blur",fill);
    }
    const debt=$("editDebtWrap");
    if(debt&&!$("editVendorAccount")){
      const w=document.createElement("div");w.className="accountField";w.innerHTML='<label class="fieldLabel">Payee account</label><input id="editVendorAccount" placeholder="Optional bank account number">';
      debt.insertAdjacentElement("afterend",w);
    }
    refreshDatalist();
  }
  function refreshDatalist(){ const d=$("payeeSuggestions"); if(!d)return; d.innerHTML=uniqueNames().map(n=>'<option value="'+n.replaceAll('"','&quot;')+'"></option>').join(""); }

  function copyText(value,button){
    const done=()=>{if(button){const old=button.textContent;button.textContent="Copied";setTimeout(()=>button.textContent=old,1000)}};
    if(navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(done).catch(()=>{fallback(value);done()}); else {fallback(value);done()}
  }
  function fallback(v){const t=document.createElement("textarea");t.value=v;t.style.position="fixed";t.style.opacity=0;document.body.append(t);t.select();try{document.execCommand("copy")}catch{}t.remove();}
  function renderPayees(){
    const h=$("vendorManager"); if(!h)return; h.innerHTML="";
    const names=uniqueNames(); if(!names.length){h.innerHTML='<div class="emptyState"><div><div class="emptyMark">0</div><strong>No payees yet</strong><span>Save your first payee above.</span></div></div>';return;}
    names.forEach(name=>{
      const acc=accountFor(name), r=document.createElement("div");r.className="vendorRow";
      const n=document.createElement("strong");n.textContent=name; const a=document.createElement("span");a.textContent=acc||"No account number";
      const actions=document.createElement("div");actions.className="vendorRowActions";
      const edit=document.createElement("button");edit.className="vendorEditBtn";edit.textContent=acc?"Edit":"Add account";edit.onclick=()=>{const x=prompt("Account number for "+name,acc);if(x!==null){savePayee(name,x);renderAll()}};
      actions.append(edit);
      if(acc){const c=document.createElement("button");c.className="vendorCopyBtn";c.textContent="Copy";c.onclick=()=>copyText(acc,c);actions.append(c);
        const del=document.createElement("button");del.className="vendorDeleteBtn";del.textContent="Remove A/C";del.onclick=()=>{if(confirm("Remove the saved account number for "+name+"?")){savePayee(name,"");renderAll()}};actions.append(del);}
      r.append(n,a,actions);h.append(r);
    });
  }
  function renderBillAccounts(){
    document.querySelectorAll("#bills .bill").forEach(row=>{
      const name=row.querySelector(".billInfo strong")?.textContent.trim(), info=row.querySelector(".billInfo"), actions=row.querySelector(".billActions");
      if(!name||!info||!actions)return; const acc=accountFor(name);
      info.querySelector(".vendorAccountLine")?.remove(); actions.querySelector(".copyAccount")?.remove();
      const b=document.createElement("button");b.className="copyAccount";
      if(acc){const l=document.createElement("small");l.className="vendorAccountLine";l.textContent="A/C "+acc;info.append(l);b.textContent="Copy A/C";b.onclick=()=>copyText(acc,b)}
      else {b.textContent="Add A/C";b.onclick=()=>{const x=prompt("Account number for "+name,"");if(x!==null){savePayee(name,x);renderAll()}}}
      actions.insertBefore(b,actions.querySelector(".edit"));
    });
  }

  function ensurePaymentText(){
    const first=document.querySelector("#paymentsView .paymentTop > .card:first-child"), second=document.querySelector("#paymentsView .paymentTop > .card:nth-child(2)");
    if(first){first.querySelector("h2").textContent="Money this month";first.querySelector(".sub").textContent="Monthly income and your actual bank balance stay separate.";$("saveIncome").textContent="Update income";
      if(!first.querySelector(".incomeLogicNote")){const p=document.createElement("p");p.className="incomeLogicNote";p.textContent="Income is a budget reference. Updating income does not add money to your bank.";first.insertBefore(p,$("bankBalancePanel"))}}
    if(second){second.querySelector("h2").textContent="Plan a payment";second.querySelector(".sub").textContent="Choose a payee, category and expected payment amount.";const b=second.querySelector("form > button.primary");if(b)b.textContent="Add to monthly plan";}
  }

  function wire(){
    if(document.body.dataset.modernWired)return;document.body.dataset.modernWired="1";
    $("form")?.addEventListener("submit",()=>{if($("vendorAccount")?.value.trim())savePayee($("name").value,$("vendorAccount").value)},true);
    $("editForm")?.addEventListener("submit",()=>{if($("editVendorAccount"))savePayee($("editName").value,$("editVendorAccount").value)},true);
    document.addEventListener("click",e=>{
      const edit=e.target.closest?.("#bills .edit"); if(edit)setTimeout(()=>{try{$("editVendorAccount").value=accountFor(s.bills[editingBillIndex][0])}catch{}},0);
      const del=e.target.closest?.("#bills .del"); if(del){const status=del.closest(".bill")?.querySelector(".statusBadge")?.textContent||"";if(/paid|partial/i.test(status)){e.preventDefault();e.stopImmediatePropagation();alert("Undo the payment before removing this bill so the bank history stays correct.");}}
      const p=e.target.closest?.("#bills .pay, #bills .undoPay"); if(p){const before=paidTotal(),label=p.closest(".bill")?.querySelector(".billInfo strong")?.textContent||"Payment";setTimeout(()=>syncPayment(before,label),0)}
    },true);
    document.addEventListener("submit",e=>{if(e.target?.id==="paymentForm"){const before=paidTotal();let label="Credit / loan payment";try{label=s.bills[paymentBillIndex][0]}catch{}setTimeout(()=>syncPayment(before,label),0)}},true);
  }
  function syncPayment(before,label){
    if(!hasBank())return; const delta=paidTotal()-before;if(!Number.isFinite(delta)||Math.abs(delta)<.005)return;
    const after=bank()-delta;setBank(after,"payment");log(delta>0?"payment":"reversal",delta>0?"Payment · "+label:"Payment reversed · "+label,-delta,after);renderBank();renderDashboard();
  }

  function renderHistory(){
    const list=$("transactionList");if(!list)return;const rows=tx.filter(t=>!t.month||t.month===activeMonth);
    $("txCount").textContent=rows.filter(t=>t.kind==="payment").length;
    $("txPaid").textContent=money(rows.filter(t=>t.kind==="payment").reduce((a,t)=>a+Math.abs(Number(t.amount||0)),0));
    $("txAdjust").textContent=rows.filter(t=>t.kind==="adjustment"||t.kind==="opening").length;
    list.innerHTML=""; if(!rows.length){list.innerHTML='<div class="emptyState"><div><div class="emptyMark">0</div><strong>No bank transactions yet</strong><span>New payments and bank corrections will appear here.</span></div></div>';return;}
    rows.slice(0,100).forEach(t=>{const r=document.createElement("div");r.className="transactionRow";const d=new Date(t.at);
      r.innerHTML='<div class="transactionMain"><strong></strong><span></span></div><div class="transactionAmount"></div><div class="transactionBank"></div>';
      r.querySelector("strong").textContent=t.label;r.querySelector(".transactionMain span").textContent=d.toLocaleString(undefined,{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})+(t.note?" · "+t.note:"");
      const a=r.querySelector(".transactionAmount");a.textContent=t.amount===null?"Balance set":signed(t.amount);if(t.amount!==null)a.classList.add(t.amount<0?"negative":t.amount>0?"positive":"");
      r.querySelector(".transactionBank").textContent="Bank after: "+money(t.bankAfter);list.append(r);});
  }

  function route(page){
    ensureViews(); const safe=["dashboard","payments","categories","payees","history"].includes(page)?page:"dashboard";
    if(safe==="payees"||safe==="history"){$("dashboardView").classList.add("hidden");$("paymentsView").classList.add("hidden");$("categoriesView").classList.add("hidden");}
    else {coreOpenPage(safe);if(safe!=="dashboard")$("dashboardView").classList.add("hidden");}
    $("payeesView").classList.toggle("hidden",safe!=="payees");$("historyView").classList.toggle("hidden",safe!=="history");
    document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===safe));
    $("payeesNav")?.classList.toggle("active",safe==="payees");$("historyNav")?.classList.toggle("active",safe==="history");
    localStorage.setItem(PAGE,safe);if(safe==="payees")renderPayees();if(safe==="history")renderHistory();
  }
  openPage=route;

  function renderAll(){
    document.querySelectorAll('input[type="number"]').forEach(i=>{i.step="0.01";if(!i.hasAttribute("min"))i.min="0"});
    ensureNav();ensureViews();ensureOTSettings();ensureDashboard();ensureBankPanel();ensureBankModal();ensureVendorFields();ensurePaymentText();wire();
    renderBank();renderPayees();renderBillAccounts();renderDashboard();renderHistory();
  }
  const coreRender=render;render=function(){coreRender();renderAll();};
  renderAll();route(localStorage.getItem(PAGE)||localStorage.getItem("moneyPlanActivePage")||"dashboard");
})();