"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

const querystring = require(`querystring`);

const axios = require(`axios`);

const _ = require(`lodash`);

const minimatch = require(`minimatch`);

const colorized = require(`./output-color`);

const httpExceptionHandler = require(`./http-exception-handler`);

const requestInQueue = require(`./request-in-queue`);

const URL = require('url').URL;
/**
 * Check auth object to see if we should fetch JWT access token
 */


const shouldUseJwt = auth => auth && (auth.jwt_user || auth.jwt_pass);
/**
 * Check auth object to see if we should use HTTP Basic Auth
 */


const shouldUseHtaccess = auth => auth && (auth.htaccess_user || auth.htaccess_pass);
/**
 * Format Auth settings for verbose output
 */


const formatAuthSettings = auth => {
  let authOutputLines = [];

  if (shouldUseJwt(auth)) {
    authOutputLines.push(`  JWT Auth: ${auth.jwt_user}:${auth.jwt_pass}`);
  }

  if (shouldUseHtaccess(auth)) {
    authOutputLines.push(`  HTTP Basic Auth: ${auth.htaccess_user}:${auth.htaccess_pass}`);
  }

  return authOutputLines.join(`\n`);
};
/**
 * High-level function to coordinate fetching data from a WordPress
 * site.
 */


function fetch(_x) {
  return _fetch.apply(this, arguments);
}
/**
 * Gets wordpress.com access token so it can fetch private data like medias :/
 *
 * @returns
 */


function _fetch() {
  _fetch = (0, _asyncToGenerator2.default)(function* ({
    baseUrl,
    _verbose,
    _siteURL,
    _useACF,
    _acfOptionPageIds,
    _hostingWPCOM,
    _auth,
    _perPage,
    _concurrentRequests,
    _includedRoutes,
    _excludedRoutes,
    typePrefix,
    refactoredEntityTypes
  }) {
    // If the site is hosted on wordpress.com, the API Route differs.
    // Same entity types are exposed (excepted for medias and users which need auth)
    // but the data model contain slights variations.
    let url;

    let _accessToken;

    if (_hostingWPCOM) {
      console.log("wp is hosted on wp.com");
      url = `https://public-api.wordpress.com/wp/v2/sites/${baseUrl}`;
      _accessToken = yield getWPCOMAccessToken(_auth);
    } else {
      url = `${_siteURL}/wp-json`;

      if (shouldUseJwt(_auth)) {
        _accessToken = yield getJWToken(_auth, url);
      }
    }

    if (_verbose) {
      console.time(`=END PLUGIN=====================================`);
      const authOutput = formatAuthSettings(_auth);
      console.log(colorized.out(`
=START PLUGIN=====================================

Site URL: ${_siteURL}
Site hosted on Wordpress.com: ${_hostingWPCOM}
Using ACF: ${_useACF}
Auth: ${authOutput ? `\n${authOutput}` : `false`}
Verbose output: ${_verbose}

Mama Route URL: ${url}
`, colorized.color.Font.FgBlue));
    } // Call the main API Route to discover the all the routes exposed on this API.


    let allRoutes;

    try {
      let options = {
        method: `get`,
        url: url
      };      

      if (_accessToken) {
        options.headers = {
          Authorization: `Bearer ${_accessToken}`
        };
        console.log("authOptionHeader", options)
      }

      allRoutes = yield axios(options);
    } catch (e) {
      httpExceptionHandler(e);
    }

    let entities = [{
      __type: `wordpress__site_metadata`,
      name: allRoutes.data.name,
      description: allRoutes.data.description,
      url: allRoutes.data.url,
      home: allRoutes.data.home
    }];

    if (allRoutes) {
      let validRoutes = getValidRoutes({
        allRoutes,
        url,
        _verbose,
        _useACF,
        _acfOptionPageIds,
        _includedRoutes,
        _excludedRoutes,
        typePrefix,
        refactoredEntityTypes
      });

      if (_verbose) {
        console.log(colorized.out(`
Fetching the JSON data from ${validRoutes.length} valid API Routes...
`, colorized.color.Font.FgBlue));
      }

      for (var _iterator = validRoutes, _isArray = Array.isArray(_iterator), _i2 = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref;

        if (_isArray) {
          if (_i2 >= _iterator.length) break;
          _ref = _iterator[_i2++];
        } else {
          _i2 = _iterator.next();
          if (_i2.done) break;
          _ref = _i2.value;
        }

        let route = _ref;
        entities = entities.concat((yield fetchData({
          route,
          _verbose,
          _perPage,
          _auth,
          _accessToken,
          _concurrentRequests
        })));
        if (_verbose) console.log(``);
      }

      if (_verbose) console.timeEnd(`=END PLUGIN=====================================`);
    } else {
      console.log(colorized.out(`No routes to fetch. Ending.`, colorized.color.Font.FgRed));
    }

    return entities;
  });
  return _fetch.apply(this, arguments);
}

