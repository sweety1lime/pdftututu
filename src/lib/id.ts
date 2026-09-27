let counter = 0;

/** Уникальный в пределах вкладки id: файлы, страницы, объекты редактора. */
export const newId = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
