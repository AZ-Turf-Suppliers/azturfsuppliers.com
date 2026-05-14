import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string().default('Guides'),
    date: z.coerce.date(),
    dateModified: z.coerce.date().optional(),
    readTime: z.string().default('10 min read'),
    image: z.string(),
    imageAlt: z.string().default(''),
    lede: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
