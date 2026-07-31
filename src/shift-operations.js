const DATA = window.ROSTER_DATA;
const SHIFTS = {
 A:{title:"Night Shift",time:"00:00–07:50",className:"night"},
 B:{title:"Morning Shift",time:"07:50–15:40",className:"morning"},
 C:{title:"Evening Shift",time:"15:40–23:40",className:"evening"},
 M:{title:"Maintenance",time:"07:50–15:40",className:"maintenance"},
 OFF:{title:"Rest Day",time:"OFF",className:"rest"},
 LEAVE:{title:"Leave",time:"Leave",className:"leave"}
};
const ORDER=["B","C","A","M","OFF","LEAVE"];
const DAY_NAMES=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
let archiveDay=Number(localStorage.getItem("opsArchiveDay")??4);
let otEntries=JSON.parse(localStorage.getItem("opsOtEntries")||"[]");

function names(codes){
 if(!codes || !codes.length) return `<span class="empty">None</span>`;
 return codes.map(code=>`<strong>${code}</strong> ${DATA.staff[code].name}`).join("<br>");
}
function peopleFor(day,key){ return DATA.rows[day][key] || []; }

function renderCalendar(){
 const cal=document.getElementById("calendar");
 let html=DAY_NAMES.map(x=>`<div class="weekday">${x}</div>`).join("");

 for(let day=1;day<=31;day++){
  const dt=new Date(2026,7,day);
  html+=`<article class="day-card ${day===14?"focus-date":""}" data-day="${day}">
   <div class="day-head"><div><div class="day-number">${day}</div><div class="day-name">${dt.toLocaleDateString("en-US",{weekday:"long"})}</div></div><span class="day-name">AUG</span></div>
   <div class="day-body">
    ${shiftLine("B",peopleFor(day,"B"))}
    ${shiftLine("C",peopleFor(day,"C"))}
    ${shiftLine("A",peopleFor(day,"A"))}
    ${shiftLine("M",peopleFor(day,"M"))}
    ${shiftLine("OFF",peopleFor(day,"OFF"))}
   </div>
  </article>`;
 }
 cal.innerHTML=html;
 cal.querySelectorAll("[data-day]").forEach(x=>x.onclick=()=>openDay(Number(x.dataset.day)));
}
function shiftLine(key,codes){
 const s=SHIFTS[key];
 const short=key==="B"?"Morning":key==="C"?"Evening":key==="A"?"Night":key==="M"?"Maintenance":"Rest Day";
 const staff=codes.length
   ? codes.map(code=>`<div><strong>${code}</strong> · ${DATA.staff[code].name}</div>`).join("")
   : '<span class="empty">No staff assigned</span>';
 return `<div class="shift-line"><div class="shift-label ${s.className}">${short}<br><small>${s.time}</small></div><div class="people">${staff}</div></div>`;
}
function openDay(day){
 document.getElementById("monthView").hidden=true;
 document.getElementById("dayView").hidden=false;
 const dt=new Date(2026,7,day);
 document.getElementById("detailTitle").textContent=`${dt.toLocaleDateString("en-US",{weekday:"long"})}, ${day} August 2026`;
 document.getElementById("detailGrid").innerHTML=ORDER.map(key=>{
   const s=SHIFTS[key],codes=peopleFor(day,key);
   return `<section class="shift-panel"><h3><span>${s.title}</span><span class="pill ${s.className}">${s.time}</span></h3>
   ${codes.length?codes.map(code=>`<div class="employee"><div class="avatar">${code}</div><div><b>${DATA.staff[code].name}</b><small>Employee ID ${DATA.staff[code].id}</small></div></div>`).join(""):`<div class="empty">No staff assigned</div>`}
   </section>`;
 }).join("");
}
document.getElementById("backToMonth").onclick=()=>{document.getElementById("dayView").hidden=true;document.getElementById("monthView").hidden=false};

