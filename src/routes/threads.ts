import { html, unsafeHTML, HTMLResponse, HTMLContent } from "@worker-tools/html";
import { notFound } from "@worker-tools/response-creators";
import { basics, combine, contentTypes } from "@worker-tools/middleware";
import { JSONStreamResponse, jsonStringifyGenerator } from '@worker-tools/json-stream'

import { router, RouteArgs, mw } from "../router.ts";

import { api } from "../api/index.ts";

import { pageLayout } from './components.ts';
import { commentEl } from "./item.ts";
import { fastTTFB } from "./news.ts";
import { StreamResponse } from "@worker-tools/stream-response";

export const moreLinkEl = (moreLink: string) => html`
  <tr class="morespace" style="height:10px"></tr>
  <tr>
    <td>
      <table border="0">
        <tr>
          <td><img src="s.gif" height="1" width="0"></td>
          <td><img src="s.gif" height="1" width="14"></td>
          <td class="title"><a href="${moreLink}" class="morelink" rel="next">More</a></td>
        </tr>
      </table>
    </td>
  </tr>`;

function threads({ headers, searchParams, type: contentType, url, handled, waitUntil }: RouteArgs)  {
  const id = searchParams.get('id');
  if (!id) return notFound('No such item.');
  const title = `${id}'s comments`;

  const next = Number(searchParams.get('next'));

  const threadsPage = api.threads(id, next, { url, handled, waitUntil });

  if (contentType === 'application/json') {
    return new StreamResponse(fastTTFB(jsonStringifyGenerator(threadsPage)), { 
      headers: [['content-type', JSONStreamResponse.contentType]] 
    })
  }

  return new HTMLResponse(pageLayout({ title, op: 'threads', id, headers })(() => {
    return html`
      <tr id="pagespace" title="${title}" style="height:10px"></tr>
      <tr>
        <td> </td>
      </tr>
      ${async function* () {
        try {
          const { items, moreLink } = await threadsPage
          for await (const item of items) {
             yield commentEl(item, { showReply: true, showParent: item.level === 0 });
          }
          yield moreLinkEl(await moreLink);
        } catch (err) {
          console.warn(err)
          yield html`<tr><td>${err instanceof Error ? err.message : err as string}</td></tr>`;
        }
      }}
      `;
  }));
}

router.get('/threads', mw, (_req, x) => threads(x))
