import { Texture2DLab } from '../sections/textureDimensions/Texture2DLab.js';
import { Texture3DLab } from '../sections/textureDimensions/Texture3DLab.js';
import { CubemapLab } from '../sections/textureDimensions/CubemapLab.js';
import { TriangleUVLab } from '../sections/uvCoordinates/TriangleUVLab.js';
import { UVInterpolationLab } from '../sections/uvCoordinates/UVInterpolationLab.js';
import { FullMeshUVLab } from '../sections/uvCoordinates/FullMeshUVLab.js';
import {
	GeneratedUVLab,
	PlanarUVLab,
	CylindricalUVLab,
	BoxUVLab,
	UnwrapUVLab,
} from '../sections/uvStrategies/UVStrategiesLab.js';
import {
	WrappingModesLab,
	OffsetRepeatLab,
	RotationCenterLab,
	FreeComparisonLab,
} from '../sections/wrapping/WrappingLab.js';
import { SpriteSheetLab } from '../sections/wrapping/SpriteSheetLab.js';
import { HouseAdjustLab } from '../sections/wrapping/HouseAdjustLab.js';
import { AliasingTabLab, MipmapsTabLab } from '../sections/aliasing/AliasingLab.js';
import { PixelFootprintLab, SamplerFilterLab } from '../sections/sampling/SamplingLab.js';

const thumb1 = `
<svg viewBox="0 0 300 165" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(14,30)"><rect width="80" height="80" fill="#3b4a7a"/>
    <path d="M0 20H80M0 40H80M0 60H80M20 0V80M40 0V80M60 0V80" stroke="#fff" stroke-opacity=".6"/>
    <rect width="20" height="20" y="60" fill="#f5a25d"/><text x="40" y="126" fill="#9aa3b2" font-size="12" text-anchor="middle">2D · UV</text></g>
  <g transform="translate(112,30)"><path d="M10 20L50 10L90 20L90 70L50 80L10 70Z" fill="#3c6e5a" stroke="#fff"/>
    <path d="M50 10V60L10 70M50 60L90 70" stroke="#fff" stroke-opacity=".6" fill="none"/>
    <path d="M10 20L50 30L90 20M50 30V80" stroke="#fff" stroke-opacity=".6" fill="none"/>
    <text x="50" y="126" fill="#9aa3b2" font-size="12" text-anchor="middle">3D · UVW</text></g>
  <g transform="translate(214,42)" stroke="#fff" fill="#5a3f7a">
    <rect x="24" width="24" height="24"/><rect x="0" y="24" width="24" height="24"/><rect x="24" y="24" width="24" height="24" fill="#7a5aa8"/>
    <rect x="48" y="24" width="24" height="24"/><rect x="72" y="24" width="24" height="24"/><rect x="24" y="48" width="24" height="24"/>
    <text x="48" y="114" fill="#9aa3b2" stroke="none" font-size="12" text-anchor="middle">Cubemap</text></g>
</svg>`;

const thumb2 = `
<svg viewBox="0 0 300 165" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(20,20)"><path d="M10 100L100 100L55 15Z" fill="#3b4a7a" stroke="#fff" stroke-width="2"/>
    <circle cx="10" cy="100" r="7" fill="#ff4d4f"/><circle cx="100" cy="100" r="7" fill="#3ddc84"/><circle cx="55" cy="15" r="7" fill="#4d8dff"/>
    <circle cx="55" cy="72" r="5" fill="#ffd84d"/></g>
  <path d="M138 75H162M154 68L162 75L154 82" stroke="#9aa3b2" fill="none" stroke-width="2"/>
  <g transform="translate(176,20)"><rect x="0" y="0" width="100" height="100" fill="#26314f" stroke="#fff"/>
    <path d="M20 85L75 75L45 20Z" fill="#5a78c8" stroke="#fff" stroke-width="2"/>
    <circle cx="20" cy="85" r="7" fill="#ff4d4f"/><circle cx="75" cy="75" r="7" fill="#3ddc84"/><circle cx="45" cy="20" r="7" fill="#4d8dff"/>
    <circle cx="47" cy="63" r="5" fill="#ffd84d"/></g>
</svg>`;

const thumb3 = `
<svg viewBox="0 0 300 165" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="uv3" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#254b78"/><stop offset="1" stop-color="#46a7a1"/></linearGradient></defs>
  <g transform="translate(18,22)"><path d="M12 92C26 18 80 8 110 56C130 88 99 119 58 112C34 108 19 101 12 92Z" fill="url(#uv3)" stroke="#d9e7ff" stroke-width="2"/>
    <path d="M28 83C48 61 75 44 105 49M34 101C57 76 84 68 116 72M47 28C47 53 61 88 78 112" fill="none" stroke="#d9e7ff" stroke-opacity=".6"/></g>
  <path d="M143 77H163M155 69L163 77L155 85" stroke="#9aa3b2" stroke-width="2" fill="none"/>
  <g transform="translate(178,24)"><rect width="104" height="104" fill="#1e2c49" stroke="#fff"/>
    <path d="M0 26H104M0 52H104M0 78H104M26 0V104M52 0V104M78 0V104" stroke="#5b9cff" stroke-opacity=".6"/>
    <path d="M3 96L98 12M7 18L92 88" stroke="#ffd84d" stroke-width="2"/><text x="52" y="126" text-anchor="middle" fill="#9aa3b2" font-size="12">proyectar · desplegar</text></g>
</svg>`;

