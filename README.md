# 🎙️ Discord Voice Recorder System

Um sistema completo para gravar chamadas de voz no Discord, armazenar localmente e gerenciar através de um dashboard web moderno.

## 🚀 Tecnologias

- **Backend:** Node.js, TypeScript, Discord.js v14, @discordjs/voice, Express, MySQL, FFmpeg.
- **Frontend:** React, Vite, TypeScript, TailwindCSS, Lucide-React.
- **Outros:** WebSocket (Socket.io), Prism-Media.

## 📁 Estrutura do Projeto

- `/src/bot`: Núcleo do bot Discord.
- `/src/commands`: Comandos Slash do bot (/gravar, /parar, etc).
- `/src/voice`: Lógica de captura e processamento de áudio.
- `/src/database`: Conexão e modelos do MySQL.
- `/src/server`: API REST e WebSocket.
- `/dashboard`: Painel web em React.

## 🛠️ Instalação (Linux / VPS)

1. **Dependências do Sistema:**
   \`\`\`bash
   sudo apt update
   sudo apt install ffmpeg mysql-server -y
   \`\`\`

2. **Configurar Banco de Dados:**
   \`\`\`sql
   CREATE DATABASE discord_recorder;
   \`\`\`

3. **Configurar Variáveis de Ambiente:**
   - Renomeie \`.env.example\` para \`.env\` e preencha com seus dados.

4. **Instalar Dependências e Rodar:**
   \`\`\`bash
   pnpm install
   pnpm run build
   pnpm start
   \`\`\`

## 📱 Instalação (Samsung S20 / Termux)

1. **Preparar Ambiente:**
   \`\`\`bash
   pkg update && pkg upgrade
   pkg install nodejs-lts ffmpeg mariadb python -y
   \`\`\`

2. **Iniciar MySQL (MariaDB):**
   \`\`\`bash
   mysqld_safe &
   mysql -u root -e "CREATE DATABASE discord_recorder;"
   \`\`\`

3. **Instalar e Rodar:**
   - Siga os mesmos passos da instalação Linux.

## 🤖 Comandos do Bot

- \`/gravar\`: Entra no canal de voz e inicia a gravação.
- \`/parar\`: Encerra a gravação e salva o arquivo MP3.
- \`/status\`: Exibe informações sobre o uso de armazenamento.
- \`/listar\`: Lista as últimas gravações.

## 📄 Licença
Este projeto foi desenvolvido para fins demonstrativos.
