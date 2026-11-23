import { Editor, Menu, Notice, Plugin, TFile, moment } from 'obsidian';
import { TextPluginSettingTab, TextPluginSettings, DEFAULT_SETTINGS } from './src/settings';
import { knownNames, openPeopleSuggestionModal, openTemplateSuggestionModal, updateLastEditDate } from './src/assets'
import { generateAutoText } from './src/autotext'
import { editNote, validatePeople, validatePeopleInFolder } from './src/validate';
import { assignInText, setStatusInText } from './src/people';
import { LocalEdits, archiveTarget, isArchived, numbered, sameText, touchLastEditDate } from './src/logic';
import { SyncHubContext } from './src/synchub';

const STATUS_FILE = 'All/status.md';

export default class TextPlugin extends Plugin {
	settings: TextPluginSettings;
	private isUpdating: boolean = false; // 防止递归
	private statusOptions: string[] = [];
	private synchub: SyncHubContext; // SyncHub 的个人文件夹和权限；不在 SyncHub 里时没有任何限制
	private local = new LocalEdits(); // 哪些改动是这台电脑上的人做的，说明见 ./src/logic.ts
	private comparing = new Set<string>();
	private archiving = new Set<string>();
	private watchedDocuments = new Set<Document>();

	private async loadStatusOptions() {
		const statusFile = this.app.vault.getAbstractFileByPath(STATUS_FILE);
		if (!(statusFile instanceof TFile)) {
			this.statusOptions = [];
			return;
		}

		const statusOptions = (await this.app.vault.read(statusFile))
			.split('\n')
			.map((s) => s.trim())
			.map((s) => s.replace(/^[-*]\s+/, '').trim())
			.filter((s) => s.length > 0 && !s.startsWith('#') && !s.endsWith(':'));

		this.statusOptions = Array.from(new Set(statusOptions)).sort();
	}

	private isActive(file: TFile): boolean {
		return this.app.workspace.getActiveFile()?.path === file.path;
	}

	// 记录这个窗口里的键盘、鼠标操作
	// keydown 也要听：回车、退格这些键由编辑器自己处理，不产生 input 事件

	private watchInput(doc: Document) {
		if (this.watchedDocuments.has(doc)) return;
		this.watchedDocuments.add(doc);
		for (const type of ['keydown', 'beforeinput', 'input', 'paste', 'cut', 'drop', 'pointerdown'] as const) {
			this.registerDomEvent(doc, type, () => this.local.input(Date.now()), { capture: true, passive: true });
		}
	}

	// 菜单操作前检查：只读的笔记不改，并告诉本人

	private async canEdit(file: TFile): Promise<boolean> {
		await this.synchub.refresh();
		if (this.synchub.canWrite(file.path)) return true;
		new Notice('This note is read-only for you');
		return false;
	}

	// 菜单对笔记做的改写：确实改了内容时，最近更改日期也在同一次写入里换成今天

	private withLastEditDate(change: (text: string) => string): (text: string) => string {
		const today = moment().format(this.settings.dateFormat);
		return (text) => {
			const next = change(text);
			return next === text ? text : touchLastEditDate(next, this.settings.lastEditDateStr, today);
		};
	}

	// 功能：右键菜单 Set Task Status
	//	- 只改属性区里的 status 那一行，其余内容原样不动

	private async setStatusInActiveFile(status: string) {
		const file = this.app.workspace.getActiveFile();
		if (!file) return;
		if (!(await this.canEdit(file))) return;

		if (setStatusInText(await this.app.vault.read(file), status) === null) {
			new Notice('No status field found in current file');
			return;
		}
		await editNote(this.app, file,
			this.withLastEditDate((text) => setStatusInText(text, status) ?? text),
			() => this.local.mark(file.path, Date.now()));
	}

	// 功能：右键菜单 Assign Task To
	//	- 把选中的人加进 assignedTo；笔记有 people 字段的话，他也会在 people 里

	private async assignTo(file: TFile, name: string) {
		if (!(this.app.vault.getAbstractFileByPath(file.path) instanceof TFile)) return;
		if (!(await this.canEdit(file))) return;

		const known = knownNames(this.app, this.settings);
		const problem = assignInText(await this.app.vault.read(file), name, known).problem;
		if (problem === 'no-properties') {
			new Notice('No properties found in current file');
			return;
		}
		if (problem === 'unreadable') {
			new Notice('Could not update assignedTo automatically. Please edit the properties by hand.');
			return;
		}
		await editNote(this.app, file,
			this.withLastEditDate((text) => assignInText(text, name, known).text),
			() => this.local.mark(file.path, Date.now()));
	}

	private fillStatusSubmenu(submenu: Menu) {
		if (this.statusOptions.length === 0) {
			submenu.addItem((subItem) => {
				subItem.setTitle('No status options loaded');
			});
			return;
		}
		for (const status of this.statusOptions) {
			submenu.addItem((subItem) => {
				subItem.setTitle(status)
					.onClick(async () => {
						await this.setStatusInActiveFile(status);
					});
			});
		}
	}

