// 打包入口：插件本身，加上它运行其上的假 Obsidian（两者在同一个包里，测试才能拿到同一份对象）
export { default as GenVoicePlugin } from '../main.ts';
export * from './fake-obsidian.mjs';
