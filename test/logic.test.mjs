import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	LocalEdits, INPUT_WINDOW_MS, MARK_TTL_MS, FRESH_WRITE_MS, INDEX_WAIT_MS, sameText,
	archiveTarget, isArchived, numbered, MAX_ARCHIVED_NAME_CHARS, MAX_ARCHIVED_NAME_BYTES,
	asList, cleanNames, normalizePeople, sameMembers, updatedDateLine, touchLastEditDate, fillTemplate,
	parsePermissions, levelFor, canWrite,
} from './.build/logic.mjs';

const T = 1_000_000_000;
const NOTE = 'Web/a.md';

describe('LocalEdits：这次改动是不是本机做的', () => {
	it('本机打字：标记 → 保存算本机 → 索引算本机，各只算一次', () => {
		const local = new LocalEdits();
		local.input(T);
		local.mark(NOTE, T);
		assert.equal(local.isMarked(NOTE, T + 100), true);
		assert.equal(local.saved(NOTE, T + 2000, 1, true), true);
		assert.equal(local.isMarked(NOTE, T + 2001), false, '保存后标记就用掉了');
		assert.equal(local.indexed(NOTE, T + 2010), true);
		assert.equal(local.indexed(NOTE, T + 2020), false, '同一次保存不会被处理两遍');
	});

	it('别人的改动同步过来：没有标记，文件的修改时间是一分钟前 → 不算本机', () => {
		const local = new LocalEdits();
		assert.equal(local.saved(NOTE, T, 60_000, false), false);
		assert.equal(local.indexed(NOTE, T + 10), false);
	});

	it('别人的改动落在我正开着、正在用键盘翻看的笔记上 → 仍然不算本机', () => {
		const local = new LocalEdits();
		local.input(T);
		assert.equal(local.saved(NOTE, T + 100, 60_000, true), false);
		assert.equal(local.indexed(NOTE, T + 110), false);
	});

	it('没经过编辑器的本机改动（例如阅读视图里改属性）：文件是刚写的 + 是当前笔记 + 刚有操作 → 算本机', () => {
		const local = new LocalEdits();
		local.input(T);
		assert.equal(local.saved(NOTE, T + 500, 2, true), true);
		assert.equal(local.indexed(NOTE, T + 510), true);
	});

	it('上面三个条件缺一个都不算', () => {
		const fresh = () => {
			const local = new LocalEdits();
			local.input(T);
			return local;
		};
		assert.equal(fresh().saved(NOTE, T + 500, FRESH_WRITE_MS, true), false, '文件不是刚写的');
		assert.equal(fresh().saved(NOTE, T + 500, -FRESH_WRITE_MS, true), false, '修改时间在未来（对方的时钟快）');
		assert.equal(fresh().saved(NOTE, T + 500, 2, false), false, '不是当前笔记（例如改名时别的笔记里的链接被更新）');
		assert.equal(fresh().saved(NOTE, T + INPUT_WINDOW_MS, 2, true), false, '早就没有操作了');
		assert.equal(new LocalEdits().saved(NOTE, T, 2, true), false, '从来没有操作过');
	});

	it('标记了却一直没保存：过期作废', () => {
		const local = new LocalEdits();
		local.mark(NOTE, T);
		assert.equal(local.isMarked(NOTE, T + MARK_TTL_MS - 1), true);
		assert.equal(local.isMarked(NOTE, T + MARK_TTL_MS), false);
		assert.equal(local.saved(NOTE, T + MARK_TTL_MS, 60_000, false), false);
	});

	it('保存了却一直没被索引：过期作废', () => {
		const local = new LocalEdits();
		local.mark(NOTE, T);
		local.saved(NOTE, T, 0, true);
		assert.equal(local.indexed(NOTE, T + INDEX_WAIT_MS), false);
	});

	it('索引来得晚一点没关系（不依赖 “十秒内”）', () => {
		const local = new LocalEdits();
		local.mark(NOTE, T);
		local.saved(NOTE, T + 2000, 0, false);
		assert.equal(local.indexed(NOTE, T + 2000 + 60_000), true);
	});

	it('有未保存的本机改动时别人的改动到了（两边合并）：算本机', () => {
		const local = new LocalEdits();
		local.mark(NOTE, T);
		assert.equal(local.saved(NOTE, T + 300, 60_000, true), true);
	});

	it('笔记改名、删除时标记跟着走', () => {
		const local = new LocalEdits();
		local.mark(NOTE, T);
		local.renamed(NOTE, 'Web/b.md');
		assert.equal(local.isMarked(NOTE, T), false);
		assert.equal(local.saved('Web/b.md', T + 1, 0, false), true);
		local.renamed('Web/b.md', 'Web/c.md');
		assert.equal(local.indexed('Web/c.md', T + 2), true);

		local.mark(NOTE, T);
		local.removed(NOTE);
		assert.equal(local.saved(NOTE, T + 1, 60_000, false), false);
	});

	it('各篇笔记互不影响', () => {
		const local = new LocalEdits();
		local.mark(NOTE, T);
		assert.equal(local.saved('Web/other.md', T + 1, 60_000, false), false);
		assert.equal(local.saved(NOTE, T + 1, 60_000, false), true);
	});
});