function getWPCOMAccessToken(_x2) {
  return _getWPCOMAccessToken.apply(this, arguments);
}
/**
 * Gets JSON Web Token so it can fetch private data
 *
 * @returns
 */


function _getWPCOMAccessToken() {
  _getWPCOMAccessToken = (0, _asyncToGenerator2.default)(function* (_auth) {
    let result;
    const oauthUrl = `https://public-api.wordpress.com/oauth2/token`;

    try {
      let options = {
        url: oauthUrl,
        method: `post`,
        data: querystring.stringify({
          client_secret: _auth.wpcom_app_clientSecret,
          client_id: _auth.wpcom_app_clientId,
          username: _auth.wpcom_user,
          password: _auth.wpcom_pass,                 
          grant_type: `password`
        })
      };
      result = yield axios(options);
      console.log("authTokenResult", result)
      result = result.data.access_token;
    } catch (e) {
      httpExceptionHandler(e);
    }
    console.log("authTokenResult", result)
    return result;
  });
  return _getWPCOMAccessToken.apply(this, arguments);
}

function getJWToken(_x3, _x4) {
  return _getJWToken.apply(this, arguments);
}
/**
 * Fetch the data from specified route url, using the auth provided.
 *
 * @param {any} route
 * @param {any} createNode
 */


function _getJWToken() {
  _getJWToken = (0, _asyncToGenerator2.default)(function* (_auth, url) {
    let result;
    let authUrl = `${url}/jwt-auth/v1/token`;

    try {
      const options = {
        url: authUrl,
        method: `post`,
        data: {
          username: _auth.jwt_user,
          password: _auth.jwt_pass
        }
      };
      result = yield axios(options);
      result = result.data.token;
    } catch (e) {
      httpExceptionHandler(e);
    }

    return result;
  });
  return _getJWToken.apply(this, arguments);
}

function fetchData(_x5) {
  return _fetchData.apply(this, arguments);
}
/**
 * Get the pages of data
 *
 * @param {any} url
 * @param {number} [page=1]
 * @returns
 */


function _fetchData() {
  _fetchData = (0, _asyncToGenerator2.default)(function* ({
    route,
    _verbose,
    _perPage,
    _auth,
    _accessToken,
    _concurrentRequests
  }) {
    const type = route.type,
          url = route.url,
          optionPageId = route.optionPageId;

    if (_verbose) {
      console.log(colorized.out(`=== [ Fetching ${type} ] ===`, colorized.color.Font.FgBlue), url);
      console.time(`Fetching the ${type} took`);
    }

    let routeResponse = yield getPages({
      url,
      _perPage,
      _auth,
      _accessToken,
      _verbose,
      _concurrentRequests
    });
    let entities = [];

    if (routeResponse) {
      // Process entities to creating GraphQL Nodes.
      if (Array.isArray(routeResponse)) {
        routeResponse = routeResponse.map(r => {
          return Object.assign({}, r, optionPageId ? {
            __acfOptionPageId: optionPageId
          } : {}, {
            __type: type
          });
        });
        entities = entities.concat(routeResponse);
      } else {
        routeResponse.__type = type;

        if (optionPageId) {
          routeResponse.__acfOptionPageId = optionPageId;
        }

        entities.push(routeResponse);
      } // WordPress exposes the menu items in meta links.


      if (type == `wordpress__wp_api_menus_menus`) {
        for (var _iterator2 = routeResponse, _isArray2 = Array.isArray(_iterator2), _i3 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
          var _ref2;

          if (_isArray2) {
            if (_i3 >= _iterator2.length) break;
            _ref2 = _iterator2[_i3++];
          } else {
            _i3 = _iterator2.next();
            if (_i3.done) break;
            _ref2 = _i3.value;
          }

          let menu = _ref2;

          if (menu.meta && menu.meta.links && menu.meta.links.self) {
            entities = entities.concat((yield fetchData({
              route: {
                url: menu.meta.links.self,
                type: `${type}_items`
              },
              _verbose,
              _perPage,
              _auth,
              _accessToken
            })));
          }
        }
      } // TODO : Get the number of created nodes using the nodes in state.


      let length;

      if (routeResponse && Array.isArray(routeResponse)) {
        length = routeResponse.length;
      } else if (routeResponse && !Array.isArray(routeResponse)) {
        length = Object.keys(routeResponse).length;
      }

      console.log(colorized.out(` -> ${type} fetched : ${length}`, colorized.color.Font.FgGreen));
    }

    if (_verbose) {
      console.timeEnd(`Fetching the ${type} took`);
    }

    return entities;
  });
  return _fetchData.apply(this, arguments);
}

