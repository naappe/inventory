const DATA = window.ROSTER_DATA;
const SHIFT_META = {
  A:{label:'Night',time:'00:00–07:50',icon:'🌙',className:'night'},
  B:{label:'Morning',time:'07:50–15:40',icon:'🌅',className:'morning'},
  C:{label:'Evening',time:'15:40–23:40',icon:'🌆',className:'evening'},
  M:{label:'Maintenance',time:'07:50–15:40',icon:'🔧',className:'maintenance'},
  OFF:{label:'Rest',time:'OFF',icon:'🛌',className:'rest'}
};
const SHIFT_ORDER = ['A','B','C','M','OFF'];
const state = {
  day: 1,
  view: 'day',
  shift: 'all',
  search: '',
  changes: JSON.parse(localStorage.getItem('opsDutyChanges') || '[]')
};

const board = document.getElementById('operationsBoard');
const picker = document.getElementById('datePicker');
const viewMode = document.getElementById('viewMode');
const shiftFilter = document.getElementById('shiftFilter');
const search = document.getElementById('staffSearch');
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const drawerContent = document.getElementById('drawerContent');
const drawerTitle = document.getElementById('drawerTitle');

function firstName(fullName){
  return (fullName || '').trim().split(/\s+/)[0] || 'Staff';
}
function fullDate(day){ return new Date(2026,7,day); }
function dayLabel(day){ return fullDate(day).toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }

