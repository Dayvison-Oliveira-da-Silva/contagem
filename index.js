// importar_produtos.js
// Uso: node importar_produtos.js
//
// Lê a planilha Excel fixa em FILE_PATH e envia para o
// Realtime Database em: /<marca>/<codigo>/
//
// Atualiza apenas:
//   - descricao
//   - unidade
//   - codBar (GTIN/EAN)
// Não mexe em: estoque, statusContagem, etc.

const XLSX = require("xlsx");
const axios = require("axios");

// ========== CONFIGURAÇÕES ==========

// URL base do seu RTDB
const FIREBASE_BASE =
  "https://gerenciador-shelf-dental-med-default-rtdb.firebaseio.com";

// Caminho fixo da planilha (na mesma pasta do script)
const FILE_PATH = "./produtos.xls";

// nomes EXATOS das colunas do Excel (ajuste se necessário)
const COLS = {
  marca: "Marca",
  codigo: "Código (SKU)",   // confira no log e ajuste se o cabeçalho for diferente
  descricao: "Descrição",
  unidade: "Unidade",
  gtin: "GTIN/EAN",
};

// ===================================

async function main() {
  console.log("Lendo planilha:", FILE_PATH);

  // Lê o arquivo Excel (primeira aba)
  const workbook = XLSX.readFile(FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!linhas.length) {
    console.error("Nenhuma linha encontrada na planilha.");
    process.exit(1);
  }

  console.log(`Aba: ${sheetName} | ${linhas.length} linhas de produto.\n`);

  console.log("Colunas detectadas na primeira linha:");
  console.log(Object.keys(linhas[0]));
  console.log(
    "\nSe algum nome não bater com COLS ali em cima, ajuste e rode de novo.\n"
  );

  let ok = 0;
  let erro = 0;

  for (let i = 0; i < linhas.length; i++) {
    const row = linhas[i];

    const marca    = (row[COLS.marca]    || "").toString().trim();
    const codigo   = (row[COLS.codigo]   || "").toString().trim();
    const descricao= (row[COLS.descricao]|| "").toString().trim();
    const unidade  = (row[COLS.unidade]  || "").toString().trim();
    const gtin     = (row[COLS.gtin]     || "").toString().trim();

    if (!marca || !codigo) {
      console.log(
        `(${i + 1}) [IGNORADO] Linha sem Marca ou Código. Marca="${marca}" Código="${codigo}"`
      );
      continue;
    }

    const marcaKey = marca.toLowerCase();   // "GOLGRAN" -> "golgran"
    const skuKey   = codigo;               // "44-1"

    const url = `${FIREBASE_BASE}/${encodeURIComponent(
      marcaKey
    )}/${encodeURIComponent(skuKey)}.json`;

    const payload = {
      descricao,
      unidade,
      codBar: gtin,
    };

    try {
      await axios.patch(url, payload);
      ok++;
      console.log(
        `(${i + 1}) ✅ ${marcaKey}/${skuKey} atualizado. EAN=${gtin || "-"}`
      );
    } catch (err) {
      erro++;
      console.error(
        `(${i + 1}) ❌ ERRO em ${marcaKey}/${skuKey}:`,
        err.response?.data || err.message
      );
    }
  }

  console.log("\n===== RESUMO =====");
  console.log("Sucesso:", ok);
  console.log("Erros:  ", erro);
}

main().catch((e) => {
  console.error("Erro geral:", e);
  process.exit(1);
});
