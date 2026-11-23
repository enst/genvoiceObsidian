// 对笔记全文做的几种改写。都是 “原文 → 新文”，只动属性区里相关的那几行。
// 纯函数，不依赖 Obsidian。测试见 test/people.test.mjs。

import { hasFrontmatter, readFrontmatterList, renderList, renderScalar, setFrontmatterKey } from './frontmatter';
import { normalizePeople, sameMembers } from './logic';

// 整理 people 和 assignedTo：一行一个名字、小写、去重，被指派的人也在 people 里。
// 只处理两个字段都有的笔记。不需要改、或者字段的写法读不懂时，原样返回。
export function tidyPeopleText(text: string, known: ReadonlySet<string>): string {
	const people = readFrontmatterList(text, 'people');
	const assignedTo = readFrontmatterList(text, 'assignedTo');
	if (!people || !assignedTo || people.items === null || assignedTo.items === null) return text;
	const next = normalizePeople(people.items, assignedTo.items, known);
	let out = text;
	// 哪个字段变了才改哪个字段
	if (!sameMembers(people.items, next.people)) {
		out = setFrontmatterKey(out, 'people', renderList('people', next.people)) ?? out;
	}
	if (!sameMembers(assignedTo.items, next.assignedTo)) {
		out = setFrontmatterKey(out, 'assignedTo', renderList('assignedTo', next.assignedTo)) ?? out;
	}
	return out;
}

export interface AssignResult {
	text: string;
	// 没改成的原因。no-properties：笔记没有属性区；unreadable：字段的写法读不懂
	problem?: 'no-properties' | 'unreadable';
}

// 把一个人加进 assignedTo（没有这个字段就加上）；笔记有 people 字段的话，他也要在里面。
export function assignInText(text: string, name: string, known: ReadonlySet<string>): AssignResult {
	if (!hasFrontmatter(text)) return { text, problem: 'no-properties' };
	const people = readFrontmatterList(text, 'people');
	const assignedTo = readFrontmatterList(text, 'assignedTo');
	if ((people && people.items === null) || (assignedTo && assignedTo.items === null)) return { text, problem: 'unreadable' };
	const before = assignedTo?.items ?? [];
	const next = normalizePeople(people?.items ?? [], [...before, name], known);
	let out = text;
	if (!assignedTo || !sameMembers(before, next.assignedTo)) {
		out = setFrontmatterKey(out, 'assignedTo', renderList('assignedTo', next.assignedTo), true) ?? out;
	}
	if (people?.items && !sameMembers(people.items, next.people)) {
		out = setFrontmatterKey(out, 'people', renderList('people', next.people)) ?? out;
	}
	return { text: out };
}

// 改属性区里的 status。没有属性区或者没有 status 字段时返回 null。
export function setStatusInText(text: string, status: string): string | null {
	return setFrontmatterKey(text, 'status', renderScalar('status', status));
}
