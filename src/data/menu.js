// Thin re-export — the canonical menu (dishes, prices, option groups) lives in
// supabase/functions/_shared/menu.js so the create-checkout Edge Function prices
// orders from the exact same data. Edit THAT file to change the menu.
export { default, resolveSelections, categories } from '../../supabase/functions/_shared/menu.js'