describe('sameText：编辑器内容和文件内容是不是一样', () => {
	it('换行符和 BOM 的差别不算', () => {
		assert.equal(sameText('a\r\nb\r\n', 'a\nb\n'), true);
		assert.equal(sameText(String.fromCharCode(0xFEFF) + 'a\n', 'a\n'), true);
		assert.equal(sameText('a\n', 'a\n'), true);
		assert.equal(sameText('a\nb\n', 'a\nbx\n'), false);
		assert.equal(sameText('a\n', 'a\n\n'), false);
	});
});

describe('archiveTarget：归档到哪里', () => {
	const time = { year: '2026', month: '11', stamp: '202611231530' };

	it('<顶层文件夹>/_Archived/年/月/文件名_时间.md', () => {
		assert.equal(archiveTarget('Web/a.md', time), 'Web/_Archived/2026/11/a_202611231530.md');
		assert.equal(archiveTarget('Web/项目A/sub/登录页.md', time), 'Web/_Archived/2026/11/登录页_202611231530.md');
	});

	it('库的根目录下的笔记不归档（以前会去建一个叫 “a.md” 的文件夹）', () => {
		assert.equal(archiveTarget('a.md', time), null);
	});

	it('已经在 _Archived 里的不动；文件名里带 _Archived 字样的照常归档', () => {
		assert.equal(archiveTarget('Web/_Archived/2026/10/a_202610010900.md', time), null);
		assert.equal(isArchived('Web/_Archived/2026/10/a.md'), true);
		assert.equal(isArchived('Web/notes_Archived.md'), false);
		assert.equal(archiveTarget('Web/notes_Archived.md', time), 'Web/_Archived/2026/11/notes_Archived_202611231530.md');
	});

	it('SyncHub 个人文件夹里的笔记归档到个人文件夹自己的 _Archived 下', () => {
		assert.equal(archiveTarget('个人/mark/todo.md', time, '个人/mark'), '个人/mark/_Archived/2026/11/todo_202611231530.md');
		assert.equal(archiveTarget('个人/mark/草稿/深层/todo.md', time, '个人/mark/'), '个人/mark/_Archived/2026/11/todo_202611231530.md');
		assert.equal(archiveTarget('个人/wang/todo.md', time, '个人/mark'), '个人/wang/_Archived/2026/11/todo_202611231530.md', '别人的个人文件夹同理');
		assert.equal(archiveTarget('个人/todo.md', time, '个人/mark'), '个人/_Archived/2026/11/todo_202611231530.md', '直接放在 “个人/” 下的笔记');
		assert.equal(archiveTarget('Web/a.md', time, '个人/mark'), 'Web/_Archived/2026/11/a_202611231530.md', '个人文件夹以外不受影响');
		assert.equal(archiveTarget('个人笔记/a.md', time, '个人/mark'), '个人笔记/_Archived/2026/11/a_202611231530.md', '名字相近的文件夹不算');
		assert.equal(archiveTarget('mine/a/b.md', time, 'mine'), 'mine/_Archived/2026/11/b_202611231530.md', '个人文件夹只有一层');
	});

	it('没有扩展名、点开头的文件名', () => {
		assert.equal(archiveTarget('Web/README', time), 'Web/_Archived/2026/11/README_202611231530');
		assert.equal(archiveTarget('Web/.hidden', time), 'Web/_Archived/2026/11/.hidden_202611231530');
	});

	it('长文件名截短：英文不超过 120 个字符', () => {
		const out = archiveTarget(`Web/${'x'.repeat(300)}.md`, time);
		const name = out.split('/').pop();
		assert.equal(name.length, MAX_ARCHIVED_NAME_CHARS);
		assert.ok(name.endsWith('_202611231530.md'));
	});

	it('长文件名截短：中文不超过 200 字节，不会把一个字切成两半', () => {
		const name = archiveTarget(`Web/${'汉'.repeat(200)}.md`, time).split('/').pop();
		assert.ok(Buffer.byteLength(name) <= MAX_ARCHIVED_NAME_BYTES, `${Buffer.byteLength(name)} bytes`);
		assert.ok(Buffer.byteLength(name) > MAX_ARCHIVED_NAME_BYTES - 3);
		assert.match(name, /^汉+_202611231530\.md$/);

		const emoji = archiveTarget(`Web/${'😀'.repeat(200)}.md`, time).split('/').pop();
		assert.match(emoji, /^(😀)+_202611231530\.md$/u);
		assert.ok(emoji.length <= MAX_ARCHIVED_NAME_CHARS);
	});

	it('短文件名原样保留', () => {
		assert.equal(archiveTarget('Web/a b.c.md', time), 'Web/_Archived/2026/11/a b.c_202611231530.md');
	});

	it('numbered：同名时加序号', () => {
		assert.equal(numbered('Web/_Archived/2026/11/a_202611231530.md', 2), 'Web/_Archived/2026/11/a_202611231530-2.md');
		assert.equal(numbered('Web/v1.2/README', 3), 'Web/v1.2/README-3');
	});
});

