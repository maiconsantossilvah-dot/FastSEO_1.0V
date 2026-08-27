import { fieldListToText } from '../../modules/categoryQaSchema.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function categoryStatusLabel(status) {
  return status === 'draft' ? 'Rascunho'
    : status === 'archived' ? 'Arquivada'
      : status === 'legacy' ? 'Legada' : 'Publicada';
}

export function modalShellHtml(canManage) {
  return `
    <div class="modal modal--cats">
      <div class="modal-hdr">
        <span class="modal-title"><i data-lucide="tags" aria-hidden="true"></i> Categorias de referência</span>
        <button class="modal-close" id="catsModalClose" type="button" aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div class="cats-layout">
        <div class="cats-list-col">
          <div class="cats-search-row">
            <input type="text" id="catsBusca" placeholder="Buscar categoria..." autocomplete="off"/>
            <button class="btn btn-primary" id="catsAddBtn" type="button"${canManage ? '' : ' hidden'}><i data-lucide="plus" aria-hidden="true"></i> Nova</button>
          </div>
          <div class="cats-list" id="catsList"></div>
          <div class="cats-list-footer" id="catsFooter"></div>
        </div>
        <div class="cats-editor-col" id="catsEditor">${emptyEditorHtml(canManage)}</div>
      </div>
      <div class="modal-ftr cats-catalog-footer">
        <div class="cats-catalog-actions"${canManage ? '' : ' hidden'}>
          <button class="btn btn-ghost" id="catsExportBtn" type="button"><i data-lucide="download" aria-hidden="true"></i> Backup</button>
          <button class="btn btn-ghost" id="catsMigrateBtn" type="button"><i data-lucide="database-backup" aria-hidden="true"></i> Migrar legado</button>
          <button class="btn btn-ghost" id="catsImportBtn" type="button"><i data-lucide="file-up" aria-hidden="true"></i> Importar JSON</button>
          <input id="catsImportFile" type="file" accept="application/json,.json" hidden/>
        </div>
        <span class="modal-saved" id="catsSavedMsg">Salvo</span>
        <button class="btn btn-primary" id="catsModalClose2">Fechar</button>
      </div>
    </div>`;
}

export function emptyEditorHtml(canManage = false) {
  return `<div class="cats-editor-empty ui-empty-state">
    <i data-lucide="tags" aria-hidden="true"></i>
    <strong>Configure uma referência</strong>
    <p>Selecione uma categoria existente ou crie a primeira estrutura para orientar o pipeline.</p>
    <button class="btn btn-primary" id="catsEmptyAddBtn" type="button"${canManage ? '' : ' hidden'}><i data-lucide="plus" aria-hidden="true"></i> Criar categoria</button>
  </div>`;
}