function fillStaff(){
 const select=document.getElementById("otStaff");
 select.innerHTML=Object.entries(DATA.staff).map(([c,s])=>`<option value="${c}">${c} — ${s.name}</option>`).join("");
 select.value="B";
}
function calculateHours(){
 const a=document.getElementById("otStart").value,b=document.getElementById("otEnd").value;if(!a||!b)return;
 let [ah,am]=a.split(":").map(Number),[bh,bm]=b.split(":").map(Number);let mins=(bh*60+bm)-(ah*60+am);if(mins<0)mins+=1440;
 document.getElementById("otHours").value=(mins/60).toFixed(2);
}
document.getElementById("otStart").onchange=calculateHours;document.getElementById("otEnd").onchange=calculateHours;
document.getElementById("otDate").value=new Date().toISOString().slice(0,10);
document.getElementById("saveOt").onclick=()=>{
 const hours=Number(document.getElementById("otHours").value),date=document.getElementById("otDate").value;
 if(!date||!hours){alert("Enter date and OT hours.");return}
 otEntries.push({id:Date.now(),staff:document.getElementById("otStaff").value,date,start:document.getElementById("otStart").value,end:document.getElementById("otEnd").value,hours,remarks:document.getElementById("otRemarks").value.trim()});
 localStorage.setItem("opsOtEntries",JSON.stringify(otEntries));renderOt();
};
document.getElementById("clearOt").onclick=()=>["otStart","otEnd","otHours","otRemarks"].forEach(x=>document.getElementById(x).value="");
function renderOt(){
 document.getElementById("otRows").innerHTML=otEntries.length?otEntries.slice().reverse().map(x=>`<tr><td>${x.staff} — ${DATA.staff[x.staff].name}</td><td>${x.date}</td><td>${x.start||"—"}</td><td>${x.end||"—"}</td><td><b>${Number(x.hours).toFixed(2)}</b></td><td>${x.remarks||"—"}</td></tr>`).join(""):`<tr><td colspan="6">No OT entries.</td></tr>`;
 const now=new Date(),sum=f=>otEntries.reduce((t,x)=>t+(f(new Date(x.date+"T00:00:00"))?Number(x.hours):0),0);
 const start=weekStart(now),end=new Date(start);end.setDate(end.getDate()+6);
 document.getElementById("mToday").textContent=sum(d=>d.toDateString()===now.toDateString()).toFixed(2);
 document.getElementById("mWeek").textContent=sum(d=>d>=start&&d<=end).toFixed(2);
 document.getElementById("mMonth").textContent=sum(d=>d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()).toFixed(2);
 document.getElementById("mYear").textContent=sum(d=>d.getFullYear()===now.getFullYear()).toFixed(2);
}
function weekStart(date){const d=new Date(date);const diff=(d.getDay()-archiveDay+7)%7;d.setDate(d.getDate()-diff);d.setHours(0,0,0,0);return d}
function renderArchive(){
 const now=new Date(),items=[];let s=new Date(2026,7,1);while(s.getDay()!==archiveDay)s.setDate(s.getDate()+1);
 const first=new Date(s);first.setDate(first.getDate()-7);
 for(let x=new Date(first);x<=new Date(2026,7,31);x.setDate(x.getDate()+7)){
  const e=new Date(x);e.setDate(e.getDate()+6);
  if(e<now){const a=new Date(Math.max(x,new Date(2026,7,1))),b=new Date(Math.min(e,new Date(2026,7,31)));if(a<=b)items.push(`<div class="archive-item"><div><b>${a.toLocaleDateString("en-US",{day:"numeric",month:"short"})} – ${b.toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric"})}</b><div class="subtitle">Read-only completed roster</div></div><span class="pill rest">Archived</span></div>`)}
 }
 document.getElementById("archiveInfo").textContent=`Completed roster weeks archive every ${DAY_NAMES[archiveDay]}.`;
 document.getElementById("archiveList").innerHTML=items.length?items.join(""):`<div class="archive-item">No completed roster week yet.</div>`;
}
document.getElementById("archiveDay").value=String(archiveDay);
document.getElementById("archiveDay").onchange=e=>{archiveDay=Number(e.target.value);localStorage.setItem("opsArchiveDay",archiveDay);document.getElementById("savedText").textContent=`Saved — archive cycle starts every ${DAY_NAMES[archiveDay]}.`;renderArchive();renderOt()};

