// 只改笔记属性区（开头两行 --- 之间的 YAML）里指定的那一个字段，其余内容一个字节都不动。
//
// 以前的做法是用 js-yaml 把整个属性区读进来再整体写回去，结果：
//   updatedDate: 2026-03-30   →  updatedDate: 2026-03-30T00:00:00.000Z（在西半球显示成前一天）
//   dueDate:                  →  dueDate: null
//   注释、引号被丢掉
// Obsidian 自带的 processFrontMatter 不会改坏日期，但同样是整体重写：丢注释、去引号、
// 把 [a, b] 改成多行。所以这里按行处理：找到这个字段占的那几行，只替换它们。
//
// 纯函数，不依赖 Obsidian。测试见 test/frontmatter.test.mjs。

interface Block {
	start: number; // 开头 --- 那一行之后的位置
	end: number; // 结尾 --- 那一行开头的位置
	crlf: boolean; // 属性区用的是 \r\n 换行
}

function locate(text: string): Block | null {
	const bom = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
	const firstBreak = text.indexOf('\n');
	if (firstBreak === -1) return null;
	const first = text.slice(bom, firstBreak);
	if (!/^---[ \t]*\r?$/.test(first)) return null;
	let pos = firstBreak + 1;
	while (pos < text.length) {
		const lineBreak = text.indexOf('\n', pos);
		const line = text.slice(pos, lineBreak === -1 ? text.length : lineBreak);
		if (/^(---|\.\.\.)[ \t]*\r?$/.test(line)) return { start: firstBreak + 1, end: pos, crlf: first.endsWith('\r') };
		if (lineBreak === -1) break;
		pos = lineBreak + 1;
	}
	return null;
}

// 属性区的各行。最后一个元素总是 ''；\r\n 换行的文件里每行末尾还带着 \r，原样保留。
function blockLines(text: string, block: Block): string[] {
	return text.slice(block.start, block.end).split('\n');
}

