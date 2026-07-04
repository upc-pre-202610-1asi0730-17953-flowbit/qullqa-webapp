import { ProductCategory } from '../domain/model/product.entity.js';

/**
 * Fixed categories in their intended display order, excluding OTHER — OTHER
 * (and any custom category, see below) always sorts last, since it's the
 * catch-all/most-recently-created bucket, not a primary grouping.
 * @type {string[]}
 */
const BASE_CATEGORY_ORDER = [
    ProductCategory.DAIRY,
    ProductCategory.GRAINS,
    ProductCategory.OILS,
    ProductCategory.BEVERAGES,
    ProductCategory.CLEANING,
    ProductCategory.MEDICINE
];

/**
 * Returns true when a category value is a custom label the admin typed in
 * (i.e. anything outside the fixed ProductCategory enum), rather than a
 * predefined category.
 * @param {string} category
 * @returns {boolean}
 */
export function isCustomCategory(category) {
    return !Object.values(ProductCategory).includes(category);
}

/**
 * Builds the full category option list — fixed categories, then every
 * distinct custom category currently in use (sorted by first appearance),
 * then OTHER last — so once an admin creates a custom category (e.g.
 * "Frutas y verduras"), it's immediately selectable everywhere a product's
 * category is chosen or filtered, without retyping it, and without ever
 * sorting below OTHER.
 * @param {Array<{category: string}>} products
 * @returns {string[]}
 */
export function orderedCategoryOptions(products) {
    const customCategories = [...new Set(
        products.map(product => product.category).filter(isCustomCategory)
    )];
    return [...BASE_CATEGORY_ORDER, ...customCategories, ProductCategory.OTHER];
}