document.querySelectorAll("[data-panel]").forEach(btn=>btn.onclick=()=>{
 const id=btn.dataset.panel;document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===id));document.querySelectorAll("[data-panel]").forEach(b=>b.classList.toggle("active",b.dataset.panel===id));
 const titles={schedule:["August 2026 Schedule","Each date is organised into Morning, Evening, Night, Maintenance and Rest"],overtime:["OT Tally","Record overtime hours and remarks"],archive:["Archive","Completed weekly roster records"],settings:["Settings","Configure the weekly archive cycle"]};
 document.getElementById("pageTitle").textContent=titles[id][0];document.getElementById("pageSubtitle").textContent=titles[id][1];
});
fillStaff();renderCalendar();renderOt();renderArchive();

/* Enhanced roster filters and duty-change workflow */
window.addEventListener("load",()=>{
 const monthView=document.getElementById("monthView");
 const calendar=document.getElementById("calendar");
 if(!monthView||!calendar)return;

 const style=document.createElement("style");
 style.textContent=`
 .ops-tools{display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:10px;margin:14px 0;padding:14px;background:#f4f8fb;border:1px solid #d8e2eb;border-radius:14px}.ops-tools label,.change-grid label{display:block;font-size:11px;font-weight:800;color:#64798a;margin-bottom:5px}.ops-tools input,.ops-tools select,.change-grid input,.change-grid select,.change-grid textarea{width:100%;padding:9px 10px;border:1px solid #d8e2eb;border-radius:9px;background:#fff}.ops-actions{display:flex;gap:8px;align-items:end}.ops-actions button,.change-actions button{border:0;border-radius:9px;padding:10px 12px;font-weight:800;cursor:pointer}.primary-action{background:#1769aa;color:#fff}.secondary-action{background:#fff;color:#17324a;border:1px solid #d8e2eb!important}.change-card{margin:0 0 14px;padding:15px;border:1px solid #d8e2eb;border-radius:14px;background:#fff}.change-card h3{margin:0 0 12px}.change-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.change-grid .wide{grid-column:1/-1}.change-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.status-sick{background:#b54b55!important}.status-cover{outline:2px solid #1769aa;outline-offset:-2px}.change-note{font-size:11px;color:#8a4c53;font-weight:800;margin-top:4px}.filter-result{font-size:12px;color:#64798a;margin:-4px 0 12px}.day-card.filtered-out{display:none!important}@media(max-width:900px){.ops-tools{grid-template-columns:repeat(3,1fr)}.change-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.ops-tools,.change-grid{grid-template-columns:1fr}.ops-actions{align-items:stretch}.change-actions{flex-direction:column}.change-actions button{width:100%}}
 `;
 document.head.appendChild(style);

 const staffOptions=Object.entries(DATA.staff).map(([c,s])=>`<option value="${c}">${c} — ${s.name}</option>`).join("");
 const tools=document.createElement("div");
 tools.className="ops-tools";
 tools.innerHTML=`
  <div><label>View</label><select id="rangeFilter"><option value="month">Full month</option><option value="day">One day</option><option value="week">One week</option></select></div>
  <div><label>Date / week</label><select id="dateFilter"><option value="all">All August</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1} August</option>`).join("")}</select></div>
  <div><label>Search staff</label><select id="staffFilter"><option value="all">All staff</option>${staffOptions}</select></div>
  <div><label>Status / duty</label><select id="statusFilter"><option value="all">All duties</option><option value="A">Night</option><option value="B">Morning</option><option value="C">Evening</option><option value="M">Maintenance</option><option value="OFF">Off / Rest</option><option value="LEAVE">Leave</option><option value="SICK">Sick</option></select></div>
  <div><label>Weekday</label><select id="weekdayFilter"><option value="all">All weekdays</option>${DAY_NAMES.map((n,i)=>`<option value="${i}">${n}</option>`).join("")}</select></div>
  <div class="ops-actions"><button id="clearFilters" class="secondary-action">Clear</button><button id="showChange" class="primary-action">Change duty</button></div>`;
 calendar.parentNode.insertBefore(tools,calendar);
 const result=document.createElement("div");result.id="filterResult";result.className="filter-result";tools.after(result);

 const change=document.createElement("div");change.id="changeCard";change.className="change-card";change.hidden=true;
 change.innerHTML=`<h3>Staff duty change / sick cover</h3><div class="change-grid">
  <div><label>Date</label><select id="changeDay">${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1} August</option>`).join("")}</select></div>
  <div><label>Staff changing</label><select id="originalStaff">${staffOptions}</select></div>
  <div><label>Reason</label><select id="changeReason"><option value="SICK">Sick</option><option value="LEAVE">Leave</option><option value="SWAP">Duty swap</option><option value="OTHER">Other</option></select></div>
  <div><label>Replacement staff</label><select id="replacementStaff"><option value="">No replacement</option>${staffOptions}</select></div>
  <div><label>Replacement duty</label><select id="replacementDuty"><option value="A">Night</option><option value="B">Morning</option><option value="C">Evening</option><option value="M">Maintenance</option><option value="OFF">Rest Day</option><option value="LEAVE">Leave</option></select></div>
  <div class="wide"><label>Remarks</label><textarea id="changeRemarks" rows="2" placeholder="Example: sick call received, replacement approved by supervisor"></textarea></div>
 </div><div class="change-actions"><button id="cancelChange" class="secondary-action">Cancel</button><button id="saveChange" class="primary-action">Save change</button></div>`;
 result.after(change);

 let changes=JSON.parse(localStorage.getItem("opsDutyChanges")||"[]");
 function actualCodes(day,key){
  let codes=[...(DATA.rows[day][key]||[])];
  changes.filter(x=>Number(x.day)===day).forEach(x=>{
   codes=codes.filter(c=>c!==x.original);
   if(x.replacement&&x.duty===key&&!codes.includes(x.replacement))codes.push(x.replacement);
  });
  return codes;
 }
 function personMarkup(day,key,code){
  const replacement=changes.find(x=>Number(x.day)===day&&x.replacement===code&&x.duty===key);
  const note=replacement?`<div class="change-note">Covering ${replacement.reason.toLowerCase()}</div>`:"";
  return `<div class="${replacement?'status-cover':''}"><strong>${code}</strong> · ${DATA.staff[code].name}${note}</div>`;
 }
 function sickMarkup(day,key){
  return changes.filter(x=>Number(x.day)===day&&x.reason==="SICK"&&x.originalDuty===key).map(x=>`<div class="change-note">${x.original} · ${DATA.staff[x.original].name} — Sick</div>`).join("");
 }
 function originalDuty(day,staff){
  return ["A","B","C","M","OFF","LEAVE"].find(k=>(DATA.rows[day][k]||[]).includes(staff))||"OFF";
 }
 function selectedDays(){
  const mode=document.getElementById("rangeFilter").value;
  const chosen=document.getElementById("dateFilter").value;
  if(mode==="month"||chosen==="all")return Array.from({length:31},(_,i)=>i+1);
  const d=Number(chosen);
  if(mode==="day")return[d];
  const start=d-((new Date(2026,7,d).getDay()+6)%7);
  return Array.from({length:7},(_,i)=>start+i).filter(x=>x>=1&&x<=31);
 }
 function enhancedRender(){
  const days=selectedDays();
  const staff=document.getElementById("staffFilter").value;
  const status=document.getElementById("statusFilter").value;
  const weekday=document.getElementById("weekdayFilter").value;
  let shown=0,html="";
  days.forEach(day=>{
   const dt=new Date(2026,7,day);
   if(weekday!=="all"&&String(dt.getDay())!==weekday)return;
   let matches=false;
   ["A","B","C","M","OFF"].forEach(key=>{
    const codes=actualCodes(day,key);
    if((staff==="all"||codes.includes(staff))&&(status==="all"||status===key))matches=true;
   });
   if(status==="SICK"&&changes.some(x=>Number(x.day)===day&&x.reason==="SICK"&&(staff==="all"||x.original===staff||x.replacement===staff)))matches=true;
   if(status==="LEAVE"&&(actualCodes(day,"LEAVE").some(c=>staff==="all"||c===staff)||changes.some(x=>Number(x.day)===day&&x.reason==="LEAVE"&&(staff==="all"||x.original===staff))))matches=true;
   if(!matches)return;
   shown++;
   html+=`<article class="day-card" data-day="${day}"><div class="day-head"><div><div class="day-number">${day}</div><div class="day-name">${dt.toLocaleDateString("en-US",{weekday:"long"})}</div></div><span class="day-name">AUG</span></div><div class="day-body">${["A","B","C","M","OFF"].map(key=>{
    const s=SHIFTS[key],short=key==="A"?"Night":key==="B"?"Morning":key==="C"?"Evening":key==="M"?"Maintenance":"Rest Day";
    const codes=actualCodes(day,key);
    const visible=codes.filter(c=>staff==="all"||c===staff);
    const people=visible.length?visible.map(c=>personMarkup(day,key,c)).join(""):'<span class="empty">No matching staff</span>';
    const sick=sickMarkup(day,key);
    return `<div class="shift-line"><div class="shift-label ${s.className}">${short}<br><small>${s.time}</small></div><div class="people">${people}${sick}</div></div>`;
   }).join("")}</div></article>`;
  });
  calendar.innerHTML=html||`<div class="archive-item">No schedule matches these filters.</div>`;
  result.textContent=`Showing ${shown} day${shown===1?'':'s'}`;
  calendar.querySelectorAll("[data-day]").forEach(x=>x.onclick=()=>openDay(Number(x.dataset.day)));
 }
 ["rangeFilter","dateFilter","staffFilter","statusFilter","weekdayFilter"].forEach(id=>document.getElementById(id).addEventListener("change",enhancedRender));
 document.getElementById("rangeFilter").addEventListener("change",e=>{document.getElementById("dateFilter").disabled=e.target.value==="month";if(e.target.value!=="month"&&document.getElementById("dateFilter").value==="all")document.getElementById("dateFilter").value="1";enhancedRender()});
 document.getElementById("dateFilter").disabled=true;
 document.getElementById("clearFilters").onclick=()=>{rangeFilter.value="month";dateFilter.value="all";dateFilter.disabled=true;staffFilter.value="all";statusFilter.value="all";weekdayFilter.value="all";enhancedRender()};
 document.getElementById("showChange").onclick=()=>{change.hidden=!change.hidden};
 document.getElementById("cancelChange").onclick=()=>{change.hidden=true};
 document.getElementById("saveChange").onclick=()=>{
  const day=Number(changeDay.value),original=originalStaff.value,replacement=replacementStaff.value,duty=replacementDuty.value,reason=changeReason.value;
  if(replacement===original){alert("Replacement must be a different staff member.");return}
  const originalKey=originalDuty(day,original);
  if(replacement){
   const replacementCurrent=originalDuty(day,replacement);
   if(replacementCurrent!=="OFF"&&replacementCurrent!=="LEAVE"){
    if(!confirm(`${DATA.staff[replacement].name} is already assigned to ${SHIFTS[replacementCurrent].title}. Continue with the exchange?`))return;
   }
  }
  changes=changes.filter(x=>!(Number(x.day)===day&&x.original===original));
  changes.push({id:Date.now(),day,original,originalDuty:originalKey,replacement,duty,reason,remarks:changeRemarks.value.trim()});
  localStorage.setItem("opsDutyChanges",JSON.stringify(changes));
  change.hidden=true;enhancedRender();alert("Duty change saved.");
 };
 enhancedRender();
});
