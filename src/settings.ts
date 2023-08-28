import TextPlugin from "../main";
import { App, PluginSettingTab, Setting } from "obsidian";

export interface TextPluginSettings {
	username: string;
	tagSymb: string;
	lastEditDateStr: string;
	dateFormat: string;
	peopleFolderPath: string;
	suggestionSplitStr: string;
	separationLineStr: string;
    topLevelLine: string;
    templateFolderPath: string;
    dataviewHeaderLine: string;
    templateDetectionStr: string;
    peopleStr: string;
    showRemind: boolean
}

export const DEFAULT_SETTINGS: Partial<TextPluginSettings> = {
	username: "user",
	tagSymb: "~",
	lastEditDateStr: "updatedDate:",
	dateFormat: "YYYY-MM-DD",
	peopleFolderPath: "All/Collaborators/",
	suggestionSplitStr: "\n",
	separationLineStr: "___",
    topLevelLine: "+++",
    templateFolderPath: "All/Templates/",
    dataviewHeaderLine: "---",
    templateDetectionStr: "type: task",
    peopleStr: "people:",
    showRemind: false
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
            .setName('Show reminders')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showRemind)
                .onChange(async (value) => {
                    if (this.plugin.settings.showRemind) {
                        this.plugin.settings.showRemind = false;
                    } else {
                        this.plugin.settings.showRemind = true;
                    }
                    await this.plugin.saveSettings();
                })
            )
            
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
            .setDesc('A character/string you and other users will use to tag each other.')
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
            /*
        new Setting(containerEl)
            .setName('Keyword: people list')
            .addText(text => text
                .setPlaceholder('default: people:')
                .setValue(this.plugin.settings.peopleStr)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.peopleStr = DEFAULT_SETTINGS.peopleStr!;
                    } else {
                        this.plugin.settings.peopleStr = input;
                    }
                    await this.plugin.saveSettings();
                })
            )
            */
        new Setting(containerEl)
            .setName('Name list file')
            .setDesc('File that stores all candidates for names to be added')
            .addText(text => text
                .setPlaceholder('default: collaborator')
                .setValue(this.plugin.settings.peopleFolderPath)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.peopleFolderPath = DEFAULT_SETTINGS.peopleFolderPath!;
                    } else {
                        this.plugin.settings.peopleFolderPath = input;
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
        
        containerEl.createEl('h1', { text: 'Inserting Header'});

		new Setting(containerEl)
            .setName('Header line')
            .addText(text => text
                .setPlaceholder('default: ___')
                .setValue(this.plugin.settings.separationLineStr)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.separationLineStr = DEFAULT_SETTINGS.separationLineStr!;
                    } else {
                        this.plugin.settings.separationLineStr = input;
                    }
                    await this.plugin.saveSettings();
                })
            )
        
        new Setting(containerEl)
            .setName('Top level content line')
            .setDesc('To indicate content to always appear at the top')
            .addText(text => text
                .setPlaceholder('default: +++')
                .setValue(this.plugin.settings.topLevelLine)
                .onChange(async (input) => {
                    if (input.localeCompare('') == 0) {
                        this.plugin.settings.topLevelLine = DEFAULT_SETTINGS.topLevelLine!;
                    } else {
                        this.plugin.settings.topLevelLine = input;
                    }
                    await this.plugin.saveSettings();
                })
            )
    }   
}

