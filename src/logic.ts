// 插件里“怎么判断、怎么算”的部分，纯函数，不依赖 Obsidian。测试见 test/logic.test.mjs。

// ------------------------------------------------------------------ 这次改动是不是本机做的

// 插件会自己改笔记、挪笔记（日期、人名、归档）。这些只能针对这台电脑上的人刚刚做的改动。
// 别人的改动同步过来时，对方电脑上的插件已经处理过了；这里再处理一遍，就成了每台电脑同时去
// 改写、移动同一篇笔记，结果是冲突副本和重复归档。
//
// Obsidian 的事件本身不区分来源：同步工具改了磁盘上的文件，一样会触发 modify、changed，
// 打开着的笔记还会触发 editor-change。所以这里自己记：
//   1. 编辑器里出现了磁盘上还没有的内容（由调用方比较），或者插件自己要写文件 → mark()
//   2. 文件保存时：有上面的标记，或者“文件是刚写的 + 这篇是当前笔记 + 刚有键盘鼠标操作” → 算本机保存
//   3. Obsidian 重新索引这篇笔记时：它对应的是一次本机保存 → 才去整理人名、归档

export const INPUT_WINDOW_MS = 10_000; // 键盘鼠标操作之后多久内算“这个人正在用”
export const MARK_TTL_MS = 30_000; // 标记之后迟迟没有保存，就作废
export const FRESH_WRITE_MS = 3_000; // 文件修改时间离现在这么近，才可能是本机刚写的（同步来的文件带着对方电脑上的修改时间）
export const INDEX_WAIT_MS = 120_000; // 保存之后等 Obsidian 索引的最长时间

export class LocalEdits {
	private lastInput = Number.NEGATIVE_INFINITY;
	private marks = new Map<string, number>(); // 笔记路径 → 本机改了、还没保存
	private saves = new Map<string, number>(); // 笔记路径 → 本机保存了、还没索引

	// 这个窗口里有键盘或鼠标操作
	input(now: number): void {
		this.lastInput = now;
	}

	recentInput(now: number): boolean {
		return now - this.lastInput < INPUT_WINDOW_MS;
	}

	// 这篇笔记有本机的改动还没保存：编辑器里有未保存的内容，或者插件马上要写它
	mark(path: string, now: number): void {
		for (const [key, at] of this.marks) {
			if (now - at >= MARK_TTL_MS) this.marks.delete(key);
		}
		this.marks.set(path, now);
	}

	isMarked(path: string, now: number): boolean {
		const at = this.marks.get(path);
		return at !== undefined && now - at < MARK_TTL_MS;
	}

	// 文件保存了（vault 的 modify 事件）。返回这次保存是不是本机做的。
	// ageMs：现在减去文件的修改时间；active：这篇是不是当前打开的笔记。
	saved(path: string, now: number, ageMs: number, active: boolean): boolean {
		const marked = this.isMarked(path, now);
		this.marks.delete(path);
		const local = marked || (Math.abs(ageMs) < FRESH_WRITE_MS && active && this.recentInput(now));
		if (local) {
			for (const [key, at] of this.saves) {
				if (now - at >= INDEX_WAIT_MS) this.saves.delete(key);
			}
			this.saves.set(path, now);
		}
		return local;
	}

	// Obsidian 重新索引了这篇笔记（metadataCache 的 changed 事件）。返回它对应的是不是一次本机保存。
	indexed(path: string, now: number): boolean {
		const at = this.saves.get(path);
		this.saves.delete(path);
		return at !== undefined && now - at < INDEX_WAIT_MS;
	}

	renamed(from: string, to: string): void {
		for (const map of [this.marks, this.saves]) {
			const at = map.get(from);
			if (at === undefined) continue;
			map.delete(from);
			map.set(to, at);
		}
	}

	removed(path: string): void {
		this.marks.delete(path);
		this.saves.delete(path);
	}
}

// 编辑器里的内容和磁盘上的是不是一样。编辑器里一律是 \n 换行，文件可能是 \r\n。
export function sameText(a: string, b: string): boolean {
	const clean = (s: string) => (s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s).replace(/\r\n?/g, '\n');
	return a === b || clean(a) === clean(b);
}

// ------------------------------------------------------------------ 归档

export const ARCHIVE_FOLDER = '_Archived';

