// 测试用的假 Obsidian：只实现插件用到的那部分接口。
//
// 事件的先后顺序照着真实的 Obsidian（1.15.1）来，是实际测出来的：
//   本机打字：       键盘事件 → editor-change → （约 2 秒后保存）modify，文件修改时间是现在 → changed
//   同步工具改了文件：modify，文件修改时间是对方保存的时间 → 这篇笔记开着的话 editor-change（编辑器内容 = 文件内容）→ changed
//   vault.process：  内容没变就不写、不触发任何事件；变了：modify → 开着的话 editor-change → changed
//   打开一篇笔记：    file-open，没有 editor-change
import momentLib from 'moment';

export const moment = momentLib;

export const notices = [];
export class Notice {
	constructor(message) {
		notices.push(String(message));
	}
}

export class TAbstractFile {
	constructor(path) {
		this.path = path;
	}
	get name() {
		return this.path.slice(this.path.lastIndexOf('/') + 1);
	}
	get parent() {
		const cut = this.path.lastIndexOf('/');
		return { path: cut === -1 ? '/' : this.path.slice(0, cut) };
	}
}
export class TFile extends TAbstractFile {
	constructor(path) {
		super(path);
		this.stat = { ctime: 0, mtime: 0, size: 0 };
	}
	get extension() {
		const dot = this.name.lastIndexOf('.');
		return dot > 0 ? this.name.slice(dot + 1) : '';
	}
	get basename() {
		const dot = this.name.lastIndexOf('.');
		return dot > 0 ? this.name.slice(0, dot) : this.name;
	}
}
export class TFolder extends TAbstractFile { }

export class MenuItem {
	setTitle(title) {
		this.title = title;
		return this;
	}
	onClick(callback) {
		this.click = callback;
		return this;
	}
	setSubmenu() {
		this.submenu = new Menu();
		return this.submenu;
	}
}
export class Menu {
	constructor() {
		this.items = [];
	}
	addSeparator() {
		return this;
	}
	addItem(callback) {
		const item = new MenuItem();
		this.items.push(item);
		callback(item);
		return this;
	}
}

export const openModals = [];
export class SuggestModal {
	constructor(app) {
		this.app = app;
	}
	setPlaceholder(text) {
		this.placeholder = text;
	}
	open() {
		openModals.push(this);
	}
	close() { }
}

export class PluginSettingTab {
	constructor(app, plugin) {
		this.app = app;
		this.plugin = plugin;
	}
}
export class Setting { }

export class Plugin {
	constructor(app, manifest) {
		this.app = app;
		this.manifest = manifest;
		this.domHandlers = [];
		this.commands = [];
		this.stored = null;
	}
	registerEvent() { }
	registerDomEvent(el, type, callback) {
		this.domHandlers.push({ el, type, callback });
	}
	addCommand(command) {
		this.commands.push(command);
		return command;
	}
	addSettingTab() { }
	async loadData() {
		return this.stored;
	}
	async saveData(data) {
		this.stored = data;
	}
}

// ------------------------------------------------------------------ 以下是测试用的 “世界”

