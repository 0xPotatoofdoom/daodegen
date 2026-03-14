import { MetadataRoute } from 'next'
import { verses } from '@/lib/verses'

export default function sitemap(): MetadataRoute.Sitemap {
  const versePages = verses.map((verse) => ({
    url: `https://daodegen.com/verse/${verse.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: 'https://daodegen.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://daodegen.com/verses',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://daodegen.com/swap',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://daodegen.com/claim',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...versePages,
  ]
}
