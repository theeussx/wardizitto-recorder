import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import { DiscordBot } from '../bot/client.ts';
import { getIO } from '../events.ts';

export const command = {
  data: new SlashCommandBuilder()
    .setName('gravar')
    .setDescription('Inicia a gravação do canal de voz atual'),

  async execute(interaction: ChatInputCommandInteraction, client: DiscordBot) {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Você precisa estar em um canal de voz!', ephemeral: true });
    }

    if (client.activeRecordings.has(voiceChannel.guild.id)) {
      return interaction.reply({ content: '❌ Já existe uma gravação em andamento neste servidor!', ephemeral: true });
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      const session = client.recorder.startSession(connection, voiceChannel.guild.id);

      client.activeRecordings.set(voiceChannel.guild.id, {
        session,
        connection,
        channelId: voiceChannel.id,
      });

      const memberNames = voiceChannel.members
        .filter(m => !m.user.bot)
        .map(m => m.user.username)
        .join(', ');

      await interaction.reply(
        `🎙️ Gravando em **${voiceChannel.name}**!\n` +
        `👥 Presentes: ${memberNames || 'nenhum ainda'}\n` +
        `Use \`/parar\` para encerrar.`
      );

      getIO().emit('recording:start', { guildId: voiceChannel.guild.id });
    } catch (error) {
      console.error(error);
      connection.destroy();
      await interaction.reply({ content: '❌ Falha ao entrar no canal de voz.', ephemeral: true });
    }
  },
};
