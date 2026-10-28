/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "b72fec57d7884b1fb8f8c3dcb1eea4c9"
  }, {
    "url": "pwa-512x512.png",
    "revision": "9b740dc217edb1cdec52ccfaf200064f"
  }, {
    "url": "pwa-192x192.png",
    "revision": "9be15561fe196df2c0e08e2058f63772"
  }, {
    "url": "index.html",
    "revision": "10af82a91eb7506860a5219c3f036700"
  }, {
    "url": "icon.svg",
    "revision": "84d12c684dfe9e559271b127647059e4"
  }, {
    "url": "icon-maskable.svg",
    "revision": "91d9658e67022324595ffe3896c2a022"
  }, {
    "url": "favicon.ico",
    "revision": "5a52d75f5f134ec364da7ea433bc86f6"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "f7b77ccbad1d1b2232fd33ce54c82177"
  }, {
    "url": "assets/index-ltaDWtfg.js",
    "revision": null
  }, {
    "url": "assets/index-BhYT_Z57.css",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "f7b77ccbad1d1b2232fd33ce54c82177"
  }, {
    "url": "favicon.ico",
    "revision": "5a52d75f5f134ec364da7ea433bc86f6"
  }, {
    "url": "icon.svg",
    "revision": "84d12c684dfe9e559271b127647059e4"
  }, {
    "url": "pwa-192x192.png",
    "revision": "9be15561fe196df2c0e08e2058f63772"
  }, {
    "url": "pwa-512x512.png",
    "revision": "9b740dc217edb1cdec52ccfaf200064f"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "b72fec57d7884b1fb8f8c3dcb1eea4c9"
  }, {
    "url": "manifest.webmanifest",
    "revision": "91716fbf2a09c27d141e2317a7157213"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