	// 功能：编辑时自动更新最近更改日期、插入更改 header
	//	- updateLastEditDate() 可在 ./src/assets.ts 找到，generateAutoText() 可在 ./src/autotext.ts 找到
	//	- 同步工具改了磁盘上的文件、Obsidian 把新内容载入编辑器时，同样会触发 editor-change。
	//	  所以要先确认两件事：这个人刚刚在操作这篇笔记；编辑器里确实有磁盘上还没有的内容。

	private onEditorChange(editor: Editor, file: TFile) {
		if (this.isUpdating) return; // 防止递归
		if (file.path.startsWith(this.settings.templateFolderPath)) return; // template 文件夹下的文件不自动更新
		const now = Date.now();
		if (!this.local.recentInput(now) || !this.isActive(file)) return;
		if (this.local.isMarked(file.path, now)) {
			this.updateEditor(editor, file); // 已经确认过，保存之前不用再比
			return;
		}
		void this.checkUnsavedChanges(editor, file);
	}

	private async checkUnsavedChanges(editor: Editor, file: TFile) {
		if (this.comparing.has(file.path)) return;
		this.comparing.add(file.path);
		try {
			const onDisk = await this.app.vault.cachedRead(file);
			if (sameText(onDisk, editor.getValue())) return; // 编辑器里就是磁盘上的内容：这是载入，不是编辑
			this.local.mark(file.path, Date.now());
			if (this.isActive(file)) this.updateEditor(editor, file);
		} catch (error) {
			console.error('GenVoice: could not compare the editor with the file:', file.path, error);
		} finally {
			this.comparing.delete(file.path);
		}
	}

	private updateEditor(editor: Editor, file: TFile) {
		void this.synchub.refresh();
		if (!this.synchub.canWrite(file.path)) return; // 只读的笔记不自动改
		this.isUpdating = true;
		try {
			updateLastEditDate(editor, this.settings);
			generateAutoText(this.app, editor, this.settings, file);
		} finally {
			this.isUpdating = false;
		}
	}

	// 功能：整理 people 和 assignedTo
	//	- validatePeople() 可在 ./src/validate.ts 找到

	private async tidyPeople(file: TFile): Promise<boolean> {
		try {
			await this.synchub.refresh();
			if (!this.synchub.canWrite(file.path)) return false; // 只读的笔记不自动改
			return await validatePeople(this.app, file, knownNames(this.app, this.settings),
				() => this.local.mark(file.path, Date.now()));
		} catch (error) {
			console.error('Validate people failed:', file.path, error);
			return false;
		}
	}

	// 功能：status 是 archived 的笔记，移到 <顶层文件夹>/_Archived/年/月/，文件名加时间后缀
	//	- SyncHub 个人文件夹（个人/<名字>）里的笔记，归档到个人文件夹自己的 _Archived 下
	//	- archiveTarget() 可在 ./src/logic.ts 找到

	private async archive(file: TFile) {
		const from = file.path;
		if (this.archiving.has(from)) return;
		this.archiving.add(from);
		try {
			await this.synchub.refresh();
			const now = moment();
			const target = archiveTarget(from,
				{ year: now.format('YYYY'), month: now.format('MM'), stamp: now.format('YYYYMMDDHHmm') },
				this.synchub.personalDir);
			if (target === null) {
				// 库的根目录下的笔记，没有可以归档进去的文件夹
				new Notice('Not archived: move this note into a folder first');
				return;
			}
			const folder = target.slice(0, target.lastIndexOf('/'));
			if (!this.synchub.canWrite(from)) {
				new Notice('Not archived: this note is read-only for you');
				return;
			}
			if (!this.synchub.canWrite(target)) {
				new Notice(`Not archived: you do not have write access to ${folder}`, 10000);
				return;
			}
			if (!await this.app.vault.adapter.exists(folder)) {
				try {
					await this.app.vault.createFolder(folder);
				} catch (error) {
					// 同时归档两篇笔记时，文件夹可能刚被另一篇建好
					if (!await this.app.vault.adapter.exists(folder)) throw error;
				}
			}
			let destination = target;
			for (let n = 2; await this.app.vault.adapter.exists(destination); n++) {
				destination = numbered(target, n);
			}
			// 一步到位移到最终的文件名；指向这篇笔记的链接由 Obsidian 更新
			await this.app.fileManager.renameFile(file, destination);
		} catch (error) {
			console.error('Archive failed:', from, error);
			new Notice(`Archive failed: ${file.name}`);
		} finally {
			this.archiving.delete(from);
		}
	}

	// 功能：创建文件时，自动插入template
	//	- openTemplateSuggestionModal 可在 ./src/assets.ts 找到

	private async offerTemplate(file: TFile) {
		try {
			if (!this.isActive(file)) return; // 只有当前激活文件才触发
			if (await this.app.vault.read(file) !== "") return; // 只处理空文档
		} catch (_) {
			return; // 文件已经不在了
		}
		// 弹出 template 选择窗口，模板写进这篇新笔记
		openTemplateSuggestionModal(this.app, this.settings, file, () => this.local.mark(file.path, Date.now()));
	}