// 属性区的最简解析，给假的 metadataCache 用（故意不用插件自己的解析代码）
export function parseFrontmatter(text) {
	if (!text.startsWith('---\n')) return undefined;
	const end = text.indexOf('\n---', 3);
	if (end === -1) return undefined;
	const scalar = (raw) => {
		const v = raw.trim();
		if (v === '' || v === 'null' || v === '~') return null;
		return /^".*"$/.test(v) || /^'.*'$/.test(v) ? v.slice(1, -1) : v;
	};
	const frontmatter = {};
	let key = null;
	for (const line of text.slice(4, end).split('\n')) {
		if (line.trim() === '' || /^\s*#/.test(line)) continue;
		const item = /^\s*-\s*(.*)$/.exec(line);
		if (item && key !== null) {
			if (!Array.isArray(frontmatter[key])) frontmatter[key] = [];
			frontmatter[key].push(scalar(item[1]));
			continue;
		}
		const pair = /^([^:\s][^:]*):\s*(.*)$/.exec(line);
		if (!pair) continue;
		key = pair[1].trim();
		const value = pair[2].trim();
		frontmatter[key] = value.startsWith('[')
			? value.slice(1, -1).split(',').map(scalar).filter((v) => v !== null)
			: scalar(value);
	}
	return frontmatter;
}

class Emitter {
	constructor() {
		this.handlers = new Map();
	}
	on(name, callback) {
		if (!this.handlers.has(name)) this.handlers.set(name, []);
		this.handlers.get(name).push(callback);
		return { name, callback };
	}
	async emit(name, ...args) {
		for (const callback of [...(this.handlers.get(name) ?? [])]) await callback(...args);
	}
	emitSync(name, ...args) {
		for (const callback of [...(this.handlers.get(name) ?? [])]) callback(...args);
	}
}

class FakeEditor {
	constructor(world, text) {
		this.world = world;
		this.text = text;
		this.cursor = 0; // 光标在全文里的位置
		this.changes = 0; // replaceRange 被调用的次数
	}
	getValue() {
		return this.text;
	}
	lineCount() {
		return this.text.split('\n').length;
	}
	getLine(n) {
		const lines = this.text.split('\n');
		if (n < 0 || n >= lines.length) throw new RangeError(`getLine(${n}) is outside the document`);
		return lines[n];
	}
	offsetOf(pos) {
		const lines = this.text.split('\n');
		let offset = 0;
		for (let i = 0; i < Math.min(pos.line, lines.length); i++) offset += lines[i].length + 1;
		return Math.min(offset + (pos.line < lines.length ? pos.ch : 0), this.text.length);
	}
	posOf(offset) {
		const before = this.text.slice(0, offset).split('\n');
		return { line: before.length - 1, ch: before[before.length - 1].length };
	}
	getCursor() {
		return this.posOf(this.cursor);
	}
	setCursor(pos) {
		this.cursor = this.offsetOf(pos);
	}
	replaceRange(replacement, from, to = from) {
		const a = this.offsetOf(from);
		const b = this.offsetOf(to);
		this.text = this.text.slice(0, a) + replacement + this.text.slice(b);
		// 光标在改动之后：跟着后移。光标正好在插入点上：留在插入内容的前面。和真的编辑器（CodeMirror）一样
		if (this.cursor > a && this.cursor >= b) this.cursor += replacement.length - (b - a);
		this.changes++;
		this.world.editorChanged();
	}
}

export class World {
	// notes：{ 路径: 内容 }；hidden：只能通过 adapter 读到的文件（.synchub/ 下的）
	constructor(notes = {}, hidden = {}) {
		this.now = Date.UTC(2026, 10, 23, 17, 0, 0);
		this.entries = new Map();
		this.folders = new Set();
		this.hidden = new Map(Object.entries(hidden));
		this.caches = new Map();
		this.active = null;
		this.editor = null;
		this.fileWrites = []; // 通过 vault 写过的路径
		this.renames = [];
		this.queue = [];
		this.timers = [];
		this.plugin = null;
		this.vaultEvents = new Emitter();
		this.cacheEvents = new Emitter();
		this.workspaceEvents = new Emitter();
		for (const [path, text] of Object.entries(notes)) this.put(path, text);

		const entry = (file) => {
			const found = this.entries.get(file.path);
			if (!found) throw new Error(`ENOENT: ${file.path}`);
			return found;
		};
		this.app = {
			vault: {
				on: (name, callback) => this.vaultEvents.on(name, callback),
				getAbstractFileByPath: (path) => this.entries.get(path)?.file ?? (this.folders.has(path) ? new TFolder(path) : null),
				getMarkdownFiles: () => [...this.entries.values()].map((e) => e.file).filter((f) => f.extension === 'md'),
				read: async (file) => entry(file).text,
				cachedRead: async (file) => entry(file).text,
				process: async (file, fn) => {
					const e = entry(file);
					const before = e.text;
					const next = fn(before);
					if (next === before) return next;
					this.now += 1;
					e.text = next;
					e.file.stat.mtime = this.now;
					this.fileWrites.push(file.path);
					await this.vaultEvents.emit('modify', e.file);
					this.queue.push(async () => {
						if (this.editor && this.active === e.file) {
							// 编辑器没有未保存的内容：载入新内容；有：合并（这里用同一个改写函数代替）
							this.editor.text = this.editor.text === before ? next : fn(this.editor.text);
							this.editorChanged();
						}
						await this.reindex(e.file.path);
					});
					return next;
				},
				createFolder: async (path) => {
					if (this.folders.has(path)) throw new Error('Folder already exists.');
					this.addFolders(path + '/x');
				},
				adapter: {
					exists: async (path) => this.entries.has(path) || this.folders.has(path) || this.hidden.has(path),
					read: async (path) => {
						if (this.hidden.has(path)) return this.hidden.get(path);
						if (this.entries.has(path)) return this.entries.get(path).text;
						throw new Error(`ENOENT: ${path}`);
					},
				},
			},
			metadataCache: {
				on: (name, callback) => this.cacheEvents.on(name, callback),
				getFileCache: (file) => this.caches.get(file.path) ?? null,
			},
			workspace: {
				on: (name, callback) => this.workspaceEvents.on(name, callback),
				onLayoutReady: (callback) => callback(),
				getActiveFile: () => this.active,
				iterateAllLeaves: () => { },
			},
			fileManager: {
				renameFile: async (file, to) => {
					if (this.entries.has(to)) throw new Error('Destination file already exists!');
					const from = file.path;
					const e = entry(file);
					this.entries.delete(from);
					file.path = to;
					this.entries.set(to, e);
					this.caches.set(to, this.caches.get(from));
					this.caches.delete(from);
					this.addFolders(to);
					this.renames.push([from, to]);
					await this.vaultEvents.emit('rename', file, from);
				},
			},
		};
	}

	// 把假的时钟、document、window 装到全局，并启动插件
	async start(PluginClass, settings = { username: 'mark' }) {
		this.realNow = Date.now;
		Date.now = () => this.now;
		globalThis.document = { fake: 'document' };
		globalThis.window = { setTimeout: (fn) => this.timers.push(fn) };
		this.plugin = new PluginClass(this.app, { id: 'obsidian-genvoice-plugin' });
		this.plugin.stored = settings;
		await this.plugin.onload();
		return this.plugin;
	}

	stop() {
		Date.now = this.realNow;
		delete globalThis.document;
		delete globalThis.window;
	}

	addFolders(path) {
		const parts = path.split('/');
		for (let i = 1; i < parts.length; i++) this.folders.add(parts.slice(0, i).join('/'));
	}

	put(path, text, mtime = this.now - 3_600_000) {
		let e = this.entries.get(path);
		if (!e) {
			e = { file: new TFile(path), text: '' };
			this.entries.set(path, e);
			this.addFolders(path);
		}
		e.text = text;
		e.file.stat.mtime = mtime;
		this.caches.set(path, { frontmatter: parseFrontmatter(text) });
		return e.file;
	}

	file(path) {
		return this.entries.get(path)?.file ?? null;
	}

	text(path) {
		return this.entries.get(path)?.text;
	}

	paths() {
		return [...this.entries.keys()].sort();
	}

	// 等所有后续动作（插件里不等待结果的异步调用、Obsidian 的重新载入和索引）做完
	async settle() {
		for (let round = 0; round < 100; round++) {
			while (this.queue.length > 0) await this.queue.shift()();
			for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
			if (this.queue.length === 0) return;
		}
		throw new Error('the world never settles: something keeps rewriting');
	}

	async runTimers() {
		while (this.timers.length > 0) await this.timers.shift()();
		await this.settle();
	}

	editorChanged() {
		this.workspaceEvents.emitSync('editor-change', this.editor, { file: this.active });
	}

	async reindex(path) {
		const e = this.entries.get(path);
		if (!e) return;
		const cache = { frontmatter: parseFrontmatter(e.text) };
		this.caches.set(path, cache);
		await this.cacheEvents.emit('changed', e.file, e.text, cache);
	}

	// ---------------------------------------------------------------- 这台电脑上的人做的事

	// 打开一篇笔记（成为当前笔记）
	open(path) {
		const e = this.entries.get(path);
		this.active = e.file;
		this.editor = new FakeEditor(this, e.text);
		this.workspaceEvents.emitSync('file-open', e.file);
		return this.editor;
	}

	// 键盘或鼠标操作，但没有改内容（方向键、点击）
	touch() {
		this.now += 5;
		for (const handler of this.plugin.domHandlers) {
			if (handler.type === 'keydown') handler.callback({ type: 'keydown' });
		}
	}

	// 在光标处打字（内容和光标一起变，然后才通知插件；editor.changes 只数插件自己的改动）
	async type(text) {
		this.touch();
		const at = this.editor.cursor;
		this.editor.text = this.editor.text.slice(0, at) + text + this.editor.text.slice(at);
		this.editor.cursor = at + text.length;
		this.editorChanged();
		await this.settle();
	}

	// 把某一行改成别的内容（光标停在那一行）
	async edit(line, text) {
		this.touch();
		const from = this.editor.offsetOf({ line, ch: 0 });
		const to = from + this.editor.getLine(line).length;
		this.editor.text = this.editor.text.slice(0, from) + text + this.editor.text.slice(to);
		this.editor.cursor = from + text.length;
		this.editorChanged();
		await this.settle();
	}

	// 把光标放到以 start 开头的那一行的行首
	cursorTo(start) {
		const line = this.editor.getValue().split('\n').findIndex((l) => l.startsWith(start));
		if (line === -1) throw new Error(`no line starts with ${start}`);
		this.editor.setCursor({ line, ch: 0 });
		return line;
	}

	// Obsidian 的自动保存：两秒后把编辑器内容写进文件，然后重新索引
	async save() {
		this.now += 2000;
		await this.writeEditor(this.active, this.editor);
	}

	// 还没等到自动保存就切到另一篇笔记：Obsidian 会立刻保存刚才那篇
	async switchTo(path) {
		const previous = this.active;
		const editor = this.editor;
		this.touch();
		this.open(path);
		await this.writeEditor(previous, editor);
	}

	async writeEditor(file, editor) {
		const e = this.entries.get(file.path);
		if (e.text !== editor.text) {
			e.text = editor.text;
			e.file.stat.mtime = this.now;
			await this.vaultEvents.emit('modify', e.file);
			await this.reindex(e.file.path);
		}
		await this.settle();
	}

	// 新建一篇空笔记并打开它
	async create(path) {
		this.touch();
		const file = this.put(path, '', this.now);
		this.vaultEvents.emitSync('create', file);
		this.open(path);
		await this.runTimers();
		return file;
	}

	// ---------------------------------------------------------------- 别人做的事

	// 同步工具把别人的改动写到了磁盘上。文件的修改时间是对方保存的时间（默认一分钟前）。
	async remoteWrite(path, text, ageMs = 60_000) {
		this.now += 50;
		const isNew = !this.entries.has(path);
		const file = this.put(path, text, this.now - ageMs);
		if (isNew) {
			this.vaultEvents.emitSync('create', file);
		} else {
			await this.vaultEvents.emit('modify', file);
			if (this.editor && this.active === file) {
				this.editor.text = text; // Obsidian 把新内容载入编辑器
				this.editorChanged();
			}
		}
		await this.reindex(path);
		await this.runTimers();
	}
}
