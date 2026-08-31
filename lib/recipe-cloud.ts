import { getSupabaseBrowserClient,isSupabaseConfigured } from "./supabase-browser";

export async function recipeCloudReady(){
  const cloud=process.env.NEXT_PUBLIC_KIUBO_DATA_MODE==="supabase"||(process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase"&&isSupabaseConfigured());
  if(!cloud)return true;
  const client=getSupabaseBrowserClient();if(!client)return false;
  const result=await client.rpc("kiubo_recipe_inventory_capability");
  return !result.error&&result.data===true;
}