function getPages(_x6) {
  return _getPages.apply(this, arguments);
}
/**
 * Check a route against the whitelist or blacklist
 * to determine validity.
 *
 * @param {any} routePath
 * @param {Array} routeList
 * @returns {boolean}
 */


function _getPages() {
  _getPages = (0, _asyncToGenerator2.default)(function* ({
    url,
    _perPage,
    _auth,
    _accessToken,
    _concurrentRequests,
    _verbose
  }, page = 1) {
    try {
      let result = [];

      const getOptions = page => {
        let o = {
          method: `get`,
          url: `${url}?${querystring.stringify({
            per_page: _perPage,
            page: page
          })}`
        };

        if (_accessToken) {
          o.headers = {
            Authorization: `Bearer ${_accessToken}`
          };
        }        

        return o;
      }; // Initial request gets the first page of data
      // but also the total count of objects, used for
      // multiple concurrent requests (rather than waterfall)


      const options = getOptions(page);

      const _ref3 = yield axios(options),
            headers = _ref3.headers,
            data = _ref3.data;

      result = result.concat(data); // Some resources have no paging, e.g. `/types`

      const wpTotal = headers[`x-wp-total`];
      const total = parseInt(wpTotal);
      const totalPages = parseInt(headers[`x-wp-totalpages`]);

      if (!wpTotal || totalPages <= 1) {
        return result;
      }

      if (_verbose) {
        console.log(`
Total entities : ${total}
Pages to be requested : ${totalPages}`);
      } // We got page 1, now we want pages 2 through totalPages


      const pageOptions = _.range(2, totalPages + 1).map(getPage => getOptions(getPage));

      const pages = yield requestInQueue(pageOptions, {
        concurrent: _concurrentRequests
      });
      const pageData = pages.map(page => page.data);
      pageData.forEach(list => {
        result = result.concat(list);
      });
      return result;
    } catch (e) {
      return httpExceptionHandler(e);
    }
  });
  return _getPages.apply(this, arguments);
}

function checkRouteList(routePath, routeList) {
  //console.log("routePath", routePath) //debug rzilahi
  //console.log("routeList", routeList) //debug rzilahi
  return routeList.some(route => minimatch(routePath, route));
}
/**
 * Extract valid routes and format its data.
 *
 * @param {any} allRoutes
 * @param {any} url
 * @returns
 */


