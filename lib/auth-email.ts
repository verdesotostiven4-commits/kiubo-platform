export const AUTH_EMAIL_COOLDOWN_MS=60_000;

export function explainAuthEmailError(message:string){
  const text=message.trim();
  const normalized=text.toLowerCase();
  if(normalized.includes("email rate limit")||normalized.includes("over_email_send_rate_limit")||normalized.includes("only request this after")){
    return "El servicio de correo limitó temporalmente los envíos. Espera un minuto antes de volver a pedir otro enlace. Para producción, KIUBO debe usar SMTP propio.";
  }
  if(normalized.includes("invalid")&&normalized.includes("email"))return "Revisa que el correo esté escrito correctamente.";
  if(normalized.includes("user not found")||normalized.includes("signup is disabled"))return "Ese correo todavía no tiene un acceso activo en KIUBO.";
  return text||"No se pudo enviar el enlace de acceso.";
}

const cooldownKey=(email:string)=>`kiubo:auth-email:${email.trim().toLowerCase()}`;

export function getAuthEmailCooldownSeconds(email:string){
  if(typeof window==="undefined"||!email.trim())return 0;
  const until=Number(window.localStorage.getItem(cooldownKey(email))||0);
  return Math.max(0,Math.ceil((until-Date.now())/1000));
}

export function startAuthEmailCooldown(email:string,durationMs=AUTH_EMAIL_COOLDOWN_MS){
  if(typeof window==="undefined"||!email.trim())return;
  window.localStorage.setItem(cooldownKey(email),String(Date.now()+durationMs));
}
