import { Client, GatewayIntentBits, Collection, type Interaction } from 'discord.js';
import dotenv from 'dotenv';
import { VoiceRecorder } from '../voice/recorder.ts';
import { initDB } from '../database/db.ts';

dotenv.config();

export class DiscordBot extends Client {
  public commands: Collection<string, any> = new Collection();
  public recorder: VoiceRecorder;
  public activeRecordings: Map<string, any> = new Map();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.recorder = new VoiceRecorder();
  }

  async start() {
    await initDB();

    this.on('ready', () => {
      console.log(`Logged in as ${this.user?.tag}!`);
    });

    this.on('interactionCreate', async (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, this);
      } catch (error) {
        console.error(error);

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: 'There was an error executing this command!',
          });
        } else {
          await interaction.reply({
            content: 'There was an error executing this command!',
            flags: 64, // equivalente a mensagem privada (ephemeral)
          });
        }
      }
    });

    await this.login(process.env.DISCORD_TOKEN);
  }
}