const thumb4 = `
<svg viewBox="0 0 300 165" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(14,24)"><rect width="126" height="84" fill="#1e2c49" stroke="#56c8ff" stroke-width="2"/>
    <g fill="#3b6fb0" stroke="#fff" stroke-opacity=".7"><rect x="0" y="0" width="42" height="28" fill-opacity=".7"/><rect x="42" y="0" width="42" height="28" fill-opacity=".45"/>
      <rect x="84" y="0" width="42" height="28" fill-opacity=".7"/><rect x="0" y="28" width="42" height="28" fill-opacity=".45"/>
      <rect x="84" y="28" width="42" height="28" fill-opacity=".45"/><rect x="0" y="56" width="42" height="28" fill-opacity=".7"/>
      <rect x="42" y="56" width="42" height="28" fill-opacity=".45"/><rect x="84" y="56" width="42" height="28" fill-opacity=".7"/>
      <rect x="42" y="28" width="42" height="28" fill="#f5a25d"/></g>
    <rect x="42" y="28" width="42" height="28" fill="none" stroke="#ffd84d" stroke-width="2.5"/>
    <text x="63" y="128" fill="#9aa3b2" font-size="12" text-anchor="middle">clamp · repeat · mirror</text></g>
  <g transform="translate(168,24)"><g transform="rotate(-18 60 42)"><rect x="18" y="8" width="84" height="68" fill="#2c4a6e" stroke="#ff9f43" stroke-width="2.5" stroke-dasharray="7 4"/>
    <path d="M30 52H88M76 42L90 52L76 62" stroke="#ffb347" stroke-width="5" fill="none"/></g>
    <circle cx="60" cy="42" r="5" fill="#ff5cf0"/><path d="M96 42A36 36 0 0 0 87 21" stroke="#ff5cf0" fill="none" stroke-width="2"/>
    <text x="60" y="128" fill="#9aa3b2" font-size="12" text-anchor="middle">offset · repeat · rotation</text></g>
</svg>`;

const thumb5 = `
<svg viewBox="0 0 300 165" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(14,24)"><path d="M6 78L100 78L84 8L22 8Z" fill="#3b4a7a" stroke="#56c8ff" stroke-width="2"/>
    <path d="M44 44L68 44L72 58L40 58Z" fill="#ffd84d" fill-opacity=".7" stroke="#ffd84d" stroke-width="2"/>
    <text x="53" y="112" fill="#9aa3b2" font-size="12" text-anchor="middle">píxel · huella del píxel</text></g>
  <path d="M128 60H152M144 52L152 60L144 68" stroke="#9aa3b2" fill="none" stroke-width="2"/>
  <g transform="translate(166,22)"><g stroke="#fff" stroke-opacity=".7">
    <rect width="30" height="30" fill="#c0504d"/><rect x="30" width="30" height="30" fill="#4d8dff"/><rect x="60" width="30" height="30" fill="#3ddc84"/>
    <rect y="30" width="30" height="30" fill="#ffa94d"/><rect x="30" y="30" width="30" height="30" fill="#8a5fc8"/><rect x="60" y="30" width="30" height="30" fill="#46a7a1"/>
    <rect y="60" width="30" height="30" fill="#e0c341"/><rect x="30" y="60" width="30" height="30" fill="#5a78c8"/><rect x="60" y="60" width="30" height="30" fill="#d45c9a"/></g>
    <path d="M38 36L64 40L60 56L34 52Z" fill="#ffd84d" fill-opacity=".45" stroke="#ffd84d" stroke-width="2"/>
    <text x="45" y="114" fill="#9aa3b2" font-size="12" text-anchor="middle">nearest · linear</text></g>
</svg>`;

