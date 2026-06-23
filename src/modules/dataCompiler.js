function buildTxt() {
  const codigo = getValue('compilerCodigo');
  const titulo = getValue('compilerTitulo');
  const ean = getValue('compilerEan');
  const fornecedor = getValue('compilerFornecedor');

  const parts = [
    codigo,
    titulo,
    `EAN: ${ean}`,
    `Fornecedor: ${fornecedor}`,
  ];

  addSection(parts, 'Ficha M3', getValue('compilerFichaM3'));
  addSection(parts, 'Site do Fornecedor', getValue('compilerSiteFornecedor'));
  addSection(parts, 'Placeholder', getValue('compilerPlaceholder'));
  addSection(parts, 'Simplus', getValue('compilerSimplus'));
  addSection(parts, 'E-mail do Fornecedor', getValue('compilerEmailFornecedor'));

  return parts.join('\n');
}