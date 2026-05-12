import { WarehouseStock } from '../domain/model/warehouse-stock.entity.js';

/**
 * Maps raw API resources into WarehouseStock domain entities.
 * @class WarehouseStockAssembler
 */
export class WarehouseStockAssembler {
    /**
     * @param {Object} resource
     * @returns {WarehouseStock}
     */
    static toEntityFromResource(resource) {
        return new WarehouseStock({ ...resource });
    }

    /**
     * @param {import('axios').AxiosResponse} response
     * @returns {WarehouseStock[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) {
            console.error(`WarehouseStockAssembler error — status: ${response.status}, message: ${response.statusText}`);
            return [];
        }
        const resources = response.data instanceof Array ? response.data : response.data['inventories'];
        return resources.map(resource => this.toEntityFromResource(resource));
    }
}