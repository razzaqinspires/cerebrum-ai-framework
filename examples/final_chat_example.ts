/**
 * @file examples/final_chat_example.ts
 * @description Contoh penggunaan Cerebrum dengan memuat konfigurasi dari file terpisah.
 */
import readline from 'readline';
import chalk from 'chalk';
import { 
    Cerebrum, 
    CerebrumError, 
    ConfigError, 
    AllProvidersFailedError,
    ChatStreamEvent
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
    const sessionId = `stable-session-${Date.now()}`;
    console.log(chalk.bold.magenta(`\nSelamat Datang di Cerebrum! Sesi: ${sessionId}`));
    console.log(chalk.gray('Contoh: "cek status pesanan ORD-12345" atau "exit" untuk keluar.\n'));

    const chatLoop = async () => {
      const userInput = await new Promise<string>(res => rl.question(chalk.greenBright('Anda: '), res));
      if (userInput.toLowerCase() === 'exit') {
        rl.close();
        cerebrum.shutdown();
        return;
      }

      try {
        console.log(chalk.yellow('AI sedang memproses permintaan Anda...'));
        let fullResponse = '';
        let finalProvider = 'N/A';
        let isToolCall = false;

        for await (const event of cerebrum.chatStream(sessionId, userInput)) {
          finalProvider = event.provider || finalProvider;
          switch (event.type) {
            case 'chunk':
              if (!isToolCall) process.stdout.write(chalk.cyanBright(event.content));
              fullResponse += event.content;
              break;
            case 'cached_response':
              process.stdout.write(chalk.cyanBright.italic(event.content));
              fullResponse += event.content;
              break;
            case 'tool_call':
              isToolCall = true;
              console.log(chalk.yellow(`\n[Memanggil tool: ${event.content[0].function.name}...]`));
              break;
            case 'tool_result':
              console.log(chalk.yellow(`[Hasil tool diterima, melanjutkan proses...]`));
              process.stdout.write(chalk.cyanBright('AI: '));
              break;
          }
        }
        
        if (fullResponse) {
            process.stdout.write('\n'); // Pindah baris setelah jawaban lengkap
        } else if (isToolCall) {
            console.log(chalk.cyanBright(`AI (${finalProvider.toUpperCase()}): `) + "Tugas telah dieksekusi.");
        }

      } catch (error) {
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