export type { OpenSlideDeckRegistry } from "./open-slide/deck-registry.js";
export type { InsertOpenSlideDeckOptions, OpenSlideApi } from "./open-slide/open-slide-service.js";
export { getOpenSlideApi, openSlideService } from "./open-slide/open-slide-service.js";
export {
	createOpenSlideShapeData,
	OPEN_SLIDE_DEFAULT_WIDTH,
	OPEN_SLIDE_MIN_WIDTH,
	resizeOpenSlideShape,
} from "./open-slide/open-slide-shape.js";
export type {
	OpenSlideDeck,
	OpenSlideDesign,
	OpenSlideModule,
	OpenSlideShapeData,
} from "./open-slide/types.js";
export {
	isOpenSlideShape,
	OPEN_SLIDE_ASPECT,
	OPEN_SLIDE_CANVAS_HEIGHT,
	OPEN_SLIDE_CANVAS_WIDTH,
	OPEN_SLIDE_SHAPE_TYPE,
} from "./open-slide/types.js";
export type { PresentationMode, PresentationPluginOptions } from "./plugin.js";
export { createPresentationPlugin } from "./plugin.js";
export { PresentModeOverlay } from "./present-mode-overlay.js";
export type {
	GetStepCount,
	IsSlide,
	SlideChangeListener,
	SlideNavigatorOptions,
} from "./slide-navigator.js";
export { defaultIsSlide, SlideNavigator } from "./slide-navigator.js";
