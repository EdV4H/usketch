export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}
export function getPointerPosition(event) {
    return {
        x: event.clientX,
        y: event.clientY
    };
}
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
//# sourceMappingURL=utils.js.map