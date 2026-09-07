/**
 * Konstanta Terpusat Posisi / Jabatan Karyawan Klinik OASE
 * BINDING: Mini-Task Jabatan Dropdown & docs/ui-design-system.md
 *
 * Usulan terkurasi default klinik — Owner dapat menyesuaikan daftar ini dalam satu baris.
 */

export const EMPLOYEE_POSITIONS = [
  'Dokter Gigi',
  'Dokter Gigi Spesialis',
  'Asisten Dokter Gigi',
  'Front Office/Resepsionis',
  'Kasir',
  'Admin',
  'Manajer Operasional',
] as const;

export type EmployeePosition = (typeof EMPLOYEE_POSITIONS)[number];

/**
 * Validasi apakah suatu nilai jabatan termasuk dalam daftar whitelist resmi.
 */
export function isAllowedEmployeePosition(position: string): boolean {
  return (EMPLOYEE_POSITIONS as readonly string[]).includes(position);
}
