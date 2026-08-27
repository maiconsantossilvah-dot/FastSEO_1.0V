/** Estado efêmero do modal, isolado do AppState global da aplicação. */
export class CategoryModalState {
  constructor(clock = globalThis) {
    this.clock = clock;
    this.editingId = null;
    this.aiSuggestion = null;
    this.saveTimer = null;
    this.savedTimer = null;
  }

  openEditor(id) {
    this.editingId = id || null;
    this.aiSuggestion = null;
  }

  clearEditor() {
    this.cancelSave();
    this.editingId = null;
    this.aiSuggestion = null;
  }

  scheduleSave(callback, delayMs = 700) {
    this.cancelSave();
    this.saveTimer = this.clock.setTimeout(() => {
      this.saveTimer = null;
      void callback();
    }, delayMs);
  }

  cancelSave() {
    if (this.saveTimer !== null) this.clock.clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  showSavedTemporarily(hide, delayMs = 1800) {
    if (this.savedTimer !== null) this.clock.clearTimeout(this.savedTimer);
    this.savedTimer = this.clock.setTimeout(() => {
      this.savedTimer = null;
      hide();
    }, delayMs);
  }

  dispose() {
    this.cancelSave();
    if (this.savedTimer !== null) this.clock.clearTimeout(this.savedTimer);
    this.savedTimer = null;
    this.editingId = null;
    this.aiSuggestion = null;
  }
}
