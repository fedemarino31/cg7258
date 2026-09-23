export function createStore(initial) {
	const state = { ...initial };
	const subs = new Set();
	return {
		state,
		set(patch) {
			Object.assign(state, patch);
			subs.forEach((f) => f(state, patch));
		},
		subscribe(fn) {
			subs.add(fn);
			return () => subs.delete(fn);
		},
	};
}
