(function(){
  const $=(id)=>document.getElementById(id);
  const money=(n)=>"MVR "+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const parseMoney=(text)=>{const n=Number(String(text||"").replace(/,/g,"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;};

  function closeMenus(except){
    document.querySelectorAll(".friendlyMenu.open").forEach(menu=>{if(menu!==except)menu.classList.remove("open")});
  }

  function addMenuAction(menu,label,source,className){
    if(!source)return;
    const b=document.createElement("button");
    b.type="button"; b.textContent=label; if(className)b.className=className;
    b.onclick=(e)=>{e.preventDefault();e.stopPropagation();closeMenus();source.click();};
    menu.append(b);
  }

  function friendlyRow(row){
    row.querySelector(".friendlyBillAmount")?.remove();
    row.querySelector(".friendlyBillControl")?.remove();

    const planned=parseMoney(row.querySelector(".plannedMetric b")?.textContent);
    const paid=parseMoney(row.querySelector(".paidMetric b")?.textContent);
    const due=Math.max(0,planned-paid);
    const status=(row.querySelector(".statusBadge")?.textContent||"").trim().toLowerCase();
    const deferred=row.classList.contains("salaryDeferred");
    const originalPay=row.querySelector(".billActions .pay");
    const undoPartial=row.querySelector(".billActions .undoPay:not(.hidden)");
    const salary=row.querySelector(".billActions .salaryDeferBtn");
    const account=row.querySelector(".billActions .copyAccount");
    const edit=row.querySelector(".billActions .edit");
    const remove=row.querySelector(".billActions .del");

    const amount=document.createElement("div");
    amount.className="friendlyBillAmount";
    const label=document.createElement("span");label.className="friendlyLabel";
    const strong=document.createElement("strong");
    const small=document.createElement("small");

    if(deferred && due>0){
      amount.classList.add("isNext");label.textContent="Next salary";strong.textContent=money(due);small.textContent=paid>0?money(paid)+" already paid":"Moved forward";
    }else if(due<=.004 && paid>0){
      amount.classList.add("isPaid");label.textContent="Paid";strong.textContent=money(paid);small.textContent="Completed this month";
    }else if(planned<=.004){
      label.textContent="Plan";strong.textContent="No payment";small.textContent="Nothing due this month";
    }else if(paid>0){
      amount.classList.add("isDue");label.textContent="Still due";strong.textContent=money(due);small.textContent=money(paid)+" already paid";
    }else{
      amount.classList.add("isDue");label.textContent="Due now";strong.textContent=money(planned);small.textContent="Not paid yet";
    }
    amount.append(label,strong,small);

    const control=document.createElement("div");control.className="friendlyBillControl";
    const primary=document.createElement("button");primary.type="button";primary.className="friendlyPrimary";
    if(deferred && due>0){
      primary.classList.add("isNext");primary.textContent="Next salary";primary.onclick=(e)=>{e.preventDefault();e.stopPropagation();salary?.click();};
    }else if(due<=.004 && paid>0){
      primary.classList.add("isPaid");primary.textContent="Paid";primary.disabled=true;
    }else if(planned<=.004){
      primary.classList.add("isNoPlan");primary.textContent="No plan";primary.disabled=true;
    }else{
      primary.textContent=paid>0?"Add payment":"Pay";
      primary.onclick=(e)=>{e.preventDefault();e.stopPropagation();originalPay?.click();};
    }

    const more=document.createElement("button");more.type="button";more.className="friendlyMore";more.textContent="•••";more.setAttribute("aria-label","More actions");
    const menu=document.createElement("div");menu.className="friendlyMenu";

    if(due<=.004 && paid>0 && originalPay) addMenuAction(menu,"Undo payment",originalPay,"undo");
    if(undoPartial) addMenuAction(menu,"Undo recorded payment",undoPartial,"undo");
    if(salary && due>0) addMenuAction(menu,deferred?"Bring back to this salary":"Move to next salary",salary,"warn");
    if(account) addMenuAction(menu,account.textContent?.toLowerCase().includes("copy")?"Copy account number":"Add account number",account,"");
    if(edit) addMenuAction(menu,"Edit bill",edit,"");
    if(remove) addMenuAction(menu,"Remove bill",remove,"danger");

    if(!menu.children.length){more.style.display="none";}
    more.onclick=(e)=>{e.preventDefault();e.stopPropagation();const open=!menu.classList.contains("open");closeMenus(menu);menu.classList.toggle("open",open);};
    menu.onclick=(e)=>e.stopPropagation();
    control.append(primary,more,menu);
    row.append(amount,control);
  }

  function groupSummary(group){
    const old=group.querySelector(".friendlyGroupSummary");if(old)old.remove();
    const rows=[...group.querySelectorAll(":scope > .bill")];
    let currentDue=0,currentCount=0,nextDue=0,nextCount=0;
    rows.forEach(row=>{
      const planned=parseMoney(row.querySelector(".plannedMetric b")?.textContent);
      const paid=parseMoney(row.querySelector(".paidMetric b")?.textContent);
      const due=Math.max(0,planned-paid);if(due<=.004)return;
      if(row.classList.contains("salaryDeferred")){nextDue+=due;nextCount++;}
      else{currentDue+=due;currentCount++;}
    });
    const s=document.createElement("span");s.className="friendlyGroupSummary";
    if(!currentCount&&!nextCount){s.textContent="All paid";s.classList.add("ok");}
    else if(currentCount){s.textContent=currentCount+" to pay · "+money(currentDue)+(nextCount?" · "+nextCount+" next salary":"");}
    else{s.textContent=nextCount+" next salary · "+money(nextDue);s.classList.add("next");}
    group.querySelector(".billGroupHead")?.append(s);
  }

  function improveLabels(){
    const head=document.querySelector("#paymentsView .billsCard .sectionHead h2");if(head)head.textContent="Bills";
    const sub=document.querySelector("#paymentsView .billsCard .sectionHead .sub");if(sub)sub.textContent="Open a category. Each bill shows one amount and one main action; use ••• for everything else.";
    const note=$("paymentsFootNote");if(note)note.textContent="Pay = money leaves the bank. Next salary = keep the bill, but do not count it against this salary.";
  }

  function enhanceFriendly(){
    improveLabels();
    document.querySelectorAll("#paymentsView #bills .bill").forEach(friendlyRow);
    document.querySelectorAll("#paymentsView #bills .billGroup").forEach(groupSummary);
  }

  document.addEventListener("click",()=>closeMenus());
  const oldRender=render;render=function(){oldRender();setTimeout(enhanceFriendly,0);};
  const oldOpenPage=openPage;openPage=function(page){oldOpenPage(page);if(page==="payments")setTimeout(enhanceFriendly,0);};
  setTimeout(enhanceFriendly,0);
})();
