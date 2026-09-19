import { ALLOWED_EMAIL, FIRST_MONTH } from './config.js';
import { getAllowedSession, signIn, signOut } from './auth.js';
import * as api from './money-api.js';
import { calculateDebtPreview, calculateMonthSummary, itemPaymentTotal } from './money-calculations.js';
import { buildDashboardModel } from './money-dashboard-model.js';
import { buildMonthSnapshot, buildMonthSaveState, historyValuesForMonth } from './month-save-model.js';
import { buildDebtGuidance } from './debt-guidance-model.js';
import { behaviorForCategory } from './category-behavior.js';
import { openSheet, field, setSheetPreview } from './money-sheets.js';
import { renderSetup } from './screens/setup.js';
import { renderOverview } from './screens/overview.js';
import { renderPayments } from './screens/payments.js';
import { renderDebts } from './screens/debts.js';
import { renderReceivables } from './screens/receivables.js';
import { renderHistory } from './screens/history.js';
import { renderSettings } from './screens/settings.js';

const state = { session:null,user:null,view:'overview',monthKey:FIRST_MONTH,bundle:null,items:[],months:[],historyModel:null,setupMode:false };
const app = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const topbar = document.getElementById('topbar');
const toastNode = document.getElementById('toast');
const money = (n) => `MVR ${Number(n || 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

function monthLabel(key){const [y,m]=key.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});}
function shiftKey(key,delta){const [y,m]=key.split('-').map(Number);const d=new Date(y,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function todayForMonth(key){const t=new Date();const current=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;return current===key?`${key}-${String(t.getDate()).padStart(2,'0')}`:`${key}-01`;}
function toast(message,tone='success'){toastNode.textContent=message;toastNode.dataset.tone=tone;toastNode.classList.add('show');clearTimeout(toast._timer);toast._timer=setTimeout(()=>toastNode.classList.remove('show'),2600);}
function showBusy(message='Loading your money plan…'){app.innerHTML=`<div class="loading-state"><div class="spinner"></div><p>${message}</p></div>`;}

function renderLogin(error=''){
  document.body.classList.add('auth-mode');
  sidebar.hidden=true;
  topbar.hidden=true;
  app.innerHTML=`<section class="login-page"><div class="login-card"><div class="brand-mark large-mark">◒</div><p class="eyebrow">PRIVATE MONEY PLAN</p><h1>Welcome back</h1><p>Sign in with your Supabase account. Only ${ALLOWED_EMAIL} is allowed.</p><form data-login-form><label class="field"><span>Email</span><input type="email" value="${ALLOWED_EMAIL}" disabled></label><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>${error?`<p class="form-error">${error}</p>`:''}<button class="button primary full large" type="submit">Sign in</button></form><small class="privacy-note">Finance data is stored in Supabase. It is not kept in browser localStorage.</small></div></section>`;
}

function renderChrome(){
  document.body.classList.remove('auth-mode');
  sidebar.hidden=false;
  topbar.hidden=false;
  document.getElementById('month-title').textContent=monthLabel(state.monthKey);
  document.getElementById('prev-month').disabled=state.monthKey<=FIRST_MONTH||state.setupMode;
  document.getElementById('next-month').disabled=state.setupMode;
  document.querySelectorAll('[data-view]').forEach((el)=>el.classList.toggle('active',el.dataset.view===state.view));
  const email=document.getElementById('account-email');if(email)email.textContent=state.user?.email||'';
  app.dataset.monthId=state.bundle?.month?.id||'';
  app.dataset.monthKey=state.monthKey;
}

function render(){
  if(!state.session)return renderLogin();
  renderChrome();
  if(state.setupMode){app.innerHTML=renderSetup({month:state.bundle.month,categories:state.bundle.categories,items:state.items,debts:state.bundle.debts});return;}
  if(state.view==='overview')app.innerHTML=renderOverview(state.bundle);
  if(state.view==='payments')app.innerHTML=renderPayments(state.bundle);
  if(state.view==='debts')app.innerHTML=renderDebts(state.bundle);
  if(state.view==='receivables')app.innerHTML=renderReceivables(state.bundle);
  if(state.view==='settings')app.innerHTML=renderSettings({user:state.user,categories:state.bundle.categories,items:state.items,preferences:state.bundle.preferences});
  if(state.view==='history')app.innerHTML=state.historyModel?renderHistory(state.historyModel):`<div class="loading-state"><div class="spinner"></div><p>Building history…</p></div>`;
}

async function loadMonth(){
  state.bundle=await api.getMonthBundle(state.monthKey);
  state.items=await api.listItems();
  state.months=await api.listMonths();
  state.bundle.bankHistory=state.months;
  state.setupMode=state.monthKey===FIRST_MONTH&&state.bundle.month.setup_complete!==true;
  state.historyModel=null;
}

async function enterApp(session){state.session=session;state.user=session.user;showBusy();let months=await api.listMonths();if(!months.length){await api.bootstrapSeptember();months=await api.listMonths();}state.months=months;state.monthKey=months.some((m)=>m.month_key===FIRST_MONTH)?FIRST_MONTH:(months[0]?.month_key||FIRST_MONTH);await loadMonth();render();}
async function reload(message){await loadMonth();render();if(message)toast(message);}
async function markCurrentMonthDirty(){if(state.bundle?.month?.saved_at)await api.markMonthDirty(state.bundle.month.id);}

async function saveCurrentMonth(){
  const summary=calculateMonthSummary({income:state.bundle.month.income,monthItems:state.bundle.monthItems,payments:state.bundle.payments,debts:state.bundle.debts,receivables:state.bundle.receivables,receivableTransactions:state.bundle.receivableTransactions});
  const dashboard=buildDashboardModel({month:state.bundle.month,summary});
  const guidance=buildDebtGuidance({debts:state.bundle.debts,availableNow:dashboard.availableNow,stillToPay:dashboard.stillLeftToPay,emergencyReserve:state.bundle.preferences?.emergency_reserve_target||0});
  const debtPaid=state.bundle.payments.filter((p)=>!p.reversed_at&&p.payment_type==='debt').reduce((s,p)=>s+Number(p.amount||0),0);
  const snapshot=buildMonthSnapshot({month:state.bundle.month,dashboard,debtReduced:debtPaid,safeToSave:guidance.safeToSave});
  await api.saveMonth(state.bundle.month.id,snapshot);
  await reload(`${monthLabel(state.monthKey)} saved`);
}

function openIncomeSheet(){openSheet({title:'Salary received',subtitle:monthLabel(state.monthKey),body:`${field.money('income','Salary / income received',state.bundle.month.income,'required')}<p class="helper">This is your income for the selected month.</p>`,submitLabel:'Save salary',onSubmit:async(v)=>{await api.setIncome(state.bundle.month.id,v.income);await markCurrentMonthDirty();await reload('Salary updated');}});}
function openBankBalanceSheet(){openSheet({title:'Current bank balance',subtitle:`Manual balance · ${monthLabel(state.monthKey)}`,body:`${field.money('bankBalance','Actual bank balance',state.bundle.month.bank_balance??'','min="0"')}<p class="helper">Enter the balance you actually see in your bank. This value is kept separate from calculated spending.</p>`,submitLabel:'Save bank balance',onSubmit:async(v)=>{await api.setBankBalance(state.bundle.month.id,v.bankBalance);await markCurrentMonthDirty();await reload('Bank balance updated');}});}
function openEmergencyReserveSheet(){openSheet({title:'Emergency reserve',subtitle:'Money to keep untouched before extra debt payments or savings.',body:field.money('amount','Reserve target',state.bundle.preferences?.emergency_reserve_target||0,'required min="0"'),submitLabel:'Save reserve',onSubmit:async(v)=>{await api.setEmergencyReserveTarget(v.amount);await reload('Emergency reserve updated');}});}

function expenseCategories(){return state.bundle.categories.filter((c)=>behaviorForCategory(c)==='expense');}
function openAddItemSheet(item=null,preselectedCategoryId=null){
  const cats=expenseCategories();const options=cats.map((c)=>({value:c.id,label:c.name}));
  openSheet({title:item?'Edit expense':'Add expense',subtitle:item?'Updates this month and future reusable plan.':'Home and Other expenses only.',body:`${field.text('name','Name',item?.name||'','required')}${field.select('categoryId','Category',options,item?.category_id||preselectedCategoryId||options[0]?.value||'')}${field.money('plannedAmount','Planned amount',item?.default_planned_amount||'','required min="0"')}${field.number('dueDay','Due day (optional)',item?.due_day||'','min="1" max="31"')}<label class="check-field"><input name="recurring" type="checkbox" ${item?.is_recurring===false?'':'checked'}><span>Repeat this expense each new month</span></label>`,submitLabel:item?'Save changes':'Add expense',onSubmit:async(values,form)=>{const recurring=form.querySelector('[name="recurring"]').checked;if(item)await api.updateItem(item.id,{...values,recurring});else await api.createItem({...values,recurring});await api.createMonth(state.monthKey);await markCurrentMonthDirty();await reload(item?'Expense updated':'Expense added');}});
}

function openAddDebtSheet(debt=null,forcedType=null){
  const type=debt?.debt_type||forcedType||'loan';
  openSheet({title:debt?'Edit balance':'Add loan or credit',subtitle:debt?'Balance reduces only through recorded payments.':'Enter the real amount you owe now.',body:`${field.text('name',type==='credit'?'Credit name':'Loan name',debt?.name||'','required')}${field.select('type','Type',[{value:'loan',label:'Loan'},{value:'credit',label:'Credit'}],type)}${debt?'':field.money('balance','Current outstanding balance','','required min="0.01"')}${field.money('monthlyPlan','Payment target this month (optional)',debt?.monthly_plan||'','min="0"')}${field.number('apr','APR / interest % (optional)',debt?.apr??'','min="0" step="0.01"')}<p class="helper">There is no required fixed payment. Set a target only when you want one for this month.</p>`,submitLabel:debt?'Save account':'Add account',onSubmit:async(values)=>{if(debt)await api.updateDebt(debt.id,values,state.monthKey);else await api.createDebt({...values,startMonthKey:state.monthKey});await markCurrentMonthDirty();await reload(debt?'Account updated':'Account added');}});
}

function openAddReceivableSheet(){openSheet({title:'Lend money',subtitle:'Track money another person must pay back to you.',body:`${field.text('name','Person / borrower','','required')}${field.money('amount','Amount lent','','required min="0.01"')}${field.date('date','Date lent',todayForMonth(state.monthKey),'required')}${field.date('expectedRepaymentDate','Expected repayment date (optional)','')}${field.text('remarks','Remarks (optional)','')}`,submitLabel:'Save money lent',onSubmit:async(v)=>{await api.createReceivable({name:v.name,amount:v.amount,date:v.date,monthId:state.bundle.month.id,expectedRepaymentDate:v.expectedRepaymentDate,remarks:v.remarks});await markCurrentMonthDirty();await reload('Money lent recorded');}});}

function openRepayReceivableSheet(r){const suggested=Number(r.current_balance||0);openSheet({title:'Record repayment',subtitle:`${r.name} · ${money(r.current_balance)} still owed to you`,body:`${field.money('amount','Amount received',suggested.toFixed(2),'required min="0.01"')}${field.date('date','Date received',todayForMonth(state.monthKey),'required')}${field.text('remarks','Remarks (optional)','')}`,submitLabel:'Save repayment',onSubmit:async(v)=>{const result=await api.recordReceivableRepayment({receivableId:r.id,monthId:state.bundle.month.id,amount:v.amount,date:v.date,remarks:v.remarks});await markCurrentMonthDirty();await reload(`Repayment saved · ${money(result?.receivable_balance??0)} still owed`);}});}

function openCategoryDrivenAdd(){
  const options=state.bundle.categories.map((c)=>({value:c.id,label:`${c.name} — ${c.behavior_type==='liability'?'Loan/Credit':c.behavior_type==='receivable'?'Money Lent':'Expense'}`}));
  openSheet({title:'Choose category',subtitle:'The category decides how the amount is calculated.',body:`${field.select('categoryId','Category',options,options[0]?.value||'')}<div class="behavior-preview">Loan/Credit carries a balance. Expense affects this month only. Money Lent tracks what someone owes you.</div>`,submitLabel:'Continue',onSubmit:async(v)=>{const category=state.bundle.categories.find((c)=>c.id===v.categoryId);queueMicrotask(()=>{const behavior=behaviorForCategory(category);if(behavior==='receivable')openAddReceivableSheet();else if(behavior==='liability')openAddDebtSheet(null,String(category?.name||'').toLowerCase().includes('credit')?'credit':'loan');else openAddItemSheet(null,category?.id);});}});
}

function openItemPaymentSheet(item){const paid=itemPaymentTotal(item.id,state.bundle.payments);const remaining=Math.max(0,Number(item.planned_amount||0)-paid);openSheet({title:'Record expense payment',subtitle:`${item.name_snapshot} · ${money(remaining)} left on plan`,body:`${field.money('amount','Amount actually paid',remaining.toFixed(2),'required min="0.01"')}${field.date('date','Payment date',todayForMonth(state.monthKey),'required')}${field.text('note','Remarks (optional)','')}`,submitLabel:'Save payment',onSubmit:async(v)=>{await api.recordPayment({monthId:state.bundle.month.id,type:'expense',amount:v.amount,date:v.date,monthItemId:item.id,note:v.note});await markCurrentMonthDirty();await reload('Expense payment saved');}});}

function openDebtPaymentSheet(debt){const target=Number(debt.monthly_plan||0);const suggested=Math.min(target>0?target:Number(debt.current_balance||0),Number(debt.current_balance||0));const preview=(amount)=>{const p=calculateDebtPreview(debt.current_balance,amount);setSheetPreview(`<div class="payment-preview"><span>Balance after this payment</span><strong>${money(p.afterPayment)}</strong>${p.effectiveAmount<Number(amount||0)?'<small>Payment is capped at the remaining balance.</small>':''}</div>`);};openSheet({title:`Record ${debt.debt_type} payment`,subtitle:`${debt.name} · current balance ${money(debt.current_balance)}`,body:`${field.money('amount','Amount paid',suggested.toFixed(2),'required min="0.01"')}${field.date('date','Payment date',todayForMonth(state.monthKey),'required')}${field.text('note','Remarks (optional)','')}`,submitLabel:'Save payment',onReady:(form)=>{const input=form.querySelector('[name="amount"]');preview(input.value);input.addEventListener('input',()=>preview(input.value));},onSubmit:async(v)=>{const result=await api.recordPayment({monthId:state.bundle.month.id,type:'debt',amount:v.amount,date:v.date,debtId:debt.id,note:v.note});await markCurrentMonthDirty();await reload(`Payment saved · balance ${money(result?.debt_balance??0)}`);}});}

function openDeleteItemSheet(source){const itemId=source.dataset.id;const monthItemId=source.dataset.monthItemId;const name=source.dataset.name||'this expense';openSheet({title:'Delete expense?',subtitle:name,body:`<div class="confirm-copy">This removes the expense from the current/future plan when safe. If it already has payment history, that history and its month snapshot stay preserved.</div>`,submitLabel:'Delete expense',onSubmit:async()=>{const result=await api.archiveItemForMonth(itemId,monthItemId);await markCurrentMonthDirty();await reload(result.historyPreserved?'Expense stopped for future months. Paid history was preserved.':'Expense removed from the plan.');}});}
function openReverseSheet(payment){openSheet({title:'Reverse payment?',subtitle:`${money(payment.amount)} will be marked reversed. The original record stays in history.`,body:`${field.text('reason','Reason','Correction','required')}<div class="warning-box">Debt balances are restored automatically when relevant.</div>`,submitLabel:'Reverse payment',onSubmit:async(v)=>{await api.reversePayment(payment.id,v.reason);await markCurrentMonthDirty();await reload('Payment reversed');}});}
function openReverseReceivableSheet(tx){openSheet({title:'Reverse Money Lent transaction?',subtitle:`${money(tx.amount)} · ${tx.transaction_type}`,body:`${field.text('reason','Reason','Correction','required')}<div class="warning-box">The receivable balance will be restored to the correct amount.</div>`,submitLabel:'Reverse transaction',onSubmit:async(v)=>{await api.reverseReceivableTransaction(tx.id,v.reason);await markCurrentMonthDirty();await reload('Receivable transaction reversed');}});}

function openCategorySheet(){openSheet({title:'Add category',body:`${field.text('name','Category name','','required')}${field.select('behavior','Accounting behavior',[{value:'expense',label:'Expense — monthly spending'},{value:'liability',label:'Loan / Credit — balance you owe'},{value:'receivable',label:'Money Lent — balance owed to you'}],'expense')}`,submitLabel:'Add category',onSubmit:async(v)=>{await api.createCategory(v.name,v.behavior);await reload('Category added');}});}

async function buildHistoryModel(){
  const raw=await api.historyData();const rows=[],debtTrend=[],savingsTrend=[];const cumulativeDebt=new Map();const cumulativeRepay=new Map();
  for(const bundle of raw.bundles){
    for(const p of bundle.payments.filter((p)=>!p.reversed_at&&p.payment_type==='debt'))cumulativeDebt.set(p.debt_id,(cumulativeDebt.get(p.debt_id)||0)+Number(p.amount||0));
    for(const t of bundle.receivableTransactions.filter((t)=>!t.reversed_at&&t.transaction_type==='repayment'))cumulativeRepay.set(t.receivable_id,(cumulativeRepay.get(t.receivable_id)||0)+Number(t.amount||0));
    const monthDebts=raw.debts.filter((d)=>String(d.start_month_key||FIRST_MONTH)<=bundle.month.month_key).map((d)=>{const h=d.monthly_plan_history&&typeof d.monthly_plan_history==='object'?d.monthly_plan_history:{};return{...d,current_balance:Math.max(0,Number(d.opening_balance||0)-(cumulativeDebt.get(d.id)||0)),monthly_plan:Number(h[bundle.month.month_key]??d.monthly_plan??0)};});
    const monthReceivables=raw.receivables.filter((r)=>String(r.start_month_key||FIRST_MONTH)<=bundle.month.month_key).map((r)=>({...r,current_balance:Math.max(0,Number(r.opening_balance||0)-(cumulativeRepay.get(r.id)||0))}));
    const summary=calculateMonthSummary({income:bundle.month.income,monthItems:bundle.monthItems,payments:bundle.payments,debts:monthDebts,receivables:monthReceivables,receivableTransactions:bundle.receivableTransactions});
    const dashboard=buildDashboardModel({month:bundle.month,summary});
    const debtReduced=bundle.payments.filter((p)=>!p.reversed_at&&p.payment_type==='debt').reduce((s,p)=>s+Number(p.amount||0),0);
    const liveValues={income:summary.income,paid:summary.paid,stillToPay:summary.stillToPay,safeToSave:summary.safeToSave,availableNow:dashboard.availableNow,debtReduced,loansRemaining:summary.loansLeft,creditsRemaining:summary.creditLeft};
    const confirmed=historyValuesForMonth({month:bundle.month,live:liveValues});
    const label=monthLabel(bundle.month.month_key).replace(' 20',' ’');
    const saveState=buildMonthSaveState(bundle.month);
    rows.push({label:monthLabel(bundle.month.month_key),...confirmed,bankBalance:bundle.month.bank_balance,paymentCount:bundle.payments.filter((p)=>!p.reversed_at).length,saveStatus:saveState.label,savedAt:bundle.month.saved_at,isDirty:Boolean(bundle.month.dirty_since_save),snapshot:bundle.month.saved_snapshot});
    debtTrend.push({label,value:monthDebts.reduce((s,d)=>s+Number(d.current_balance||0),0)});savingsTrend.push({label,value:summary.safeToSave});
  }
  return{rows,debtTrend,savingsTrend};
}

async function selectView(view){if(state.setupMode){toast('Finish September setup first.','error');return;}state.view=view;if(view==='history'&&!state.historyModel){render();state.historyModel=await buildHistoryModel();}render();}
async function changeMonth(delta){if(state.setupMode){toast('Finish September setup first.','error');return;}const next=shiftKey(state.monthKey,delta);if(next<FIRST_MONTH)return;showBusy('Opening month…');await api.createMonth(next);state.monthKey=next;await loadMonth();render();}

async function handleAction(action,source){
  if(action==='save-month')return saveCurrentMonth();
  if(action==='set-income')return openIncomeSheet();
  if(action==='set-bank-balance')return openBankBalanceSheet();
  if(action==='set-emergency-reserve')return openEmergencyReserveSheet();
  if(action==='add-item'||action==='add-by-category'||action==='quick-add')return openCategoryDrivenAdd();
  if(action==='add-debt')return openAddDebtSheet();
  if(action==='add-receivable')return openAddReceivableSheet();
  if(action==='add-category')return openCategorySheet();
  if(action==='sign-out'){await signOut();state.session=null;state.user=null;return renderLogin();}
  if(action==='finish-setup'){await api.createMonth(FIRST_MONTH);await api.markSetupComplete(state.bundle.month.id);state.setupMode=false;state.view='overview';await reload('September plan started');return;}
  if(action==='pay-item'){const item=state.bundle.monthItems.find((x)=>x.id===source.dataset.id);if(item)return openItemPaymentSheet(item);}
  if(action==='pay-debt'){const debt=state.bundle.debts.find((x)=>x.id===source.dataset.id);if(debt)return openDebtPaymentSheet(debt);}
  if(action==='edit-debt'){const debt=state.bundle.debts.find((x)=>x.id===source.dataset.id);if(debt)return openAddDebtSheet(debt);}
  if(action==='edit-item'){const item=state.items.find((x)=>x.id===source.dataset.id);if(item)return openAddItemSheet(item);}
  if(action==='delete-item')return openDeleteItemSheet(source);
  if(action==='reverse-payment'){const p=state.bundle.payments.find((x)=>x.id===source.dataset.id);if(p)return openReverseSheet(p);}
  if(action==='repay-receivable'){const r=state.bundle.receivables.find((x)=>x.id===source.dataset.id);if(r)return openRepayReceivableSheet(r);}
  if(action==='reverse-receivable-transaction'){const tx=state.bundle.receivableTransactions.find((x)=>x.id===source.dataset.id);if(tx)return openReverseReceivableSheet(tx);}
}

document.addEventListener('click',async(event)=>{const viewTarget=event.target.closest('[data-view]');if(viewTarget){event.preventDefault();try{await selectView(viewTarget.dataset.view);}catch(e){toast(e.message,'error');}return;}const actionTarget=event.target.closest('[data-action]');if(actionTarget){event.preventDefault();try{await handleAction(actionTarget.dataset.action,actionTarget);}catch(e){toast(e.message||'Something went wrong.','error');}}});
document.addEventListener('submit',async(event)=>{const form=event.target.closest('[data-login-form]');if(!form)return;event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Signing in…';try{const session=await signIn(new FormData(form).get('password'));await enterApp(session);}catch(error){renderLogin(error?.message||'Could not sign in.');}});
document.getElementById('prev-month').addEventListener('click',()=>changeMonth(-1).catch((e)=>toast(e.message,'error')));
document.getElementById('next-month').addEventListener('click',()=>changeMonth(1).catch((e)=>toast(e.message,'error')));
(async function start(){try{const session=await getAllowedSession();if(!session)renderLogin();else await enterApp(session);}catch(error){renderLogin(error?.message||'Could not start My Money Plan.');}})();
