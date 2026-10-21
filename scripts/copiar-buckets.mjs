/**
 * Copia os arquivos dos buckets de um projeto do Supabase para outro
 * (docs/MUDAR-REGIAO.md, passo 4). A lista de arquivos (storage.objects)
 * já foi para o banco novo no dump; aqui vão os bytes.
 *
 *   node --env-file=.env.migracao scripts/copiar-buckets.mjs
 *
 * Precisa de ANTIGO_URL, ANTIGO_SERVICE_ROLE_KEY, NOVO_URL e
 * NOVO_SERVICE_ROLE_KEY. Cria no destino o bucket que faltar (com a mesma
 * visibilidade do de origem), copia arquivo por arquivo com o mesmo tipo e
 * pula o que já existe com o mesmo tamanho: pode rodar de novo à vontade.
 */
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["midia-whatsapp", "importacoes"];

function obrigatoria(nome) {
  const v = process.env[nome];
  if (!v) {
    console.error(`Falta ${nome} no ambiente (--env-file=.env.migracao).`);
    process.exit(1);
  }
  return v;
}

const antigo = createClient(obrigatoria("ANTIGO_URL"), obrigatoria("ANTIGO_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const novo = createClient(obrigatoria("NOVO_URL"), obrigatoria("NOVO_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

/** Todos os arquivos de um bucket, pasta por pasta (a listagem é por nível). */
async function listar(cliente, bucket, pasta = "") {
  const arquivos = [];
  let pagina = 0;
  const POR_PAGINA = 1000;
  for (;;) {
    const { data, error } = await cliente.storage.from(bucket).list(pasta, {
      limit: POR_PAGINA,
      offset: pagina * POR_PAGINA,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`listar ${bucket}/${pasta}: ${error.message}`);
    for (const item of data ?? []) {
      const caminho = pasta ? `${pasta}/${item.name}` : item.name;
      // Pasta vem sem id e sem metadata; arquivo vem com os dois.
      if (item.id === null || item.id === undefined) {
        arquivos.push(...(await listar(cliente, bucket, caminho)));
      } else {
        arquivos.push({
          caminho,
          tamanho: item.metadata?.size ?? null,
          tipo: item.metadata?.mimetype ?? "application/octet-stream",
        });
      }
    }
    if (!data || data.length < POR_PAGINA) break;
    pagina += 1;
  }
  return arquivos;
}

async function garantirBucket(bucket) {
  const { data: origem } = await antigo.storage.getBucket(bucket);
  if (!origem) {
    console.log(`· ${bucket}: não existe na origem, pulando.`);
    return false;
  }
  const { data: destino } = await novo.storage.getBucket(bucket);
  if (!destino) {
    const { error } = await novo.storage.createBucket(bucket, {
      public: origem.public,
      fileSizeLimit: origem.file_size_limit ?? undefined,
      allowedMimeTypes: origem.allowed_mime_types ?? undefined,
    });
    if (error) throw new Error(`criar bucket ${bucket}: ${error.message}`);
    console.log(`· ${bucket}: criado no destino (${origem.public ? "público" : "privado"}).`);
  }
  return true;
}

let copiados = 0;
let pulados = 0;
let falhas = 0;

for (const bucket of BUCKETS) {
  if (!(await garantirBucket(bucket))) continue;
  const [deLa, deCa] = await Promise.all([listar(antigo, bucket), listar(novo, bucket)]);
  const jaTem = new Map(deCa.map((a) => [a.caminho, a.tamanho]));
  console.log(`· ${bucket}: ${deLa.length} arquivos na origem, ${deCa.length} no destino.`);

  for (const arquivo of deLa) {
    if (jaTem.has(arquivo.caminho) && jaTem.get(arquivo.caminho) === arquivo.tamanho) {
      pulados += 1;
      continue;
    }
    try {
      const { data: blob, error: erroBaixar } = await antigo.storage
        .from(bucket)
        .download(arquivo.caminho);
      if (erroBaixar || !blob) throw new Error(erroBaixar?.message ?? "download vazio");
      const { error: erroSubir } = await novo.storage
        .from(bucket)
        .upload(arquivo.caminho, blob, { contentType: arquivo.tipo, upsert: true });
      if (erroSubir) throw new Error(erroSubir.message);
      copiados += 1;
      if (copiados % 50 === 0) console.log(`  ${copiados} copiados…`);
    } catch (e) {
      falhas += 1;
      console.error(`  falhou ${bucket}/${arquivo.caminho}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

console.log(`\nPronto: ${copiados} copiados, ${pulados} já estavam, ${falhas} falharam.`);
if (falhas > 0) {
  console.log("Rode de novo: só o que falhou é tentado outra vez.");
  process.exit(1);
}
