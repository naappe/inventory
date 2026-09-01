(function(){
  function isMobile(){return window.matchMedia('(max-width:760px)').matches;}
  function revealActive(){
    if(!isMobile())return;
    const nav=document.querySelector('.nav');
    const active=nav?.querySelector('.workflowNavBtn.active');
    if(!nav||!active)return;
    requestAnimationFrame(()=>active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}));
  }
  const oldOpen=typeof openPage==='function'?openPage:null;
  if(oldOpen){
    openPage=function(page){oldOpen(page);setTimeout(revealActive,80);};
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('.workflowNavBtn'))setTimeout(revealActive,80);
  });
  window.addEventListener('resize',revealActive,{passive:true});
  setTimeout(revealActive,180);
})();
