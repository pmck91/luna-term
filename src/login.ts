export type SystemInfo = { load: string; diskUsed: string; diskPercent: number; memory: number; swap: number; temperature: string; processes: number; users: number; zombies: number; address: string; lastAddress: string; lastTime: string };
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
export function systemInfo(): SystemInfo {
  try { const saved = sessionStorage.getItem('luna-system'); if (saved) return JSON.parse(saved) as SystemInfo; } catch { /* Storage is optional. */ }
  const processes = random(220, 530), zombies = random(0, 2), diskPercent = random(8, 38);
  const value: SystemInfo = { load: (random(8, 180) / 100).toFixed(2), diskUsed: (456.34 * diskPercent / 100).toFixed(2), diskPercent, memory: random(17, 62), swap: random(0, 38), temperature: (random(360, 660) / 10).toFixed(1), processes, users: random(1, 5), zombies, address: `192.168.14.${random(10, 240)}`, lastAddress: `10.0.${random(0, 8)}.${random(2, 240)}`, lastTime: new Date(Date.now() - random(1, 168) * 3600000 - random(0, 59) * 60000).toISOString() };
  try { sessionStorage.setItem('luna-system', JSON.stringify(value)); } catch { /* Storage is optional. */ }
  return value;
}