// 归档后的文件名上限。两个都要满足：
// 字符数：让 C:\Users\<名字>\SyncHub\<项目>\_Archived\2026\11\<文件名> 留在 Windows 的 260 字符以内；
// 字节数：Linux、macOS 的文件名上限是 255 字节，中文一个字 3 字节，还要给同步工具的冲突后缀留位置。
export const MAX_ARCHIVED_NAME_CHARS = 120;
export const MAX_ARCHIVED_NAME_BYTES = 200;

export interface ArchiveTime {
	year: string; // YYYY
	month: string; // MM
	stamp: string; // YYYYMMDDHHmm
}

export function isArchived(path: string): boolean {
	return path.split('/').includes(ARCHIVE_FOLDER);
}

function utf8Length(codePoint: number): number {
	if (codePoint < 0x80) return 1;
	if (codePoint < 0x800) return 2;
	return codePoint < 0x10000 ? 3 : 4;
}

function truncate(s: string, maxChars: number, maxBytes: number): string {
	let out = '';
	let bytes = 0;
	for (const ch of s) { // 按字符走，不会把一个字切成两半
		bytes += utf8Length(ch.codePointAt(0) ?? 0);
		if (out.length + ch.length > maxChars || bytes > maxBytes) break;
		out += ch;
	}
	return out;
}

// status 变成 archived 的笔记该移到哪里：<根>/_Archived/<年>/<月>/<文件名>_<时间>.md
//
// “根”是笔记所在的顶层文件夹。SyncHub 的个人文件夹（personalDir，例如 “个人/mark”）里的笔记，
// 根是那个人的文件夹，因为 “个人/” 这一层谁都没有写权限。
// 返回 null 表示不移动：已经在 _Archived 里，或者笔记在库的根目录下（没有可以归档进去的文件夹）。
export function archiveTarget(path: string, time: ArchiveTime, personalDir?: string | null): string | null {
	const segments = path.split('/');
	if (segments.length < 2 || segments.includes(ARCHIVE_FOLDER)) return null;

	let root = segments[0];
	const personal = (personalDir ?? '').replace(/^\/+|\/+$/g, '');
	const cut = personal.lastIndexOf('/');
	if (cut > 0) {
		const area = personal.slice(0, cut); // “个人”
		const depth = area.split('/').length;
		// 任何人的个人文件夹都一样：个人/<谁>/…… 归档到 个人/<谁>/_Archived
		if (path.startsWith(area + '/') && segments.length >= depth + 2) root = segments.slice(0, depth + 1).join('/');
	} else if (personal !== '' && path.startsWith(personal + '/')) {
		root = personal;
	}

	const fileName = segments[segments.length - 1];
	const dot = fileName.lastIndexOf('.');
	const base = dot > 0 ? fileName.slice(0, dot) : fileName;
	const tail = `_${time.stamp}${dot > 0 ? fileName.slice(dot) : ''}`;
	const kept = truncate(base, Math.max(1, MAX_ARCHIVED_NAME_CHARS - tail.length), Math.max(1, MAX_ARCHIVED_NAME_BYTES - tail.length));
	return `${root}/${ARCHIVE_FOLDER}/${time.year}/${time.month}/${kept}${tail}`;
}

// 目标位置已经有同名文件时：在扩展名前加 -2、-3……
export function numbered(path: string, n: number): string {
	const slash = path.lastIndexOf('/');
	const dot = path.lastIndexOf('.');
	return dot > slash + 1 ? `${path.slice(0, dot)}-${n}${path.slice(dot)}` : `${path}-${n}`;
}

// ------------------------------------------------------------------ people / assignedTo

// Obsidian 缓存里的属性值：列表原样，单个值当成只有一项的列表
export function asList(raw: unknown): string[] {
	if (Array.isArray(raw)) return raw.filter((v) => v !== null && v !== undefined).map((v) => String(v));
	if (raw === null || raw === undefined || raw === '') return [];
	return [String(raw)];
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}

// 把随手写的内容整理成人名：["Mark, wang"]、["~mark ~wang"]、["Mark", "Wang"] → mark、wang
//
// 规则和以前一样：按非字母的字符拆开，转小写，去重。所以已经整理过的笔记不会再被改。
// 和以前不同的两点：
//   - 协作者名单里有的名字整个保留（名字里带数字、连字符的不会被拆坏）；
//   - “字母”包括中文和带重音的字母（以前中文名会被整个丢掉，josé 会变成 jos）。
export function cleanNames(entries: readonly string[], known: ReadonlySet<string>): string[] {
	const out: string[] = [];
	for (const entry of entries) {
		const whole = entry.trim().replace(/^[~@]+/, '').toLowerCase();
		if (whole === '') continue;
		if (known.has(whole)) {
			out.push(whole);
			continue;
		}
		for (const piece of whole.split(/[\s,;，；、~@|/\\]+/)) {
			if (piece === '') continue;
			if (known.has(piece)) {
				out.push(piece);
				continue;
			}
			for (const token of piece.split(/[^\p{L}]+/u)) {
				if (token !== '') out.push(token);
			}
		}
	}
	return unique(out);
}

