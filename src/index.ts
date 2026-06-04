import { DiscordBot } from './bot/client.ts';
import { startServer } from './server/index.ts';

import { command as recordCmd } from './commands/record.ts';
import { command as stopCmd } from './commands/stop.ts';
import { command as ajudaCmd } from './commands/ajuda.ts';

const bot = new DiscordBot();

const commands = [
  recordCmd,
  stopCmd,
  ajudaCmd,
];

async function syncCommands() {
  if (!bot.application) return;

  console.log('🔄 Sincronizando comandos...');

  await bot.application.commands.set(
    commands.map(cmd => cmd.data.toJSON())
  );

  console.log(`✅ ${commands.length} comandos sincronizados.`);
  console.log('🧹 Comandos antigos removidos automaticamente.');
}

async function main() {
  try {
    for (const command of commands) {
      bot.commands.set(command.data.name, command);
    }

    // Registra o handler ANTES de start() para não perder o evento 'ready'
    bot.once('ready', async () => {
      await syncCommands();
    });

    await bot.start();

    startServer();

    console.log('🚀 Sistema iniciado!');
  } catch (error) {
    console.error('❌ Erro ao iniciar:', error);
    process.exit(1);
  }
}

main();
