import { URL_PARAM_EXP, BRACES_EXP } from '../api/constants';

/**
 * Get a versioned endpoint URL
 * @param {string} endpoint - Endpoint URL (ie "someEndpoint/{someId}")
 * @param {Number} version - Endpoint version (ie 1.1)
 * @returns {string} - Versioned endpoint (ie "v1.1/someEndpoint/{someId}")
 */
export function getEndpointWithVersion(endpoint, version) {
  return `api/v${version.toFixed(1)}/${endpoint}`;
}

/**
 * Get an object with URL and query parameters.
 * If the queryParams object contains keys found in the URL string,
 * those will be inserted into the new URL string and removed from the new params object.
 * @param {string} url - URL
 * @param {Object} queryParams - Query parameters object
 * @returns {Object} - An object containing the URL and parameters
 */
export function getUrlAndParams(url, queryParams) {
  const fallback = { url, params: queryParams };

  if (!queryParams) return fallback;

  const urlParamTemplates = url.match(URL_PARAM_EXP);

  if (urlParamTemplates?.length) {
    return urlParamTemplates.reduce(
      (acc, paramTemplate) => {
        const paramName = paramTemplate.replace(BRACES_EXP, '');

        const paramValue = queryParams[paramName];
        if (!paramValue) {
          acc.params[paramName] = queryParams[paramName];
        } else {
          delete acc.params[paramName];
          acc.url = acc.url.replace(
            new RegExp(paramTemplate, 'g'),
            `/${paramValue}`,
          );
        }

        return acc;
      },
      {
        url,
        params: { ...queryParams },
      },
    );
  }

  return fallback;
}
