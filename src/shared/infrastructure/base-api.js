import axios from 'axios';

const platformApiUrl = import.meta.env.VITE_QULLQA_API_BASE_URL;

/**
 * Shared infrastructure base class that configures the Axios HTTP client.
 * All bounded-context API classes extend this class to inherit the HTTP client.
 *
 * @class BaseApi
 */
export class BaseApi {
    /**
     * @private
     * Axios HTTP client instance configured with the platform API base URL.
     * @type {import('axios').AxiosInstance}
     */
    #http;

    /**
     * Initializes the Axios HTTP client with the base URL from environment variables
     * and default JSON headers.
     */
    constructor() {
        this.#http = axios.create({
            baseURL: platformApiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    /**
     * Returns the configured Axios HTTP client instance.
     * @returns {import('axios').AxiosInstance} The Axios HTTP client.
     */
    get http() {
        return this.#http;
    }
}