const thumb6 = `
<svg viewBox="0 0 300 165" xmlns="http://www.w3.org/2000/svg">
  <defs><pattern id="ck6" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#e8e8ee"/><rect x="8" y="8" width="8" height="8" fill="#e8e8ee"/><rect x="8" width="8" height="8" fill="#1c2029"/><rect y="8" width="8" height="8" fill="#1c2029"/></pattern></defs>
  <g transform="translate(16,20)"><path d="M0 100L34 6H92L126 100Z" fill="url(#ck6)" stroke="#56c8ff" stroke-width="2"/><path d="M34 6H92L88 22H38Z" fill="#7a8194" opacity=".85"/>
    <text x="63" y="122" fill="#9aa3b2" font-size="12" text-anchor="middle">aliasing</text></g>
  <path d="M154 60H174M166 52L174 60L166 68" stroke="#9aa3b2" fill="none" stroke-width="2"/>
  <g transform="translate(190,20)" stroke="#fff" stroke-opacity=".6"><rect width="64" height="64" fill="#3b4a7a"/><rect x="66" width="32" height="32" fill="#3b4a7a"/><rect x="66" y="34" width="16" height="16" fill="#3b4a7a"/><rect x="84" y="34" width="8" height="8" fill="#3b4a7a"/>
    <rect x="66" width="32" height="32" fill="none" stroke="#ffd84d" stroke-width="2.5"/>
    <text x="49" y="122" fill="#9aa3b2" stroke="none" font-size="12" text-anchor="middle">mipmaps · anisotropía</text></g>
</svg>`;

export const SECTIONS = [
	{
		id: 'dimensiones',
		number: 1,
		title: 'Dimensiones y tipos de textura',
		blurb: 'Textura 2D, 3D y cubemap: cuántas coordenadas necesita cada una.',
		thumb: thumb1,
		tabs: [
			{ id: '2d', title: 'Textura 2D', Lab: Texture2DLab },
			{ id: '3d', title: 'Textura 3D', Lab: Texture3DLab },
			{ id: 'cubemap', title: 'Cubemap', Lab: CubemapLab },
		],
	},
	{
		id: 'uv',
		number: 2,
		title: 'Coordenadas UV',
		blurb: 'Del triángulo a la malla: atributos por vértice, interpolación e islas UV.',
		thumb: thumb2,
		tabs: [
			{ id: 'triangulo', title: 'Un triángulo', Lab: TriangleUVLab },
			{ id: 'interpolacion', title: 'Interpolación UV', Lab: UVInterpolationLab },
			{ id: 'malla', title: 'Malla completa', Lab: FullMeshUVLab },
		],
	},
	{
		id: 'estrategias-uv',
		number: 3,
		title: 'Estrategias para obtener UV',
		blurb: 'Compará UV de generación, proyecciones planar, cilíndrica y de caja, y un atlas diseñado.',
		thumb: thumb3,
		tabs: [
			{ id: 'generacion', title: 'UV de generación', Lab: GeneratedUVLab },
			{ id: 'planar', title: 'Proyección planar', Lab: PlanarUVLab },
			{ id: 'cilindrica', title: 'Proyección cilíndrica', Lab: CylindricalUVLab },
			{ id: 'caja', title: 'Proyección tipo caja', Lab: BoxUVLab },
			{ id: 'unwrap', title: 'Unwrap y atlas', Lab: UnwrapUVLab },
		],
	},
	{
		id: 'wrapping',
		number: 4,
		title: 'Wrapping y transformaciones de textura',
		blurb: 'Qué pasa cuando los UV salen de [0,1]: clamp, repeat y mirrored, más offset, repeat, rotation y center.',
		thumb: thumb4,
		tabs: [
			{ id: 'modos', title: 'Modos de wrapping', Lab: WrappingModesLab },
			{ id: 'offset-repeat', title: 'Offset y Repeat', Lab: OffsetRepeatLab },
			{ id: 'rotacion', title: 'Rotación y centro', Lab: RotationCenterLab },
			{ id: 'libre', title: 'Comparación libre', Lab: FreeComparisonLab },
			{ id: 'sprite', title: 'Sprite sheet', Lab: SpriteSheetLab },
			{ id: 'ajuste', title: 'Ajuste de texturas', Lab: HouseAdjustLab },
		],
	},
	{
		id: 'muestreo',
		number: 5,
		title: 'Muestreo y samplers',
		blurb: 'De píxel a color: huella del píxel sobre la superficie y en UV, y cómo Nearest y Linear producen el valor final.',
		thumb: thumb5,
		tabs: [
			{ id: 'huella', title: 'Huella de píxel', Lab: PixelFootprintLab },
			{ id: 'filtro', title: 'Filtro del sampler', Lab: SamplerFilterLab },
		],
	},
	{
		id: 'aliasing',
		number: 6,
		title: 'Aliasing, mipmaps y anisotropía',
		blurb: 'Qué ocurre cuando un píxel cubre demasiada textura y cómo lo reducen los mipmaps y el filtrado anisotrópico.',
		thumb: thumb6,
		tabs: [
			{ id: 'aliasing', title: 'Aliasing', Lab: AliasingTabLab },
			{ id: 'mipmaps', title: 'Mipmaps y anisotropía', Lab: MipmapsTabLab },
		],
	},
];
