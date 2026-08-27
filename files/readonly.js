(function(){
  'use strict';
  if(!window.FAMILOCK_READ_ONLY)return;

  function lockControls(){
    const root=document.getElementById('main-app');if(!root)return;
    root.querySelectorAll('input,textarea,select,button:not(.mni)').forEach(control=>{
      control.disabled=true;
      control.setAttribute('aria-disabled','true');
      control.title='Archiwalny podgląd. Dane edytuj w Managerze Familock.';
    });
  }

  function notify(event){
    const target=event.target?.closest?.('#main-app [onclick],#main-app label[for],#main-app label.btn');
    if(!target||target.closest('.ni,.mni'))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(window.toast)window.toast('Archiwalny podgląd. Dane edytuj w Managerze.','err');
  }

  document.addEventListener('click',notify,true);
  const start=()=>{
    lockControls();
    const root=document.getElementById('main-app');
    if(root)new MutationObserver(lockControls).observe(root,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
