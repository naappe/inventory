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

  function setRowStatus(row,state){
    row.classList.remove("statusUnpaid","statusPaid","statusPending","statusNeutral");
    row.classList.add(state);
  }

  function friendlyRow(row){
    row.querySelector(".friendlyBillAmount")?.remove();
    row.querySelector(".friendlyBillControl")?.remove();

    const planned=parseMoney(row.querySelector(".plannedMetric b")?.textContent);
    const paid=parseMoney(row.querySelector(".paidMetric b")?.textContent);
    const due=Math.max(0,planned-paid);
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

    let state="neutral";
    if(deferred && due>0){
      state="pending";
      setRowStatus(row,"statusPending");
      amount.classList.add("isPending");
      label.textContent="Pending";
      strong.textContent=money(due);
      small.textContent=paid>0?money(paid)+" paid · next salary":"Kept for next salary";
    }else if(due<=.004 && paid>0){
      state="paid";
      setRowStatus(row,"statusPaid");
      amount.classList.add("isPaid");
      label.textContent="Paid";
      strong.textContent=money(paid);
      small.textContent="Completed this month";
    }else if(planned<=.004){
      state="neutral";
      setRowStatus(row,"statusNeutral");
      label.textContent="No plan";
      strong.textContent="MVR 0";
      small.textContent="Nothing planned this month";
    }else if(paid>0){
      state="pending";
      setRowStatus(row,"statusPending");
      amount.classList.add("isPending");
      label.textContent="Pending";
      strong.textContent=money(due);
      small.textContent=money(paid)+" already paid";
    }else{
      state="unpaid";
      setRowStatus(row,"statusUnpaid");
      amount.classList.add("isDue");
      label.textContent="Not paid";
      strong.textContent=money(planned);
      small.textContent="Full amount still due";
    }
    amount.append(label,strong,small);

    const control=document.createElement("div");control.className="friendlyBillControl";
    const primary=document.createElement("button");primary.type="button";primary.className="friendlyPrimary";
    if(state==="pending" && deferred){
      primary.classList.add("isPending");primary.textContent="Pending";
      primary.onclick=(e)=>{e.preventDefault();e.stopPropagation();salary?.click();};
      primary.title="Kept for next salary";
    }else if(state==="paid"){
      primary.classList.add("isPaid");primary.textContent="Paid";primary.disabled=true;
    }else if(state==="neutral"){
      primary.classList.add("isNoPlan");primary.textContent="No plan";primary.disabled=true;
    }else if(state==="pending"){
      primary.classList.add("isPending");primary.textContent="Add payment";
      primary.onclick=(e)=>{e.preventDefault();e.stopPropagation();originalPay?.click();};
    }else{
      primary.classList.add("isUnpaid");primary.textContent="Pay";
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
    let unpaidDue=0,unpaidCount=0,pendingDue=0,pendingCount=0;
    rows.forEach(row=>{
      const planned=parseMoney(row.querySelector(".plannedMetric b")?.textContent);
      const paid=parseMoney(row.querySelector(".paidMetric b")?.textContent);
      const due=Math.max(0,planned-paid);if(due<=.004)return;
      if(row.classList.contains("salaryDeferred")||paid>0){pendingDue+=due;pendingCount++;}
      else{unpaidDue+=due;unpaidCount++;}
    });
    const s=document.createElement("span");s.className="friendlyGroupSummary";
    if(!unpaidCount&&!pendingCount){
      s.textContent="All paid";s.classList.add("ok");
    }else if(unpaidCount){
      s.textContent=unpaidCount+" not paid · "+money(unpaidDue)+(pendingCount?" · "+pendingCount+" pending":"");
      s.classList.add("unpaid");
    }else{
      s.textContent=pendingCount+" pending · "+money(pendingDue);s.classList.add("pending");
    }
    group.querySelector(".billGroupHead")?.append(s);
  }

  function improveLabels(){
    const head=document.querySelector("#paymentsView .billsCard .sectionHead h2");if(head)head.textContent="Bills";
    const sub=document.querySelector("#paymentsView .billsCard .sectionHead .sub");if(sub)sub.textContent="Red = not paid · Green = paid · Blue = pending. Open a category to manage its bills.";
    const note=$("paymentsFootNote");if(note)note.textContent="Red = not paid. Green = paid. Blue = pending or moved to next salary.";
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