describe('人名整理', () => {
	const none = new Set();

	// 1.0.41 的规则，原样抄过来做对照
	const oldRule = (entries) => Array.from(new Set(entries.flatMap((s) => s.split(/[^a-zA-Z]+/).filter(Boolean).map((str) => str.toLowerCase()))));

	it('只有英文字母的内容，结果和 1.0.41 完全一样', () => {
		const samples = [
			['mark'], ['Mark', 'Wang'], ['Mark, wang'], ['~mark ~wang'], ['mark;wang|anna'], ['mark/wang\\anna'],
			['wang.wei'], ['jean-luc'], ['mark2', 'r2d2'], ["o'brien"], ['  mark  '], ['@mark'], ['mark', 'mark', 'MARK'],
			['[[mark]]'], ['mark (lead)'], ['123'], [''], [], ['mark,', ',wang'], ['a_b'], ['mark\twang'],
		];
		for (const sample of samples) {
			assert.deepEqual(cleanNames(sample, none), oldRule(sample), JSON.stringify(sample));
		}
	});

	it('已经整理过的名单不会再变', () => {
		const tidy = ['mark', 'wang', 'anna'];
		assert.deepEqual(cleanNames(tidy, none), tidy);
		assert.deepEqual(cleanNames(tidy, new Set(['mark', 'jean-luc'])), tidy);
	});

	it('中文名、带重音的名字保留（以前中文名被丢掉，josé 变成 jos）', () => {
		assert.deepEqual(cleanNames(['张三', '李四, 王五'], none), ['张三', '李四', '王五']);
		assert.deepEqual(cleanNames(['José', 'Zoë'], none), ['josé', 'zoë']);
		assert.deepEqual(cleanNames(['张三、李四；王五，赵六'], none), ['张三', '李四', '王五', '赵六']);
		assert.deepEqual(cleanNames(['mark — wang'], none), ['mark', 'wang'], '标点不会变成名字');
	});

	it('协作者名单里的名字整个保留', () => {
		const known = new Set(['jean-luc', 'mark2', 'mary ann', '管理员']);
		assert.deepEqual(cleanNames(['Jean-Luc, mark2', 'wang.wei'], known), ['jean-luc', 'mark2', 'wang', 'wei']);
		assert.deepEqual(cleanNames(['Mary Ann'], known), ['mary ann']);
		assert.deepEqual(cleanNames(['~管理员'], known), ['管理员']);
	});

	it('normalizePeople：被指派的人也在 people 里', () => {
		assert.deepEqual(normalizePeople(['Mark, wang.wei'], ['Mark', 'Anna'], none), { people: ['mark', 'wang', 'wei', 'anna'], assignedTo: ['mark', 'anna'] });
		assert.deepEqual(normalizePeople([], [], none), { people: [], assignedTo: [] });
	});

	it('sameMembers 不看顺序', () => {
		assert.equal(sameMembers(['a', 'b'], ['b', 'a']), true);
		assert.equal(sameMembers(['a', 'b'], ['a']), false);
		assert.equal(sameMembers(['a', 'a'], ['a']), false);
		assert.equal(sameMembers(['a,b'], ['a', 'b']), false);
		assert.equal(sameMembers([], []), true);
	});

	it('asList：缓存里的值', () => {
		assert.deepEqual(asList(['a', null, 'b']), ['a', 'b']);
		assert.deepEqual(asList('a, b'), ['a, b']);
		assert.deepEqual(asList(null), []);
		assert.deepEqual(asList(undefined), []);
		assert.deepEqual(asList(''), []);
		assert.deepEqual(asList(7), ['7']);
	});
});

