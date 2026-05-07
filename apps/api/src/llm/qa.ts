import {
  AskQuestionToolSchema,
  FinalizeToolSchema,
  type Preferences,
} from '@galley/shared'
import type Anthropic from '@anthropic-ai/sdk'
import { MODEL, getAnthropicClient } from './anthropic.js'
import { logLLMCall } from './log.js'

// Q&A turn endpoint per MVP.md. The LLM gets the partial preferences and is
// instructed to either ask the next question or finalise. We wire it via
// tool-calling and Zod-validate the response (ADR-005).

export type QATurn =
  | { kind: 'question'; text: string; quickPicks?: string[] }
  | { kind: 'final'; preferences: Preferences }

const SYSTEM_PROMPT = `You are guiding a user through a kitchen design Q&A. Your goal is to fill in their Preferences object.

Rules:
- Ask ONE question at a time, conversational tone.
- Never re-ask anything already in the partial preferences below.
- Prefer concrete questions tied to earlier answers (e.g. if cookingFrequency is "intense", probe induction vs gas).
- Provide quickPicks (3–5 short options) when the answer is from a fixed enum or a small set.
- Cap the conversation at ~10 questions. Finalise as soon as you can fill the schema confidently — guess sensible defaults for anything the user hasn't specified directly but you can infer.
- Always respond via a tool call: ask_question(text, quickPicks?) OR finalize(preferences).

Preferences schema:
- style: modern | classic | rustic | minimal | industrial
- budgetTier: low | mid | high
- cookingFrequency: rare | weekly | daily | intense
- hobType: induction | gas | ceramic
- ovenType: single | double | combi | none
- fridgeSize: compact | standard | american
- dishwasher: boolean
- islandPreferred: boolean
- seatingAtIsland: integer (0 if no island or no seating)
- storagePriority: low | medium | high
- accessibility: array of free-form strings
- notes: free text capturing anything else`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'ask_question',
    description: 'Ask the user the next question in the Q&A.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The question text in plain prose.' },
        quickPicks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional short options the user can click directly.',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'finalize',
    description: 'Finalise the preferences when the schema is fully populated.',
    input_schema: {
      type: 'object',
      properties: {
        preferences: {
          type: 'object',
          properties: {
            style: { type: 'string', enum: ['modern', 'classic', 'rustic', 'minimal', 'industrial'] },
            budgetTier: { type: 'string', enum: ['low', 'mid', 'high'] },
            cookingFrequency: { type: 'string', enum: ['rare', 'weekly', 'daily', 'intense'] },
            hobType: { type: 'string', enum: ['induction', 'gas', 'ceramic'] },
            ovenType: { type: 'string', enum: ['single', 'double', 'combi', 'none'] },
            fridgeSize: { type: 'string', enum: ['compact', 'standard', 'american'] },
            dishwasher: { type: 'boolean' },
            islandPreferred: { type: 'boolean' },
            seatingAtIsland: { type: 'integer', minimum: 0 },
            storagePriority: { type: 'string', enum: ['low', 'medium', 'high'] },
            accessibility: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
          },
          required: [
            'style',
            'budgetTier',
            'cookingFrequency',
            'hobType',
            'ovenType',
            'fridgeSize',
            'dishwasher',
            'islandPreferred',
            'seatingAtIsland',
            'storagePriority',
            'accessibility',
            'notes',
          ],
        },
      },
      required: ['preferences'],
    },
  },
]

export type QAMessage = { role: 'user' | 'assistant'; content: string }

export async function nextQATurn(args: {
  partial: Record<string, unknown>
  history: QAMessage[]
}): Promise<QATurn> {
  const client = getAnthropicClient()
  const userPrefix = `Partial preferences so far (JSON):\n${JSON.stringify(args.partial, null, 2)}\n\nDecide whether to ask the next question or finalise.`

  const messages: Anthropic.MessageParam[] = [
    ...args.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userPrefix },
  ]

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    tool_choice: { type: 'any' },
    messages,
  })

  logLLMCall('qa', { request: { messages, partial: args.partial }, response })

  const tool = response.content.find((b) => b.type === 'tool_use')
  if (!tool || tool.type !== 'tool_use') {
    throw new Error('Q&A: model did not call a tool')
  }

  if (tool.name === 'ask_question') {
    const parsed = AskQuestionToolSchema.parse(tool.input)
    return { kind: 'question', text: parsed.text, quickPicks: parsed.quickPicks }
  }
  if (tool.name === 'finalize') {
    const parsed = FinalizeToolSchema.parse(tool.input)
    return { kind: 'final', preferences: parsed.preferences }
  }
  throw new Error(`Q&A: unexpected tool ${tool.name}`)
}
