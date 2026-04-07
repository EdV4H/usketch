export const SHAPE_SDF_SHADER = /* wgsl */ `
// Unified SDF shader for rectangles (with rounded corners) and ellipses.
// Renders instanced quads — each instance is one shape.
// params.w encodes the shape kind: 0.0 = rect, 1.0 = ellipse.

struct Uniforms {
  viewProjection: mat4x4<f32>,
  resolution: vec2<f32>,
  _pad: vec2<f32>,
};

struct Instance {
  posSize: vec4<f32>,      // x, y, width, height
  fillColor: vec4<f32>,    // RGBA 0-1
  strokeColor: vec4<f32>,  // RGBA 0-1
  params: vec4<f32>,       // cornerRadius, strokeWidth, opacity, shapeKind
  extra: vec4<f32>,        // rotationDeg, _pad, _pad, _pad
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localPos: vec2<f32>,
  @location(1) @interpolate(flat) instanceIndex: u32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let inst = instances[instanceIndex];
  let x = inst.posSize.x;
  let y = inst.posSize.y;
  let w = inst.posSize.z;
  let h = inst.posSize.w;

  var quadPos = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
  );

  let uv = quadPos[vertexIndex];
  let strokeW = inst.params.y;
  let rotationDeg = inst.extra.x;
  let expand = strokeW * 0.5 + 1.0;
  var localPos2 = vec2<f32>(
    -expand + uv.x * (w + expand * 2.0) - w * 0.5,
    -expand + uv.y * (h + expand * 2.0) - h * 0.5,
  );
  let angleRad = rotationDeg * 3.14159265359 / 180.0;
  let cosA = cos(angleRad);
  let sinA = sin(angleRad);
  let rotatedPos = vec2<f32>(
    localPos2.x * cosA - localPos2.y * sinA,
    localPos2.x * sinA + localPos2.y * cosA,
  );
  let center = vec2<f32>(x + w * 0.5, y + h * 0.5);
  let worldPos = center + rotatedPos;

  var output: VertexOutput;
  output.position = uniforms.viewProjection * vec4<f32>(worldPos, 0.0, 1.0);
  output.localPos = (uv - 0.5) * vec2<f32>(w + expand * 2.0, h + expand * 2.0);
  output.instanceIndex = instanceIndex;
  return output;
}

fn roundedRectSDF(p: vec2<f32>, halfSize: vec2<f32>, radius: f32) -> f32 {
  let q = abs(p) - halfSize + vec2<f32>(radius);
  return length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

fn ellipseSDF(p: vec2<f32>, halfSize: vec2<f32>) -> f32 {
  // Approximate ellipse SDF using normalized coordinates
  let np = p / halfSize;
  let d = length(np) - 1.0;
  return d * min(halfSize.x, halfSize.y);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let inst = instances[input.instanceIndex];
  let w = inst.posSize.z;
  let h = inst.posSize.w;
  let cornerRadius = inst.params.x;
  let strokeWidth = inst.params.y;
  let opacity = inst.params.z;
  let shapeKind = inst.params.w;

  let halfSize = vec2<f32>(w, h) * 0.5;

  var dist: f32;
  if (shapeKind < 0.5) {
    // Rectangle
    dist = roundedRectSDF(input.localPos, halfSize, cornerRadius);
  } else {
    // Ellipse
    dist = ellipseSDF(input.localPos, halfSize);
  }

  let fillAlpha = 1.0 - smoothstep(-1.0, 1.0, dist);
  let strokeAlpha = 1.0 - smoothstep(-1.0, 1.0, abs(dist + strokeWidth * 0.5) - strokeWidth * 0.5);

  let fill = inst.fillColor * fillAlpha;
  let stroke = inst.strokeColor * strokeAlpha;

  let color = mix(fill, stroke, stroke.a);
  return vec4<f32>(color.rgb, color.a * opacity);
}
`;