describe('日期和模板', () => {
	it('updatedDateLine：日期变了才给出新的一行', () => {
		assert.equal(updatedDateLine('updatedDate: 2026-03-30', 'updatedDate:', '2026-11-23'), 'updatedDate: 2026-11-23');
		assert.equal(updatedDateLine('updatedDate: 2026-11-23', 'updatedDate:', '2026-11-23'), null);
		assert.equal(updatedDateLine('updatedDate:2026-11-23', 'updatedDate:', '2026-11-23'), 'updatedDate: 2026-11-23', '格式不标准的整行换掉');
		assert.equal(updatedDateLine('updatedDate: 2026-03-30T00:00:00.000Z', 'updatedDate:', '2026-11-23'), 'updatedDate: 2026-11-23');
		assert.equal(updatedDateLine('createdDate: 2026-03-30', 'updatedDate:', '2026-11-23'), null);
	});

	it('touchLastEditDate：只换属性区里那一行，\\r\\n 换行保留', () => {
		assert.equal(
			touchLastEditDate('---\nstatus: open\nupdatedDate: 2026-03-30\n---\n\nupdatedDate: body\n', 'updatedDate:', '2026-11-23'),
			'---\nstatus: open\nupdatedDate: 2026-11-23\n---\n\nupdatedDate: body\n');
		assert.equal(
			touchLastEditDate('---\r\nupdatedDate: 2026-03-30\r\n---\r\n', 'updatedDate:', '2026-11-23'),
			'---\r\nupdatedDate: 2026-11-23\r\n---\r\n');
		const same = '---\nupdatedDate: 2026-11-23\n---\n';
		assert.equal(touchLastEditDate(same, 'updatedDate:', '2026-11-23'), same);
		const body = '# Title\n\nupdatedDate: 2026-03-30\n';
		assert.equal(touchLastEditDate(body, 'updatedDate:', '2026-11-23'), body, '第一个空行之后的不算');
		assert.equal(touchLastEditDate(same, '', '2026-11-23'), same);
		assert.equal(touchLastEditDate('updatedDate: 2026-03-30', 'updatedDate:', '2026-11-23'), 'updatedDate: 2026-11-23');
	});

	it('fillTemplate 和 1.0.41 的替换一样', () => {
		const template = '---\npeople: \nassignedTo:\ncreatedBy: \ncreatedDate: {{date}}\nupdatedDate: {{DATE}}\n---\n';
		assert.equal(fillTemplate(template, '2026-11-23', 'mark'),
			'---\npeople:\n  - mark\nassignedTo:\ncreatedBy: mark\ncreatedDate: 2026-11-23\nupdatedDate: 2026-11-23\n---\n');
	});
});

describe('SyncHub 权限', () => {
	const perms = parsePermissions({
		schema: 1,
		default: 'none',
		entries: [
			{ path: '研发/设计', level: 'read' },
			{ path: '个人/mark', level: 'write' },
			{ path: '研发', level: 'write' },
			{ path: 'All', level: 'read' },
		],
	});

	it('最具体的规则生效；都不匹配时取默认值', () => {
		assert.equal(levelFor(perms, '研发/a.md'), 'write');
		assert.equal(levelFor(perms, '研发/设计/a.md'), 'read');
		assert.equal(levelFor(perms, '研发/设计稿/a.md'), 'write', '名字相近的文件夹不算');
		assert.equal(levelFor(perms, 'All/status.md'), 'read');
		assert.equal(levelFor(perms, '个人/mark/_Archived/2026/11/a.md'), 'write');
		assert.equal(levelFor(perms, '个人/_Archived/2026/11/a.md'), 'none');
		assert.equal(levelFor(perms, 'a.md'), 'none');
	});

	it('canWrite', () => {
		assert.equal(canWrite(perms, '研发/a.md'), true);
		assert.equal(canWrite(perms, '研发/设计/a.md'), false);
		assert.equal(canWrite(perms, 'a.md'), false);
		assert.equal(canWrite(null, 'anything/a.md'), true, '不在 SyncHub 里：不限制');
	});

	it('格式不对的文件当作没有', () => {
		assert.equal(parsePermissions(null), null);
		assert.equal(parsePermissions('x'), null);
		assert.equal(parsePermissions([]), null);
		assert.deepEqual(parsePermissions({ entries: [{ path: 'a/', level: 'write' }, { path: 'b', level: 'admin' }, 'junk'] }), { defaultLevel: 'none', entries: [{ path: 'a', level: 'write' }] });
	});
});
