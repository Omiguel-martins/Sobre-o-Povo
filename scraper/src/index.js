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
import { publishArticles, createSupabaseClient, isDuplicate } from './publish.js';

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

    // ── FASE DE DEDUPLICAÇÃO PRÉVIA & LIMITAÇÃO DE COTA ───────────
    let articlesToProcess = [];
    if (isDryRun) {
      // No dry-run simulamos apenas com os primeiros 3 artigos coletados
      articlesToProcess = rawArticles.slice(0, 3);
      console.log(`\n🧪 [DRY-RUN] Processando lote simulado de ${articlesToProcess.length} artigos.`);
    } else {
      console.log('\n🔍 Verificando duplicidade com o Supabase antes de iniciar reescrita...');
      const supabase = createSupabaseClient();
      const uniqueArticles = [];
      
      for (const article of rawArticles) {
        // Evita duplicar links dentro do mesmo lote coletado
        const isAlreadyInArray = uniqueArticles.some(a => a.sourceUrl === article.sourceUrl);
        if (isAlreadyInArray) continue;

        const dup = await isDuplicate(supabase, '', article.sourceUrl);
        if (dup) {
          console.log(`  ⏭️  Já publicado: "${article.title.slice(0, 50)}..."`);
        } else {
          uniqueArticles.push(article);
        }
      }

      if (uniqueArticles.length === 0) {
        console.log('\n⚠️  Todas as notícias coletadas já existem no banco. Encerrando pipeline.');
        process.exit(0);
      }

      // Processa todas as matérias inéditas encontradas a pedido do usuário
      articlesToProcess = uniqueArticles;
      console.log(`\n📌 Matérias novas encontradas: ${uniqueArticles.length}. Processando a reescrita e publicação de todas as ${articlesToProcess.length} matérias.`);
    }

    // ── FASE 2: Reescrita (Gemini) ───────────────────────────────
    const rewrittenArticles = await rewriteArticles(articlesToProcess, isDryRun);

    if (rewrittenArticles.length === 0) {
      console.log('\n⚠️  Nenhum artigo foi reescrito nesta execução. Encerrando pipeline.');
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

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erro crítico no pipeline:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
