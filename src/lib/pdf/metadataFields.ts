/** Свойства документа, которые можно посмотреть и изменить. Отдельно от metadata.ts: список нужен интерфейсу, а тот модуль тянет pdf-lib. */
export const METADATA_FIELDS = ["title", "author", "subject", "keywords", "creator", "producer"] as const;
export type MetadataField = (typeof METADATA_FIELDS)[number];
