export interface BaseShape {
    id: string;
    type: 'rectangle' | 'ellipse' | 'line' | 'text' | 'freedraw';
    x: number;
    y: number;
    rotation: number;
    opacity: number;
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
}
export interface RectangleShape extends BaseShape {
    type: 'rectangle';
    width: number;
    height: number;
}
export interface EllipseShape extends BaseShape {
    type: 'ellipse';
    width: number;
    height: number;
}
export interface LineShape extends BaseShape {
    type: 'line';
    x2: number;
    y2: number;
}
export interface TextShape extends BaseShape {
    type: 'text';
    text: string;
    fontSize: number;
    fontFamily: string;
}
export interface FreedrawShape extends BaseShape {
    type: 'freedraw';
    points: Array<{
        x: number;
        y: number;
    }>;
}
export type Shape = RectangleShape | EllipseShape | LineShape | TextShape | FreedrawShape;
export interface Camera {
    x: number;
    y: number;
    zoom: number;
}
export interface Point {
    x: number;
    y: number;
}
export interface WhiteboardState {
    shapes: Record<string, Shape>;
    selectedShapeIds: Set<string>;
    camera: Camera;
    currentTool: string;
}
//# sourceMappingURL=index.d.ts.map