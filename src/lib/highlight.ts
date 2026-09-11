import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import yaml from 'highlight.js/lib/languages/yaml';
import diff from 'highlight.js/lib/languages/diff';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('diff', diff);

/** Language for a tool step's code block. */
export function languageForTool(tool: string | undefined, code: string): string {
	switch (tool) {
		case 'browser_exec':
			return 'javascript';
		case 'bash':
			return 'bash';
		case 'edit':
			return 'diff';
		case 'write':
			return guess(code);
		default:
			return guess(code);
	}
}

/** Language for a tool step's output: aria snapshots are YAML, JSON is JSON. */
export function languageForOutput(tool: string | undefined, output: string): string {
	const trimmed = output.trimStart();
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
	if (tool === 'browser_exec' && /^(#|- )/.test(trimmed)) return 'yaml';
	if (tool === 'bash') return 'plaintext';
	return guess(output);
}

function guess(text: string): string {
	const head = text.trimStart().slice(0, 200);
	if (/^(import |export |const |let |await |function |\(async|document\.|window\.)/.test(head))
		return 'javascript';
	if (/^(def |import |from |print\()/.test(head)) return 'python';
	if (/^[{[]/.test(head)) return 'json';
	if (/^(#!\/bin\/(ba)?sh|\$ )/.test(head)) return 'bash';
	return 'plaintext';
}

export function highlight(code: string, language: string): string {
	if (language === 'plaintext' || !hljs.getLanguage(language)) return escapeHtml(code);
	try {
		return hljs.highlight(code, { language, ignoreIllegals: true }).value;
	} catch {
		return escapeHtml(code);
	}
}

function escapeHtml(text: string) {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
