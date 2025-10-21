export function slugify(input: string) {
  return input.toLowerCase()
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80);
}
// ensure uniqueness by suffixing short hash
export function makeUniqueSlug(title: string, company: string, hash: string, location?: string) {
  const base = slugify([title, company, location || ''].filter(Boolean).join('-'));
  // Use the full hash to ensure uniqueness, and add timestamp
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substr(2, 9);
  return `${base}-${hash.slice(0,8)}-${timestamp}-${randomSuffix}`;
}
