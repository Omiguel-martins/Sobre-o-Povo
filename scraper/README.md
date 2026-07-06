# Sobre o Povo — Scraper de Notícias

## Configuração Rápida

### 1. Variáveis de Ambiente
Antes de rodar o pipeline (localmente ou no GitHub Actions), configure as seguintes variáveis:

| Variável | Descrição |
|----------|-----------|
| `GEMINI_API_KEY` | Chave da API do Google Gemini (Google AI Studio) |
| `SUPABASE_URL` | URL do seu projeto Supabase (ex: `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | **Service Role Key** do Supabase (NOT a anon key) |

### 2. Instalação local
```bash
cd scraper
npm install
```

### 3. Teste local (sem gravar dados reais)
```bash
# Roda a suite de testes unitários
npm test

# Roda o pipeline completo em modo simulação
npm run dry-run
```

### 4. Execução em produção (local)
```bash
# Configure as variáveis de ambiente primeiro:
export GEMINI_API_KEY="sua-chave-aqui"
export SUPABASE_URL="https://wnvpkbddmhnznybvmqam.supabase.co"
export SUPABASE_SERVICE_KEY="sua-service-key-aqui"

npm start
```

---

## Configuração no GitHub Actions (Automação)

1. Acesse seu repositório em: `https://github.com/Omiguel-martins/Sobre-o-Povo`
2. Vá em **Settings → Secrets and variables → Actions**
3. Clique em **New repository secret** e adicione:
   - `GEMINI_API_KEY` — sua chave do Google Gemini
   - `SUPABASE_URL` — `https://wnvpkbddmhnznybvmqam.supabase.co`
   - `SUPABASE_SERVICE_KEY` — sua Service Role Key (encontrada em Supabase → Settings → API)
4. Faça commit e push de todos os arquivos do `scraper/` e `.github/` para o branch `main`.
5. O workflow será executado automaticamente **4 vezes ao dia** (06h, 11h, 15h e 20h no horário de Cuiabá).

Para acionar manualmente: vá em **Actions → Scraper Autônomo → Run workflow**.

---

## Estrutura de Arquivos
```
scraper/
├── package.json        — Dependências Node.js
├── src/
│   ├── index.js        — Orquestrador CLI principal
│   ├── collect.js      — Módulo de raspagem multicanais
│   ├── rewrite.js      — Módulo de reescrita com Gemini
│   └── publish.js      — Módulo de publicação no Supabase
└── tests/
    └── test.js         — Suite de testes (dry-run)

.github/
└── workflows/
    └── scraper.yml     — Workflow do GitHub Actions
```

## Fluxo do Pipeline
```
collectNews() → rewriteArticles() → publishArticles()
    ↓                  ↓                    ↓
Raspagem dos       Reescrita com        Upload da imagem
portais MT         API do Gemini        + Inserção no Supabase
(4 portais)        (sem plágio)         (verificação de duplicidade)
```

## Obtendo a Service Role Key do Supabase
1. Acesse `https://supabase.com/dashboard`
2. Selecione o projeto `wnvpkbddmhnznybvmqam`
3. Vá em **Settings → API**
4. Copie a chave em **service_role** (NUNCA use a `anon` key para operações de servidor)

## Obtendo a Chave do Google Gemini
1. Acesse `https://aistudio.google.com/app/apikey`
2. Clique em **Create API Key**
3. Copie e salve a chave gerada
