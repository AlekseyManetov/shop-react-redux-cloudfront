import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Product, Stock, ProductWithStock } from "./types";

const AWS_REGION = process.env.AWS_REGION;
const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME;
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME;

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export async function getProductById(event?: { pathParameters?: { productId?: string } } | { productId?: string }) {
    try {
        const productId = (event as any)?.pathParameters?.productId ?? (event as any)?.productId;

        if (!productId) {
            throw new Error("productId path parameter is required");
        }

        // Get product from products table
        const productCommand = new GetCommand({
            TableName: PRODUCTS_TABLE_NAME,
            Key: { id: productId },
        });
        const productResult = await docClient.send(productCommand);

        if (!productResult.Item) {
            throw new Error("Product not found");
        }

        const product: Product = productResult.Item as Product;

        // Get stock information
        const stockCommand = new GetCommand({
            TableName: STOCK_TABLE_NAME,
            Key: { product_id: productId },
        });
        const stockResult = await docClient.send(stockCommand);

        const stock: Stock = stockResult.Item as Stock;
        const count = stock ? stock.count : 0;

        // Combine product with stock information
        const productWithStock: ProductWithStock = {
            id: product.id,
            title: product.title,
            description: product.description,
            price: product.price,
            count: count,
        };

        return productWithStock;
    } catch (error) {
        console.error('Error fetching product:', error);
        throw error;
    }
}