import { z } from 'zod';
import { defineDomain, id, int } from './common.ts';
export const OmenSchema = z
  .strictObject({
    id: id(),
    family: id(),
    fi_min: int().min(0).max(5),
    fi_max: int().min(0).max(5),
    tags: z.array(id()).default([]),
    weight: int().min(1).default(100),
    tag_weights: z.record(z.string(), int().min(0)).default({}),
    glamour: z.boolean().default(false),
    deep_sense: z.boolean().default(false),
    sight: z.boolean().default(true),
    notice_dc: int(),
    read_dc: int().default(10),
    plain_dc: int().default(12),
    duration_minutes: int().min(60).max(360).default(180),
    trace_minutes: int().min(1440).max(4320).default(4320),
    thins: int().min(-25).max(25),
    subtle: z.boolean().default(false),
    text: z.array(z.string()).min(1),
    plain: z.array(z.string()).min(1),
    signature: z.string(),
    reading: z.string(),
    counter: z.string(),
  })
  .refine((d) => d.text.length === d.plain.length, {
    message: 'Each surface variant must have its matching mundane reading',
    path: ['plain'],
  });
export const faeDomains = { omens: defineDomain({ dir: 'fae', key: 'omen', schema: OmenSchema }) };
