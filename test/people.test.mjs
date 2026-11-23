import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assignInText, setStatusInText, tidyPeopleText } from './.build/people.mjs';

const known = new Set(['mark', 'wang', 'anna']);

describe('tidyPeopleText：整理 people 和 assignedTo', () => {
	it('1.0.41 会改坏的那篇笔记：现在只有 people、assignedTo 两处变化', () => {
		const before = [
			'---',
			'people: Mark, wang.wei',
			'assignedTo: Mark',
			'createdDate: 2026-03-01',
			'updatedDate: 2026-03-30',
			'dueDate:',
			'# keep this comment',
			'figma: "https://example.com/a?b=1"',
			'---',
			'body',
			'',
		].join('\n');
		const after = [
			'---',
			'people:',
			'  - mark',
			'  - wang',
			'  - wei',
			'assignedTo:',
			'  - mark',
			'createdDate: 2026-03-01',
			'updatedDate: 2026-03-30',
			'dueDate:',
			'# keep this comment',
			'figma: "https://example.com/a?b=1"',
			'---',
			'body',
			'',
		].join('\n');
		assert.equal(tidyPeopleText(before, new Set()), after);
	});

	it('整理过的笔记再整理一遍：原文不变', () => {
		const text = '---\npeople:\n  - mark\n  - wang\nassignedTo:\n  - mark\n---\n';
		assert.equal(tidyPeopleText(text, known), text);
	});

	it('只有一个字段需要改时，另一个字段的写法原样保留', () => {
		assert.equal(
			tidyPeopleText('---\npeople: [mark, anna]\nassignedTo: Wang\n---\n', known),
			'---\npeople:\n  - mark\n  - anna\n  - wang\nassignedTo:\n  - wang\n---\n');
		assert.equal(
			tidyPeopleText('---\npeople: Mark\nassignedTo:\n---\n', known),
			'---\npeople:\n  - mark\nassignedTo:\n---\n', '空的 assignedTo 不会被写成 []');
		assert.equal(tidyPeopleText('---\npeople: mark\nassignedTo: mark\n---\n', known), '---\npeople: mark\nassignedTo: mark\n---\n', '单个值写法、内容已经对的，不改');
	});

	it('缺一个字段、或者没有属性区：不动', () => {
		for (const text of ['---\npeople: Mark\n---\n', '---\nassignedTo: Mark\n---\n', 'people: Mark\nassignedTo: Mark\n', '']) {
			assert.equal(tidyPeopleText(text, known), text);
		}
	});

	it('写法读不懂的笔记：不动', () => {
		const text = '---\npeople:\n  - name: Mark\nassignedTo: Mark\n---\n';
		assert.equal(tidyPeopleText(text, known), text);
	});

	it('去重，被指派的人补进 people', () => {
		assert.equal(
			tidyPeopleText('---\npeople:\n  - mark\n  - mark\nassignedTo:\n  - anna\n---\n', known),
			'---\npeople:\n  - mark\n  - anna\nassignedTo:\n  - anna\n---\n');
	});
});

describe('assignInText：Assign Task To', () => {
	it('加进 assignedTo，也加进 people', () => {
		assert.deepEqual(
			assignInText('---\npeople:\n  - mark\nassignedTo:\nstatus: open\n---\nbody\n', 'wang', known),
			{ text: '---\npeople:\n  - mark\n  - wang\nassignedTo:\n  - wang\nstatus: open\n---\nbody\n' });
	});

	it('已经指派过的人再指派一次：不变', () => {
		const text = '---\npeople:\n  - mark\n  - wang\nassignedTo:\n  - wang\n---\n';
		assert.deepEqual(assignInText(text, 'wang', known), { text });
	});

	it('没有 assignedTo 字段：加上；没有 people 字段：不加 people', () => {
		assert.deepEqual(assignInText('---\ntype: task\n---\n', 'wang', known), { text: '---\ntype: task\nassignedTo:\n  - wang\n---\n' });
	});

	it('顺手把原来的名单整理好', () => {
		assert.deepEqual(
			assignInText('---\npeople: Mark\nassignedTo: Mark\n---\n', 'anna', known),
			{ text: '---\npeople:\n  - mark\n  - anna\nassignedTo:\n  - mark\n  - anna\n---\n' });
	});

	it('没有属性区、写法读不懂：不改，并说明原因', () => {
		assert.deepEqual(assignInText('# Title\n', 'wang', known), { text: '# Title\n', problem: 'no-properties' });
		const odd = '---\npeople:\n  - name: mark\nassignedTo:\n---\n';
		assert.deepEqual(assignInText(odd, 'wang', known), { text: odd, problem: 'unreadable' });
	});
});

describe('setStatusInText：Set Task Status', () => {
	it('只改属性区里的 status', () => {
		assert.equal(
			setStatusInText('---\nstatus:  open\nupdatedDate: 2026-03-30\n---\nstatus: body line\n', 'closed'),
			'---\nstatus: closed\nupdatedDate: 2026-03-30\n---\nstatus: body line\n');
		assert.equal(setStatusInText('---\nstatus:\n---\n', 'in progress'), '---\nstatus: in progress\n---\n');
	});

	it('属性区里没有 status：null（以前会改掉正文里第一行以 status: 开头的内容）', () => {
		assert.equal(setStatusInText('---\ntype: task\n---\nstatus: body line\n', 'closed'), null);
		assert.equal(setStatusInText('status: body line\n', 'closed'), null);
	});
});
