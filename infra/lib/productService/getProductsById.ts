import {carData} from "./data";

export async function getProductById(event?: { pathParameters?: { productId?: string } } | { productId?: string }) {
    const productId = (event as any)?.pathParameters?.productId ?? (event as any)?.productId;

    if (!productId) {
        return { message: "productId path parameter is required" };
    }

    const product = carData.find((item) => item.id === productId);

    if (!product) {
        return { message: "Product not found" };
    }

    return product;
}