function getValidRoutes({
  allRoutes,
  url,
  _verbose,
  _useACF,
  _acfOptionPageIds,
  _hostingWPCOM,
  _includedRoutes,
  _excludedRoutes,
  typePrefix,
  refactoredEntityTypes
}) {
  let validRoutes = [];

  if (_useACF) {
    let defaultAcfNamespace = `acf/v3`; // Grab ACF Version from namespaces

    const acfNamespace = allRoutes.data.namespaces.find(namespace => namespace.includes(`acf`));
    const acfRestNamespace = acfNamespace ? acfNamespace : defaultAcfNamespace;

    _includedRoutes.push(`/${acfRestNamespace}/**`);

    if (_verbose) console.log(colorized.out(`Detected ACF to REST namespace: ${acfRestNamespace}.`, colorized.color.Font.FgGreen)); // The OPTIONS ACF API Route is not giving a valid _link so let`s add it manually
    // and pass ACF option page ID
    // ACF to REST v3 requires options/options

    let optionsRoute = acfRestNamespace.includes(`3`) ? `options/options/` : `options/`;
    validRoutes.push({
      url: `${url}/${acfRestNamespace}/${optionsRoute}`,
      type: `${typePrefix}acf_options`
    }); // ACF to REST V2 does not allow ACF Option Page ID specification

    if (_acfOptionPageIds.length > 0 && acfRestNamespace.includes(`3`)) {
      _acfOptionPageIds.forEach(function (acfOptionPageId) {
        validRoutes.push({
          url: `${url}/acf/v3/options/${acfOptionPageId}`,
          type: `${typePrefix}acf_options`,
          optionPageId: acfOptionPageId
        });
      });

      if (_verbose) console.log(colorized.out(`Added ACF Options route(s).`, colorized.color.Font.FgGreen));
    }

    if (_acfOptionPageIds.length > 0 && _hostingWPCOM) {
      // TODO : Need to test that out with ACF on Wordpress.com hosted site. Need a premium account on wp.com to install extensions.
      if (_verbose) console.log(colorized.out(`The ACF options pages is untested under wordpress.com hosting. Please let me know if it works.`, colorized.color.Effect.Blink));
    }
  }

  var _arr = Object.keys(allRoutes.data.routes);

  for (var _i = 0; _i < _arr.length; _i++) {
    let key = _arr[_i];
    if (_verbose) console.log(`Route discovered :`, key);
    let route = allRoutes.data.routes[key]; // A valid route exposes its _links (for now)

    if (route._links) {
      const entityType = getRawEntityType(key); // Excluding the "technical" API Routes

      const excludedTypes = [`/v2/**`, `/v3/**`, `**/1.0`, `**/2.0`, `**/embed`, `**/proxy`, `/`, `/jwt-auth/**`];
      const routePath = getRoutePath(url, key);
      const whiteList = _includedRoutes;
      const blackList = [...excludedTypes, ..._excludedRoutes]; // Check whitelist first      
      const inWhiteList = checkRouteList(routePath, whiteList); // Then blacklist
      // console.log(inWhiteList) //debug rzilahi
      const inBlackList = checkRouteList(routePath, blackList);
      const validRoute = inWhiteList && !inBlackList;

      if (validRoute) {
        if (_verbose) console.log(colorized.out(`Valid route found. Will try to fetch.`, colorized.color.Font.FgGreen));
        const manufacturer = getManufacturer(route);
        let rawType = ``;

        if (manufacturer === `wp`) {
          rawType = `${typePrefix}${entityType}`;
        }

        let validType;

        switch (rawType) {
          case `${typePrefix}posts`:
            validType = refactoredEntityTypes.post;
            break;

          case `${typePrefix}pages`:
            validType = refactoredEntityTypes.page;
            break;

          case `${typePrefix}tags`:
            validType = refactoredEntityTypes.tag;
            break;

          case `${typePrefix}categories`:
            validType = refactoredEntityTypes.category;
            break;

          default:
            validType = `${typePrefix}${manufacturer.replace(/-/g, `_`)}_${entityType.replace(/-/g, `_`)}`;
            break;
        }

        validRoutes.push({
          url: buildFullUrl(url, key),
          type: validType
        });
      } else {
        if (_verbose) {
          const invalidType = inBlackList ? `blacklisted` : `not whitelisted`;
          //console.log(colorized.out(`Excluded route: ${invalidType}`, colorized.color.Font.FgYellow));
        }
      }
    } else {
      if (_verbose) console.log(colorized.out(`Invalid route: detail route`, colorized.color.Font.FgRed));
    }
  }

  return validRoutes;
}
/**
 * Extract the raw entity type from fullPath
 *
 * @param {any} full path to extract raw entity from
 */


const getRawEntityType = fullPath => fullPath.substring(fullPath.lastIndexOf(`/`) + 1, fullPath.length);
/**
 * Extract the route path for an endpoint
 *
 * @param {any} baseUrl The base site URL that should be removed
 * @param {any} fullPath The full path to retrieve the route path from
 */


const getRoutePath = (baseUrl, fullPath) => {
  const baseUrlObj = new URL(baseUrl);
  const basePath = baseUrlObj.pathname;
  return fullPath.replace(basePath, ``);
};
/**
 * Build full URL from baseUrl and fullPath
 *
 * @param {any} baseUrl The base site URL that should be prepended to full path
 * @param {any} fullPath The full path to build URL from
 */


const buildFullUrl = (baseUrl, fullPath) => {
  const baseUrlObj = new URL(baseUrl);
  const baseOrigin = baseUrlObj.origin;
  
  return `${baseOrigin}${fullPath}`;
};
/**
 * Extract the route manufacturer
 *
 * @param {any} route
 */


const getManufacturer = route => route.namespace.substring(0, route.namespace.lastIndexOf(`/`));

fetch.getRawEntityType = getRawEntityType;
fetch.getRoutePath = getRoutePath;
fetch.buildFullUrl = buildFullUrl;
module.exports = fetch;