import { z } from 'zod';

/**
 * Zod schema for defining the cost structure of a request.
 * All cost fields are optional.
 */
export const PricingSchema = z.object({
    /** 
     * The cost in USD per 1 million input tokens.
     * Example: A value of 0.5 means $0.50 per 1M input tokens.
     */
    inputCostPerMillionTokens: z.number().positive().optional(),

    /** 
     * The cost in USD per 1 million output tokens.
     * Example: A value of 1.5 means $1.50 per 1M output tokens.
     */
    outputCostPerMillionTokens: z.number().positive().optional(),

    /** 
     * A flat cost in USD per request/call.
     * Example: A value of 0.001 means $0.001 per request.
     */
    costPerRequest: z.number().positive().optional(),
});

/**
 * TypeScript type representing the cost structure of a request, with costs
 * denominated in USD per million tokens or per request.
 * Inferred from the Zod schema.
 */
export type Pricing = z.infer<typeof PricingSchema>;