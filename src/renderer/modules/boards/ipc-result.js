/**
 * Unwrap a board IPC result: { success: true, data } gives data; anything
 * else throws with the result's error, or "<step> failed".
 * @param {{ success: boolean, data?: *, error?: string }} result
 * @param {string} step - what was being done, for the fallback message
 */
export function unwrap(result, step) {
  if (!result?.success) throw new Error(result?.error || `${step} failed`);
  return result.data;
}

export default { unwrap };
