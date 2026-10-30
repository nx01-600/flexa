// Simulated data for the visual prototype. Nothing here touches real money.

export const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export const worker = {
  name: "Valentina Torres",
  firstName: "Valentina",
  doc: "CC 1.234.567.890",
  email: "valentina.torres@email.com",
  company: "Empresa S.A.",
  earned: 1_000_000,
  withdrawn: 700_000,
  available: 300_000,
  // share of the earned salary that can be withdrawn (30-60 % by profile)
  limitPct: 30,
};

export type MovementKind = "retiro" | "pago" | "recarga";

export type Movement = {
  id: string;
  kind: MovementKind;
  title: string;
  date: string;
  amount: number;
  dest: string;
  account: string;
  time: string;
};

export const movements: Movement[] = [
  { id: "458732", kind: "retiro", title: "Retiro a Bancolombia", date: "12 abr 2025", time: "10:24 a. m.", amount: 100_000, dest: "Bancolombia", account: "123 456 7890" },
  { id: "458611", kind: "pago", title: "Pago de luz, EPM", date: "10 abr 2025", time: "6:02 p. m.", amount: 85_000, dest: "EPM", account: "Ref. 0098 2231" },
  { id: "458502", kind: "retiro", title: "Retiro a Nequi", date: "5 abr 2025", time: "8:15 a. m.", amount: 150_000, dest: "Nequi", account: "300 123 4567" },
  { id: "458377", kind: "pago", title: "Pago de internet", date: "3 abr 2025", time: "7:40 p. m.", amount: 70_000, dest: "Claro hogar", account: "Ref. 5521 0094" },
  { id: "458201", kind: "retiro", title: "Retiro a Davivienda", date: "28 mar 2025", time: "12:31 p. m.", amount: 100_000, dest: "Davivienda", account: "0570 1122 3344" },
  { id: "458150", kind: "recarga", title: "Recarga de celular", date: "25 mar 2025", time: "9:05 a. m.", amount: 60_000, dest: "Claro", account: "300 123 4567" },
];

export const weeklyEarned = [
  { week: "Sem 1", value: 250_000 },
  { week: "Sem 2", value: 500_000 },
  { week: "Sem 3", value: 750_000 },
  { week: "Sem 4", value: 1_000_000 },
];

export const banks = ["Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA", "Nequi", "Daviplata"];

export const tips = [
  "Mantener un buen equilibrio te da más libertad.",
  "Retirar solo lo necesario protege tu quincena.",
  "Revisa tus gastos fijos antes de retirar.",
];

// ---------- Flexa Empresas ----------

export const company = {
  name: "Empresa S.A.",
  nit: "900.123.456-7",
  activeWorkers: 250,
  withAccess: 180,
  withdrawalsMonth: 520,
  withdrawnMonth: 48_200_000,
};

export const companyWeekly = [
  { week: "Sem 1", value: 7_600_000 },
  { week: "Sem 2", value: 10_400_000 },
  { week: "Sem 3", value: 10_300_000 },
  { week: "Sem 4", value: 6_800_000 },
];

export const payrollUploads = [
  { file: "Nomina_Octubre2026.xlsx", date: "15 oct 2026", period: "Oct 2026", status: "Procesada", workers: 250 },
  { file: "Nomina_Septiembre2026.xlsx", date: "15 sep 2026", period: "Sep 2026", status: "Procesada", workers: 248 },
  { file: "Nomina_Agosto2026.xlsx", date: "15 ago 2026", period: "Ago 2026", status: "Procesada", workers: 250 },
  { file: "Nomina_Julio2026.csv", date: "15 jul 2026", period: "Jul 2026", status: "Con novedades", workers: 246 },
  { file: "Nomina_Junio2026.xlsx", date: "14 jun 2026", period: "Jun 2026", status: "Procesada", workers: 241 },
];

export const monthlyWithdrawn = [
  { month: "Abr", value: 12_000_000 },
  { month: "May", value: 27_000_000 },
  { month: "Jun", value: 29_000_000 },
  { month: "Jul", value: 26_500_000 },
  { month: "Ago", value: 37_000_000 },
  { month: "Sep", value: 44_000_000 },
];

export const categories = [
  { name: "Alimentación", value: 40 },
  { name: "Servicios públicos", value: 25 },
  { name: "Telefonía", value: 15 },
  { name: "Transporte", value: 10 },
  { name: "Otros", value: 10 },
];

export const weekdayWithdrawals = [
  { day: "Lun", value: 38_000_000 },
  { day: "Mar", value: 46_000_000 },
  { day: "Mié", value: 22_000_000 },
  { day: "Jue", value: 41_000_000 },
  { day: "Vie", value: 48_000_000 },
];

export const sites = [
  { name: "Sede Cali", value: 35 },
  { name: "Sede Bogotá", value: 25 },
  { name: "Sede Medellín", value: 20 },
  { name: "Sede Barranquilla", value: 12 },
  { name: "Sede Bucaramanga", value: 8 },
];

export const employees = [
  { name: "Juan Pérez", doc: "1.107.233.481", site: "Cali", salary: 2_400_000, access: true, withdrawn: 1_200_000 },
  { name: "María López", doc: "1.144.902.115", site: "Bogotá", salary: 2_100_000, access: true, withdrawn: 980_000 },
  { name: "Carlos Gómez", doc: "94.551.208", site: "Cali", salary: 1_900_000, access: true, withdrawn: 850_000 },
  { name: "Ana Castaño", doc: "1.020.778.640", site: "Medellín", salary: 1_750_000, access: true, withdrawn: 410_000 },
  { name: "Diego Rentería", doc: "1.130.665.902", site: "Cali", salary: 1_600_000, access: false, withdrawn: 0 },
  { name: "Laura Torres", doc: "1.006.112.874", site: "Barranquilla", salary: 1_450_000, access: true, withdrawn: 50_000 },
  { name: "Andrés Ruiz", doc: "80.224.517", site: "Bogotá", salary: 2_800_000, access: true, withdrawn: 70_000 },
  { name: "Camila Díaz", doc: "1.098.441.330", site: "Bucaramanga", salary: 1_500_000, access: true, withdrawn: 80_000 },
  { name: "Felipe Mora", doc: "1.144.087.226", site: "Medellín", salary: 1_300_000, access: false, withdrawn: 0 },
];

export const team = [
  { name: "Ricardo Salazar", email: "gerencia@empresa.com", role: "Administrador" },
  { name: "Paola Muñoz", email: "rrhh@empresa.com", role: "Recursos Humanos" },
  { name: "Jorge Valencia", email: "finanzas@empresa.com", role: "Finanzas" },
];
