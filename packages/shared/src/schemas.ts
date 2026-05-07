import { z } from 'zod'
import type { Layout, Module, Preferences } from './types.js'

// Zod schemas mirror the TypeScript types in types.ts. Used by the API to
// validate every LLM tool-call response before trusting it (ADR-005).

const Vec2 = z.object({ x: z.number(), y: z.number() })

export const ModuleSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'base_cabinet',
    'wall_cabinet',
    'tall_cabinet',
    'sink_unit',
    'hob_unit',
    'oven_tower',
    'fridge',
    'dishwasher',
    'island',
  ]),
  position: Vec2,
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  label: z.string().optional(),
}) satisfies z.ZodType<Module>

export const PreferencesSchema = z.object({
  style: z.enum(['modern', 'classic', 'rustic', 'minimal', 'industrial']),
  budgetTier: z.enum(['low', 'mid', 'high']),
  cookingFrequency: z.enum(['rare', 'weekly', 'daily', 'intense']),
  hobType: z.enum(['induction', 'gas', 'ceramic']),
  ovenType: z.enum(['single', 'double', 'combi', 'none']),
  fridgeSize: z.enum(['compact', 'standard', 'american']),
  dishwasher: z.boolean(),
  islandPreferred: z.boolean(),
  seatingAtIsland: z.number().int().nonnegative(),
  storagePriority: z.enum(['low', 'medium', 'high']),
  accessibility: z.array(z.string()),
  notes: z.string(),
}) satisfies z.ZodType<Preferences>

export const LayoutToolSchema = z.object({
  modules: z.array(ModuleSchema),
  rationale: z.string().min(1),
}) satisfies z.ZodType<Pick<Layout, 'modules' | 'rationale'>>

export const AskQuestionToolSchema = z.object({
  text: z.string().min(1),
  quickPicks: z.array(z.string()).optional(),
})

export const FinalizeToolSchema = z.object({
  preferences: PreferencesSchema,
})
