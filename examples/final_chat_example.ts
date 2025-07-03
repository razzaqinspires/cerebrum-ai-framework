/**
 * @file examples/final_chat_example.ts
 * @description Contoh penggunaan Cerebrum dengan toolChoice dan tampilan terminal yang stabil.
 */
import readline from 'readline';
import chalk from 'chalk';
import { 
    Cerebrum, 
    CerebrumError, 
    ConfigError, 
    AllProvidersFailedError,
    ChatStreamEvent,
    ChatOptions
} from '../src/index.js';
import { appConfig, myToolImplementations, myPlugins, corePrompt } from './app-config.js';

const log = (label: string, message: string, color = chalk.white) => {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    console.log(color(`${timestamp} [${label}]`), message);
}

async function main() {
  try {
    const cerebrum = new Cerebrum(appConfig, myToolImplementations, myPlugins, corePrompt);
    await cerebrum.bootstrap();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const sessionId = `final-session-${Date.now()}`;
    console.log(chalk.bold.magenta(`\nSelamat Datang di Cerebrum! Sesi: ${sessionId}`));
    console.log(chalk.gray('Contoh: "cek status pesanan ORD-12345", "siapa kamu?", atau "exit" untuk keluar.\n'));

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
        let isFirstChunk = true;

        // --- LOGIKA CERDAS UNTUK TOOL CHOICE ---
        // Jika input mengandung kata kunci seperti 'status' atau 'pesanan',
        // biarkan AI bebas memilih tool. Jika tidak, paksa untuk menjawab dengan teks.
        const chatOptions: ChatOptions = {
            toolChoice: userInput.toLowerCase().includes('status') || userInput.toLowerCase().includes('pesanan')
                ? 'auto'
                : 'none'
        };
        log('APP', `Tool Choice diatur ke: '${chatOptions.toolChoice}'`, chalk.blue);

        for await (const event of cerebrum.chatStream(sessionId, userInput, chatOptions)) {
          finalProvider = event.provider || finalProvider;
          
          // Cetak "AI:" hanya sekali saat data pertama diterima
          if (isFirstChunk) {
            process.stdout.write(chalk.cyanBright('AI: '));
            isFirstChunk = false;
          }

          switch (event.type) {
            case 'chunk':
              process.stdout.write(chalk.cyanBright(event.content));
              fullResponse += event.content;
              break;
            case 'cached_response':
              process.stdout.write(chalk.cyanBright.italic(event.content));
              fullResponse += event.content;
              break;
            case 'tool_call':
              process.stdout.write(chalk.yellow(`[Memanggil tool: ${event.content[0].function.name}...]\n`));
              break;
            case 'tool_result':
              log('APP', `[Hasil tool diterima, melanjutkan proses...]`, chalk.yellow);
              process.stdout.write(chalk.cyanBright('AI: '));
              break;
          }
        }
        
        if (fullResponse) {
            process.stdout.write('\n');
        }

      } catch (error) {
        console.log();
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