// Rectangle SDF shader with rounded corners, fill, stroke, and anti-aliasing.
// Renders instanced quads — each instance is one rectangle.

struct Uniforms {
  viewProjection: mat4x4<f32>,
  resolution: vec2<f32>,
  _pad: vec2<f32>,
};

struct Instance {
  // rect bounds in world space
  posSize: vec4<f32>,      // x, y, width, height
  fillColor: vec4<f32>,    // RGBA 0-1
  strokeColor: vec4<f32>,  // RGBA 0-1
  params: vec4<f32>,       // cornerRadius, strokeWidth, opacity, rotation
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localPos: vec2<f32>,  // local coords in [-0.5, 0.5]
  @location(1) @interpolate(flat) instanceIndex: u32,
};

// Expand each quad vertex position
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

  // Unit quad corners: 0=TL, 1=TR, 2=BL, 3=BR (triangle strip)
  var quadPos = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
  );

  let uv = quadPos[vertexIndex];
  let strokeW = inst.params.y;
  // Expand by stroke width so stroke isn't clipped
  let expand = strokeW * 0.5 + 1.0;
  let worldPos = vec2<f32>(
    x - expand + uv.x * (w + expand * 2.0),
    y - expand + uv.y * (h + expand * 2.0),
  );

  var output: VertexOutput;
  output.position = uniforms.viewProjection * vec4<f32>(worldPos, 0.0, 1.0);
  // Local position centered in [-0.5-margin, 0.5+margin] of the rect
  output.localPos = (uv - 0.5) * vec2<f32>(w + expand * 2.0, h + expand * 2.0);
  output.instanceIndex = instanceIndex;
  return output;
}

// SDF for a rounded rectangle centered at origin
fn roundedRectSDF(p: vec2<f32>, halfSize: vec2<f32>, radius: f32) -> f32 {
  let q = abs(p) - halfSize + vec2<f32>(radius);
  return length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let inst = instances[input.instanceIndex];
  let w = inst.posSize.z;
  let h = inst.posSize.w;
  let cornerRadius = inst.params.x;
  let strokeWidth = inst.params.y;
  let opacity = inst.params.z;

  let halfSize = vec2<f32>(w, h) * 0.5;
  let dist = roundedRectSDF(input.localPos, halfSize, cornerRadius);

  // Anti-aliased edges using smoothstep (1 pixel feather)
  let fillAlpha = 1.0 - smoothstep(-1.0, 1.0, dist);
  let strokeAlpha = 1.0 - smoothstep(-1.0, 1.0, abs(dist + strokeWidth * 0.5) - strokeWidth * 0.5);

  let fill = inst.fillColor * fillAlpha;
  let stroke = inst.strokeColor * strokeAlpha;

  // Composite stroke over fill
  let color = mix(fill, stroke, stroke.a);
  return vec4<f32>(color.rgb, color.a * opacity);
}
