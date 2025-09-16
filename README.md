# 🚀 MultiZap - Dashboard Unificado

Sistema Multi-Tenant para WhatsApp com dashboard moderno e funcional.

## ✨ Funcionalidades

- 🎯 **Dashboard Moderno** - Interface Bootstrap 5 responsiva
- 📱 **Múltiplas Instâncias** - Gerencie vários WhatsApp simultaneamente  
- 🔄 **Reconexão Automática** - Reconexão inteligente com delays progressivos
- 📊 **Estatísticas em Tempo Real** - Monitoramento de instâncias
- 💬 **Envio de Mensagens** - Interface integrada para envio
- 🧪 **Teste Rápido** - Modal especializado para testes
- 📱 **QR Code Automático** - Geração e exibição de QR codes
- 🤖 **Bot Automático** - Resposta automática com gatilho `!bot`

## 🚀 Como Usar

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar Aplicação

**Opção 1 - Comando direto:**
```bash
npm start
```

**Opção 2 - Script automático (Windows):**
```bash
start-server.bat
```

**⚠️ Se der erro de porta em uso:**
```bash
# Windows - Finalizar processo na porta 3000
netstat -ano | findstr :3000
taskkill /PID [PID_NUMBER] /F

# Ou use o script automático
stop-server.bat
```

### 3. Acessar Dashboard
```
http://localhost:3000/dashboard-unified.html
```

## 📁 Estrutura do Projeto

```
multizap-unified/
├── src/
│   ├── index.js                    # Servidor principal
│   ├── routes/
│   │   └── instances.js            # API de instâncias
│   └── whatsapp/
│       ├── InstanceManager.js      # Gerenciador de instâncias
│       └── WhatsAppInstanceUnified.js # Instância WhatsApp
├── public/
│   └── dashboard-unified.html      # Dashboard principal
├── sessions/                       # Sessões WhatsApp (auto-criado)
├── package.json
└── README.md
```

## 🔧 API Endpoints

- `GET /api/instances` - Listar instâncias
- `POST /api/instances/{tenantId}/connect` - Criar instância
- `GET /api/instances/{tenantId}/qr` - Obter QR code
- `POST /api/instances/{tenantId}/send` - Enviar mensagem
- `DELETE /api/instances/{tenantId}/disconnect` - Desconectar instância

## 🎯 Status das Instâncias

- 🟢 **Verde**: Conectado e funcionando
- 🟡 **Amarelo**: Conectando
- 🔵 **Azul**: Aguardando QR Code
- 🔴 **Vermelho**: Desconectado

## 📱 Como Criar Instância

1. Acesse o dashboard
2. Clique em "Nova Instância"
3. Digite um ID único (ex: `cliente1`)
4. Clique em "Criar Instância"
5. Escaneie o QR Code que aparece
6. Aguarde a conexão (status verde)

## 💬 Como Enviar Mensagem

1. Aguarde a instância conectar (status verde)
2. Clique em "Enviar" na instância
3. Digite o número: `5511999999999@s.whatsapp.net`
4. Digite sua mensagem
5. Clique em "Enviar Mensagem"

## 🧪 Teste Rápido

1. Clique em "Teste" na instância conectada
2. Digite apenas o número: `11999999999`
3. Use a mensagem automática ou personalize
4. Clique em "Enviar Teste"

## 🤖 Bot Automático

O MultiZap inclui um bot simples que responde automaticamente a mensagens:

### Como Usar o Bot

1. **Conecte uma instância** no dashboard
2. **Envie a mensagem** `!bot` para qualquer número
3. **Receba a resposta automática**: "Olá mundo! 👋 Sou o bot do MultiZap e estou funcionando perfeitamente!"

### Gatilhos Disponíveis

- `!bot` - Resposta automática "Olá mundo!"

### Funcionamento

- ✅ **Detecção automática** de mensagens recebidas
- ✅ **Resposta instantânea** quando detecta o gatilho
- ✅ **Funciona em todas as instâncias** conectadas
- ✅ **Logs detalhados** no console do servidor

## ⚙️ Configurações

- **Porta**: 3000 (configurável via PORT env)
- **Máximo de instâncias**: 10
- **Limpeza automática**: 30 minutos de inatividade
- **Atualização dashboard**: 10 segundos

## 🐛 Problemas Resolvidos

- ✅ QR Codes desnecessários após conexão
- ✅ Múltiplas instâncias simultâneas
- ✅ Reconexões desnecessárias
- ✅ Conexões intermitentes
- ✅ Interface não funcional

## 🔧 Troubleshooting

### Erro: Porta 3000 em uso

**Sintoma:** `EADDRINUSE: address already in use :::3000`

**Solução:**
1. **Usar script automático:**
   ```bash
   stop-server.bat
   start-server.bat
   ```

2. **Solução manual:**
   ```bash
   # Verificar qual processo está usando a porta
   netstat -ano | findstr :3000
   
   # Finalizar o processo (substitua [PID] pelo número encontrado)
   taskkill /PID [PID] /F
   
   # Iniciar novamente
   npm start
   ```

3. **Usar porta diferente:**
   ```bash
   # Definir variável de ambiente
   set PORT=3001
   npm start
   ```

### Bot não responde

**Verificações:**
1. ✅ Instância está conectada (status verde)
2. ✅ Mensagem enviada é exatamente `!bot`
3. ✅ Verificar logs no console do servidor
4. ✅ Testar com número diferente

### Dashboard não carrega

**Verificações:**
1. ✅ Servidor está rodando na porta 3000
2. ✅ Acessar URL correta: `http://localhost:3000/dashboard-unified.html`
3. ✅ Verificar se não há firewall bloqueando
4. ✅ Testar em navegador diferente

## 📄 Licença

MIT