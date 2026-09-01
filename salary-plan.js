(function(){
  const STORE="moneyPlanSalaryPlanV1";
  const BANK="moneyPlanBankBalance";
  const $=(id)=>document.getElementById(id);
  const money=(n)=>"MVR "+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const norm=(v)=>String(v||"").trim().toLowerCase();

  let salaryPlan=(()=>{try{const v=JSON.parse(localStorage.getItem(STORE))||{};return v&&typeof v==="object"?v:{}}catch{return {}}})();

  function savePlan(){localStorage.setItem(STORE,JSON.stringify(salaryPlan));}
  function monthPlan(){if(!salaryPlan[activeMonth])salaryPlan[activeMonth]={};return salaryPlan[activeMonth];}
  function keyFor(b){return norm(b?.[0])+"||"+norm(b?.[2]);}
  function isNextSalary(b){return !!monthPlan()[keyFor(b)];}
  function setNextSalary(b,value){
    const state=monthPlan(),key=keyFor(b);
    if(value)state[key]=true;else delete state[key];
    savePlan();
  }
  function dueFor(b){return Math.max(0,Number(b?.[1]||0)-Number(paidValue(b)||0));}
  function paidTotalSalary(){return (s.bills||[]).reduce((a,b)=>a+Number(paidValue(b)||0),0);}
  function unpaidBills(){return (s.bills||[]).filter(b=>dueFor(b)>.004);}
  function hasBank(){return localStorage.getItem(BANK)!==null;}
  function bank(){const n=Number(localStorage.getItem(BANK));return Number.isFinite(n)?Math.max(0,n):0;}

  function totals(){
    const paid=paidTotalSalary();
    const planned=(s.bills||[]).reduce((a,b)=>a+Math.max(0,Number(b?.[1]||0)),0);
    const income=Math.max(0,Number(s.income||0));
    const salaryLeft=Math.max(0,income-paid);
    const unpaid=unpaidBills();
    const allDue=unpaid.reduce((a,b)=>a+dueFor(b),0);
    const next=unpaid.filter(isNextSalary);
    const nextDue=next.reduce((a,b)=>a+dueFor(b),0);
    const thisSalaryDue=Math.max(0,allDue-nextDue);
    let available=salaryLeft;
    if(hasBank()) available=income>0?Math.min(salaryLeft,bank()):bank();
    const short=Math.max(0,thisSalaryDue-available);
    const spare=Math.max(0,available-thisSalaryDue);
    return {paid,planned,income,salaryLeft,bankNow:hasBank()?bank():null,available,unpaid,allDue,next,nextDue,thisSalaryDue,short,spare,
      thisCount:unpaid.filter(b=>!isNextSalary(b)).length,nextCount:next.length};
  }

  function ensurePlanner(){
    const view=$("paymentsView"),top=view?.querySelector(".paymentTop"),bills=view?.querySelector(".billsCard");
    if(!view||!top||!bills||$("salaryPlanCard"))return;
    const card=document.createElement("section");
    card.id="salaryPlanCard";
    card.className="card salaryPlanCard";
    card.innerHTML=
      '<div class="salaryPlanHead"><div><h2>Salary plan</h2><p>One view for the total plan, what is already paid, what is still pending, and what must wait for the next salary.</p></div><span class="salaryPlanBadge">THIS SALARY → NEXT SALARY</span></div>'+ 
      '<div class="salaryPlanNumbers">'+
        '<div class="salaryPlanStat"><span>Salary received</span><strong id="salaryReceived"></strong></div>'+ 
        '<div class="salaryPlanStat"><span>Total bills planned</span><strong id="salaryPlanned"></strong></div>'+ 
        '<div class="salaryPlanStat paid"><span>Already paid</span><strong id="salaryPaid"></strong></div>'+ 
        '<div class="salaryPlanStat unpaid"><span>Still unpaid</span><strong id="salaryUnpaid"></strong></div>'+ 
        '<div class="salaryPlanStat available"><span>Available this salary</span><strong id="salaryAvailable"></strong></div>'+ 
      '</div>'+ 
      '<div class="salaryAllocation">'+
        '<div class="salaryAllocationBox"><span>Pay with this salary</span><strong id="salaryThisDue"></strong><small id="salaryThisCount"></small></div>'+ 
        '<div class="salaryAllocationBox next"><span>Keep for next salary</span><strong id="salaryNextDue"></strong><small id="salaryNextCount"></small></div>'+ 
      '</div>'+ 
      '<div id="salaryPlanStatus" class="salaryPlanStatus"></div>'+ 
      '<div id="salaryPlanHint" class="salaryPlanHint">For any bill you cannot pay now, press <b>Next salary</b> on that bill. It stays visible but is removed from this salary requirement.</div>';
    bills.insertAdjacentElement("beforebegin",card);
  }

  function renderPlanner(){
    if(!$("salaryPlanCard"))return;
    const t=totals();
    $("salaryReceived").textContent=money(t.income);
    $("salaryPlanned").textContent=money(t.planned);
    $("salaryPaid").textContent=money(t.paid);
    $("salaryUnpaid").textContent=money(t.allDue);
    $("salaryAvailable").textContent=money(t.available);
    $("salaryThisDue").textContent=money(t.thisSalaryDue);
    $("salaryNextDue").textContent=money(t.nextDue);
    $("salaryThisCount").textContent=t.thisCount+" unpaid "+(t.thisCount===1?"bill":"bills")+" assigned to this salary";
    $("salaryNextCount").textContent=t.nextCount+" "+(t.nextCount===1?"bill":"bills")+" kept for next salary";
    const status=$("salaryPlanStatus");
    status.classList.toggle("short",t.short>0);
    if(!t.unpaid.length){
      status.textContent="All planned bills are paid. There is nothing pending for the next salary.";
    }else if(t.short>0){
      status.innerHTML="This salary cannot cover the bills currently assigned to it. Move at least <b>"+money(t.short)+"</b> more to <b>Next salary</b>.";
    }else{
      status.innerHTML="This salary plan fits. After paying the bills assigned to this salary, about <b>"+money(t.spare)+"</b> remains available.";
    }
    const hint=$("salaryPlanHint");
    if(hint){
      if(t.bankNow!==null && t.income>0 && t.bankNow<t.salaryLeft-.004)
        hint.innerHTML="Salary budget left: "+money(t.salaryLeft)+". Bank now: "+money(t.bankNow)+". The lower bank balance limits what can actually be paid now.";
      else if(t.bankNow!==null && t.income>0 && t.bankNow>t.salaryLeft+.004)
        hint.innerHTML="Bank now: "+money(t.bankNow)+". Salary budget left: "+money(t.salaryLeft)+". Extra bank money is not counted as new salary, so this plan protects the salary budget.";
      else
        hint.innerHTML='For any bill you cannot pay now, press <b>Next salary</b> on that bill. It stays visible but is removed from this salary requirement.';
    }
  }

  function updateCompactSummary(){
    const box=$("compactBillSummary");if(!box)return;
    const t=totals(),items=box.querySelectorAll(".compactBillStat");
    if(items.length<3)return;
    box.classList.add("salaryAware");
    items[0].querySelector("span").textContent="This salary to pay";
    items[0].querySelector("strong").textContent=money(t.thisSalaryDue);
    items[1].querySelector("span").textContent="Next salary";
    items[1].querySelector("strong").textContent=money(t.nextDue);
    items[2].querySelector("span").textContent="Already paid";
    items[2].querySelector("strong").textContent=money(t.paid);
  }

  function billForRow(row){
    const name=row.querySelector(".billInfo strong")?.textContent?.trim()||"";
    const categoryText=row.querySelector(".billInfo small")?.textContent?.trim()||"";
    const matches=(s.bills||[]).filter(b=>String(b?.[0]||"").trim()===name);
    return matches.find(b=>categoryText.toLowerCase().startsWith(String(b?.[2]||"").toLowerCase()))||matches[0]||null;
  }

  function enhanceRows(){
    let changed=false;
    document.querySelectorAll("#paymentsView #bills .bill").forEach(row=>{
      const b=billForRow(row);if(!b)return;
      const due=dueFor(b);
      if(due<=.004){
        if(isNextSalary(b)){setNextSalary(b,false);changed=true;}
        row.classList.remove("salaryDeferred");
        row.querySelector(".salaryDeferBtn")?.remove();
        row.querySelector(".salaryTag")?.remove();
        return;
      }
      const deferred=isNextSalary(b);
      row.classList.toggle("salaryDeferred",deferred);
      const info=row.querySelector(".billInfo"),actions=row.querySelector(".billActions");
      let tag=row.querySelector(".salaryTag");
      if(deferred){
        if(!tag){tag=document.createElement("small");tag.className="salaryTag";info?.append(tag);}
        tag.textContent="Next salary · "+money(due);
      }else if(tag)tag.remove();

      let btn=row.querySelector(".salaryDeferBtn");
      if(!btn&&actions){
        btn=document.createElement("button");btn.type="button";btn.className="salaryDeferBtn";
        actions.insertBefore(btn,actions.querySelector(".edit")||actions.firstChild);
        btn.addEventListener("click",e=>{
          e.preventDefault();e.stopPropagation();
          setNextSalary(b,!isNextSalary(b));
          render();
        });
      }
      if(btn){
        btn.classList.toggle("isDeferred",deferred);
        btn.textContent=deferred?"This salary":"Next salary";
        btn.title=deferred?"Bring this bill back to the current salary":"Keep this unpaid bill for the next salary";
      }
    });
    if(changed)savePlan();
  }

  function ensureClearLabels(){
    const first=document.querySelector("#paymentsView .paymentTop > .card:first-child");
    const second=document.querySelector("#paymentsView .paymentTop > .card:nth-child(2)");
    if(first){
      const h=first.querySelector("h2");if(h)h.textContent="Salary and bank";
      const p=first.querySelector(".sub");if(p)p.textContent="Salary is the monthly budget. Bank balance is the money actually available now.";
    }
    if(second){
      const h=second.querySelector("h2");if(h)h.textContent="Add a bill";
      const p=second.querySelector(".sub");if(p)p.textContent="Add what you expect to pay. This does not reduce the bank until you record payment.";
    }
    const bills=document.querySelector("#paymentsView .billsCard .sectionHead h2");if(bills)bills.textContent="Bills and salary allocation";
    const billsSub=document.querySelector("#paymentsView .billsCard .sectionHead .sub");if(billsSub)billsSub.textContent="Assign each unpaid bill to this salary or keep it for the next salary.";
  }

  function enhanceSalaryPlan(){
    ensurePlanner();ensureClearLabels();enhanceRows();renderPlanner();updateCompactSummary();
  }

  const previousRender=render;
  render=function(){previousRender();setTimeout(enhanceSalaryPlan,0);};
  const previousOpenPage=openPage;
  openPage=function(page){previousOpenPage(page);if(page==="payments")setTimeout(enhanceSalaryPlan,0);};

  enhanceSalaryPlan();
})();
