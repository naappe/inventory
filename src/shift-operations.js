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
