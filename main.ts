import { App, Editor, Notice, Plugin, moment, TFile, Command } from 'obsidian';
import { TextPluginSettingTab, TextPluginSettings, DEFAULT_SETTINGS } from './src/settings';
import { updateLastEditDate, openPeopleSuggestionModal, openTemplateSuggestionModal, openStatusSuggestionModal } from './src/assets'
import { generateAutoText } from './src/autotext'

export default class TextPlugin extends Plugin {
	settings: TextPluginSettings;

	// obsidian 启动时激活

	async onload() {

		// 加载 settings

		await this.loadSettings();
		this.addSettingTab(new TextPluginSettingTab(this.app, this));

		


		// 功能：文档被更改时，自动更新最近更改日期
		//	- this.app.workspace.getActiveFile()!.path 返回当前打开文档的 path (e.g. All/intern/travelPlanner.md)
		//	- this.settings 信息可以在 ./src/settings.ts 找到
		//	- updateLastEditDate() 可在 ./src/assets.ts 找到
		
	
		this.registerDomEvent(document, 'keypress', (evt: KeyboardEvent) => { // 有任何改动时触发
			if (!this.app.workspace.getActiveFile()!.path.startsWith(this.settings.templateFolderPath)) { // 确保当前文档不是 template 文档
				updateLastEditDate(this.app.workspace.activeEditor!.editor!, this.settings); // 更改日期
			}
		});




		// 功能：在文档粘贴内容时，自动更新最近更改日期

		this.registerEvent(this.app.workspace.on('editor-paste', () => { // 有任何粘贴时触发
			if (!this.app.workspace.getActiveFile()!.path.startsWith(this.settings.templateFolderPath)) { // 确保当前文档不是 template 文档
				updateLastEditDate(this.app.workspace.activeEditor!.editor!, this.settings); // 更改日期
			}
		}));




		// 功能：点击左工具栏图标直接插入今天日期
		//	- this.addRibbonIcon() 会在左工具栏新加图标 (此功能用了 calendar 图标)
		//	- this.app.workspace.activeEditor!.editor! 返回当前文档使用的 editor
		//	- editor.replaceRange(content, editor.getCursor()) 在当前鼠标位置插入 content

		const ribbonIconInsertDate = this.addRibbonIcon('calendar', 'Insert Date', (evt: MouseEvent) => {
			let editor = this.app.workspace.activeEditor!.editor!;
			editor.replaceRange(moment().format(this.settings.dateFormat), editor.getCursor()); // 插入今日日期
			updateLastEditDate(editor, this.settings); // 顺便自动更改最近更改日期
		});	

		// 功能： 监听metadataCache改变
		// cache.frontmatter?.status === 'archived' 
		// 归档到当年文件夹

		this.registerEvent(this.app.metadataCache.on("changed", async (file , data, cache) => { // metadataCache有改动时触发
			// let path = this.app.workspace.getActiveFile()!.path;
			let path = file.path
			let dir: string[] = path.split('/');
			if (cache.frontmatter?.status === 'archived') {
				if (!await this.app.vault.adapter.exists(`${dir[0]}/_Archived/${moment().format('YYYY')}`) ) {
					await this.app.vault.createFolder(`${dir[0]}/_Archived/${moment().format('YYYY')}`)
				}
				// const fileName = dir[dir.length - 1].split('.')[0] + '[' + moment().format('YYYYMMDD hhmm') + '].' + dir[dir.length - 1].split('.')[1]
				// this.app.fileManager.renameFile(this.app.vault.getAbstractFileByPath(path)!, `${dir[0]}/_Archived/${moment().format('YYYY')}/${fileName}`);
				this.app.fileManager.renameFile(this.app.vault.getAbstractFileByPath(path)!, `${dir[0]}/_Archived/${moment().format('YYYY')}/${dir[dir.length - 1]}`);
			}
			
		}));

		// 功能：通过 ～ 来插入人名
		//	- openPeopleSuggestionModal() 可在 ./src/assets.ts 找到

		this.registerEvent(this.app.workspace.on('editor-change', (editor: Editor) => { // 文档有改动时触发
			const key = editor.getLine(editor.getCursor().line).charAt(editor.getCursor().ch - 1); // 提取最近输入的字母
			if (key.localeCompare(this.settings.tagSymb) == 0) { // 如果最近输入是 ～
				openPeopleSuggestionModal(this.app, this.settings); // 人名选择窗口弹出
			} 
		}));
		



		// 功能：更改或粘贴时，插入更改 header （只在 type：task 文档生效）
		//	generateAutoText() 可在 ./src/autotext.ts 找到

		this.registerDomEvent(document, 'keypress', (evt: KeyboardEvent) => { // 更改时
			generateAutoText(this.app, this.app.workspace.activeEditor!.editor!, this.settings);
		});
	
		this.registerEvent(this.app.workspace.on('editor-paste', () => { // 粘贴时
			generateAutoText(this.app, this.app.workspace.activeEditor!.editor!, this.settings);
		}));




		// 功能：创建文件时，自动插入template
		//	- setTimeout 用来防止 obsidian 启动时触发
		//	- openTemplateSuggestionModal 可在 ./src/assets.ts 找到

		setTimeout(() => {
			this.registerEvent(this.app.vault.on('create', (file: TFile) => { // 创建文档时触发
				setTimeout(async () => {
					let content = await this.app.vault.read(file); // 提取文档内容
					if (file.path.endsWith('.md') && content == "") { // 确认创建的是 md 文档，并且为空文档
						openTemplateSuggestionModal(this.app, this.settings); // 弹出 template 选择窗口
					}
				}, 100);
			}));
		}, 100);

	


		
		// 功能：自动弹出 status 选择窗口
		// - openStatusSuggestionModal 可在 ./src/assets.ts 找到
		
		this.registerDomEvent(document, 'click', async (evt: MouseEvent) => { // 任何点击时触发
				const editor = this.app?.workspace?.activeEditor?.editor!;
				if (editor?.getLine(editor.getCursor().line).contains('status:')) { // 如果点击在 status：同一行
				await openStatusSuggestionModal(this.app, this.settings, editor.getCursor().line); // 打开 status 选择窗口
				editor.setCursor({ line: editor.getCursor().line - 1, ch: 0 });
			}
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

