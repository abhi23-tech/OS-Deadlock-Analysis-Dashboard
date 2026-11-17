const configured=(import.meta.env.VITE_API_BASE_URL as string|undefined)?.replace(/\/$/,"");
const base=configured || (import.meta.env.DEV ? "http://localhost:8000" : "");
export async function api<T>(path:string,body?:unknown):Promise<T>{if(!base)throw new Error("VITE_API_BASE_URL is missing. Configure it to your deployed FastAPI URL and rebuild the frontend.");const r=await fetch(base+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json().catch(()=>({detail:"Invalid server response"}));if(!r.ok)throw new Error(data.detail||`Request failed (${r.status})`);return data as T}
export const API_BASE=base || "(not configured)";
