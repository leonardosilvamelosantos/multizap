# MultiZap WhatsApp API

Aplicação Multi-Tenant para conectar múltiplos WhatsApps usando Baileys.

## 🚀 Instalação

```bash
npm install
```

## 📱 Como usar

### 1. Iniciar a aplicação
```bash
npm start
```

### 2. Criar um tenant
```bash
curl -X POST http://localhost:3000/api/tenants/create \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "cliente1"}'
```

### 3. Verificar status do tenant
```bash
curl http://localhost:3000/api/tenants/cliente1/status
```

### 4. Enviar mensagem
```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "cliente1",
    "to": "5511999999999@s.whatsapp.net",
    "message": "Olá! Esta é uma mensagem de teste."
  }'
```

### 5. Enviar mídia
```bash
curl -X POST http://localhost:3000/api/messages/send-media \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "cliente1",
    "to": "5511999999999@s.whatsapp.net",
    "media": {
      "type": "image",
      "url": "https://example.com/image.jpg"
    },
    "caption": "Legenda da imagem"
  }'
```

## 🔧 Funcionalidades

- ✅ Múltiplos WhatsApps simultâneos
- ✅ Isolamento completo entre tenants
- ✅ QR Code para autenticação
- ✅ Reconexão automática
- ✅ API REST para controle
- ✅ Tratamento de erro 515
- ✅ Envio de mensagens de texto
- ✅ Envio de mídia (imagem, vídeo, áudio, documento)
- ✅ Obtenção de mensagens de chat

## 📋 Endpoints

### Tenants
- `POST /api/tenants/create` - Criar novo tenant
- `GET /api/tenants` - Listar todos os tenants
- `GET /api/tenants/:id/status` - Status de um tenant
- `GET /api/tenants/:id/qr` - QR Code de um tenant
- `DELETE /api/tenants/:id` - Remover tenant

### Mensagens
- `POST /api/messages/send` - Enviar mensagem de texto
- `POST /api/messages/send-media` - Enviar mensagem com mídia
- `GET /api/messages/:tenantId/chat/:chatId` - Obter mensagens de um chat

## ⚙️ Configuração

### Variáveis de Ambiente
- `PORT` - Porta do servidor (padrão: 3000)
- `NODE_ENV` - Ambiente de execução (padrão: development)

### Estrutura de Diretórios
```
src/
├── index.js                 # Arquivo principal
├── whatsapp/
│   └── WhatsAppManager.js   # Gerenciador de WhatsApp
└── routes/
    ├── index.js            # Rotas principais
    ├── tenant.js           # Rotas de tenants
    └── message.js          # Rotas de mensagens
```

## 🔒 Segurança

- Cada tenant possui seu próprio estado de autenticação
- Isolamento completo entre instâncias
- Tratamento de erros de conexão
- Logs detalhados para monitoramento

## 💻 Exemplos de Uso

### JavaScript/Node.js
```javascript
// Criar tenant
const response = await fetch('http://localhost:3000/api/tenants/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenantId: 'meu-cliente' })
});

// Enviar mensagem
const messageResponse = await fetch('http://localhost:3000/api/messages/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'meu-cliente',
    to: '5511999999999@s.whatsapp.net',
    message: 'Olá!'
  })
});
```

### Python
```python
import requests

# Criar tenant
response = requests.post('http://localhost:3000/api/tenants/create', 
                        json={'tenantId': 'meu-cliente'})

# Enviar mensagem
message_response = requests.post('http://localhost:3000/api/messages/send',
                                json={
                                    'tenantId': 'meu-cliente',
                                    'to': '5511999999999@s.whatsapp.net',
                                    'message': 'Olá!'
                                })
```

## 🐛 Solução de Problemas

### Erro 515
- O erro 515 é tratado automaticamente
- Tenants com erro 515 são removidos automaticamente
- Reconexão automática para outros erros

### QR Code não aparece
- Verifique se o tenant foi criado corretamente
- Aguarde alguns segundos para o QR Code aparecer
- Verifique os logs do terminal

### Mensagens não são enviadas
- Verifique se o tenant está conectado
- Confirme se o número está no formato correto
- Verifique os logs para erros específicos

## 📄 Licença

MIT