function bare(line: string): string {
	return line.endsWith('\r') ? line.slice(0, -1) : line;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isBlankOrComment(line: string): boolean {
	return /^[ \t]*(#.*)?$/.test(line);
}

// 顶层字段 key 占的行：[第一行, 最后一行的下一行)
function keyRange(lines: string[], key: string): [number, number] | null {
	const isKey = new RegExp('^' + escapeRegExp(key) + '[ \\t]*:([ \\t]|$)');
	const count = lines.length - 1; // 不算末尾的 ''
	let at = -1;
	for (let i = 0; i < count; i++) {
		if (isKey.test(bare(lines[i]))) {
			at = i;
			break;
		}
	}
	if (at === -1) return null;
	let end = at + 1;
	for (let i = at + 1; i < count; i++) {
		const line = bare(lines[i]);
		if (isBlankOrComment(line)) continue; // 空行和注释：后面还有这个字段的内容才算进来
		// 缩进的行，或者和字段名齐头的 “- 项”，都还是这个字段的值
		if (/^[ \t]+\S/.test(line) || /^-([ \t]|$)/.test(line)) end = i + 1;
		else break;
	}
	return [at, end];
}

export function hasFrontmatter(text: string): boolean {
	return locate(text) !== null;
}

// ------------------------------------------------------------------ 读

// 一行里的一个 YAML 值。null：空或 null；undefined：不是简单的一行文字（这种不去碰）
function parseScalar(raw: string): string | null | undefined {
	const s = raw.trim();
	if (s === '' || s.startsWith('#')) return null;
	const quote = s[0];
	if (quote === '"' || quote === "'") {
		let out = '';
		let i = 1;
		for (; i < s.length; i++) {
			const ch = s[i];
			if (quote === '"' && ch === '\\') {
				const next = s[i + 1];
				if (next !== '"' && next !== '\\') return undefined; // 其他转义写法
				out += next;
				i++;
			} else if (ch === quote) {
				if (quote === "'" && s[i + 1] === "'") {
					out += "'";
					i++;
				} else {
					break;
				}
			} else {
				out += ch;
			}
		}
		if (i >= s.length) return undefined; // 引号没有在这一行结束
		const rest = s.slice(i + 1).trim();
		return rest === '' || rest.startsWith('#') ? out : undefined;
	}
	const plain = s.replace(/[ \t]+#.*$/, '');
	if (/^(~|null|Null|NULL)$/.test(plain)) return null;
	// 列表、映射、锚点、标签、多行文字等写法
	if (/^[[\]{}&*!|>%@`,]/.test(plain) || /^[-?]([ \t]|$)/.test(plain)) return undefined;
	if (/:([ \t]|$)/.test(plain)) return undefined;
	return plain;
}

// [a, "b c", 'd'] 这种写在一行里的列表
function parseFlowList(s: string): string[] | null {
	const items: string[] = [];
	let item = '';
	let quote = '';
	let i = 1;
	const push = (): boolean => {
		const value = parseScalar(item);
		if (value === undefined) return false;
		if (value !== null) items.push(value);
		item = '';
		return true;
	};
	for (; i < s.length; i++) {
		const ch = s[i];
		if (quote !== '') {
			item += ch;
			if (quote === '"' && ch === '\\') {
				item += s[++i] ?? '';
			} else if (ch === quote) {
				if (quote === "'" && s[i + 1] === "'") item += s[++i];
				else quote = '';
			}
		} else if ((ch === '"' || ch === "'") && item.trim() === '') {
			quote = ch;
			item += ch;
		} else if (ch === ',') {
			if (!push()) return null;
		} else if (ch === ']') {
			break;
		} else if (ch === '[' || ch === '{' || ch === '}') {
			return null;
		} else {
			item += ch;
		}
	}
	if (quote !== '' || i >= s.length) return null; // 没有在这一行结束
	const rest = s.slice(i + 1).trim();
	if (rest !== '' && !rest.startsWith('#')) return null;
	return push() ? items : null;
}

function parseListValue(inline: string, rest: string[]): string[] | null {
	if (inline.startsWith('[')) return rest.length === 0 ? parseFlowList(inline) : null;
	const single = parseScalar(inline);
	if (single === undefined) return null;
	if (single !== null) return rest.length === 0 ? [single] : null;
	const items: string[] = [];
	for (const line of rest) {
		const match = /^[ \t]*-(?:[ \t]+(.*))?$/.exec(line);
		if (!match) return null;
		const value = parseScalar(match[1] ?? '');
		if (value === undefined) return null;
		if (value !== null) items.push(value);
	}
	return items;
}

// 一个列表字段现在写着什么。
// items 为 null 表示写法这里读不懂（嵌套结构、跨行的文字等），这样的字段不要自动去改。
export interface ListField {
	items: string[] | null;
}

// 读一个列表字段。三种写法都认：`key: [a, b]`、每行一个 `- 项`、只有一个值的 `key: a`。
// 没有属性区、或者没有这个字段时返回 null。
export function readFrontmatterList(text: string, key: string): ListField | null {
	const block = locate(text);
	if (!block) return null;
	const lines = blockLines(text, block);
	const range = keyRange(lines, key);
	if (!range) return null;
	const head = bare(lines[range[0]]);
	const inline = head.slice(head.indexOf(':', key.length) + 1).trim();
	const rest = lines.slice(range[0] + 1, range[1]).map(bare).filter((line) => !isBlankOrComment(line));
	return { items: parseListValue(inline, rest) };
}

// ------------------------------------------------------------------ 写

// 一个值写成 YAML：能直接写就直接写，否则加双引号
export function yamlScalar(value: string): string {
	const plain = /^[\p{L}_][\p{L}\p{N}_ .-]*$/u.test(value)
		&& !value.endsWith(' ')
		&& !/^(true|false|null|yes|no|on|off|y|n)$/i.test(value);
	return plain ? value : JSON.stringify(value);
}

// `key:` 加每行一个 `  - 项`；空列表写成 `key: []`
export function renderList(key: string, values: string[]): string[] {
	if (values.length === 0) return [`${key}: []`];
	return [`${key}:`, ...values.map((v) => `  - ${yamlScalar(v)}`)];
}

export function renderScalar(key: string, value: string): string[] {
	return [`${key}: ${yamlScalar(value)}`];
}

// 把属性区里的顶层字段 key 换成 rendered 这几行，其余内容原样不动。
// 返回新的全文（没有变化时就是原文）。没有属性区，或者没有这个字段而 addIfMissing 为 false 时返回 null。
export function setFrontmatterKey(text: string, key: string, rendered: string[], addIfMissing = false): string | null {
	const block = locate(text);
	if (!block) return null;
	const lines = blockLines(text, block);
	const range = keyRange(lines, key);
	if (!range && !addIfMissing) return null;
	const [from, to] = range ?? [lines.length - 1, lines.length - 1]; // 没有这个字段：加在属性区最后
	const fresh = rendered.map((line) => (block.crlf ? line + '\r' : line));
	const next = [...lines.slice(0, from), ...fresh, ...lines.slice(to)];
	return text.slice(0, block.start) + next.join('\n') + text.slice(block.end);
}