function assigned(day,key){
  let list = [...(DATA.rows[day]?.[key] || [])];
  state.changes.filter(x=>Number(x.day)===day).forEach(change=>{
    list = list.filter(code=>code!==change.original);
    if(change.replacement && change.duty===key && !list.includes(change.replacement)) list.push(change.replacement);
  });
  return list;
}
function changeFor(day,key,code){ return state.changes.find(x=>Number(x.day)===day && x.replacement===code && x.duty===key); }
function filteredCodes(day,key){
  if(state.shift!=='all' && state.shift!==key) return [];
  return assigned(day,key).filter(code=>{
    const name = DATA.staff[code]?.name || '';
    return !state.search || firstName(name).toLowerCase().includes(state.search.toLowerCase()) || name.toLowerCase().includes(state.search.toLowerCase());
  });
}
function staffCard(day,key,code){
  const person = DATA.staff[code];
  const change = changeFor(day,key,code);
  return `<button class="staff-card ${change?'changed':''}" data-staff="${code}" data-day="${day}" data-shift="${key}">
    <span class="staff-main"><span class="avatar">${code}</span><span><span class="staff-name">${firstName(person.name)}</span><span class="staff-status">${change?'Covering duty':'Assigned'}</span></span></span>
    <span class="staff-menu">⋮</span>
  </button>`;
}
function shiftColumn(day,key){
  const meta = SHIFT_META[key];
  const codes = filteredCodes(day,key);
  return `<section class="shift-column ${state.shift!=='all'&&state.shift!==key?'hidden':''}">
    <div class="shift-head ${meta.className}">${meta.icon} ${meta.label}<br><small>${meta.time}</small></div>
    <div class="staff-list">${codes.length?codes.map(code=>staffCard(day,key,code)).join(''):'<div class="empty">No matching staff</div>'}</div>
  </section>`;
}
function dayPanel(day){
  const maintenance = assigned(day,'M');
  return `<article class="day-panel ${maintenance.length?'maintenance-day':''}">
    <div class="day-banner"><strong>${dayLabel(day)}</strong><span>Duty day begins at 00:00</span></div>
    ${maintenance.length?`<div class="maintenance-ribbon">🔧 Maintenance scheduled — ${maintenance.map(c=>firstName(DATA.staff[c].name)).join(', ')}</div>`:''}
    <div class="shift-grid">${SHIFT_ORDER.map(key=>shiftColumn(day,key)).join('')}</div>
  </article>`;
}
function renderDay(){
  board.className = 'operations-board';
  board.innerHTML = dayPanel(state.day);
  document.getElementById('boardTitle').textContent = dayLabel(state.day);
}
function renderWeek(){
  const start = Math.max(1,Math.min(state.day,25));
  const days = Array.from({length:7},(_,i)=>start+i).filter(d=>d<=31);
  board.className = 'operations-board week-view';
  board.innerHTML = days.map(dayPanel).join('');
  document.getElementById('boardTitle').textContent = `${dayLabel(days[0])} — ${days[days.length-1]} August`;
}
function renderMonth(){
  board.className = 'month-view';
  board.innerHTML = Array.from({length:31},(_,i)=>i+1).map(day=>{
    const counts = SHIFT_ORDER.map(k=>`${SHIFT_META[k].label}: ${assigned(day,k).length}`).join('</div><div>');
    return `<button class="month-cell" data-open-day="${day}"><strong>${day}</strong><small>${fullDate(day).toLocaleDateString('en-US',{weekday:'short'})}</small><div class="month-counts"><div>${counts}</div></div></button>`;
  }).join('');
  document.getElementById('boardTitle').textContent = 'August 2026';
}
function render(){
  if(state.view==='day') renderDay(); else if(state.view==='week') renderWeek(); else renderMonth();
  bindBoardActions();
  updateSummary();
}
function bindBoardActions(){
  board.querySelectorAll('[data-staff]').forEach(btn=>btn.addEventListener('click',()=>openProfile(Number(btn.dataset.day),btn.dataset.shift,btn.dataset.staff)));
  board.querySelectorAll('[data-open-day]').forEach(btn=>btn.addEventListener('click',()=>{
    state.day=Number(btn.dataset.openDay);state.view='day';picker.value=`2026-08-${String(state.day).padStart(2,'0')}`;viewMode.value='day';render();
  }));
}
function currentShiftKey(){
  const now = new Date();
  const mins = now.getHours()*60+now.getMinutes();
  if(mins < 470) return 'A';
  if(mins < 940) return 'B';
  return 'C';
}
function nextShiftInfo(){
  const now = new Date();
  const mins = now.getHours()*60+now.getMinutes();
  const targets = [470,940,1440];
  const labels = ['Morning','Evening','Night'];
  let index = targets.findIndex(t=>t>mins);
  if(index<0) index=2;
  let diff = targets[index]-mins;
  if(diff<=0) diff += 1440;
  return {label:labels[index],text:`${String(Math.floor(diff/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}`};
}
function updateSummary(){
  const day = state.day;
  const current = currentShiftKey();
  const next = nextShiftInfo();
  document.getElementById('workingNow').textContent = assigned(day,current).length;
  document.getElementById('activeShift').textContent = `${SHIFT_META[current].label} shift active`;
  document.getElementById('countdown').textContent = next.text;
  document.getElementById('nextShiftLabel').textContent = `${next.label} shift starts next`;
  document.getElementById('maintenanceCount').textContent = assigned(day,'M').length;
  document.getElementById('restCount').textContent = assigned(day,'OFF').length;
}
function openDrawer(title,html){
  drawerTitle.textContent=title;drawerContent.innerHTML=html;overlay.hidden=false;drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');
}
function closeDrawer(){ overlay.hidden=true;drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true'); }
function openProfile(day,key,code){
  const person=DATA.staff[code];
  const change=changeFor(day,key,code);
  openDrawer(firstName(person.name),`
    <div class="profile-row"><span>Full name</span><strong>${person.name}</strong></div>
    <div class="profile-row"><span>Employee ID</span><strong>${person.id}</strong></div>
    <div class="profile-row"><span>Date</span><strong>${dayLabel(day)}</strong></div>
    <div class="profile-row"><span>Current duty</span><strong>${SHIFT_META[key].label} · ${SHIFT_META[key].time}</strong></div>
    <div class="profile-row"><span>Status</span><strong>${change?'Covering duty':'Assigned'}</strong></div>
    <div class="profile-actions"><button class="primary-btn" id="profileChange">Change duty</button><button class="secondary-btn" id="profileSick">Report sick</button></div>`);
  document.getElementById('profileChange').onclick=()=>openChangeForm(day,code,'OTHER');
  document.getElementById('profileSick').onclick=()=>openChangeForm(day,code,'SICK');
}
function staffOptions(selected=''){
  return Object.entries(DATA.staff).map(([code,p])=>`<option value="${code}" ${code===selected?'selected':''}>${firstName(p.name)} — ${p.id}</option>`).join('');
}
function openChangeForm(day=state.day,original='',reason='SICK'){
  openDrawer('Change duty',`<form id="changeForm">
    <div><label>Date</label><input id="changeDate" type="date" min="2026-08-01" max="2026-08-31" value="2026-08-${String(day).padStart(2,'0')}" required></div>
    <div><label>Staff changing</label><select id="originalStaff" required><option value="">Select staff</option>${staffOptions(original)}</select></div>
    <div><label>Reason</label><select id="changeReason"><option value="SICK" ${reason==='SICK'?'selected':''}>Sick</option><option value="LEAVE">Leave</option><option value="SWAP">Duty swap</option><option value="OTHER" ${reason==='OTHER'?'selected':''}>Other</option></select></div>
    <div><label>Replacement staff</label><select id="replacementStaff"><option value="">No replacement</option>${staffOptions()}</select></div>
    <div><label>Replacement duty</label><select id="replacementDuty">${SHIFT_ORDER.filter(k=>k!=='OFF').map(k=>`<option value="${k}">${SHIFT_META[k].label}</option>`).join('')}</select></div>
    <div><label>Remarks</label><textarea id="changeRemarks" placeholder="Add supervisor note"></textarea></div>
    <div class="drawer-actions"><button type="button" class="secondary-btn" id="cancelChange">Cancel</button><button class="primary-btn" type="submit">Save change</button></div>
  </form>`);
  document.getElementById('cancelChange').onclick=closeDrawer;
  document.getElementById('changeForm').onsubmit=e=>{
    e.preventDefault();
    const selectedDay=Number(document.getElementById('changeDate').value.slice(-2));
    const originalCode=document.getElementById('originalStaff').value;
    const replacement=document.getElementById('replacementStaff').value;
    const duty=document.getElementById('replacementDuty').value;
    const conflict = replacement && SHIFT_ORDER.some(k=>assigned(selectedDay,k).includes(replacement));
    if(conflict){alert('Replacement staff already has a duty on this date. Remove or change that duty first.');return;}
    state.changes.push({id:Date.now(),day:selectedDay,original:originalCode,replacement,duty,reason:document.getElementById('changeReason').value,remarks:document.getElementById('changeRemarks').value.trim()});
    localStorage.setItem('opsDutyChanges',JSON.stringify(state.changes));
    closeDrawer();render();
  };
}
document.getElementById('closeDrawer').onclick=closeDrawer;
overlay.onclick=closeDrawer;
document.getElementById('openChange').onclick=()=>openChangeForm();
document.getElementById('prevDay').onclick=()=>{state.day=Math.max(1,state.day-1);picker.value=`2026-08-${String(state.day).padStart(2,'0')}`;render();};
document.getElementById('nextDay').onclick=()=>{state.day=Math.min(31,state.day+1);picker.value=`2026-08-${String(state.day).padStart(2,'0')}`;render();};
document.getElementById('todayBtn').onclick=()=>{const now=new Date();state.day=(now.getFullYear()===2026&&now.getMonth()===7)?now.getDate():1;picker.value=`2026-08-${String(state.day).padStart(2,'0')}`;render();};
picker.onchange=()=>{state.day=Number(picker.value.slice(-2));render();};
viewMode.onchange=()=>{state.view=viewMode.value;render();};
shiftFilter.onchange=()=>{state.shift=shiftFilter.value;render();};
search.oninput=()=>{state.search=search.value.trim();render();};
render();
setInterval(updateSummary,60000);
