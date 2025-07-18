import { App, Editor, Notice, Plugin, moment, TFile, Command, Menu, MarkdownView } from 'obsidian';
import { TextPluginSettingTab, TextPluginSettings, DEFAULT_SETTINGS } from './src/settings';
import { updateLastEditDate, openPeopleSuggestionModal, openTemplateSuggestionModal, openStatusSuggestionModal } from './src/assets'
import { generateAutoText } from './src/autotext'
import { validatePeople } from 'src/validate';

export default class TextPlugin extends Plugin {
	settings: TextPluginSettings;
	private isUpdating: boolean = false; // 防止递归

	// obsidian 启动时激活

	async onload() {

		// 加载 settings

		await this.loadSettings();
		this.addSettingTab(new TextPluginSettingTab(this.app, this));

		/*
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
		*/
		// 功能：点击左工具栏图标直接插入今天日期
		//	- this.addRibbonIcon() 会在左工具栏新加图标 (此功能用了 calendar 图标)
		//	- this.app.workspace.activeEditor!.editor! 返回当前文档使用的 editor
		//	- editor.replaceRange(content, editor.getCursor()) 在当前鼠标位置插入 content

		// const ribbonIconInsertDate = this.addRibbonIcon('calendar', 'Insert Date', (evt: MouseEvent) => {
		// 	let editor = this.app.workspace.activeEditor!.editor!;
		// 	editor.replaceRange(moment().format(this.settings.dateFormat), editor.getCursor()); // 插入今日日期
		// 	updateLastEditDate(editor, this.settings); // 顺便自动更改最近更改日期
		// });	

		// 功能： 监听metadataCache改变
		// cache.frontmatter?.status === 'archived' 
		// 归档到当年文件夹

		this.registerEvent(this.app.metadataCache.on("changed", async (file, data, cache) => { // metadataCache有改动时触发
			// console.log('metadataCache changed:', file.path, cache);
			let path = file.path
			let archivedFolderName = '_Archived'
			let dir: string[] = path.split('/');
			if (cache.frontmatter?.status === 'archived') {
				if (path.includes(archivedFolderName)) {
					// console.log('已经在_Archived里了')
					return
				}
				const archivedFolderPath = `${dir[0]}/${archivedFolderName}/${moment().format('YYYY')}/${moment().format('MM')}`
				if (!await this.app.vault.adapter.exists(archivedFolderPath)) {
					await this.app.vault.createFolder(archivedFolderPath)
				}
				// const fileName = dir[dir.length - 1].split('.')[0] + '[' + moment().format('YYYYMMDD hhmm') + '].' + dir[dir.length - 1].split('.')[1]
				// this.app.fileManager.renameFile(this.app.vault.getAbstractFileByPath(path)!, `${dir[0]}/_Archived/${moment().format('YYYY')}/${fileName}`);
				this.app.fileManager.renameFile(this.app.vault.getAbstractFileByPath(path)!, `${archivedFolderPath}/${dir[dir.length - 1]}`);
			}else {
				// setTimeout(async () => {
				// 	// console.log('metadataCache changed:', file.path, cache);
				// 	await validatePeople(file); // 验证 people 和 assignedTo 字段
				// }, 600);
			}
		}));

		// 功能：更改或粘贴时，插入更改 header （只在 type：task 文档生效）
		//	generateAutoText() 可在 ./src/autotext.ts 找到

		/*this.registerDomEvent(document, 'keypress', (evt: KeyboardEvent) => { // 更改时
			generateAutoText(this.app, this.app.workspace.activeEditor!.editor!, this.settings);
		});
	
		this.registerEvent(this.app.workspace.on('editor-paste', () => { // 粘贴时
			generateAutoText(this.app, this.app.workspace.activeEditor!.editor!, this.settings);
		}));*/


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
				}, 500);
			}));
		}, 1000);

		// 功能：自动弹出 status 选择窗口
		// - openStatusSuggestionModal 可在 ./src/assets.ts 找到

		/*this.registerDomEvent(document, 'click', async (evt: MouseEvent) => { // 任何点击时触发
				const editor = this.app?.workspace?.activeEditor?.editor!;
				if (editor?.getLine(editor.getCursor().line).contains('status:')) { // 如果点击在 status：同一行
				await openStatusSuggestionModal(this.app, this.settings, editor.getCursor().line); // 打开 status 选择窗口
				editor.setCursor({ line: editor.getCursor().line - 1, ch: 0 });
			}
		});*/

		this.registerEvent(
			this.app.workspace.on('editor-change', async (editor: Editor) => {
				const file = this.app.workspace.getActiveFile();
				if (!editor || !file) return;
				if (this.isUpdating) return; // 防止递归
				if (file.path.startsWith(this.settings.templateFolderPath)) {
					// 如果是 template 文件夹下的文件，则不进行自动更新
					return;
				}
				this.isUpdating = true;
				try {
					updateLastEditDate(editor, this.settings);
					generateAutoText(this.app, editor, this.settings);
					// const cache = this.app.metadataCache.getFileCache(file);
					await validatePeople(file);
				} finally {
					this.isUpdating = false;
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view) => {
				menu.addSeparator();
				// menu.addItem((item) => {
				// 	item.setTitle("GenVoice")
				// });
				menu.addItem((item) => {
					item.setTitle("Set Task Status")
						.onClick(() => {
							openStatusSuggestionModal(this.app, this.settings, 0);
						});
				});
				menu.addItem((item) => {
					item.setTitle("Assign Task To")
						.onClick(() => {
							openPeopleSuggestionModal(this.app, this.settings);
						});
				});
			})
		);
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

