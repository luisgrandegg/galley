import {
  CLEARANCES,
  LayoutToolSchema,
  STANDARD_MODULES,
  WORK_TRIANGLE,
  type FixedPoint,
  type Layout,
  type Module,
  type Preferences,
  type ValidatorResult,
  type Wall,
  validateLayout,
} from '@galley/shared'
import type Anthropic from '@anthropic-ai/sdk'
import { MODEL, getAnthropicClient } from './anthropic.js'
import { logLLMCall } from './log.js'

// Layout generation per MVP.md + ADR-004:
//   1. Build a system prompt with geometry, fixed points, preferences,
//      module library, and clearance constants.
//   2. Ask the LLM to call propose_layout.
//   3. Run the validator. If invalid, send violations back as a tool result
//      and retry. Cap at 3 repair iterations.

const MAX_REPAIRS = 3

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'propose_layout',
    description:
      'Propose a kitchen layout as a list of placed modules and a short rationale.',
    input_schema: {
      type: 'object',
      properties: {
        modules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              kind: {
                type: 'string',
                enum: [
                  'base_cabinet',
                  'wall_cabinet',
                  'tall_cabinet',
                  'sink_unit',
                  'hob_unit',
                  'oven_tower',
                  'fridge',
                  'dishwasher',
                  'island',
                ],
              },
              position: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' } },
                required: ['x', 'y'],
              },
              rotation: { type: 'integer', enum: [0, 90, 180, 270] },
              width: { type: 'number' },
              depth: { type: 'number' },
              height: { type: 'number' },
              label: { type: 'string' },
            },
            required: ['id', 'kind', 'position', 'rotation', 'width', 'depth', 'height'],
          },
        },
        rationale: { type: 'string' },
      },
      required: ['modules', 'rationale'],
    },
  },
]

export type GenerateLayoutInput = {
  walls: Wall[]
  fixedPoints: FixedPoint[]
  preferences: Preferences
}

export type GenerateLayoutResult = {
  layout: Layout
  validation: ValidatorResult
  repairIterations: number
  warning: string | null
}

function systemPrompt(): string {
  return `You are a senior kitchen designer producing a 2D top-down layout in millimetres.

You will be given:
- The room geometry as a list of walls (line segments). The room is the closed polygon they form.
- A list of fixed points with positions (water, drain, gas, electric, doors with swing, windows).
- The user's preferences.
- The standard module library and clearance constants you MUST respect.

You MUST call the propose_layout tool. Do not respond in prose.

Hard constraints (these are validated deterministically afterwards — produce a layout that passes them):
- Every module footprint must lie inside the wall polygon.
- Modules must not overlap.
- Base, wall, tall, sink, hob, oven, fridge, dishwasher cabinets must back against a wall (≤ 50 mm from the nearest wall). Islands are exempt.
- Sink unit must be within 600 mm of BOTH a water inlet AND a drain.
- Hob unit must be within 600 mm of a gas inlet (if hobType is "gas") or an electric point (if "induction"/"ceramic").
- Fridge and dishwasher must each be within 600 mm of an electric point.
- Doors' swing arc must be clear (≥ ${CLEARANCES.doorSwing} mm radius free of any module).
- Walkway between opposing parallel cabinet runs must be ≥ ${CLEARANCES.walkway} mm.
- Work triangle (sink, hob, fridge centres): each leg between ${WORK_TRIANGLE.minLegMm} and ${WORK_TRIANGLE.maxLegMm} mm; perimeter ≤ ${WORK_TRIANGLE.maxPerimeterMm} mm.
- Front of fridge / oven / dishwasher: ${CLEARANCES.applianceFront} mm clear.

Standard module library (widths in mm):
${JSON.stringify(STANDARD_MODULES, null, 2)}

Coordinate system: origin at top-left of the wall bounding box. +x right, +y down. All values in mm. Rotation 0 means the module's depth points down (+y); 90/180/270 rotate clockwise.

Use unique string ids for each module ("m1", "m2", ...). Provide one label per module.`
}

function userPromptInitial(input: GenerateLayoutInput): string {
  return `WALLS:
${JSON.stringify(input.walls, null, 2)}

FIXED POINTS:
${JSON.stringify(input.fixedPoints, null, 2)}

PREFERENCES:
${JSON.stringify(input.preferences, null, 2)}

Call propose_layout with a layout that satisfies every constraint above.`
}

function repairPrompt(violations: string[]): string {
  return `The previous layout failed validation. Violations:\n\n${violations
    .map((v, i) => `${i + 1}. ${v}`)
    .join('\n')}\n\nCall propose_layout again with a corrected layout that fixes ALL violations. Keep modules that were valid; move or resize the offending ones.`
}

export async function generateLayout(input: GenerateLayoutInput): Promise<GenerateLayoutResult> {
  const client = getAnthropicClient()
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPromptInitial(input) },
  ]
  let layout: Layout | null = null
  let validation: ValidatorResult = { ok: false, violations: [] }
  let iteration = 0

  for (iteration = 0; iteration <= MAX_REPAIRS; iteration++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt(),
      tools: TOOLS,
      tool_choice: { type: 'tool', name: 'propose_layout' },
      messages,
    })

    logLLMCall(`layout-iter-${iteration}`, { request: messages, response })

    const tool = response.content.find((b) => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use' || tool.name !== 'propose_layout') {
      throw new Error('Layout: model did not call propose_layout')
    }
    const parsed = LayoutToolSchema.parse(tool.input)
    const modules: Module[] = parsed.modules
    layout = {
      modules,
      rationale: parsed.rationale,
      generatedAt: new Date().toISOString(),
    }

    validation = validateLayout({
      walls: input.walls,
      fixedPoints: input.fixedPoints,
      modules,
      hobType: input.preferences.hobType,
    })

    if (validation.ok) break

    if (iteration === MAX_REPAIRS) break

    messages.push(
      { role: 'assistant', content: response.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: tool.id,
            content: repairPrompt(validation.violations.map((v) => v.message)),
          },
        ],
      }
    )
  }

  if (!layout) throw new Error('Layout: produced no layout')

  return {
    layout,
    validation,
    repairIterations: iteration,
    warning: validation.ok
      ? null
      : `Layout still has ${validation.violations.length} violation(s) after ${MAX_REPAIRS} repair attempts.`,
  }
}
