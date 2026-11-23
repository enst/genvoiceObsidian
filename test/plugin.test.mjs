// 整个插件接在假的 Obsidian 上跑（test/fake-obsidian.mjs）。
// 每个测试描述一件 “人做的事” 或者 “同步过来的事”，然后看插件改了什么、没改什么。
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { GenVoicePlugin, Menu, World, moment, notices, openModals } from './.build/plugin.mjs';

let world;

async function start(notes, hidden = {}, settings = { username: 'mark' }) {
	notices.length = 0;
	openModals.length = 0;
	world = new World({
		'All/status.md': 'open\npending\nWIP\nclosed\narchived\n',
		'All/Collaborators/mark.md': '',
		'All/Collaborators/wang.md': '',
		'All/Collaborators/anna.md': '',
		'All/Templates/Task.md': '---\ntype: task\nstatus: open\npeople: \nassignedTo:\ncreatedBy: \ncreatedDate: {{date}}\nupdatedDate: {{date}}\n---\n# Task\n\n+++\n\n',
		...notes,
	}, hidden);
	await world.start(GenVoicePlugin, settings);
	return world;
}

afterEach(() => {
	if (world) world.stop();
	world = undefined;
});

const today = () => moment().format('YYYY-MM-DD');
const archivedPath = (root, base) => `${root}/_Archived/${moment().format('YYYY')}/${moment().format('MM')}/${base}_${moment().format('YYYYMMDDHHmm')}.md`;

// 一篇典型的任务笔记。第 2 行（从 0 数）是 status
const task = ({ status = 'open', people = 'people:\n  - mark', assignedTo = 'assignedTo:\n  - mark' } = {}) => [
	'---',
	'type: task',
	`status: ${status}`,
	people,
	assignedTo,
	'createdDate: 2026-03-01',
	'updatedDate: 2026-03-30',
	'dueDate:',
	'# keep this comment',
	'figma: "https://example.com/a?b=1"',
	'---',
	'# Task',
	'',
	'first paragraph',
	'',
].join('\n');

const MESSY = { people: 'people: Mark, wang.wei', assignedTo: 'assignedTo: Mark' };
const lineOf = (text, start) => text.split('\n').findIndex((line) => line.startsWith(start));
const withToday = (text) => text.replace('updatedDate: 2026-03-30', `updatedDate: ${today()}`);

const synchub = (entries, personal = '个人/mark') => ({
	'.synchub/client-config.json': JSON.stringify({ schema: 1, personal_dir: personal }),
	'.synchub/permissions.json': JSON.stringify({ schema: 1, default: 'none', entries }),
});

function nothingHappened() {
	assert.deepEqual(world.fileWrites, [], 'the plugin must not write any file');
	assert.deepEqual(world.renames, [], 'the plugin must not move any file');
}

describe('别人的改动同步过来：插件什么都不做', () => {
	it('没打开的笔记被别人归档、名单没整理：不移动、不改写', async () => {
		await start({ 'Web/a.md': task() });
		const remote = task({ status: 'archived', ...MESSY });
		await world.remoteWrite('Web/a.md', remote);
		nothingHappened();
		assert.equal(world.text('Web/a.md'), remote);
	});

	it('正开着、正用键盘翻看的笔记被别人改了：编辑器载入新内容，日期不动、不整理、不归档', async () => {
		await start({ 'Web/a.md': task() });
		const editor = world.open('Web/a.md');
		world.touch();
		const remote = task({ status: 'archived', ...MESSY });
		await world.remoteWrite('Web/a.md', remote);
		world.touch();
		await world.settle();
		nothingHappened();
		assert.equal(editor.changes, 0, 'the plugin must not edit the editor');
		assert.equal(editor.getValue(), remote);
	});

	it('别人连续改同一篇开着的笔记也一样', async () => {
		await start({ 'Web/a.md': task() });
		const editor = world.open('Web/a.md');
		for (let i = 0; i < 5; i++) {
			world.touch();
			await world.remoteWrite('Web/a.md', task({ status: 'archived', ...MESSY }) + `remote ${i}\n`);
		}
		nothingHappened();
		assert.equal(editor.changes, 0);
	});

	it('只是打开看了看再离开：不改', async () => {
		await start({ 'Web/a.md': task(MESSY), 'Web/b.md': task(MESSY) });
		world.open('Web/a.md');
		world.touch();
		await world.switchTo('Web/b.md');
		await world.switchTo('Web/a.md');
		nothingHappened();
	});

	it('同步过来的新的空笔记不弹模板窗口', async () => {
		await start({ 'Web/a.md': task() });
		world.open('Web/a.md');
		world.touch();
		await world.remoteWrite('Web/new.md', '');
		assert.equal(openModals.length, 0);
	});

	it('别人改了状态词表：菜单跟着更新', async () => {
		await start({});
		assert.deepEqual(world.plugin.statusOptions, ['WIP', 'archived', 'closed', 'open', 'pending']);
		await world.remoteWrite('All/status.md', 'open\nblocked\n');
		assert.deepEqual(world.plugin.statusOptions, ['blocked', 'open']);
	});
});

