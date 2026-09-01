(function(){
  const META_KEY="moneyPlanMonthMetaV1";
  const $=(id)=>document.getElementById(id);

  let meta=(()=>{try{const v=JSON.parse(localStorage.getItem(META_KEY))||{};return v&&typeof v==="object"?v:{}}catch{return {}}})();

  function saveMeta(){localStorage.setItem(META_KEY,JSON.stringify(meta));}
  function monthName(value){
    if(!/^\d{4}-\d{2}$/.test(String(value||"")))return String(value||"");
    const [y,m]=value.split("-").map(Number);
    return new Date(y,m-1,1).toLocaleDateString(undefined,{month:"long",year:"numeric"});
  }
  function shiftMonth(value,delta){
    const [y,m]=String(value).split("-").map(Number);
    const d=new Date(y,m-1+delta,1);
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
  }
  function simpleHash(value){
    const text=JSON.stringify(value||{});
    let h=2166136261;
    for(let i=0;i<text.length;i++){
      h^=text.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    return (h>>>0).toString(36)+":"+text.length;
  }
  function monthState(){
    const record=meta[activeMonth];
    if(!record)return {kind:"working",label:"Working month",detail:"Changes are autosaved"};
    if(record.hash===simpleHash(s)){
      const when=record.savedAt?new Date(record.savedAt):null;
      return {kind:"saved",label:"Month saved",detail:when&&!Number.isNaN(when.getTime())?"Saved "+when.toLocaleDateString(undefined,{day:"numeric",month:"short"}):"Saved"};
    }
    return {kind:"modified",label:"Modified",detail:"Save month again when finished"};
  }

  function markMonthSaved(){
    try{save();}catch{}
    meta[activeMonth]={savedAt:new Date().toISOString(),hash:simpleHash(s)};
    saveMeta();
    renderMonthManager();
    const button=$("saveMonthBtn");
    if(button){
      const old=button.textContent;
      button.textContent="Saved ✓";
      setTimeout(()=>{button.textContent=old;renderMonthManager();},1100);
    }
  }

  function isDebtBill(bill){
    const category=String(bill?.[2]||"").trim().toLowerCase();
    if(category==="loan")return true;
    try{return typeof isCreditCategory==="function"&&isCreditCategory(bill?.[2]);}
    catch{return category.includes("credit")||category.includes("debt");}
  }
  function debtType(bill){
    return String(bill?.[2]||"").trim().toLowerCase()==="loan"?"Loan":"Credit / debt";
  }
  function money(value){return "MVR "+Number(value||0).toLocaleString(undefined,{maximumFractionDigits:2});}

  function ensureRolloverModal(){
    if($("monthRolloverModal"))return;
    const wrap=document.createElement("div");
    wrap.id="monthRolloverModal";
    wrap.className="monthRolloverBackdrop hidden";
    wrap.innerHTML=
      '<section class="monthRolloverModal" role="dialog" aria-modal="true" aria-labelledby="monthRolloverTitle">'+
        '<div class="monthRolloverHead"><div><span>NEXT MONTH SETUP</span><h2 id="monthRolloverTitle">Choose what continues</h2><p id="monthRolloverSub"></p></div><button type="button" id="monthRolloverClose" aria-label="Close">×</button></div>'+ 
        '<div class="monthRolloverNote"><strong>Simple rule</strong><span>Normal expenses can be removed completely. Loans and credit balances stay tracked, but you choose whether to schedule a payment next month.</span></div>'+ 
        '<div class="monthRolloverToolbar"><button type="button" id="rolloverSelectUsual">Select usual bills</button><button type="button" id="rolloverClearPlans">Clear payment plans</button></div>'+ 
        '<div id="monthRolloverList" class="monthRolloverList"></div>'+ 
        '<div class="monthRolloverFooter"><button type="button" id="monthRolloverCancel">Cancel</button><button type="button" id="monthRolloverConfirm" class="primary">Create next month →</button></div>'+ 
      '</section>';
    document.body.append(wrap);
    $("monthRolloverClose").onclick=closeRolloverModal;
    $("monthRolloverCancel").onclick=closeRolloverModal;
    wrap.addEventListener("click",e=>{if(e.target===wrap)closeRolloverModal();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!wrap.classList.contains("hidden"))closeRolloverModal();});
  }

  function closeRolloverModal(){const modal=$("monthRolloverModal");if(modal)modal.classList.add("hidden");}

  function renderRolloverList(){
    const list=$("monthRolloverList");
    if(!list)return;
    list.innerHTML="";
    const bills=Array.isArray(s?.bills)?s.bills:[];
    const sections=[
      {key:"regular",title:"Regular expenses",hint:"Uncheck anything you do not need next month.",filter:b=>!isDebtBill(b)},
      {key:"credit",title:"Credit & debt",hint:"Balance stays tracked. Toggle only controls next month's payment plan.",filter:b=>isDebtBill(b)&&String(b?.[2]||"").trim().toLowerCase()!=="loan"},
      {key:"loan",title:"Loans",hint:"Balance stays tracked. Turn off people you do not need to pay next month.",filter:b=>String(b?.[2]||"").trim().toLowerCase()==="loan"}
    ];
    sections.forEach(section=>{
      const rows=bills.map((bill,index)=>({bill,index})).filter(x=>section.filter(x.bill));
      if(!rows.length)return;
      const block=document.createElement("section");
      block.className="rolloverSection";
      block.innerHTML='<div class="rolloverSectionHead"><div><strong></strong><span></span></div><b></b></div><div class="rolloverRows"></div>';
      block.querySelector("strong").textContent=section.title;
      block.querySelector("span").textContent=section.hint;
      block.querySelector("b").textContent=rows.length+" item"+(rows.length===1?"":"s");
      const holder=block.querySelector(".rolloverRows");
      rows.forEach(({bill,index})=>{
        const debt=isDebtBill(bill);
        const planned=Number(bill?.[1]||0);
        const remaining=Number(bill?.[4]||0);
        const row=document.createElement("label");
        row.className="rolloverRow";
        row.innerHTML=
          '<input type="checkbox" class="rolloverCheck" />'+
          '<div class="rolloverMain"><strong></strong><span></span></div>'+ 
          '<div class="rolloverAmount"><small></small><strong></strong></div>';
        const check=row.querySelector("input");
        check.dataset.billIndex=String(index);
        check.dataset.kind=debt?"debt":"regular";
        check.checked=debt?planned>0:planned>0;
        row.querySelector(".rolloverMain strong").textContent=String(bill?.[0]||"Unnamed");
        row.querySelector(".rolloverMain span").textContent=debt?(debtType(bill)+" · "+(remaining>0?money(remaining)+" remaining":"no balance")):String(bill?.[2]||"Expense");
        row.querySelector(".rolloverAmount small").textContent=debt?"PAY NEXT MONTH":"NEXT MONTH PLAN";
        row.querySelector(".rolloverAmount strong").textContent=planned>0?money(planned):"No plan";
        holder.append(row);
      });
      list.append(block);
    });
    if(!list.children.length)list.innerHTML='<div class="rolloverEmpty">No bills are set up in this month.</div>';
  }

  function openRolloverModal(){
    ensureRolloverModal();
    const next=shiftMonth(activeMonth,1);
    $("monthRolloverTitle").textContent="Set up "+monthName(next);
    $("monthRolloverSub").textContent="Choose exactly what should continue from "+monthName(activeMonth)+".";
    renderRolloverList();
    $("rolloverSelectUsual").onclick=()=>{
      document.querySelectorAll("#monthRolloverList .rolloverCheck").forEach(check=>{
        const bill=s.bills[Number(check.dataset.billIndex)];
        check.checked=Number(bill?.[1]||0)>0;
      });
    };
    $("rolloverClearPlans").onclick=()=>{
      document.querySelectorAll("#monthRolloverList .rolloverCheck").forEach(check=>check.checked=false);
    };
    $("monthRolloverConfirm").onclick=createSelectedNextMonth;
    $("monthRolloverModal").classList.remove("hidden");
  }

  function createSelectedNextMonth(){
    const current=activeMonth;
    const next=shiftMonth(current,1);
    let nextPlan;
    try{nextPlan=typeof makeNewMonth==="function"?makeNewMonth(s):preparePlan(s);}catch{nextPlan=preparePlan(s);}
    nextPlan.income=0;
    const choices=new Map();
    document.querySelectorAll("#monthRolloverList .rolloverCheck").forEach(check=>choices.set(Number(check.dataset.billIndex),check.checked));
    const built=[];
    (nextPlan.bills||[]).forEach((bill,index)=>{
      const source=s.bills[index];
      const debt=isDebtBill(source);
      const selected=choices.has(index)?choices.get(index):Number(source?.[1]||0)>0;
      if(debt){
        // Keep the balance in the new month even when no payment is scheduled.
        const copy=[...bill];
        if(!selected)copy[1]=0;
        built.push(copy);
      }else if(selected){
        built.push([...bill]);
      }
    });
    nextPlan.bills=built;
    markMonthSaved();
    months[next]=preparePlan(nextPlan);
    closeRolloverModal();
    selectMonth(next);
    delete meta[next];
    saveMeta();
    try{save();}catch{}
    try{openPage(localStorage.getItem("moneyPlanModernPage")||localStorage.getItem("moneyPlanActivePage")||"payments");}catch{}
    setTimeout(renderMonthManager,0);
  }

  function goNextMonth(){
    const next=shiftMonth(activeMonth,1);
    if(months[next]){
      markMonthSaved();
      selectMonth(next);
      try{openPage(localStorage.getItem("moneyPlanModernPage")||localStorage.getItem("moneyPlanActivePage")||"payments");}catch{}
      setTimeout(renderMonthManager,0);
      return;
    }
    openRolloverModal();
  }

  function ensureMonthManager(){
    const picker=document.querySelector(".monthPicker");
    if(!picker||$("monthWorkflow"))return;
    const box=document.createElement("div");
    box.id="monthWorkflow";
    box.className="monthWorkflow";
    box.innerHTML=
      '<div class="monthWorkflowStatus"><span id="monthStateDot" class="monthStateDot"></span><div><strong id="monthStateLabel"></strong><small id="monthStateDetail"></small></div></div>'+ 
      '<div class="monthWorkflowActions">'+
        '<button type="button" id="saveMonthBtn" class="saveMonthBtn">Save month</button>'+ 
        '<button type="button" id="nextMonthBtn" class="nextMonthBtn">Next month →</button>'+ 
      '</div>'+ 
      '<p class="monthWorkflowHelp">Next month now lets you choose which expenses continue. Loan and credit balances remain tracked even when you skip the next payment.</p>';
    picker.append(box);
    $("saveMonthBtn").onclick=markMonthSaved;
    $("nextMonthBtn").onclick=goNextMonth;

    const input=$("monthSelect");
    if(input&&!input.dataset.monthWorkflowWire){
      input.dataset.monthWorkflowWire="1";
      input.addEventListener("change",()=>setTimeout(renderMonthManager,0));
    }
  }

  function ensureMonthBanner(){
    const payments=$("paymentsView");
    const intro=$("paymentsIntro");
    if(!payments||!intro||$("monthBanner"))return;
    const banner=document.createElement("section");
    banner.id="monthBanner";
    banner.className="monthBanner";
    banner.innerHTML=
      '<div class="monthBannerMain"><span class="monthBannerEyebrow">CURRENT MONTH</span><strong id="monthBannerName"></strong><small id="monthBannerState"></small></div>'+ 
      '<div class="monthBannerActions"><button type="button" id="bannerSaveMonth">Save month</button><button type="button" id="bannerNextMonth">Next month →</button></div>';
    intro.insertAdjacentElement("afterend",banner);
    $("bannerSaveMonth").onclick=markMonthSaved;
    $("bannerNextMonth").onclick=goNextMonth;
  }

  function renderMonthManager(){
    ensureMonthManager();
    ensureMonthBanner();
    ensureRolloverModal();
    const state=monthState();
    const label=$("monthStateLabel"),detail=$("monthStateDetail"),dot=$("monthStateDot");
    if(label)label.textContent=state.label;
    if(detail)detail.textContent=state.detail;
    if(dot)dot.className="monthStateDot "+state.kind;
    const saveBtn=$("saveMonthBtn");
    if(saveBtn)saveBtn.textContent=state.kind==="saved"?"Saved month ✓":"Save month";
    const next=shiftMonth(activeMonth,1);
    const nextLabel=(months[next]?"Open: ":"Set up: ")+monthName(next);
    const nextBtn=$("nextMonthBtn");
    if(nextBtn)nextBtn.textContent=nextLabel+" →";
    const bName=$("monthBannerName");if(bName)bName.textContent=monthName(activeMonth);
    const bState=$("monthBannerState");if(bState)bState.textContent=state.label+" · "+state.detail;
    const bSave=$("bannerSaveMonth");if(bSave)bSave.textContent=state.kind==="saved"?"Saved ✓":"Save month";
    const bNext=$("bannerNextMonth");if(bNext)bNext.textContent=(months[next]?"Open ":"Set up ")+monthName(next)+" →";
  }

  const previousRender=render;
  render=function(){previousRender();setTimeout(renderMonthManager,0);};
  const previousOpenPage=openPage;
  openPage=function(page){previousOpenPage(page);setTimeout(renderMonthManager,0);};

  setTimeout(renderMonthManager,0);
})();