// assignedTo 整理好；people = people 里的人 + 所有被指派的人
export function normalizePeople(people: readonly string[], assignedTo: readonly string[], known: ReadonlySet<string>): { people: string[]; assignedTo: string[] } {
	const assigned = cleanNames(assignedTo, known);
	return { people: unique([...cleanNames(people, known), ...assigned]), assignedTo: assigned };
}

// 是不是同一批名字（不看顺序）
export function sameMembers(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort();
	const sortedB = [...b].sort();
	return sortedA.every((value, i) => value === sortedB[i]);
}

// ------------------------------------------------------------------ 编辑时用到的小东西

// updatedDate 那一行应该换成什么；已经是今天了就返回 null
export function updatedDateLine(line: string, key: string, today: string): string | null {
	if (!line.startsWith(key)) return null;
	const next = `${key} ${today}`;
	return line === next ? null : next;
}

// 在笔记全文里把最近更改日期那一行换成今天（菜单改了笔记时用）。
// 和编辑器里的做法一样：只看开头到第一个空行之间，找第一行以 key 开头的。
export function touchLastEditDate(text: string, key: string, today: string): string {
	if (key === '') return text;
	let pos = 0;
	while (pos < text.length) {
		const lineBreak = text.indexOf('\n', pos);
		const end = lineBreak === -1 ? text.length : lineBreak;
		const raw = text.slice(pos, end);
		const cr = raw.endsWith('\r') ? '\r' : '';
		const line = cr === '' ? raw : raw.slice(0, -1);
		if (line === '') return text;
		if (line.startsWith(key)) {
			const next = updatedDateLine(line, key, today);
			return next === null ? text : text.slice(0, pos) + next + cr + text.slice(end);
		}
		if (lineBreak === -1) break;
		pos = lineBreak + 1;
	}
	return text;
}

// 模板填进新笔记时：{{date}} 换成今天，people 和 createdBy 填上自己
export function fillTemplate(text: string, today: string, username: string): string {
	return text
		.replace(/{{date}}/gi, today)
		.replace('people: ', `people:\n  - ${username}`)
		.replace('createdBy: ', `createdBy: ${username}`);
}

// ------------------------------------------------------------------ SyncHub 的权限

// 规则和 SyncHub 自己的插件一致：路径相同或者是上级文件夹的规则里，最具体的那一条生效

export type Level = 'none' | 'read' | 'write';

export interface Permissions {
	defaultLevel: Level;
	entries: { path: string; level: Level }[];
}

function isLevel(value: unknown): value is Level {
	return value === 'none' || value === 'read' || value === 'write';
}

function normalizeVaultPath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '').replace(/\/+$/, '').normalize('NFC');
}

// .synchub/permissions.json 的内容；不是这个格式时返回 null
export function parsePermissions(raw: unknown): Permissions | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const obj = raw as Record<string, unknown>;
	const entries: Permissions['entries'] = [];
	if (Array.isArray(obj.entries)) {
		for (const item of obj.entries) {
			if (!item || typeof item !== 'object') continue;
			const { path, level } = item as Record<string, unknown>;
			if (typeof path === 'string' && isLevel(level)) entries.push({ path: normalizeVaultPath(path), level });
		}
	}
	return { defaultLevel: isLevel(obj.default) ? obj.default : 'none', entries };
}

// 一个路径的权限：路径和它相同、或者是它上级文件夹的规则里最具体的那一条；都不匹配时取默认值
export function levelFor(perms: Permissions, path: string): Level {
	const target = normalizeVaultPath(path);
	let best: { path: string; level: Level } | null = null;
	for (const entry of perms.entries) {
		const matches = entry.path === '' || target === entry.path || target.startsWith(entry.path + '/');
		if (matches && (best === null || entry.path.length > best.path.length)) best = entry;
	}
	return best ? best.level : perms.defaultLevel;
}

// 不在 SyncHub 里（perms 为 null）时什么都能写
export function canWrite(perms: Permissions | null, path: string): boolean {
	return perms === null || levelFor(perms, path) === 'write';
}