describe('本人编辑', () => {
	it('打字：updatedDate 换成今天，只换一次，其他行不变', async () => {
		await start({ 'Web/a.md': task() });
		const editor = world.open('Web/a.md');
		world.cursorTo('first paragraph');
		await world.type('x');
		await world.type('y');
		await world.type('z');
		assert.equal(editor.changes, 1, 'the date line is replaced once, not on every key');
		assert.equal(editor.getValue(), withToday(task()).replace('first paragraph', 'xyzfirst paragraph'));
		await world.save();
		assert.equal(world.text('Web/a.md'), editor.getValue());
		nothingHappened();
	});

	it('今天已经改过的笔记：再打字不产生任何额外修改', async () => {
		await start({});
		world.put('Web/a.md', withToday(task()));
		const editor = world.open('Web/a.md');
		world.cursorTo('first paragraph');
		await world.type('x');
		await world.save();
		await world.type('y');
		assert.equal(editor.changes, 0);
	});

	it('光标停在 updatedDate 那一行时不动它（可以手改日期）', async () => {
		await start({ 'Web/a.md': task() });
		const editor = world.open('Web/a.md');
		const line = lineOf(editor.getValue(), 'updatedDate:');
		await world.edit(line, 'updatedDate: 2026-01-0');
		assert.equal(editor.changes, 0);
		assert.equal(editor.getLine(line), 'updatedDate: 2026-01-0');
	});

	it('名单没整理过的笔记：保存后只改 people 和 assignedTo，日期、注释、引号、空字段原样', async () => {
		await start({ 'Web/a.md': task(MESSY) });
		const editor = world.open('Web/a.md');
		world.cursorTo('first paragraph');
		await world.type('x');
		await world.save();
		const expected = withToday(task({ people: 'people:\n  - mark\n  - wang\n  - wei', assignedTo: 'assignedTo:\n  - mark' }))
			.replace('first paragraph', 'xfirst paragraph');
		assert.equal(world.text('Web/a.md'), expected);
		assert.equal(editor.getValue(), expected, 'the editor shows the same');
		assert.deepEqual(world.fileWrites, ['Web/a.md'], 'one write, no rewriting loop');
		assert.deepEqual(world.renames, []);
	});

	it('把 status 改成 archived：保存后移到 <顶层>/_Archived/年/月/，只移动一次', async () => {
		await start({ 'Web/项目A/登录页.md': task() });
		world.open('Web/项目A/登录页.md');
		await world.edit(2, 'status: archived');
		assert.deepEqual(world.renames, [], 'not before the note is saved');
		await world.save();
		assert.deepEqual(world.renames, [['Web/项目A/登录页.md', archivedPath('Web', '登录页')]]);
		assert.deepEqual(world.fileWrites, []);
		assert.deepEqual(notices, []);
	});

	it('改成 archived 之后没等自动保存就切到别的笔记：照样归档', async () => {
		await start({ 'Web/a.md': task(), 'Web/b.md': task() });
		world.open('Web/a.md');
		await world.edit(2, 'status: archived');
		await world.switchTo('Web/b.md');
		assert.deepEqual(world.renames, [['Web/a.md', archivedPath('Web', 'a')]]);
	});

	it('同一次保存里既要整理名单又要归档：先整理，再归档，各一次', async () => {
		await start({ 'Web/a.md': task(MESSY) });
		world.open('Web/a.md');
		await world.edit(2, 'status: archived');
		await world.save();
		const to = archivedPath('Web', 'a');
		assert.deepEqual(world.renames, [['Web/a.md', to]]);
		assert.deepEqual(world.fileWrites, ['Web/a.md']);
		assert.match(world.text(to), /^people:\n  - mark\n  - wang\n  - wei\nassignedTo:\n  - mark$/m);
		assert.match(world.text(to), /^createdDate: 2026-03-01$/m);
	});

	it('已经在 _Archived 里的笔记再编辑：不会再移动', async () => {
		await start({ 'Web/_Archived/2026/03/a_202603301200.md': task({ status: 'archived' }) });
		const editor = world.open('Web/_Archived/2026/03/a_202603301200.md');
		world.cursorTo('first paragraph');
		await world.type('x');
		await world.save();
		assert.deepEqual(world.renames, []);
		assert.equal(editor.getLine(lineOf(editor.getValue(), 'updatedDate:')), `updatedDate: ${today()}`);
	});

	it('库的根目录下的笔记改成 archived：提示，不移动', async () => {
		await start({ 'loose.md': task() });
		world.open('loose.md');
		await world.edit(2, 'status: archived');
		await world.save();
		assert.deepEqual(world.renames, []);
		assert.deepEqual(notices, ['Not archived: move this note into a folder first']);
	});

	it('归档位置已经有同名文件：加序号，不覆盖', async () => {
		await start({ 'Web/a.md': task() });
		world.open('Web/a.md');
		world.put(archivedPath('Web', 'a'), 'someone else\n');
		await world.edit(2, 'status: archived');
		await world.save();
		const taken = archivedPath('Web', 'a');
		assert.deepEqual(world.renames, [['Web/a.md', taken.replace(/\.md$/, '-2.md')]]);
		assert.equal(world.text(taken), 'someone else\n');
	});

	it('template 文件夹里的文件：不改日期、不整理、不归档', async () => {
		await start({});
		world.put('All/Templates/Old.md', task({ status: 'archived', ...MESSY }));
		const editor = world.open('All/Templates/Old.md');
		world.cursorTo('first paragraph');
		await world.type('x');
		await world.save();
		nothingHappened();
		assert.equal(editor.changes, 0);
	});

	it('在 +++ 下面写新内容：自动插入分隔线、日期和用户名，只插一次', async () => {
		await start({ 'Web/a.md': `---\ntype: task\npeople:\n  - mark\nupdatedDate: ${'2026-03-30'}\n---\n# Task\n\n+++\n\n` });
		const editor = world.open('Web/a.md');
		editor.setCursor({ line: 10, ch: 0 });
		await world.type('n');
		await world.type('e');
		await world.type('w');
		const text = editor.getValue();
		assert.equal(text.split('___').length - 1, 1, 'one separator');
		assert.ok(text.includes(`+++\n\n\n___\n${today()} mark\nnew\n`), text);
	});
});

