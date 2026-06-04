import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { DiscordBot } from '../bot/client.ts';
import pool from '../database/db.ts';
import path from 'path';
import { getIO } from '../events.ts';

export const command = {
  data: new SlashCommandBuilder()
    .setName('parar')
    .setDescription('Para a gravação atual e salva os arquivos'),

  async execute(interaction: ChatInputCommandInteraction, client: DiscordBot) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const rec = client.activeRecordings.get(guildId);
    if (!rec) {
      return interaction.reply({ content: '❌ Não há nenhuma gravação em andamento neste servidor.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const result = await client.recorder.stopSession(guildId);
      rec.connection.destroy();
      client.activeRecordings.delete(guildId);

      if (result.mp3Files.length > 1) {
        try {
          await client.recorder.mixToSingle(result.mp3Files, result.mixedMp3Path!);
        } catch (err) {
          console.error('[stop] mix error:', err);
        }
      }

      for (const mp3Path of result.mp3Files) {
        await pool.query(
          `INSERT INTO recordings (filename, duration, size, participants, guild_id, channel_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [path.basename(mp3Path), result.duration, 0, JSON.stringify(result.participants), guildId, rec.channelId]
        );
      }

      const dur = `${Math.floor(result.duration / 60)}:${String(result.duration % 60).padStart(2, '0')}`;
      await interaction.editReply(
        `✅ Gravação encerrada!\n` +
        `⏱️ Duração: ${dur}\n` +
        `👥 Participantes: ${result.participants.length}\n` +
        `📁 Arquivos: ${result.mp3Files.length} individual(is)` +
        (result.mp3Files.length > 1 ? ` + 1 mix` : '')
      );

      getIO().emit('recording:stop', { guildId });
    } catch (err) {
      console.error('[stop] error:', err);
      await interaction.editReply('❌ Erro ao encerrar a gravação.');
    }
  },
};
