import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasFrontmatter, readFrontmatterList, renderList, renderScalar, setFrontmatterKey, yamlScalar } from './.build/frontmatter.mjs';

const NOTE = [
	'---',
	'people: Mark, wang.wei',
	'assignedTo: Mark',
	'createdDate: 2026-03-01',
	'updatedDate: 2026-03-30',
	'dueDate:',
	'# keep this comment',
	'figma: "https://example.com/a?b=1"',
	'tags: [a, b]',
	'status:  open',
	'---',
	'# Title',
	'',
	'status: this line is in the body',
	'',
].join('\n');

// 除了下标在 except 里的行，两段文字逐行相同
function sameExcept(before, after, except) {
	const a = before.split('\n');
	const b = after.split('\n');
	assert.equal(b.length, a.length, 'line count');
	a.forEach((line, i) => {
		if (!except.includes(i)) assert.equal(b[i], line, `line ${i} must not change`);
	});
}

describe('setFrontmatterKey：只换一个字段', () => {
	it('改 status 只动那一行，日期、空字段、注释、引号、正文都不变', () => {
		const out = setFrontmatterKey(NOTE, 'status', renderScalar('status', 'closed'));
		sameExcept(NOTE, out, [9]);
		assert.equal(out.split('\n')[9], 'status: closed');
	});

	it('值没有变化时返回的就是原文', () => {
		const text = '---\nstatus: open\n---\nbody\n';
		assert.equal(setFrontmatterKey(text, 'status', renderScalar('status', 'open')), text);
	});

	it('属性区里没有这个字段：返回 null，不去碰正文里长得像的行', () => {
		const text = '---\ntype: task\n---\nstatus: body line\n';
		assert.equal(setFrontmatterKey(text, 'status', renderScalar('status', 'closed')), null);
	});

	it('没有属性区、属性区没有结尾、--- 不在第一行：都返回 null', () => {
		assert.equal(setFrontmatterKey('status: open\n', 'status', ['status: x']), null);
		assert.equal(setFrontmatterKey('---\nstatus: open\n', 'status', ['status: x']), null);
		assert.equal(setFrontmatterKey('\n---\nstatus: open\n---\n', 'status', ['status: x']), null);
		assert.equal(setFrontmatterKey('', 'status', ['status: x']), null);
		// 正文里的两条分隔线之间不是属性区
		assert.equal(setFrontmatterKey('# Title\n\n---\nstatus: open\n---\n', 'status', ['status: x']), null);
	});

	it('字段名要完全一致：status 不会匹配 statusNote，也不会匹配缩进的 status', () => {
		const text = '---\nstatusNote: a\nmeta:\n  status: nested\nstatus: open\n---\n';
		assert.equal(setFrontmatterKey(text, 'status', ['status: closed']), '---\nstatusNote: a\nmeta:\n  status: nested\nstatus: closed\n---\n');
		assert.equal(setFrontmatterKey('---\nstatus:open\n---\n', 'status', ['status: closed']), null, '"status:open" 不是一个字段');
	});

	it('多行的值整个换掉，后面的字段不受影响', () => {
		const text = '---\npeople:\n  - Mark\n  - wang\nstatus: open\n---\nbody\n';
		assert.equal(
			setFrontmatterKey(text, 'people', renderList('people', ['mark', 'wang', 'anna'])),
			'---\npeople:\n  - mark\n  - wang\n  - anna\nstatus: open\n---\nbody\n');
	});

	it('不缩进的列表、列表中间的空行和注释都算这个字段的；字段后面的注释不算', () => {
		const text = '---\npeople:\n- a\n\n# who else\n- b\n# about status\nstatus: open\n---\n';
		assert.equal(setFrontmatterKey(text, 'people', renderList('people', ['a'])), '---\npeople:\n  - a\n# about status\nstatus: open\n---\n');
	});

	it('一行里的列表换成多行', () => {
		assert.equal(setFrontmatterKey('---\npeople: [Mark, wang]\n---\n', 'people', renderList('people', ['mark', 'wang'])), '---\npeople:\n  - mark\n  - wang\n---\n');
	});

	it('空列表写成 []', () => {
		assert.equal(setFrontmatterKey('---\nassignedTo: Mark\n---\n', 'assignedTo', renderList('assignedTo', [])), '---\nassignedTo: []\n---\n');
	});

	it('addIfMissing：加在属性区最后；空的属性区也可以', () => {
		assert.equal(setFrontmatterKey('---\ntype: task\n---\nbody', 'assignedTo', renderList('assignedTo', ['mark']), true), '---\ntype: task\nassignedTo:\n  - mark\n---\nbody');
		assert.equal(setFrontmatterKey('---\n---\nbody', 'status', ['status: open'], true), '---\nstatus: open\n---\nbody');
	});

	it('\\r\\n 换行的笔记：没动的行原样保留，新写的行也用 \\r\\n', () => {
		const text = '---\r\ntype: task\r\npeople: Mark\r\nstatus: open\r\n---\r\nbody\r\n';
		assert.equal(
			setFrontmatterKey(text, 'people', renderList('people', ['mark', 'wang'])),
			'---\r\ntype: task\r\npeople:\r\n  - mark\r\n  - wang\r\nstatus: open\r\n---\r\nbody\r\n');
	});

	it('文件开头有 BOM 也认', () => {
		const bom = String.fromCharCode(0xFEFF);
		assert.equal(setFrontmatterKey(bom + '---\nstatus: open\n---\n', 'status', ['status: closed']), bom + '---\nstatus: closed\n---\n');
	});

	it('属性区以 ... 结尾时到那里为止', () => {
		assert.equal(setFrontmatterKey('---\ntype: task\n...\nstatus: open\n---\n', 'status', ['status: closed']), null);
	});

	it('hasFrontmatter', () => {
		assert.equal(hasFrontmatter(NOTE), true);
		assert.equal(hasFrontmatter('# Title\n'), false);
		assert.equal(hasFrontmatter('---\nno end\n'), false);
	});
});