describe('菜单和命令', () => {
	const openMenu = (editor) => {
		const menu = new Menu();
		world.touch();
		world.workspaceEvents.emitSync('editor-menu', menu, editor, {});
		return menu;
	};

	it('Set Task Status：子菜单是状态词表；选了以后只改 status 那一行', async () => {
		await start({ 'Web/a.md': task() });
		const editor = world.open('Web/a.md');
		const menu = openMenu(editor);
		assert.deepEqual(menu.items.map((item) => item.title), ['Set Task Status', 'Assign Task To']);
		const choices = menu.items[0].submenu.items;
		assert.deepEqual(choices.map((item) => item.title), ['WIP', 'archived', 'closed', 'open', 'pending']);
		await choices.find((item) => item.title === 'closed').click();
		await world.settle();
		assert.equal(world.text('Web/a.md'), withToday(task({ status: 'closed' })), 'the status line and the date, nothing else');
		assert.equal(editor.getValue(), world.text('Web/a.md'), 'the editor shows the same');
		assert.deepEqual(world.fileWrites, ['Web/a.md'], 'one write');
		assert.deepEqual(world.renames, []);

		await choices.find((item) => item.title === 'closed').click();
		await world.settle();
		assert.deepEqual(world.fileWrites, ['Web/a.md'], 'choosing the status it already has writes nothing');
	});

	it('Set Task Status 选 archived：改完就归档', async () => {
		await start({ 'Web/a.md': task() });
		const menu = openMenu(world.open('Web/a.md'));
		await menu.items[0].submenu.items.find((item) => item.title === 'archived').click();
		await world.settle();
		assert.deepEqual(world.renames, [['Web/a.md', archivedPath('Web', 'a')]]);
	});

	it('Set Task Status：正文里以 status: 开头的行不会被改', async () => {
		await start({ 'Web/a.md': '---\ntype: note\n---\nstatus: body line\n' });
		const menu = openMenu(world.open('Web/a.md'));
		await menu.items[0].submenu.items[0].click();
		await world.settle();
		nothingHappened();
		assert.deepEqual(notices, ['No status field found in current file']);
	});

	it('Assign Task To：选的人加进 assignedTo 和 people', async () => {
		await start({ 'Web/a.md': task() });
		const menu = openMenu(world.open('Web/a.md'));
		menu.items[1].click();
		assert.equal(openModals.length, 1);
		assert.deepEqual(openModals[0].getSuggestions(''), ['anna', 'mark', 'wang']);
		assert.deepEqual(openModals[0].getSuggestions('AN'), ['anna', 'wang']);
		openModals[0].onChooseSuggestion('wang');
		await world.settle();
		assert.equal(world.text('Web/a.md'), withToday(task({ people: 'people:\n  - mark\n  - wang', assignedTo: 'assignedTo:\n  - mark\n  - wang' })));
		assert.deepEqual(world.fileWrites, ['Web/a.md']);
	});

	it('Assign Task To：窗口开着时当前笔记换了，改的仍然是点菜单时的那一篇', async () => {
		await start({ 'Web/a.md': task(), 'Web/b.md': task() });
		const menu = openMenu(world.open('Web/a.md'));
		menu.items[1].click();
		world.open('Web/b.md');
		openModals[0].onChooseSuggestion('anna');
		await world.settle();
		assert.match(world.text('Web/a.md'), /assignedTo:\n  - mark\n  - anna/);
		assert.equal(world.text('Web/b.md'), task());
	});

	it('Validate People in Folder：只处理这个文件夹（含子文件夹），名字相近的文件夹不受影响', async () => {
		await start({
			'Web/A/1.md': task(MESSY),
			'Web/A/sub/2.md': task(MESSY),
			'Web/AB/3.md': task(MESSY),
			'Web/A/4.md': task(),
		});
		world.open('Web/A/1.md');
		const command = world.plugin.commands.find((c) => c.id === 'validate-people-in-folder');
		assert.equal(command.checkCallback(true), true);
		command.checkCallback(false);
		await world.settle();
		assert.deepEqual([...world.fileWrites].sort(), ['Web/A/1.md', 'Web/A/sub/2.md']);
		assert.equal(world.text('Web/AB/3.md'), task(MESSY));
		assert.match(world.text('Web/A/sub/2.md'), /^createdDate: 2026-03-01\nupdatedDate: 2026-03-30\ndueDate:\n# keep this comment$/m);
		assert.equal(notices[notices.length - 1], 'Validated 3 files: 2 updated');
	});

	it('Validate People in Folder：在库的根目录下的笔记上运行，不做全库改写', async () => {
		await start({ 'loose.md': task(MESSY), 'Web/a.md': task(MESSY) });
		world.open('loose.md');
		world.plugin.commands[0].checkCallback(false);
		await world.settle();
		nothingHappened();
	});
});

describe('新建笔记时选模板', () => {
	it('新建空笔记：弹出模板列表，选中的模板填好日期和本人', async () => {
		await start({});
		await world.create('Web/new.md');
		assert.equal(openModals.length, 1);
		assert.deepEqual(openModals[0].getSuggestions('').map((file) => file.path), ['All/Templates/Task.md']);
		await openModals[0].onChooseSuggestion(world.file('All/Templates/Task.md'));
		await world.settle();
		assert.equal(world.text('Web/new.md'),
			`---\ntype: task\nstatus: open\npeople:\n  - mark\nassignedTo:\ncreatedBy: mark\ncreatedDate: ${today()}\nupdatedDate: ${today()}\n---\n# Task\n\n+++\n\n`);
		assert.deepEqual(world.fileWrites, ['Web/new.md'], 'the template is written once and nothing rewrites it afterwards');
	});

	it('窗口开着时当前笔记换了：模板仍然写进新建的那篇，别的笔记不受影响', async () => {
		await start({ 'Web/other.md': task() });
		await world.create('Web/new.md');
		world.open('Web/other.md');
		await openModals[0].onChooseSuggestion(world.file('All/Templates/Task.md'));
		await world.settle();
		assert.equal(world.text('Web/other.md'), task());
		assert.match(world.text('Web/new.md'), /^---\ntype: task\n/);
	});

	it('中文用户名：填进 people 以后不会被整理掉', async () => {
		await start({}, {}, { username: '管理员' });
		await world.create('Web/new.md');
		await openModals[0].onChooseSuggestion(world.file('All/Templates/Task.md'));
		await world.settle();
		const editor = world.editor;
		editor.setCursor({ line: editor.lineCount() - 1, ch: 0 });
		await world.type('x');
		await world.save();
		assert.match(world.text('Web/new.md'), /^people:\n  - 管理员\nassignedTo:\ncreatedBy: 管理员$/m);
	});

	it('新建的笔记不是空的、或者新建后已经被删掉：不弹窗口，不报错', async () => {
		await start({});
		world.touch();
		const file = world.put('Web/gone.md', '', world.now);
		world.vaultEvents.emitSync('create', file);
		world.open('Web/gone.md');
		world.entries.delete('Web/gone.md');
		await world.runTimers();
		assert.equal(openModals.length, 0);
	});
});

describe('在 SyncHub 里', () => {
	it('个人文件夹里的笔记归档到个人文件夹自己的 _Archived 下', async () => {
		await start({ '个人/mark/todo.md': task() }, synchub([{ path: '个人/mark', level: 'write' }, { path: 'All', level: 'read' }]));
		world.open('个人/mark/todo.md');
		await world.edit(2, 'status: archived');
		await world.save();
		assert.deepEqual(world.renames, [['个人/mark/todo.md', archivedPath('个人/mark', 'todo')]]);
	});

	it('只读的笔记：不改日期、不整理名单；菜单会提示只读', async () => {
		await start({ 'All/guide.md': task(MESSY) }, synchub([{ path: 'All', level: 'read' }]));
		const editor = world.open('All/guide.md');
		world.cursorTo('first paragraph');
		await world.type('x');
		await world.save();
		assert.equal(editor.changes, 0);
		nothingHappened();

		await world.plugin.setStatusInActiveFile('closed');
		await world.settle();
		nothingHappened();
		assert.deepEqual(notices, ['This note is read-only for you']);
	});

	it('归档的目标文件夹不可写：提示本人，笔记留在原处', async () => {
		await start({ 'Web/项目A/a.md': task() }, synchub([{ path: 'Web/项目A', level: 'write' }, { path: 'Web', level: 'read' }]));
		world.open('Web/项目A/a.md');
		await world.edit(2, 'status: archived');
		await world.save();
		assert.deepEqual(world.renames, []);
		assert.equal(notices.length, 1);
		assert.match(notices[0], /^Not archived: you do not have write access to Web\/_Archived\/\d{4}\/\d{2}$/);
		assert.ok(world.file('Web/项目A/a.md'));
	});

	it('Validate People in Folder 跳过只读的笔记', async () => {
		await start(
			{ 'Web/A/1.md': task(MESSY), 'Web/A/locked/2.md': task(MESSY) },
			synchub([{ path: 'Web/A/locked', level: 'read' }, { path: 'Web', level: 'write' }]));
		world.open('Web/A/1.md');
		world.plugin.commands[0].checkCallback(false);
		await world.settle();
		assert.deepEqual(world.fileWrites, ['Web/A/1.md']);
		assert.equal(notices[notices.length - 1], 'Validated 2 files: 1 updated, 1 read-only skipped');
	});

	it('权限文件后来变了：十几秒后按新的权限来', async () => {
		await start({ 'Web/a.md': task() }, synchub([{ path: 'Web', level: 'read' }]));
		const editor = world.open('Web/a.md');
		world.cursorTo('first paragraph');
		await world.type('x');
		assert.equal(editor.changes, 0, 'read-only: no date update');
		world.hidden.set('.synchub/permissions.json', JSON.stringify({ schema: 1, default: 'none', entries: [{ path: 'Web', level: 'write' }] }));
		world.now += 20_000;
		await world.type('y');
		await world.type('z');
		assert.equal(editor.getLine(lineOf(editor.getValue(), 'updatedDate:')), `updatedDate: ${today()}`);
	});
});
