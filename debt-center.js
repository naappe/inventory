(function(){
  'use strict';

  const VERSION = '20260916-debt-center-v1';

  function money(n){
    return typeof fmt === 'function' ? fmt(n) : 'MVR ' + Number(n||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function safe(s){
    return typeof esc === 'function' ? esc(s) : String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function debtKey(e){
    return `${e.debtType||'debt'}::${String(e.name||'Debt').trim().toLowerCase().replace(/\s+/g,' ')}`;
  }
  function monthCompare(a,b){ return String(a||'').localeCompare(String(b||'')); }
  function allDebtRows(state){
    const rows=[];
    Object.keys(state.months||{}).sort().forEach(monthKey=>{
      const month=state.months[monthKey];
      Object.values(month?.expenses||{}).forEach(e=>{
        if(e?.isDebt) rows.push({monthKey,e,key:e.debtKey||debtKey(e)});
      });
    });
    return rows;
  }
  function ensureRegistry(state){
    if(!state.debtRegistry || typeof state.debtRegistry!=='object' || Array.isArray(state.debtRegistry)) state.debtRegistry={};
    const latest={};
    allDebtRows(state).forEach(row=>{
      const r=latest[row.key];
      if(!r || monthCompare(row.monthKey,r.monthKey)>=0) latest[row.key]=row;
    });
    Object.values(latest).forEach(({monthKey,e,key})=>{
      e.debtKey=key;
      const current=state.debtRegistry[key]||{};
      if(current.archived){ state.debtRegistry[key]=current; return; }
      const candidate={
        key,
        name:e.name||current.name||'Debt',
        debtType:e.debtType||current.debtType||'credit',
        category:e.category||current.category||'Debt',
        balance:Math.max(0,+e.debtTotal||0),
        original:Math.max(+e.debtOriginal||0,+e.debtTotal||0,+current.original||0),
        monthlyPlan:Math.max(0,+e.planned||+current.monthlyPlan||0),
        apr:Math.max(0,+current.apr||+e.apr||0),
        updatedMonth:current.updatedMonth||monthKey
      };
      if(!current.key || monthCompare(monthKey,current.updatedMonth||'')>=0){
        candidate.updatedMonth=monthKey;
        state.debtRegistry[key]={...current,...candidate};
      } else {
        state.debtRegistry[key]={...candidate,...current,key};
      }
    });
    return state.debtRegistry;
  }

  function openingBalance(e){
    const ps=Array.isArray(e.payments)?e.payments:[];
    const first=ps.find(p=>p && p.debtBefore!=null);
    if(first) return Math.max(0,+first.debtBefore||0);
    const paid=ps.reduce((s,p)=>s+Math.max(0,+p.amount||0),0);
    return Math.max(0,(+e.debtTotal||0)+paid);
  }

  function currentMonthDebts(state){
    const m=state.months?.[state.activeMonth];
    return Object.values(m?.expenses||{}).filter(e=>e?.isDebt);
  }

  function seedDebtsIntoActiveMonth(state){
    const registry=ensureRegistry(state);
    const m=getMonth(state,state.activeMonth);
    const existing=new Map(Object.values(m.expenses||{}).filter(e=>e?.isDebt).map(e=>[e.debtKey||debtKey(e),e]));
    Object.values(registry).forEach(r=>{
      if((+r.balance||0)<=0 || existing.has(r.key)) return;
      const id=addExpense(m,{
        name:r.name,
        category:r.category|| (r.debtType==='loan'?'Loan':'Credit'),
        planned:+r.monthlyPlan||0,
        isDebt:true,
        debtType:r.debtType||'credit',
        debtTotal:+r.balance||0,
        debtOriginal:+r.original||+r.balance||0
      });
      m.expenses[id].debtKey=r.key;
      m.expenses[id].apr=+r.apr||0;
      existing.set(r.key,m.expenses[id]);
    });
  }

  function syncRegistryFromActiveMonth(state){
    const registry=ensureRegistry(state);
    const active=state.activeMonth;
    currentMonthDebts(state).forEach(e=>{
      const key=e.debtKey||debtKey(e); e.debtKey=key;
      const r=registry[key]||{key};
      const canAdvance=!r.updatedMonth || monthCompare(active,r.updatedMonth)>=0;
      const merged={
        ...r,
        key,
        name:e.name,
        debtType:e.debtType||'credit',
        category:e.category,
        original:Math.max(+r.original||0,+e.debtOriginal||0,+e.debtTotal||0),
        monthlyPlan:Math.max(0,+e.planned||0),
        apr:Math.max(0,+e.apr||+r.apr||0)
      };
      if(canAdvance){
        merged.balance=Math.max(0,+e.debtTotal||0);
        merged.updatedMonth=active;
      }
      registry[key]=merged;
    });
  }

  function syncFutureCopies(state){
    const registry=ensureRegistry(state);
    const active=state.activeMonth;
    Object.entries(state.months||{}).forEach(([monthKey,m])=>{
      if(monthCompare(monthKey,active)<=0) return;
      Object.values(m?.expenses||{}).forEach(e=>{
        if(!e?.isDebt) return;
        const key=e.debtKey||debtKey(e); e.debtKey=key;
        const r=registry[key];
        if(!r) return;
        e.debtTotal=Math.max(0,+r.balance||0);
        e.debtOriginal=Math.max(+e.debtOriginal||0,+r.original||0);
        e.apr=Math.max(0,+r.apr||0);
      });
    });
  }

  function prepareDebtState(state){
    ensureRegistry(state);
    seedDebtsIntoActiveMonth(state);
    syncRegistryFromActiveMonth(state);
    syncFutureCopies(state);
  }

  function selectedDebtSummary(state){
    const debts=currentMonthDebts(state);
    const rows=debts.map(e=>{
      const paid=(Array.isArray(e.payments)?e.payments:[]).reduce((s,p)=>s+Math.max(0,+p.amount||0),0) || Math.max(0,+e.paid||0);
      return {
        key:e.debtKey||debtKey(e),
        id:e.id,
        name:e.name,
        type:e.debtType||'credit',
        category:e.category,
        opening:openingBalance(e),
        paid,
        balance:Math.max(0,+e.debtTotal||0),
        planned:Math.max(0,+e.planned||0),
        apr:Math.max(0,+e.apr||+state.debtRegistry?.[e.debtKey||debtKey(e)]?.apr||0)
      };
    });
    const total=rows.reduce((s,r)=>s+r.balance,0);
    const loans=rows.filter(r=>r.type==='loan').reduce((s,r)=>s+r.balance,0);
    const credits=rows.filter(r=>r.type!=='loan').reduce((s,r)=>s+r.balance,0);
    const paid=rows.reduce((s,r)=>s+r.paid,0);
    const plan=rows.reduce((s,r)=>s+r.planned,0);
    return {rows,total,loans,credits,paid,plan,remainingPlan:Math.max(0,plan-paid)};
  }

  function priorityRows(summary){
    const open=summary.rows.filter(r=>r.balance>0);
    const hasApr=open.some(r=>r.apr>0);
    const sorted=[...open].sort((a,b)=>{
      if(hasApr){
        const aprDiff=(b.apr||0)-(a.apr||0);
        if(aprDiff) return aprDiff;
      }
      return a.balance-b.balance || a.name.localeCompare(b.name);
    });
    return {sorted,hasApr};
  }

  function debtCenterMarkup(state){
    const s=selectedDebtSummary(state);
    const p=priorityRows(s);
    const monthName=typeof monthLabel==='function'?monthLabel(state.activeMonth):state.activeMonth;
    if(!s.rows.length){
      return `<section class="debtCenter card"><div class="dcTitle"><div><small>DEBT CENTER · ${safe(monthName)}</small><h2>No active debt entered for this month</h2></div></div><p class="dcMuted">Add a payment and tick <b>Credit / loan payment?</b>. Enter the current total balance so the app can carry it forward month by month.</p></section>`;
    }
    const order=p.sorted.slice(0,6).map((r,i)=>`<div class="dcPriorityRow"><span class="dcRank">${i+1}</span><span><b>${safe(r.name)}</b><small>${r.apr>0?`${r.apr.toFixed(2)}% APR · `:''}${r.type==='loan'?'Loan':'Credit'} · ${money(r.balance)} left</small></span><button class="ghost" onclick="DebtCenter.edit('${encodeURIComponent(r.key)}')">Details</button></div>`).join('');
    const rows=s.rows.sort((a,b)=>(a.type==='loan'?0:1)-(b.type==='loan'?0:1)||a.balance-b.balance).map(r=>{
      const reduced=Math.max(0,r.opening-r.balance);
      const pct=r.opening>0?Math.min(100,reduced/r.opening*100):100;
      return `<div class="dcDebtRow"><div class="dcDebtTop"><span><b>${safe(r.name)}</b><small>${r.type==='loan'?'Loan':'Credit'}${r.apr>0?` · ${r.apr.toFixed(2)}% APR`:''}</small></span><strong>${money(r.balance)}</strong></div><div class="dcBar"><i style="width:${pct.toFixed(1)}%"></i></div><div class="dcDebtMeta"><span>Start ${money(r.opening)}</span><span>Paid this month ${money(r.paid)}</span><span>Plan ${money(r.planned)}</span></div></div>`;
    }).join('');
    return `<section class="debtCenter card">
      <div class="dcTitle"><div><small>DEBT CENTER · ${safe(monthName)}</small><h2>Current debt & payoff plan</h2></div><span class="dcSync">Month-linked</span></div>
      <div class="dcKpis"><div><small>Total debt left</small><b>${money(s.total)}</b></div><div><small>Loans pending</small><b>${money(s.loans)}</b></div><div><small>Credit pending</small><b>${money(s.credits)}</b></div><div><small>Still to pay this month</small><b>${money(s.remainingPlan)}</b></div></div>
      <div class="dcGrid"><div><h3>Balances for ${safe(monthName)}</h3>${rows}</div><div><h3>Payoff priority</h3><p class="dcMuted">${p.hasApr?'Priority uses highest APR first to reduce interest cost.':'No APR is entered yet, so priority uses the smallest balance first. Enter APR in Details if you want interest-saving priority.'}</p>${order||'<p class="dcMuted">No debt balance remaining.</p>'}</div></div>
      <div class="dcFoot">Each month keeps its own opening balance, payments and ending balance. Unfinished debt is automatically carried into the next month.</div>
    </section>`;
  }

  function paymentsSummaryMarkup(state){
    const s=selectedDebtSummary(state);
    if(!s.rows.length) return '';
    return `<div class="card dcPaymentStrip"><div><small>CURRENT DEBT LEFT</small><b>${money(s.total)}</b></div><div><small>LOANS PENDING</small><b>${money(s.loans)}</b></div><div><small>DEBT PAID THIS MONTH</small><b>${money(s.paid)}</b></div><div><small>MONTHLY DEBT PLAN LEFT</small><b>${money(s.remainingPlan)}</b></div></div>`;
  }

  window.DebtCenter={
    edit(encodedKey){
      const key=decodeURIComponent(encodedKey);
      const state=Store.state;
      const reg=ensureRegistry(state);
      const r=reg[key];
      const e=currentMonthDebts(state).find(x=>(x.debtKey||debtKey(x))===key);
      if(!r && !e) return;
      const x=r||{};
      const current=e||{};
      openDialog(`
        <h3>${safe(current.name||x.name||'Debt')} — debt details</h3>
        <p style="color:var(--muted);margin:6px 0 12px">Use the real current balance. APR is optional but helps the app choose the interest-saving payoff order.</p>
        ${field('Monthly planned payment','planned','number',`value="${Math.max(0,+current.planned||+x.monthlyPlan||0)}" step="0.01" min="0"`)}
        ${field('Current debt balance','balance','number',`value="${Math.max(0,+current.debtTotal||+x.balance||0)}" step="0.01" min="0"`)}
        ${field('Interest rate / APR %','apr','number',`value="${Math.max(0,+current.apr||+x.apr||0)}" step="0.01" min="0"`,false)}
      `,d=>{
        const plan=Math.max(0,+d.planned||0), balance=Math.max(0,+d.balance||0), apr=Math.max(0,+d.apr||0);
        if(e){ e.planned=plan; e.debtTotal=balance; e.apr=apr; e.debtOriginal=Math.max(+e.debtOriginal||0,balance); e.debtKey=key; }
        reg[key]={...(r||{}),key,name:current.name||x.name,debtType:current.debtType||x.debtType||'credit',category:current.category||x.category||'Debt',monthlyPlan:plan,balance,apr,original:Math.max(+x.original||0,+current.debtOriginal||0,balance),updatedMonth:state.activeMonth};
        Store.commit();
        if(typeof toast==='function') toast('Debt details updated');
      });
    }
  };

  const style=document.createElement('style');
  style.textContent=`
    .debtCenter{overflow:hidden}.dcTitle{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.dcTitle small,.dcKpis small,.dcPaymentStrip small{display:block;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em}.dcTitle h2{font-size:20px;margin-top:3px}.dcSync{font-size:11px;font-weight:800;color:var(--green);background:rgba(46,204,113,.12);border:1px solid rgba(46,204,113,.25);padding:5px 9px;border-radius:99px;white-space:nowrap}.dcKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 16px}.dcKpis>div,.dcPaymentStrip>div{background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:12px}.dcKpis b,.dcPaymentStrip b{display:block;margin-top:4px;font-size:18px}.dcGrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:18px}.dcGrid h3{margin-bottom:10px}.dcDebtRow{padding:12px 0;border-top:1px solid var(--line)}.dcDebtRow:first-of-type{border-top:0}.dcDebtTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.dcDebtTop span small,.dcPriorityRow span small{display:block;color:var(--muted);font-size:12px;margin-top:2px}.dcDebtTop strong{font-size:16px;white-space:nowrap}.dcBar{height:7px;background:#0b1220;border-radius:99px;overflow:hidden;margin:8px 0}.dcBar i{display:block;height:100%;background:var(--blue);border-radius:99px}.dcDebtMeta{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:12px}.dcPriorityRow{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:8px;padding:10px 0;border-top:1px solid var(--line)}.dcRank{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:var(--surface2);font-weight:800}.dcMuted{color:var(--muted);font-size:13px;margin-bottom:8px}.dcFoot{margin:16px -16px -16px;padding:11px 16px;background:rgba(74,163,255,.07);border-top:1px solid var(--line);color:var(--muted);font-size:12px}.dcPaymentStrip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.dcPaymentStrip b{font-size:16px}@media(max-width:820px){.dcKpis,.dcPaymentStrip{grid-template-columns:1fr 1fr}.dcGrid{grid-template-columns:1fr}}@media(max-width:520px){.dcKpis,.dcPaymentStrip{grid-template-columns:1fr}.dcDebtTop{align-items:center}.dcDebtMeta{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px}.dcPriorityRow{grid-template-columns:28px 1fr}.dcPriorityRow button{grid-column:2;justify-self:start}}
  `;
  document.head.appendChild(style);

  prepareDebtState(Store.state);
  Store.save();

  const originalCommit=Store.commit.bind(Store);
  Store.commit=function(){
    prepareDebtState(this.state);
    return originalCommit();
  };

  const baseDeleteExpense=Actions.deleteExpense.bind(Actions);
  Actions.deleteExpense=function(id){
    const state=Store.state, m=getMonth(state,state.activeMonth), e=m.expenses[id];
    if(!e?.isDebt) return baseDeleteExpense(id);
    if(!confirm(`Remove ${e.name} from active debt tracking? Historical months will stay in History.`)) return;
    const key=e.debtKey||debtKey(e);
    const reg=ensureRegistry(state);
    reg[key]={...(reg[key]||{}),key,name:e.name,debtType:e.debtType||'credit',category:e.category,balance:0,monthlyPlan:0,archived:true,updatedMonth:state.activeMonth};
    Object.entries(state.months||{}).forEach(([monthKey,month])=>{
      if(monthCompare(monthKey,state.activeMonth)<0) return;
      Object.entries(month?.expenses||{}).forEach(([eid,x])=>{
        if(x?.isDebt && (x.debtKey||debtKey(x))===key) delete month.expenses[eid];
      });
    });
    Store.commit();
    if(typeof toast==='function') toast('Debt removed from active tracking');
  };

  const baseDashboard=Views.dashboard.bind(Views);
  Views.dashboard=function(state){
    prepareDebtState(state);
    return debtCenterMarkup(state)+baseDashboard(state);
  };
  const basePayments=Views.payments.bind(Views);
  Views.payments=function(state){
    prepareDebtState(state);
    return paymentsSummaryMarkup(state)+basePayments(state);
  };

  render();
  console.log('Debt Center active',VERSION);
})();
