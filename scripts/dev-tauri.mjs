import http from 'http';
import { spawn } from 'child_process';

const checkServer = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173', () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
};

const isRunning = await checkServer();
if (isRunning) {
  console.log('[Tauri] http://localhost:5173 üzerinde aktif sunucu algılandı. Mevcut sunucuya bağlanılıyor...');
  const tauri = spawn('npx', ['tauri', 'dev', '-c', '{"build":{"beforeDevCommand":""}}'], { stdio: 'inherit', shell: true });
  tauri.on('exit', (code) => process.exit(code || 0));
} else {
  console.log('[Tauri] Vite sunucusu ve Tauri masaüstü penceresi başlatılıyor...');
  const tauri = spawn('npx', ['tauri', 'dev'], { stdio: 'inherit', shell: true });
  tauri.on('exit', (code) => process.exit(code || 0));
}
