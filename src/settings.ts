import TextPlugin from "../main";
import { App, PluginSettingTab, Setting } from "obsidian";

// 设置里可改数据

export interface TextPluginSettings {
	username: string; // 个人名称
	tagSymb: string; // 自动插入人名时所用的快捷键
	lastEditDateStr: string; // 代表最近更改日期的字符
	dateFormat: string; // 插入日期的格式
	peopleFolderPath: string; // 用来提取所有人名的文件夹 path
	separationLineStr: string; // 自动插入 header 时的 header 分界线
    topLevelLine: string; // type：task 文档置顶内容的分界线 （以上内容置顶）
    templateFolderPath: string; // 用来提取 template 的文件夹 path
    dataviewHeaderLine: string;
    templateDetectionStr: string; // 用来检测当前文档是不是指定的 template
    peopleStr: string; // 代表文档相关人员的字符
}

// 默认设置

export const DEFAULT_SETTINGS: Partial<TextPluginSettings> = {
	username: "placeholder",
	tagSymb: "~",
	lastEditDateStr: "updatedDate:",
	dateFormat: "YYYY-MM-DD",
	peopleFolderPath: "All/Collaborators/",
	separationLineStr: "___",
    topLevelLine: "+++",
    templateFolderPath: "All/Templates/",
    dataviewHeaderLine: "---",
    templateDetectionStr: "type: task",
    peopleStr: "people:",
};

// 搭建设置 interface

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

