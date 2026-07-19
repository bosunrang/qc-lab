/* ===== BOOT ===== */
async function boot(){
  if(await loadBootState())await ensureAdmin().then(()=>{
    showLogin();
    setTimeout(()=>storageHydrationPromise.then(ok=>{if(ok)initFirebase();else showStartupRecovery();}),0);
  });
  else showStartupRecovery();
}
boot();
