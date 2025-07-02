/**
 * @file examples/final_chat_example.ts
 * @description Contoh final dan terlengkap penggunaan Cerebrum
 * dengan memuat konfigurasi dari file terpusat.
 */

// Impor dari library pihak ketiga dan Node.js
import readline from 'readline';
import chalk from 'chalk';

// Impor semua yang dibutuhkan dari framework Anda
import { 
    Cerebrum, 
    CerebrumError, 
    ConfigError, 
    AllProvidersFailedError,
    ChatStreamEvent
} from '../src/index.js';

// Impor SEMUA yang dibutuhkan dari file konfigurasi terpusat Anda
import { appConfig, myToolImplementations, myPlugins, corePrompt } from './app-config.js';

const log = (label: string, message: string, color = chalk.white) => {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    console.log(color(`${timestamp} [${label}]`), message);
}

async function main() {
  try {
    // 1. Inisialisasi Cerebrum dengan mengimpor semua konfigurasi.
    // Perhatikan betapa bersihnya bagian ini.
    const cerebrum = new Cerebrum(appConfig, myToolImplementations, myPlugins, corePrompt);
    
    // 2. Jalankan proses bootstrap
    await cerebrum.bootstrap();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const sessionId = `final-session-${Date.now()}`;
    console.log(chalk.bold.magenta(`\nSelamat Datang di Cerebrum! Sesi: ${sessionId}`));
    console.log(chalk.gray('Contoh: "cek status pesanan ORD-12345" atau "exit" untuk keluar.\n'));

    // 3. Mulai loop percakapan interaktif
    const chatLoop = async () => {
      const userInput = await new Promise<string>(res => rl.question(chalk.greenBright('Anda: '), res));
      if (userInput.toLowerCase() === 'exit') {
        rl.close();
        cerebrum.shutdown();
        return;
      }

      try {
        log('APP', `Memproses permintaan: "${userInput}"...`, chalk.yellow);
        
        let fullResponse = '';
        let finalProvider = 'N/A';
        
        // 4. Gunakan .chatStream dan proses setiap event yang diterima
        for await (const event of cerebrum.chatStream(sessionId, userInput)) {
          finalProvider = event.provider || finalProvider;
          switch (event.type) {
            case 'chunk':
              if (fullResponse.length === 0) process.stdout.write(chalk.cyanBright('AI: '));
              process.stdout.write(chalk.cyanBright(event.content));
              fullResponse += event.content;
              break;
            case 'cached_response':
              process.stdout.write(chalk.cyanBright('AI: '));
              process.stdout.write(chalk.cyanBright.italic(event.content));
              fullResponse += event.content;
              break;
            case 'tool_call':
              console.log(chalk.yellow(`\n[Memanggil tool: ${event.content[0].function.name}...]`));
              break;
            case 'tool_result':
              console.log(chalk.yellow(`[Hasil tool diterima, melanjutkan proses...]`));
              process.stdout.write(chalk.cyanBright('AI: '));
              break;
          }
        }
        
        // Pindah baris hanya jika ada output teks
        if (fullResponse) {
            process.stdout.write('\n');
        }

      } catch (error) {
        console.log(); // Pindah baris jika ada error
        if (error instanceof AllProvidersFailedError) log('APP', `Gagal: ${error.message}`, chalk.red);
        else log('APP', `Error tak terduga: ${(error as Error).message}`, chalk.red);
      }
      
      console.log();
      chatLoop();
    };
    
    chatLoop();

  } catch (error) {
    if (error instanceof ConfigError) log('FATAL', `Config Error: ${error.message}`, chalk.red.bold);
    else log('FATAL', `Startup Error: ${(error as Error).message}`, chalk.red.bold);
  }
}

main();