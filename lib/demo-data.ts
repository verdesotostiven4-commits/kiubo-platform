export type TenantStatus = "trial" | "active" | "grace" | "suspended";

export type Tenant = {
  id: string;
  name: string;
  plan: "Start" | "Pro" | "Custom" | "Internal";
  status: TenantStatus;
  users: number;
  branches: number;
  expiresAt: string;
  catalog: boolean;
  invoice: boolean;
};

export const tenants: Tenant[] = [
  { id: "tenant-barrio-max", name: "Barrio MAX", plan: "Internal", status: "active", users: 3, branches: 1, expiresAt: "Sin vencimiento", catalog: true, invoice: true },
  { id: "tenant-pilot-001", name: "Piloto 001 · Jairo", plan: "Pro", status: "trial", users: 2, branches: 1, expiresAt: "90 días desde activación", catalog: true, invoice: false }
];

export const metrics = [
  { label: "Negocios", value: "2", note: "1 interno · 1 piloto" },
  { label: "MRR", value: "$0", note: "Etapa de validación" },
  { label: "Trials", value: "1", note: "Piloto 001" },
  { label: "Salud", value: "100%", note: "Foundation aislado" }
];

export const activity = [
  "Foundation multiempresa preparada",
  "Modo local activo: sin tocar Supabase productivo",
  "Despliegues Git de KIUBO desactivados durante construcción",
  "KIUBO Control listo como primer checkpoint visual"
];
