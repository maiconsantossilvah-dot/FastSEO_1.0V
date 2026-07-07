export const CATEGORY_NOTICE_OPTIONS = [
  { key: 'normal', label: 'Normal', text: '' },
  {
    key: 'bebida_alcoolica',
    label: 'Bebida Alcoólica',
    text: 'É Proibida A Venda e O Consumo de Bebidas Alcoólicas Para Menores de 18 Anos\nSe Beber Não Dirija',
  },
  {
    key: 'composto_lacteo',
    label: 'Composto Lácteo',
    text: 'O aleitamento materno é fundamental para o desenvolvimento saudável do bebê. Ele fortalece o sistema imunológico, promove o vínculo afetivo e oferece todos os nutrientes necessários para o crescimento.',
  },
  {
    key: 'item_sortido',
    label: 'Item Sortido',
    text: 'Esse produto vem em cores e modelos variados sem opção de escolha especifica',
  },

  {
    key: 'produto_grande',
    label: 'Produto Grande',
    text: 'Confira as dimensões do produto e certifique-se de que estão adequadas aos elevadores, portas e corredores do local de entrega, pois não fazemos a montagem e desmontagem do produto ou de portas e janelas para entrega de produtos, bem como içamento por fora de prédio ou transporte por escada quando oferecer risco para o produto e entregadores.'
  },

  {
    key: 'bicicleta_eletrica',
    label: 'Bicicleta Elétrica',
    text: 'Montagens e custos relacionados a montagem são de responsabilidade do cliente.'
  },
];

export function getCategoryNotice(key) {
  return CATEGORY_NOTICE_OPTIONS.find(item => item.key === key) || CATEGORY_NOTICE_OPTIONS[0];
}