export function categoryListHtml(categories, { query, activeId, canManage, hasDefinition }) {
  if (!categories.length) {
    return `<div class="cats-empty">${query ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria ainda - crie a primeira!'}</div>`;
  }
  return categories.map(category => {
    const structured = hasDefinition(category);
    const active = activeId === category.id;
    const status = category.status || 'published';
    return `<div class="cats-item${active ? ' active' : ''}" data-id="${escapeHtml(category.id)}">
      <span class="cats-item-dot" style="background:${structured ? '#4ade80' : 'rgba(255,255,255,.2)'}${structured ? ';box-shadow:0 0 6px rgba(74,222,128,.4)' : ''}"></span>
      <span class="cats-item-name">${escapeHtml(category.nome || 'Sem nome')}</span>
      <span class="cats-status cats-status--${escapeHtml(status)}">${categoryStatusLabel(status)}</span>
      <div class="cats-item-actions">
        <button class="cats-btn-edit" data-id="${escapeHtml(category.id)}" title="${canManage ? 'Editar' : 'Visualizar'}">${canManage ? 'Editar' : 'Ver'}</button>
        ${canManage ? `<button class="cats-btn-del" data-id="${escapeHtml(category.id)}" title="Excluir permanentemente">Excluir</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

export function categoryEditorHtml(category, { canManage, parents, noticeOptions }) {
  const disabled = canManage ? '' : ' disabled';
  const noticeOptionsHtml = noticeOptions.map(option => {
    const selected = (category.avisoFichaTipo || 'normal') === option.key ? ' selected' : '';
    return `<option value="${escapeHtml(option.key)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join('');
  const parentOptions = parents.map(item =>
    `<option value="${escapeHtml(item.id)}"${category.parentId === item.id ? ' selected' : ''}>${escapeHtml(item.nome)}</option>`,
  ).join('');
  const editable = canManage && category.status !== 'archived';

  return `<div class="cats-editor-form">
    <div class="cats-editor-hdr">
      <input class="cats-nome-input" id="catEditNome" type="text" value="${escapeHtml(category.nome || '')}" placeholder="Nome da categoria" autocomplete="off"${disabled}/>
      <div class="cats-publish-group">
        <span class="cats-status cats-status--${escapeHtml(category.status || 'published')}">${categoryStatusLabel(category.status)}</span>
        ${editable ? '<button class="btn btn-ghost" id="catAnalyzeAiBtn" type="button"><i data-lucide="sparkles" aria-hidden="true"></i> Analisar com IA</button>' : ''}
        ${editable ? '<button class="btn btn-primary" id="catPublishBtn" type="button"><i data-lucide="cloud-upload" aria-hidden="true"></i> Publicar</button>' : ''}
      </div>
    </div>
    <div class="cats-ai-examples" id="catsAiExamples" hidden>
      <div class="cats-ai-heading"><div><strong>Base para análise da categoria</strong><span>Cole cinco fichas reais. A IA comparará recorrência, variações e complexidade antes de sugerir a estrutura.</span></div><span class="cats-ai-type" id="catsAiExamplesCount">0/5 prontas</span></div>
      <div class="cats-ai-example-grid">${[1, 2, 3, 4, 5].map(number => `
        <label class="cats-ai-example-field"><span>Ficha ${number}</span><textarea class="cat-ai-example" data-example="${number}" minlength="40" maxlength="5000" placeholder="Cole uma ficha completa e representativa desta categoria..."></textarea></label>`).join('')}</div>
      <p class="cats-ai-token-note">Nenhum token é consumido ao preencher. A chamada acontece somente em “Gerar análise”. Serão considerados até 3.500 caracteres de cada ficha.</p>
      <div class="cats-ai-actions"><button class="btn btn-ghost" id="catCancelAiExamplesBtn" type="button">Cancelar</button><button class="btn btn-primary" id="catRunAiBtn" type="button" disabled><i data-lucide="sparkles" aria-hidden="true"></i> Gerar análise</button></div>
    </div>
    <div class="cats-ai-suggestion" id="catsAiSuggestion" hidden></div>
    <div class="cats-profile-grid">
      <div class="cats-field"><label>Tipo do perfil</label><select id="catEditProfileType"${disabled}><option value="compact"${category.profileType === 'compact' ? ' selected' : ''}>Compacto</option><option value="technical"${category.profileType === 'technical' ? ' selected' : ''}>Técnico</option><option value="generic"${category.profileType === 'generic' ? ' selected' : ''}>Genérico</option></select></div>
      <div class="cats-field"><label>Herdar de</label><select id="catEditParent"${disabled}><option value="">Nenhuma categoria</option>${parentOptions}</select></div>
    </div>
    <div class="cats-field"><label>Aliases <span class="cats-field-hint">- sinônimos, singular e nomes comerciais</span></label><textarea id="catEditAliases" rows="3" placeholder="Ex: squeeze, cantil, garrafinha"${disabled}>${escapeHtml(fieldListToText(category.aliases || []))}</textarea></div>
    <div class="cats-field"><label>Termos negativos <span class="cats-field-hint">- impedem falsos positivos</span></label><textarea id="catEditNegativeTerms" rows="2" placeholder="Ex: suporte para garrafa, refil para garrafa"${disabled}>${escapeHtml(fieldListToText(category.negativeTerms || []))}</textarea></div>
    <div class="cats-field"><label>Campos obrigatórios <span class="cats-field-hint">- o A2 valida com mais rigor</span></label><textarea id="catEditObrigatorios" rows="4" placeholder="Ex: EAN, Marca, Tensão, Potência..."${disabled}>${escapeHtml(fieldListToText(category.camposObrigatorios))}</textarea></div>
    <div class="cats-field"><label>Campos opcionais <span class="cats-field-hint">- validam se aparecerem nos dados brutos</span></label><textarea id="catEditOpcionais" rows="4" placeholder="Ex: Cor, Peso, Dimensões, Recursos extras..."${disabled}>${escapeHtml(fieldListToText(category.camposOpcionais))}</textarea></div>
    <div class="cats-field"><label>Texto obrigatório da ficha</label><select id="catEditAvisoFicha"${disabled}>${noticeOptionsHtml}</select></div>
    <div class="cats-field"><label>Ficha ideal <span class="cats-field-hint">- referência para o formatador</span></label><textarea id="catEditFichaIdeal" rows="6" placeholder="Cole aqui a estrutura ideal desta categoria..."${disabled}>${escapeHtml(category.fichaIdeal || '')}</textarea></div>
    <div class="cats-profile-grid">
      <div class="cats-field"><label>Fórmula do título</label><textarea id="catEditTitleFormula" rows="2" placeholder="Produto + Marca + Modelo + Característica"${disabled}>${escapeHtml(category.titleRule?.formula || '')}</textarea></div>
      <div class="cats-field"><label>Exemplo de título</label><textarea id="catEditTitleExample" rows="2" placeholder="Garrafa Invicta 1L Inox"${disabled}>${escapeHtml(category.titleRule?.example || '')}</textarea></div>
    </div>
    <div class="cats-field"><div class="cats-section-heading"><label>Modificadores <span class="cats-field-hint">- complementam campos quando detectados</span></label>${canManage ? '<button class="btn btn-ghost btn-sm" id="catAddModifierBtn" type="button"><i data-lucide="plus" aria-hidden="true"></i> Adicionar</button>' : ''}</div><div class="cats-modifiers" id="catEditModifiers"></div></div>
    <div class="cats-field"><label>JSON de validação <span class="cats-field-hint">- gerado automaticamente</span></label><pre class="exemplos-section-body" id="catEditQaPreview"></pre></div>
  </div>`;
}

export function modifiersHtml(modifiers, canManage) {
  if (!modifiers.length) return '<div class="cats-modifiers-empty">Nenhum modificador. Exemplo: Térmica pode adicionar campos somente quando for detectada.</div>';
  return modifiers.map((modifier, index) => `
    <div class="cat-modifier-row" data-id="${escapeHtml(modifier.id || `modificador-${index + 1}`)}">
      <input data-mod-name type="text" value="${escapeHtml(modifier.nome || modifier.name || '')}" placeholder="Nome: Térmica"${canManage ? '' : ' disabled'}/>
      <input data-mod-aliases type="text" value="${escapeHtml((modifier.aliases || []).join(', '))}" placeholder="Aliases: isotérmica, conserva temperatura"${canManage ? '' : ' disabled'}/>
      <input data-mod-fields type="text" value="${escapeHtml((modifier.camposOpcionais || modifier.addOptionalFields || []).join(', '))}" placeholder="Campos adicionais: tempo de conservação"${canManage ? '' : ' disabled'}/>
      ${canManage ? '<button class="btn btn-ghost btn-icon" data-remove-modifier type="button" title="Remover modificador"><i data-lucide="trash-2" aria-hidden="true"></i></button>' : ''}
    </div>`).join('');
}

export function aiSuggestionHtml(suggestion) {
  const typeLabel = { compact: 'Compacto', technical: 'Técnico', generic: 'Genérico' }[suggestion.profileType];
  const line = values => (Array.isArray(values) ? values : []).map(escapeHtml).join(', ') || 'Nenhum';
  return `<div class="cats-ai-heading"><div><strong>Sugestão da IA</strong><span>${escapeHtml(suggestion.summary || 'Estrutura sugerida para revisão.')}</span></div><span class="cats-ai-type">Perfil ${typeLabel}</span></div>
    <div class="cats-ai-preview"><p><strong>Aliases:</strong> ${line(suggestion.aliases)}</p><p><strong>Obrigatórios:</strong> ${line(suggestion.requiredFields)}</p><p><strong>Opcionais:</strong> ${line(suggestion.optionalFields)}</p><p><strong>Modificadores:</strong> ${line((suggestion.modifiers || []).map(item => item.name))}</p></div>
    <p class="cats-ai-replace-note">Ao aprovar, a estrutura atual será substituída por esta sugestão. Nome, herança e aviso obrigatório não serão alterados.</p>
    <div class="cats-ai-actions"><button class="btn btn-ghost" id="catDiscardAiBtn" type="button">Descartar</button><button class="btn btn-primary" id="catApplyAiBtn" type="button"><i data-lucide="replace" aria-hidden="true"></i> Substituir estrutura</button></div>`;
}
