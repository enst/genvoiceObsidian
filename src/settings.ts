import TextPlugin from "../main";
import { App, PluginSettingTab, Setting } from "obsidian";

// setting tab for textPlugin
// to be imported by main.ts

export interface TextPluginSettings {
	username: string;
	tagSymb: string;
    autoNotify: boolean;
    noticeSymb: string;
	lastEditDateStr: string;
	dateFormat: string;
	peopleListFileName: string;
	suggestionSplitStr: string;
}

export const DEFAULT_SETTINGS: Partial<TextPluginSettings> = {
	username: "user",
	tagSymb: "@",
    autoNotify: true,
    noticeSymb: "!",
	lastEditDateStr: "updatedDate:",
	dateFormat: "YYYY-MM-DD",
	peopleListFileName: "collaborator",
	suggestionSplitStr: "\n",
};

export class TextPluginSettingTab extends PluginSettingTab {
    plugin: TextPlugin;

    constructor(app: App, plugin: TextPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl('h1', { text: 'Tagging & Adding People' });

        new Setting(containerEl)
            .setName('Username')
            .setDesc('How other users will identify you in tags, notices, etc.')
            .addText(text => text
                .setPlaceholder('default: user')
                .setValue(this.plugin.settings.username)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.username = DEFAULT_SETTINGS.username!;
                    } else {
                        this.plugin.settings.username = input;
                    }
                    await this.plugin.saveSettings();
                })
            )
        new Setting(containerEl)
            .setName('Tag indicator')
            .setDesc('A character/string other users will use to tag you.')
            .addText(text => text
                .setPlaceholder('default: @')
                .setValue(this.plugin.settings.tagSymb)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.tagSymb = DEFAULT_SETTINGS.tagSymb!;
                    } else {
                        this.plugin.settings.tagSymb = input;
                    }
                    await this.plugin.saveSettings();
                })
            )
        new Setting(containerEl)
            .setName('Notify pop-up')
            .setDesc('Automatic pop-up option to notify user upon tag')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoNotify)
                .onChange(async (value) => {
                    if (this.plugin.settings.autoNotify) {
                        this.plugin.settings.autoNotify = false;
                    } else {
                        this.plugin.settings.autoNotify = true;
                    }
                    await this.plugin.saveSettings();
                })
            )
        new Setting(containerEl)
            .setName('Name list file')
            .setDesc('File that stores all candidates for names to be added')
            .addText(text => text
                .setPlaceholder('default: collaborator')
                .setValue(this.plugin.settings.peopleListFileName)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.peopleListFileName = DEFAULT_SETTINGS.peopleListFileName!;
                    } else {
                        this.plugin.settings.peopleListFileName = input;
                    }
                    await this.plugin.saveSettings();
                })
            )
        new Setting(containerEl)
            .setName('Name list separator')
            .setDesc('Symbol/phrase that separates individual names in the name list file')
            .addText(text => text
                .setPlaceholder('default: new line')
                .setValue(this.plugin.settings.suggestionSplitStr)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.suggestionSplitStr = DEFAULT_SETTINGS.suggestionSplitStr!;
                    } else {
                        this.plugin.settings.suggestionSplitStr = input;
                    }
                    await this.plugin.saveSettings();
                })
            )

        containerEl.createEl('h1', { text: 'Inserting & Updating Edit Dates'});
        
        new Setting(containerEl)
            .setName('Keyword: latest edit date')
            .addText(text => text
                .setPlaceholder('default: updatedDate:')
                .setValue(this.plugin.settings.lastEditDateStr)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.lastEditDateStr = DEFAULT_SETTINGS.lastEditDateStr!;
                    } else {
                        this.plugin.settings.lastEditDateStr = input;
                    }
                    await this.plugin.saveSettings();
                })
            )
        new Setting(containerEl)
            .setName('Date format')
            .setDesc('Format used in inserting / editing dates.')
            .addText(text => text
                .setPlaceholder('default: YYYY-MM-DD')
                .setValue(this.plugin.settings.dateFormat)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.dateFormat = DEFAULT_SETTINGS.dateFormat!;
                    } else {
                        this.plugin.settings.dateFormat = input;
                    }
                    await this.plugin.saveSettings();
                })
            )
        
        
    }   
}

