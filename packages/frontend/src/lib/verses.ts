import versesJson from '@/data/verses.json'
import { Verse } from '@/types/verse'

export const verses = versesJson as Verse[]

export const getVerseById = (id: number): Verse | null => {
  return verses.find((verse) => verse.id === id) ?? null
}
