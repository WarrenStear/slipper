/** Fixture-only observation of the actual production fetch + streaming reader.
 * The returned Response, reader, chunk bytes, thrown errors and cancellation
 * semantics are unchanged. A material request stays pending until actual body
 * EOF, cancellation or failure, rather than merely until headers arrive.
 * Pass this self-contained function directly to page.addInitScript. */
export function observeMaterialFetches() {
  const observed = window.__receiverFetches = { pending: 0, bodyPending: 0, total: 0, completed: 0, headers: 0 };
  const fetchActual = window.fetch.bind(window);
  window.fetch = (...args) => {
    const input = args[0], url = typeof input === 'string' ? input : typeof input?.url === 'string' ? input.url : String(input);
    if (!url.includes('/art/materials/')) return fetchActual(...args);
    observed.pending++; observed.total++;
    let settled = false, bodyPending = false;
    const settle = () => { if (settled) return; settled = true; observed.pending--; observed.completed++; if (bodyPending) observed.bodyPending--; };
    let pending;
    try { pending = fetchActual(...args); } catch (error) { settle(); throw error; }
    return pending.then(response => {
      observed.headers++;
      const body = response.body;
      if (!body) { settle(); return response; }
      bodyPending = true; observed.bodyPending++;
      const getReader = body.getReader.bind(body), cancelBody = body.cancel.bind(body);
      body.cancel = (...values) => {
        try { return cancelBody(...values).finally(settle); } catch (error) { settle(); throw error; }
      };
      body.getReader = (...values) => {
        let reader;
        try { reader = getReader(...values); } catch (error) { settle(); throw error; }
        const read = reader.read.bind(reader), cancel = reader.cancel.bind(reader);
        reader.read = (...readArgs) => {
          let result;
          try { result = read(...readArgs); } catch (error) { settle(); throw error; }
          return result.then(chunk => { if (chunk.done) settle(); return chunk; }, error => { settle(); throw error; });
        };
        reader.cancel = (...cancelArgs) => {
          try { return cancel(...cancelArgs).finally(settle); } catch (error) { settle(); throw error; }
        };
        return reader;
      };
      return response;
    }, error => { settle(); throw error; });
  };
}
