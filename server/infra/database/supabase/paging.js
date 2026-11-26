// PostgREST cuts every read at max_rows (1000 by default), RPCs included, with no error.
// pageAll(fetchPage) calls fetchPage(from, to) page by page until a short page and returns every row.
export const PAGE_SIZE = 1000

export async function pageAll(fetchPage, size = PAGE_SIZE) {
  const all = []
  for (let from = 0; ; from += size) {
    const rows = (await fetchPage(from, from + size - 1)) ?? []
    all.push(...rows)
    if (rows.length < size) return all
  }
}
