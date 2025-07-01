import { z } from 'zod';

export const toolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.any().refine(val => val instanceof z.ZodObject, {
    message: "Parameters harus merupakan instance dari Zod.object",
  }),
});
export type ToolDefinition = z.infer<typeof toolSchema>;

const contextManagementSchema = z.union([
  z.object({
    strategy: z.literal('slidingWindow'),
    maxMessages: z.number().int().positive(),
  }),
  z.object({
    strategy: z.literal('tokenLimit'),
    maxTokens: z.number().int().positive(),
  }),
]).optional();

export const configSchema = z.object({
  apiKeys: z.record(z.string(), z.array(z.string()).min(1)),
  providerStrategy: z.array(z.string()).min(1),
  modelDefaults: z.record(z.string(), z.string()),
  prompting: z.object({
    systemPrompt: z.string().optional(),
  }).optional(),
  contextManagement: contextManagementSchema,
  tools: z.array(toolSchema).optional(),
  caching: z.object({
    enabled: z.boolean().default(false),
    ttl: z.number().int().positive().describe('Masa berlaku cache dalam detik.'),
  }).optional(),
}).refine(data => {
    for (const provider of data.providerStrategy) {
        if (!data.apiKeys[provider] || data.apiKeys[provider].length === 0) {
            return false;
        }
    }
    return true;
}, {
    message: "Setiap provider dalam 'providerStrategy' harus memiliki setidaknya satu kunci API di 'apiKeys'",
    path: ["providerStrategy"],
});

export type CerebrumConfig = z.infer<typeof configSchema>;