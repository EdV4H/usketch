// The 3D shape layer moved to the CSS 3D renderer (`@edv4h/usketch-css3d-renderer`), which
// registers it now; re-exported until the next major.
import type { Css3dCameraSource } from "@edv4h/usketch-css3d-renderer";

export { SHAPE_3D_LAYER_ID } from "@edv4h/usketch-css3d-renderer";

/** The drawn camera and its change notifications (= `Css3dCameraSource`). */
export type Shape3dCameraSource = Css3dCameraSource;
