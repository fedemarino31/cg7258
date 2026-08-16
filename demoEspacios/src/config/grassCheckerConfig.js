export const GRASS_CHECKER_CONFIG = {
	light: { r: 0x45 / 255, g: 0x6f / 255, b: 0x5d / 255 },
	dark: { r: 0x3b / 255, g: 0x62 / 255, b: 0x51 / 255 },
	squaresPerSide: 5,
};

export function paintGrassChecker(context, width, height) {
	const { squaresPerSide, light, dark } = GRASS_CHECKER_CONFIG;
	const squareWidth = width / squaresPerSide;
	const squareHeight = height / squaresPerSide;
	for (let row = 0; row < squaresPerSide; row += 1) {
		for (let column = 0; column < squaresPerSide; column += 1) {
			const { r, g, b } = (row + column) % 2 === 0 ? light : dark;
			context.fillStyle = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
			context.fillRect(column * squareWidth, row * squareHeight, squareWidth, squareHeight);
		}
	}
}

export function sampleGrassChecker(uv) {
	const wrap = (value) => ((value % 1) + 1) % 1;
	const column = Math.floor(wrap(uv.x) * GRASS_CHECKER_CONFIG.squaresPerSide);
	const row = Math.floor(wrap(uv.y) * GRASS_CHECKER_CONFIG.squaresPerSide);
	return (row + column) % 2 === 0 ? GRASS_CHECKER_CONFIG.light : GRASS_CHECKER_CONFIG.dark;
}
