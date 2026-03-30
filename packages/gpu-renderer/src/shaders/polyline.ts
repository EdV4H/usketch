export const POLYLINE_SHADER = /* wgsl */ `
// Polyline shader — renders tessellated triangle strips from CPU.
// Each vertex has position + color/opacity.

struct Uniforms {
  viewProjection: mat4x4<f32>,
  resolution: vec2<f32>,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) opacity: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) opacity: f32,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.viewProjection * vec4<f32>(input.position, 0.0, 1.0);
  output.color = input.color;
  output.opacity = input.opacity;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color.rgb, input.color.a * input.opacity);
}
`;
