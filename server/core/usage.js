// Spends one unit of a daily counter and answers whether it was still within max. The counter goes
// up first and is checked after, so requests that arrive together can't all read the same old count
// and slip under the limit. A refused request still counts, which only matters past the limit.
export async function spendUsage(store, key, day, max) {
  return (await store.addUsage(key, day)) <= max
}
