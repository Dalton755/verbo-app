/** Canal visual Android/TWA; não é prova de compra. */
export const SHALOM_PLAY_PACKAGE="br.com.nethanel.shalom";
export const SHALOM_PLAY_SKU="shalom_mensal";
const KEY="shalom:google-play-channel";

export function isShalomPlayOrigin(search="",referrer="",stored=false){
  const params=new URLSearchParams(String(search).replace(/^\?/,""));
  return params.get("platform")==="googleplay"
    || /^android-app:\/\/br\.com\.nethanel\.shalom(?:\/|$)/i.test(String(referrer))
    || stored===true;
}

export function detectShalomPlayChannel(win=typeof window==="undefined"?null:window){
  if(!win)return false;
  let stored=false;
  try{stored=win.sessionStorage?.getItem(KEY)==="1"}catch{/* opcional */}
  const origin=isShalomPlayOrigin(win.location?.search||"",win.document?.referrer||"",stored);
  if(origin){try{win.sessionStorage?.setItem(KEY,"1")}catch{/* opcional */}}
  return origin;
}