	// obsidian 启动时激活

	async onload() {

		// 加载 settings

		await this.loadSettings();
		this.synchub = new SyncHubContext(this.app);
		await this.synchub.refresh(true);
		await this.loadStatusOptions();
		this.addSettingTab(new TextPluginSettingTab(this.app, this));

		this.watchInput(document);
		this.registerEvent(this.app.workspace.on('window-open', (_, win) => this.watchInput(win.document))); // 弹出的独立窗口

		this.app.workspace.onLayoutReady(() => {
			void this.loadStatusOptions();
			this.app.workspace.iterateAllLeaves((leaf) => this.watchInput(leaf.view.containerEl.ownerDocument));

			// obsidian 启动时，库里已有的每个文件都会触发一次 create，所以等布局就绪后再监听
			this.registerEvent(this.app.vault.on('create', (file) => { // 创建文档时触发
				if (!(file instanceof TFile) || file.extension !== 'md') return;
				window.setTimeout(() => void this.offerTemplate(file), 500);
			}));
		});

		this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
			const file = info?.file ?? this.app.workspace.getActiveFile();
			if (!editor || !file) return;
			this.onEditorChange(editor, file);
		}));

		this.registerEvent(this.app.vault.on('modify', (file) => { // 存盘时触发，同步工具改了文件也会触发
			if (!(file instanceof TFile)) return;
			if (file.extension === 'md') {
				// 这次保存是不是本机做的，记下来，留给下面的 changed 用
				const now = Date.now();
				this.local.saved(file.path, now, now - file.stat.mtime, this.isActive(file));
			}
			if (file.path === STATUS_FILE) void this.loadStatusOptions();
		}));

		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.local.renamed(oldPath, file.path)));
		this.registerEvent(this.app.vault.on('delete', (file) => this.local.removed(file.path)));

		// 功能： 监听metadataCache改变
		//	- 只处理本机刚保存的笔记。别人的改动同步过来时，对方电脑上的插件已经处理过了
		//	- 整理 people 和 assignedTo
		//	- cache.frontmatter?.status === 'archived' 时归档

		this.registerEvent(this.app.metadataCache.on("changed", async (file, data, cache) => { // metadataCache有改动时触发
			if (!this.local.indexed(file.path, Date.now())) return;
			if (file.path.startsWith(this.settings.templateFolderPath)) return; // 不动 template
			if (await this.tidyPeople(file)) return; // 刚改了这篇笔记：它保存后会再来一次，到那时再看要不要归档
			if (cache.frontmatter?.status === 'archived' && !isArchived(file.path)) {
				await this.archive(file);
			}
		}));

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view) => {
				menu.addSeparator();
				menu.addItem((item) => {
					item.setTitle("Set Task Status");
					const itemWithSubmenu = item as unknown as {
						setSubmenu?: ((submenu: Menu) => unknown) & ((cb: (submenu: Menu) => void) => unknown) & (() => Menu | unknown);
					};
					if (!itemWithSubmenu.setSubmenu) return;

					let populated = false;
					try {
						const submenu = (itemWithSubmenu.setSubmenu as () => unknown)();
						if (submenu instanceof Menu) {
							this.fillStatusSubmenu(submenu);
							populated = true;
						}
					} catch (_) {
						// ignore and try callback signature below
					}

					if (!populated) {
						try {
							(itemWithSubmenu.setSubmenu as (cb: (submenu: Menu) => void) => unknown)((submenu: Menu) => {
								this.fillStatusSubmenu(submenu);
							});
							populated = true;
						} catch (_) {
							// submenu API unavailable in this runtime
						}
					}

					if (!populated && this.statusOptions.length > 0) {
						for (const status of this.statusOptions) {
							menu.addItem((flatItem) => {
								flatItem.setTitle(`Set Task Status: ${status}`)
									.onClick(async () => {
										await this.setStatusInActiveFile(status);
									});
							});
						}
					}
				});
				menu.addItem((item) => {
					item.setTitle("Assign Task To")
						.onClick(() => {
							const file = this.app.workspace.getActiveFile();
							if (!file) return;
							// 选中的人加进点菜单时的这篇笔记
							openPeopleSuggestionModal(this.app, this.settings, (name) => void this.assignTo(file, name));
						});
				});
			})
		);

		// 添加命令：验证当前文件夹下的所有.md文件的people和assignedTo字段
		this.addCommand({
			id: 'validate-people-in-folder',
			name: 'Validate People in Folder',
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (file === null) return false;

				if (checking) {
					return true;
				}

				const folderPath = file.parent?.path || '/';
				void this.synchub.refresh(true).then(() => validatePeopleInFolder(
					this.app, this.settings, folderPath, knownNames(this.app, this.settings),
					(path) => this.synchub.canWrite(path)));
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
