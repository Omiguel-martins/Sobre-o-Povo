#!/usr/bin/env node
/**
 * Sobre o Povo — Orquestrador do Pipeline de Scraping Autônomo
 *
 * Uso:
 *   node src/index.js              # Executa o pipeline completo em produção
 *   node src/index.js --dry-run    # Simula todo o fluxo sem gravar dados reais
 *
 * Variáveis de ambiente obrigatórias (exceto no --dry-run):
 *   GEMINI_API_KEY         — Chave da API do Google Gemini
 *   SUPABASE_URL           — URL do projeto Supabase
 *   SUPABASE_SERVICE_KEY   — Service Role Key do Supabase
 */

import { collectNews } from './collect.js';
import { rewriteArticles } from './rewrite.js';
import { publishArticles } from './publish.js';

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📰 SOBRE O POVO — Scraper Autônomo de Notícias');
  console.log(`  Modo: ${isDryRun ? '🧪 DRY-RUN (simulação)' : '🚀 PRODUÇÃO'}`);
  console.log(`  Horário: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!isDryRun) {
    // Valida variáveis de ambiente obrigatórias antes de iniciar
    const required = ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.error(`❌ Variáveis de ambiente ausentes: ${missing.join(', ')}`);
      console.error('   Configure-as antes de rodar o pipeline em produção.');
      process.exit(1);
    }
  }

  try {
    // ── FASE 1: Coleta ───────────────────────────────────────────
    const rawArticles = await collectNews();

    if (rawArticles.length === 0) {
      console.log('\n⚠️  Nenhum artigo coletado. Encerrando pipeline.');
      process.exit(0);
    }

    // ── FASE 2: Reescrita (Gemini) ───────────────────────────────
    const rewrittenArticles = await rewriteArticles(rawArticles, isDryRun);

    if (rewrittenArticles.length === 0) {
      console.log('\n⚠️  Nenhum artigo foi reescrito. Encerrando pipeline.');
      process.exit(0);
    }

    // ── FASE 3: Publicação (Supabase) ────────────────────────────
    const stats = await publishArticles(rewrittenArticles, isDryRun);

    // ── RESUMO FINAL ──────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✅ Pipeline concluído com sucesso!');
    console.log(`  ⏱️  Tempo total: ${elapsed}s`);
    console.log(`  📦 Coletados: ${rawArticles.length} artigos`);
    console.log(`  ✍️  Reescritos: ${rewrittenArticles.length} artigos`);
    if (!isDryRun) {
      console.log(`  🚀 Publicados: ${stats.published} | Duplicados: ${stats.skipped} | Erros: ${stats.errors}`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Erro crítico no pipeline:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
