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

  function goNextMonth(){
    const current=activeMonth;
    markMonthSaved();
    const next=shiftMonth(current,1);
    const existed=!!months[next];
    selectMonth(next);
    if(!existed){
      // The core month creator carries the current plan forward and resets payment state.
      // The new month remains a working month until the user explicitly saves it.
      delete meta[next];
      saveMeta();
    }
    try{openPage(localStorage.getItem("moneyPlanModernPage")||localStorage.getItem("moneyPlanActivePage")||"payments");}catch{}
    setTimeout(renderMonthManager,0);
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
      '<p class="monthWorkflowHelp">To modify an old month, choose that month above, edit it, then press <b>Save month</b> again.</p>';
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
    const state=monthState();
    const label=$("monthStateLabel"),detail=$("monthStateDetail"),dot=$("monthStateDot");
    if(label)label.textContent=state.label;
    if(detail)detail.textContent=state.detail;
    if(dot)dot.className="monthStateDot "+state.kind;
    const saveBtn=$("saveMonthBtn");
    if(saveBtn)saveBtn.textContent=state.kind==="saved"?"Saved month ✓":"Save month";
    const nextLabel="Next: "+monthName(shiftMonth(activeMonth,1));
    const nextBtn=$("nextMonthBtn");
    if(nextBtn)nextBtn.textContent=nextLabel+" →";
    const bName=$("monthBannerName");if(bName)bName.textContent=monthName(activeMonth);
    const bState=$("monthBannerState");if(bState)bState.textContent=state.label+" · "+state.detail;
    const bSave=$("bannerSaveMonth");if(bSave)bSave.textContent=state.kind==="saved"?"Saved ✓":"Save month";
    const bNext=$("bannerNextMonth");if(bNext)bNext.textContent="Go to "+monthName(shiftMonth(activeMonth,1))+" →";
  }

  const previousRender=render;
  render=function(){previousRender();setTimeout(renderMonthManager,0);};
  const previousOpenPage=openPage;
  openPage=function(page){previousOpenPage(page);setTimeout(renderMonthManager,0);};

  setTimeout(renderMonthManager,0);
})();
