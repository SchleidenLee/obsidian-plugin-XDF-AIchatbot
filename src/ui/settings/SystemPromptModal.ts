import { Modal, App, Setting, Notice } from "obsidian";
import { t } from "src/i18n";

export class SystemPromptModal extends Modal {
  private prompt = "";
  private onSubmit: (prompt: string) => void | Promise<void>;

  constructor(
    app: App,
    initialValue: string,
    onSubmit: (prompt: string) => void | Promise<void>
  ) {
    super(app);
    this.prompt = initialValue;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: t("settings.systemPrompt") });

    const descEl = contentEl.createEl("p", {
      cls: "setting-item-description",
    });
    descEl.setText(t("settings.systemPrompt.modalDesc"));

    new Setting(contentEl).addTextArea((text) => {
      text
        .setPlaceholder(t("settings.systemPrompt.placeholder"))
        .setValue(this.prompt)
        .onChange((value) => {
          this.prompt = value;
        });
      text.inputEl.rows = 12;
      text.inputEl.cols = 60;
      text.inputEl.style.width = "100%";
      text.inputEl.style.minHeight = "200px";
      text.inputEl.focus();
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText(t("common.cancel")).onClick(() => {
          this.close();
        })
      )
      .addButton((btn) =>
        btn
          .setButtonText(t("common.ok"))
          .setCta()
          .onClick(() => {
            this.submit();
          })
      );
  }

  private submit() {
    void this.onSubmit(this.prompt);
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
