/**
 * use:reveal — fades content up 12px over --dur-reveal when it scrolls into view, staggering the
 * direct children (`stagger: true`). Does nothing under prefers-reduced-motion or without
 * IntersectionObserver (content is never hidden for those users).
 */
import type { Action } from 'svelte/action';

export const reveal: Action<HTMLElement, { stagger?: boolean; delay?: number } | undefined> = (node, opts) => {
	if (typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const targets = opts?.stagger ? (Array.from(node.children) as HTMLElement[]) : [node];
	targets.forEach((el, i) => {
		el.style.opacity = '0';
		el.style.transform = 'translateY(12px)';
		el.style.transition = `opacity var(--dur-reveal) var(--motion-out) ${(opts?.delay ?? 0) + i * 80}ms, transform var(--dur-reveal) var(--motion-out) ${(opts?.delay ?? 0) + i * 80}ms`;
	});
	const io = new IntersectionObserver(
		(entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			targets.forEach((el) => {
				el.style.opacity = '';
				el.style.transform = '';
			});
			io.disconnect();
		},
		{ rootMargin: '0px 0px -10% 0px' }
	);
	io.observe(node);
	return { destroy: () => io.disconnect() };
};
