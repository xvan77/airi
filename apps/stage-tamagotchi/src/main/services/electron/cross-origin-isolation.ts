import type { Session } from 'electron'

import { mergeCrossOriginIsolationHeaders } from '../../../shared/cross-origin-isolation'

/**
 * Make renderer documents cross-origin isolated so Kokoro can use several CPU threads.
 */
export function setupCrossOriginIsolation(targetSession: Session): void {
  targetSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: mergeCrossOriginIsolationHeaders(details.responseHeaders),
    })
  })
}
