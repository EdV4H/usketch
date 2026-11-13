// ホスト向けのページ API を `ctx.services` に置く（参照実装: usketch-plugin-map の map-service.ts）。
// `getPagesApi(app.services)?.create({ open: true })` のように HUD を通さずに使える。
import { defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { PagesApi } from "./pages-api.js";

export const pagesService = defineService<PagesApi>("usketch-plugin-pages");

export function getPagesApi(services: ServiceRegistry): PagesApi | undefined {
	return pagesService.get(services);
}
