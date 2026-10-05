# Privacy Policy

**System Font Substituter** is designed to operate locally in the browser.

## Data collection

The extension does not collect, record, sell, or transmit personal data, browsing history, webpage content, or analytics data to the developer or to any third-party service.

## Page access

The extension runs on ordinary webpages in order to inspect CSS font-family information and apply local font substitutions. This processing happens locally in the browser. Page text and browsing activity are not sent to any server.

## Settings

Extension settings are stored using Chromium's `chrome.storage.sync` API. Depending on the user's browser account and sync settings, the browser vendor may synchronize these settings between the user's signed-in browser installations.

## Network access and remote code

The extension does not contact a developer-operated server and does not load or execute remotely hosted code.

To avoid unnecessary font scans during page interactions, the extension analyzes the page’s existing CSS font declarations locally. When the browser prevents direct access to a cross-origin stylesheet, the extension may request that stylesheet from its original URL without site credentials. Only CSS text is accepted, parsed in memory and used to determine whether font sampling is necessary. The retrieved text is not injected into the page or executed. These requests do not include page text, conversation content or extension settings. If a stylesheet cannot be read, the extension continues using full font sampling.

## Changes

If the extension's data practices change, this policy will be updated before such changes are released.

## Contact

For questions or issues, use the project's GitHub issue tracker:

https://github.com/Speechlessmanbilibili/system-font-substituter/issues
