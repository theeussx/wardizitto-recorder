import {
SlashCommandBuilder,
ChatInputCommandInteraction,
EmbedBuilder
} from 'discord.js';

export const command = {
data: new SlashCommandBuilder()
.setName('ajuda')
.setDescription('Mostra os comandos disponíveis do bot'),

async execute(interaction: ChatInputCommandInteraction) {
const embed = new EmbedBuilder()
.setTitle('🎙️ Central de Ajuda')
.setDescription('Comandos disponíveis do bot de gravação:')
.addFields(
{
name: '/gravar',
value: 'Inicia a gravação do canal de voz em que você está.',
},
{
name: '/parar',
value: 'Encerra a gravação atual e salva os arquivos.',
},
{
name: '/ajuda',
value: 'Exibe esta mensagem de ajuda.',
}
)
.setFooter({
text: 'Discord Recorder Bot',
})
.setTimestamp();

await interaction.reply({
  embeds: [embed],
  ephemeral: true,
});

},
};
