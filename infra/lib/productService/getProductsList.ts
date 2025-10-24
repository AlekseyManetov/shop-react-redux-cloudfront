import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ScanCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Product, Stock, ProductWithStock } from "./types";

const AWS_REGION = process.env.AWS_REGION;
const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME;
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME;

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export async function getProductsList() {
    try {
        // Scan products table
        const productsCommand = new ScanCommand({
            TableName: PRODUCTS_TABLE_NAME,
        });
        const productsResult = await docClient.send(productsCommand);
        const products: Product[] = productsResult.Items as Product[] || [];

        // Scan stock table
        const stockCommand = new ScanCommand({
            TableName: STOCK_TABLE_NAME,
        });
        const stockResult = await docClient.send(stockCommand);
        const stock: Stock[] = stockResult.Items as Stock[] || [];

        // Create a map of product_id to count for efficient lookup
        const stockMap = new Map<string, number>();
        stock.forEach(item => {
            stockMap.set(item.product_id, item.count);
        });

        // Join products with stock
        const productsWithStock: ProductWithStock[] = products.map(product => ({
            id: product.id,
            title: product.title,
            description: product.description,
            price: product.price,
            count: stockMap.get(product.id) || 0,
        }));

        return productsWithStock;
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
}