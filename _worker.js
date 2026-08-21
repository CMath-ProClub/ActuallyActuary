/**
 * Host-based routing for actuallyactuary.com.
 *
 * One deployment serves every section. A request to
 *
 *     projects.actuallyactuary.com/backtester
 *
 * is rewritten internally to the file at
 *
 *     /projects/backtester/index.html
 *
 * so the folder layout on disk stays exactly the same and only the address
 * the visitor sees changes.
 *
 * Sub-sections stay as paths (projects.actuallyactuary.com/backtester rather
 * than backtester.projects.actuallyactuary.com) because Cloudflare's free
 * Universal SSL only covers one level of wildcard; a deeper subdomain would
 * need the paid Advanced Certificate Manager.
 *
 * Anything unrecognised falls straight through to the static assets, so the
 * original path-based addresses (actuallyactuary.com/projects/) keep working
 * and nothing can break just because a new subdomain appears.
 */

const SECTIONS = new Set([
  "projects", "resume", "exams", "content", "apparel", "support", "business",
]);

export default {
  async fetch(request, env) {
    // If the assets binding is missing for any reason, do nothing clever.
    if (!env || !env.ASSETS) return fetch(request);

    let url;
    try {
      url = new URL(request.url);
    } catch (e) {
      return env.ASSETS.fetch(request);
    }

    const label = url.hostname.split(".")[0].toLowerCase();

    // Apex and www serve the site as built.
    if (!SECTIONS.has(label)) return env.ASSETS.fetch(request);

    // Already pointing into the right folder? Leave it alone, so that
    // projects.actuallyactuary.com/projects/ does not become /projects/projects/.
    if (url.pathname === `/${label}` || url.pathname.startsWith(`/${label}/`)) {
      return env.ASSETS.fetch(request);
    }

    // Files at the root (the résumé PDF, favicon) are shared by every section.
    if (/\.[a-z0-9]+$/i.test(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    const rewritten = new URL(url);
    rewritten.pathname = `/${label}${url.pathname}`;
    const response = await env.ASSETS.fetch(new Request(rewritten, request));

    // If the section has no such sub-page, fall back rather than 404 blindly.
    if (response.status === 404) return env.ASSETS.fetch(request);
    return response;
  },
};
