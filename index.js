// importar_produtos_firestore.js
// Uso: node importar_produtos_firestore.js
//
// Lê a planilha (FILE_PATH) e salva no Firestore em:
// collection: PRODUTOS_COLLECTION
// docId: ID (coluna "ID")
// campos: sku, descricao, unidade, gtin (+ marca se existir)
//
// Atualiza via merge (não apaga campos existentes).

const XLSX = require("xlsx");
const admin = require("firebase-admin");
const path = require("path");

// ====== CONFIG ======
const FILE_PATH = "./produtos.xls"; // ou .xlsx

// Nome da coleção no Firestore
const PRODUTOS_COLLECTION = "produtos";

// Caminho da chave service account
const SERVICE_ACCOUNT_PATH = "./serviceAccountKey.json";

// nomes EXATOS das colunas do Excel
const COLS = {
  id: "ID",
  codigo: "Código (SKU)",
  descricao: "Descrição",
  unidade: "Unidade",
  gtin: "GTIN/EAN",

  // opcional (se existir na sua planilha)
  marca: "Marca",
};
// =====================

function initFirestore() {
  const serviceAccount = require(path.resolve(SERVICE_ACCOUNT_PATH));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin.firestore();
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function main() {
  console.log("Lendo planilha:", FILE_PATH);

  const workbook = XLSX.readFile(FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!linhas.length) {
    console.error("Nenhuma linha encontrada na planilha.");
    process.exit(1);
  }

  console.log(`Aba: ${sheetName} | ${linhas.length} linhas.\n`);
  console.log("Colunas detectadas na primeira linha:");
  console.log(Object.keys(linhas[0]));
  console.log("");

  const db = initFirestore();
  const colRef = db.collection(PRODUTOS_COLLECTION);

  let ok = 0;
  let ignorados = 0;
  let erro = 0;

  // Firestore batch limite: 500 writes
  const batches = chunkArray(linhas, 500);

  for (let b = 0; b < batches.length; b++) {
    const batch = db.batch();
    const chunk = batches[b];

    for (let i = 0; i < chunk.length; i++) {
      const row = chunk[i];

      const id = (row[COLS.id] || "").toString().trim();
      const sku = (row[COLS.codigo] || "").toString().trim();
      const descricao = (row[COLS.descricao] || "").toString().trim();
      const unidade = (row[COLS.unidade] || "").toString().trim();
      const gtin = (row[COLS.gtin] || "").toString().trim();

      // marca é opcional
      const marca = COLS.marca ? (row[COLS.marca] || "").toString().trim() : "";

      if (!id || !sku) {
        ignorados++;
        continue;
      }

      const docId = id; // pai principal
      const docRef = colRef.doc(docId);

      const payload = {
        sku,
        descricao,
        unidade,
        gtin,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // só salva marca se realmente existir/estiver preenchida
      if (marca) payload.marca = marca;

      // merge: true => atualiza sem apagar outros campos existentes
      batch.set(docRef, payload, { merge: true });
    }

    try {
      await batch.commit();
      ok += chunk.length;
      console.log(`✅ Batch ${b + 1}/${batches.length} gravado (${chunk.length} docs)`);
    } catch (e) {
      erro++;
      console.error(`❌ Erro no batch ${b + 1}:`, e.message);
    }
  }

  console.log("\n===== RESUMO =====");
  console.log("Linhas na planilha:", linhas.length);
  console.log("Ignorados (sem ID ou SKU):", ignorados);
  console.log("Batches com erro:", erro);
  console.log("Processados (tentados):", ok);
}

main().catch((e) => {
  console.error("Erro geral:", e);
  process.exit(1);
});