describe('readFrontmatterList：读列表字段', () => {
	const read = (yaml, key = 'people') => readFrontmatterList(`---\n${yaml}\n---\n`, key);

	it('三种常见写法', () => {
		assert.deepEqual(read('people:\n  - mark\n  - wang'), { items: ['mark', 'wang'] });
		assert.deepEqual(read('people:\n- mark\n- wang'), { items: ['mark', 'wang'] });
		assert.deepEqual(read('people: [mark, "wang wei", \'anna\']'), { items: ['mark', 'wang wei', 'anna'] });
		assert.deepEqual(read('people: Mark, wang.wei'), { items: ['Mark, wang.wei'] });
		assert.deepEqual(read('people: ~mark ~wang'), { items: ['~mark ~wang'] });
	});

	it('空值', () => {
		assert.deepEqual(read('people:'), { items: [] });
		assert.deepEqual(read('people: []'), { items: [] });
		assert.deepEqual(read('people: null'), { items: [] });
		assert.deepEqual(read('people: ~'), { items: [] });
		assert.deepEqual(read('people:\n  -\n  - mark'), { items: ['mark'] });
	});

	it('注释和引号', () => {
		assert.deepEqual(read('people: mark # lead'), { items: ['mark'] });
		assert.deepEqual(read('people:\n  - "mark" # lead\n  # nobody else\n  - \'o\'\'brien\''), { items: ['mark', "o'brien"] });
		assert.deepEqual(read('people: ["a, b", c] # two'), { items: ['a, b', 'c'] });
		assert.deepEqual(read('people: "say \\"hi\\""'), { items: ['say "hi"'] });
	});

	it('没有这个字段、没有属性区：null', () => {
		assert.equal(read('status: open'), null);
		assert.equal(readFrontmatterList('people: mark\n', 'people'), null);
	});

	it('读不懂的写法：items 为 null', () => {
		assert.deepEqual(read('people:\n  - name: mark\n    role: lead'), { items: null }, '嵌套的映射');
		assert.deepEqual(read('people: [\n  mark,\n  wang\n]'), { items: null }, '跨行的 [ ]');
		assert.deepEqual(read('people: |\n  mark\n  wang'), { items: null }, '多行文字');
		assert.deepEqual(read('people: mark\n  wang'), { items: null }, '跨行的值');
		assert.deepEqual(read('people: [[a, b], c]'), { items: null }, '嵌套的列表');
		assert.deepEqual(read('people: &team [mark]'), { items: null }, '锚点');
		assert.deepEqual(read('people:\n  - "mark\\n"'), { items: null }, '带转义的字符串');
		assert.deepEqual(read('people: {a: 1}'), { items: null }, '映射');
		assert.deepEqual(read('people:\n  - - nested'), { items: null }, '列表里的列表');
	});
});

describe('yamlScalar：值怎么写', () => {
	it('普通的词直接写', () => {
		for (const value of ['open', 'WIP', 'in progress', 'to-do', 'v1.2', '已完成', 'josé', 'mark_w']) {
			assert.equal(yamlScalar(value), value);
		}
	});

	it('会被 YAML 当成别的东西的值加引号', () => {
		assert.equal(yamlScalar('2026-03-30'), '"2026-03-30"');
		assert.equal(yamlScalar('123'), '"123"');
		assert.equal(yamlScalar('true'), '"true"');
		assert.equal(yamlScalar('No'), '"No"');
		assert.equal(yamlScalar('null'), '"null"');
		assert.equal(yamlScalar('a: b'), '"a: b"');
		assert.equal(yamlScalar('n/a'), '"n/a"');
		assert.equal(yamlScalar('#1'), '"#1"');
		assert.equal(yamlScalar('- x'), '"- x"');
		assert.equal(yamlScalar(''), '""');
		assert.equal(yamlScalar('done '), '"done "');
		assert.equal(yamlScalar('say "hi"'), '"say \\"hi\\""');
	});

	it('写出去的值读回来还是它', () => {
		for (const value of ['open', 'in progress', '2026-03-30', 'a: b', 'say "hi"', 'back\\slash', '已完成', 'true']) {
			const text = `---\n${renderList('people', [value]).join('\n')}\n---\n`;
			assert.deepEqual(readFrontmatterList(text, 'people'), { items: [value] });
		}
	});
});
