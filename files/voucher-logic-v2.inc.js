// FAMILOCK_VOUCHER_LOGIC_V2
// Voucher jest przychodem w dniu sprzedaży. Realizacja voucherem ma revenue=0,
// żeby nie księgować tej samej sprzedaży drugi raz.
(function installVoucherLogicV2(){
  function warsawDate(){
    try{
      const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
        timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(new Date()).map(x=>[x.type,x.value]));
      return `${p.year}-${p.month}-${p.day}`;
    }catch(e){
      const d=new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
  }

  voucherStatus = function(v){
    if (v?.usedBy || v?.usedSessionId) return 'used';
    const exp=String(v?.expires||'').slice(0,10);
    if (exp && exp < warsawDate()) return 'expired';
    return 'active';
  };

  nextVoucherCode = function(){
    const year=String(new Date().getFullYear());
    let max=0;
    (S.vouchers||[]).forEach(v=>{
      const m=String(v?.code||'').trim().match(/^(\d+)\/(\d{4})$/);
      if(m&&m[2]===year) max=Math.max(max,Number(m[1])||0);
    });
    return `${String(max+1).padStart(3,'0')}/${year}`;
  };

  function voucherForSession(s){
    if(!s)return null;
    return (S.vouchers||[]).find(v=>
      (s.voucherId!=null && String(v.id)===String(s.voucherId)) ||
      (v.usedSessionId!=null && String(v.usedSessionId)===String(s.id))
    )||null;
  }

  function releaseVoucher(s){
    const v=voucherForSession(s);
    if(!v)return;
    if(v.usedSessionId==null || String(v.usedSessionId)===String(s.id)){
      v.usedBy=null;
      v.usedSessionId=null;
    }
  }

  function markVoucher(v,s){
    v.usedBy=s.date||warsawDate();
    v.usedSessionId=s.id;
  }

  const baseEditSession=window.editSession;
  if(typeof baseEditSession==='function'){
    window.editSession=function(idx){
      baseEditSession(idx);
      const s=S.sessions[idx];
      const pay=$('se-lockme');
      if(!s||!pay)return;

      if(![...pay.options].some(o=>o.value==='voucher')){
        const o=document.createElement('option');
        o.value='voucher'; o.textContent='Voucher';
        pay.appendChild(o);
      }
      if(String(s.payment||'').toLowerCase()==='voucher') pay.value='voucher';

      let field=$('se-voucher-edit-field');
      if(!field){
        field=document.createElement('div');
        field.className='field';
        field.id='se-voucher-edit-field';
        field.style.margin='0';
        const label=document.createElement('label');
        label.textContent='Voucher';
        const select=document.createElement('select');
        select.id='se-voucher-id';
        field.append(label,select);
        pay.closest('.field')?.insertAdjacentElement('afterend',field);
      }

      const vsel=$('se-voucher-id');
      if(vsel){
        vsel.textContent='';
        const currentId=s.voucherId==null?'':String(s.voucherId);
        const candidates=(S.vouchers||[]).filter(v=>voucherStatus(v)==='active'||String(v.id)===currentId||String(v.usedSessionId||'')===String(s.id));
        if(!candidates.length){
          const o=document.createElement('option'); o.value=''; o.textContent='— brak dostępnych voucherów —'; vsel.appendChild(o);
        }else{
          candidates.forEach(v=>{
            const o=document.createElement('option');
            o.value=String(v.id);
            o.textContent=`${v.code||'Voucher'} · ${fmtPLN(v.value||0)}${v.buyer?` · ${v.buyer}`:''}`;
            if(String(v.id)===currentId) o.selected=true;
            vsel.appendChild(o);
          });
        }
      }

      const syncPaymentUI=()=>{
        const isVoucher=pay.value==='voucher';
        if(field) field.style.display=isVoucher?'':'none';
        const rev=$('se-rev');
        if(rev){
          rev.disabled=isVoucher;
          if(isVoucher) rev.value='0';
        }
      };
      pay.addEventListener('change',syncPaymentUI);
      syncPaymentUI();
    };
  }

  window.updateSession=function(idx){
    const s=S.sessions[idx];
    if(!s)return;
    const payType=$('se-lockme')?.value||'0';
    const isVoucher=payType==='voucher';
    const date=$('se-date')?.value||'';
    const rev=isVoucher?0:(parseFloat($('se-rev')?.value)||0);
    if(!date){toast('Podaj datę','err');return;}
    if(!isVoucher&&rev<=0){toast('Podaj przychód','err');return;}

    const oldVoucher=voucherForSession(s);
    let newVoucher=null;
    if(isVoucher){
      const voucherId=$('se-voucher-id')?.value||String(s.voucherId||'');
      newVoucher=(S.vouchers||[]).find(v=>String(v.id)===String(voucherId));
      if(!newVoucher){toast('Wybierz voucher','err');return;}
      if(newVoucher.usedSessionId!=null && String(newVoucher.usedSessionId)!==String(s.id)){
        toast('Ten voucher jest już wykorzystany','err');return;
      }
    }

    if(oldVoucher && (!newVoucher || String(oldVoucher.id)!==String(newVoucher.id))) releaseVoucher(s);

    s.date=date;
    s.hour=$('se-hour')?.value||'';
    s.players=parseInt($('se-players')?.value)||0;
    s.revenue=rev;
    s.discount=parseFloat($('se-disc')?.value)||0;
    s.note=$('se-note')?.value.trim()||'';
    s.source=$('se-source')?.value||'';
    s.email=$('se-email')?.value.trim()||'';
    s.phone=$('se-phone')?.value.trim()||'';
    s.test=$('se-test')?.checked||false;

    if(isVoucher){
      s.lockme=false;
      s.payment='voucher';
      s.voucherId=newVoucher.id;
      s.voucherCode=newVoucher.code||'';
      markVoucher(newVoucher,s);
    }else{
      s.lockme=payType==='1';
      s.payment=s.lockme?'online':'on-site';
      delete s.voucherId;
      delete s.voucherCode;
    }

    save();
    renderSessions();
    toast(isVoucher?`Zaktualizowano · voucher ${s.voucherCode}`:'Zaktualizowano sesję');
  };

  window.deleteSession=function(idx){
    const s=S.sessions[idx];
    if(!s)return;
    if(!confirm('Usunąć tę sesję?'))return;
    releaseVoucher(s);
    S.sessions.splice(idx,1);
    save();
    renderSessions();
    toast('Usunięto');
  };

  const baseUpdateVoucher=window.updateVoucher;
  if(typeof baseUpdateVoucher==='function'){
    window.updateVoucher=function(idx){
      const before=S.vouchers[idx];
      const linked=before?.usedSessionId;
      const oldCode=before?.code;
      baseUpdateVoucher(idx);
      const after=S.vouchers[idx];
      if(!after || after.code===oldCode || linked==null)return;
      const s=S.sessions.find(x=>String(x.id)===String(linked));
      if(s){
        s.voucherCode=after.code;
        save();
      }
    };
  }
})();
