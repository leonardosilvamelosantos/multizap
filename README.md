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

## 🚀 Como Usar

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar Aplicação
```bash
npm start
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

## 📄 Licença

MIT