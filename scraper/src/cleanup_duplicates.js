/**
 * Script de Higienização de Notícias Duplicadas no Supabase — Sobre o Povo
 * 
 * Uso:
 *   node src/cleanup_duplicates.js          # Executa a limpeza e exclusão das duplicatas
 *   node src/cleanup_duplicates.js --dry-run # Apenas lista o que seria removido
 */

import { createClient } from '@supabase/supabase-js';
import { areNewsDuplicates } from './dedup.js';

const isDryRun = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_KEY não configuradas.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runCleanup() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧹 HIGIENIZAÇÃO DE DUPLICATAS — SOBRE O POVO');
  console.log(`  Modo: ${isDryRun ? '🧪 DRY-RUN (simulação)' : '🚀 PRODUÇÃO'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Busca as últimas 60 notícias
  const { data: news, error } = await supabase
    .from('noticias')
    .select('id, title, slug, summary, content, image, date, category')
    .order('date', { ascending: false })
    .limit(80);

  if (error || !news) {
    console.error('❌ Falha ao buscar notícias do banco:', error?.message);
    process.exit(1);
  }

  console.log(`📊 Analisando as últimas ${news.length} notícias publicadas...\n`);

  const toKeep = [];
  const toDelete = [];

  for (const article of news) {
    let duplicateWith = null;

    for (const kept of toKeep) {
      const check = areNewsDuplicates(article, kept);
      if (check.isDuplicate) {
        duplicateWith = { kept, reason: check.reason };
        break;
      }
    }

    if (duplicateWith) {
      // Já temos uma matéria sobre este fato
      // Avalia se o artigo atual é melhor (tem foto não padrão ou texto mais longo)
      const hasBetterImage = article.image && !article.image.includes('logosemfundo') && duplicateWith.kept.image && duplicateWith.kept.image.includes('logosemfundo');
      const hasLongerContent = (article.content || '').length > (duplicateWith.kept.content || '').length * 1.3;

      if (hasBetterImage || hasLongerContent) {
        // Substitui a que estava marcada para manter
        toDelete.push({
          id: duplicateWith.kept.id,
          title: duplicateWith.kept.title,
          slug: duplicateWith.kept.slug,
          keptTitle: article.title,
          reason: duplicateWith.reason,
        });
        const index = toKeep.findIndex(k => k.id === duplicateWith.kept.id);
        toKeep[index] = article;
      } else {
        toDelete.push({
          id: article.id,
          title: article.title,
          slug: article.slug,
          keptTitle: duplicateWith.kept.title,
          reason: duplicateWith.reason,
        });
      }
    } else {
      toKeep.push(article);
    }
  }

  console.log(`🔍 Resultado da Análise:`);
  console.log(`   Matérias únicas mantidas: ${toKeep.length}`);
  console.log(`   Duplicatas identificadas para remoção: ${toDelete.length}\n`);

  if (toDelete.length === 0) {
    console.log('✅ Nenhuma notícia duplicada encontrada.');
    process.exit(0);
  }

  console.log('📋 Notícias duplicadas detectadas:');
  for (const item of toDelete) {
    console.log(`  ❌ [REMOVER] "${item.title}"`);
    console.log(`     ↳ Mantendo: "${item.keptTitle}"`);
    console.log(`     ↳ Motivo: ${item.reason}`);
    console.log(`     ↳ ID: ${item.id}\n`);
  }

  if (isDryRun) {
    console.log('🧪 Modo dry-run: Nenhuma notícia foi excluída do banco.');
    process.exit(0);
  }

  console.log(`🗑️  Excluindo ${toDelete.length} notícias duplicadas do Supabase...`);
  const idsToDelete = toDelete.map(d => d.id);

  const { error: delError } = await supabase
    .from('noticias')
    .delete()
    .in('id', idsToDelete);

  if (delError) {
    console.error('❌ Falha ao excluir duplicatas:', delError.message);
    process.exit(1);
  }

  console.log('✅ Todas as notícias duplicadas foram removidas com sucesso do portal!\n');
}

runCleanup();
