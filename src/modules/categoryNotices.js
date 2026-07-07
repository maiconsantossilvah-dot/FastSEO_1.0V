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
];

export function getCategoryNotice(key) {
  return CATEGORY_NOTICE_OPTIONS.find(item => item.key === key) || CATEGORY_NOTICE_OPTIONS[0];
}